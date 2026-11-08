// 수영장 판에서만 쓰는 것: 물소리, 물방울, 수건 걸이, 고무오리, 깊은 물의 눈높이.
// HorrorGame 은 맵에 물이 있을 때만 이것을 만든다. 계산은 logic/horrorWater.js 가 맡는다
import { createWet, stepWet, dry, waterNoise, waterSpeed, waterUnder, eyeIn, throwDuck, DRY, DEEP } from '../logic/horrorWater.js';
import { buildWater } from './water.js';

const SLOSH_EVERY = 0.45; // 물을 헤치는 소리 간격 (초)
const SWIM_EVERY = 0.75; // 헤엄치는 소리 간격 (초)
const DRIP_EVERY = 0.55; // 물방울 소리 간격 (초)
const RIPPLE_EVERY = { lurk: 1.6, swim: 0.3, crawl: 0 }; // 물괴물이 일으키는 물결 간격 (초). 0 은 없음
const EYE_RATE = 6; // 눈높이가 바뀌는 빠르기

export class PoolPlay {
  constructor({ root, scene, map, k, eye }) {
    this.map = map;
    this.k = k;
    this.kw = k.water;
    this.baseEye = eye;
    this.eye = eye;
    this.water = buildWater(scene, map);
    this.wet = createWet();
    this.used = new Set(); // 쓴 수건 걸이
    this.ducks = map.ducks.map((c) => ({ ...c }));
    this.holding = -1; // 손에 든 고무오리 번호
    this.splash = null; // 이번 프레임에 고무오리가 떨어진 물소리
    this.soundT = 0;
    this.dripT = 0;
    this.ripples = [];
    this.ducks.forEach((c, i) => this.water.setDuck(i, c));
    // 젖은 동안 화면 가장자리에 물방울이 맺힌다
    this.drops = document.createElement('div');
    this.drops.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .4s;'
      + 'background:radial-gradient(circle at 8% 12%,rgba(220,240,255,.55) 0 1.2%,transparent 1.6%),radial-gradient(circle at 92% 20%,rgba(220,240,255,.5) 0 1%,transparent 1.4%),'
      + 'radial-gradient(circle at 15% 85%,rgba(220,240,255,.5) 0 1.6%,transparent 2%),radial-gradient(circle at 86% 78%,rgba(220,240,255,.45) 0 1.3%,transparent 1.7%),'
      + 'radial-gradient(circle at 50% 4%,rgba(220,240,255,.4) 0 .8%,transparent 1.1%),radial-gradient(ellipse at center,transparent 62%,rgba(200,230,250,.35) 100%)';
    root.appendChild(this.drops);
  }

  get textures() {
    return this.water.textures;
  }

  speedScale(p) {
    return waterSpeed(waterUnder(this.map, p), this.kw);
  }

  // 한 프레임. 물괴물이 듣는 소리 거리 (칸) 를 돌려준다. 소리는 플레이어에게도 들려서 규칙을 알 수 있다
  step(p, moving, running, dt, audio) {
    const before = this.wet.level;
    const level = waterUnder(this.map, p);
    stepWet(this.wet, level, this.kw, dt);
    this.soundT -= dt;
    if (level > DRY && (moving || level === DEEP) && (this.soundT <= 0 || before === DRY)) {
      this.soundT = level === DEEP ? SWIM_EVERY : SLOSH_EVERY;
      audio?.play(level === DEEP ? 'swim' : 'slosh');
      this.water.ripple(p.x, p.y, level === DEEP ? 1.2 : 0.7);
    }
    if (level === DRY && this.wet.dripT > 0) {
      this.dripT -= dt;
      if (this.dripT <= 0) {
        this.dripT = DRIP_EVERY;
        audio?.play('drip');
      }
    }
    this.drops.style.opacity = String(Math.min(1, this.wet.dripT / 2 + (level > DRY ? 0.6 : 0)));
    return waterNoise(this.wet, moving, running, this.kw);
  }

  // 고무오리가 떨어진 물소리는 한 프레임만 들린다
  takeSplash() {
    const s = this.splash;
    this.splash = null;
    return s;
  }

  // 가까이 있는 수건 걸이나 고무오리. 오리를 들고 있고 다른 할 일이 없으면 던지기다
  target(p) {
    let best = null;
    let bestD = this.k.useRange;
    const near = (c) => Math.hypot(c.cx + 0.5 - p.x, c.cy + 0.5 - p.y);
    this.map.towels.forEach((c, i) => {
      const d = near(c);
      if (!this.used.has(i) && d <= bestD) {
        bestD = d;
        best = { kind: 'towel', index: i, label: '수건으로 닦기' };
      }
    });
    if (this.holding < 0) {
      this.ducks.forEach((c, i) => {
        const d = c && near(c);
        if (c && d <= bestD) {
          bestD = d;
          best = { kind: 'duck', index: i, label: '고무오리 줍기' };
        }
      });
    }
    return best ?? (this.holding >= 0 ? { kind: 'throw', index: this.holding, label: '고무오리 던지기' } : null);
  }

  // 수영장 일이면 처리하고 true
  use(t, p, yaw, audio, hud) {
    if (t?.kind === 'towel') {
      this.used.add(t.index);
      this.water.setTowel(t.index, false);
      dry(this.wet);
      audio?.play('towel');
      hud.say('몸을 닦았다. 이제 물방울 소리가 나지 않아', 3);
      return true;
    }
    if (t?.kind === 'duck') {
      this.holding = t.index;
      this.ducks[t.index] = null;
      this.water.setDuck(t.index, null);
      hud.say('고무오리를 주웠다. 물에 던지면 그쪽으로 소리가 난다', 4);
      return true;
    }
    if (t?.kind === 'throw') {
      const r = throwDuck(this.map, p, yaw, this.kw.duckRange);
      if (!r) {
        hud.say('앞이 막혀서 던질 수 없어', 2);
        return true;
      }
      this.ducks[this.holding] = r.cell;
      this.water.setDuck(this.holding, r.cell);
      this.holding = -1;
      if (r.splash) {
        this.splash = { x: r.cell.cx + 0.5, y: r.cell.cy + 0.5, range: this.kw.hear.duck };
        this.water.ripple(this.splash.x, this.splash.y, 1.4);
        audio?.play('plop');
      } else hud.say('마른 바닥에 떨어졌다. 물에 떨어져야 소리가 난다', 3);
      return true;
    }
    return false;
  }

  // 잡혔다가 돌아오면 몸은 마르고, 들고 있던 오리는 처음 자리로 돌아간다
  reset() {
    dry(this.wet);
    if (this.holding >= 0) {
      this.ducks[this.holding] = { ...this.map.ducks[this.holding] };
      this.water.setDuck(this.holding, this.ducks[this.holding]);
      this.holding = -1;
    }
    this.drops.style.opacity = '0';
  }

  // swimmers: 물괴물 상태들. 물속에서 움직이면 물결, 가라앉아 떠돌면 거품 물결이 인다
  update(t, dt, swimmers, p) {
    const level = waterUnder(this.map, p);
    this.eye += (eyeIn(level, this.baseEye, this.kw) - this.eye) * Math.min(1, dt * EYE_RATE);
    swimmers.forEach((s, i) => {
      const wet = waterUnder(this.map, s) > DRY;
      const kind = !wet ? 'crawl' : s.mode === 'patrol' ? 'lurk' : 'swim';
      const every = RIPPLE_EVERY[kind];
      this.ripples[i] = (this.ripples[i] ?? 0) - dt;
      if (every && this.ripples[i] <= 0 && s.mode !== 'stunned') {
        this.ripples[i] = every;
        this.water.ripple(s.x, s.y, kind === 'lurk' ? 0.5 : 1);
      }
    });
    this.water.update(t, dt);
  }

  destroy() {
    this.drops.remove();
  }
}
