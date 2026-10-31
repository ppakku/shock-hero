// 공포 모드 소리. 파일 없이 합성한다.
import { sfx } from '../audio/sfx.js';
import { cfg } from '../config/index.js';
import { heartInterval } from '../logic/horrorStalker.js';

const DRONE = [82.41, 82.9, 123.47]; // 살짝 어긋난 낮은 음이 천천히 울렁인다
const PAD = [155.56, 164.81]; // 반음이 부딪혀 불안하게 들린다
const NOTES = [196, 207.65, 293.66, 311.13, 392]; // 어둠 속에서 가끔 울리는 쇳소리 음
const CLANG = [310, 467, 811]; // 멀리서 쇠가 부딪히는 소리
// 세이노 소리 크기와 간격. 숨소리는 작은 태블릿 스피커에 들리도록 300Hz 위 대역만 쓴다.
const BREATH_LEVEL = { patrol: 0.5, investigate: 0.6, search: 0.6, chase: 1.1, stunned: 0.2 };
const SWELL_SEC = { patrol: 1.4, investigate: 1.4, search: 1.4, chase: 0.7, stunned: 1.4 };
const STEP_EVERY = { patrol: 0.75, investigate: 0.75, search: 0.75, chase: 0.42, stunned: 0 };

export class HorrorAudio {
  constructor({ muted }) {
    sfx.unlock();
    this.ctx = sfx.ctx;
    this.k = cfg.horror;
    this.loops = [];
    this.noteT = this.k.musicNoteMin / 2;
    this.clangT = this.k.musicClangMin;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out = this.ctx.createGain();
    this.out.gain.value = muted ? 0 : 1;
    this.out.connect(sfx.master);
    // 처음에는 조용했다가 어둠과 함께 차오른다
    this.music = this.ctx.createGain();
    this.music.gain.setValueAtTime(0.001, t);
    this.music.gain.exponentialRampToValueAtTime(this.k.musicVolume, t + 4);
    this.music.connect(this.out);
    // 넓은 공장처럼 들리게 하는 메아리
    this.echo = this.ctx.createDelay(1);
    this.echo.delayTime.value = 0.55;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.45;
    const dull = this.ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 1400;
    this.echo.connect(dull).connect(feedback).connect(this.echo);
    dull.connect(this.music);
    this.echoLoop = [this.echo, dull, feedback];

    this.addTones(DRONE, 'sawtooth', 0.09, 420, 0.07, 160);
    this.addTones(PAD, 'triangle', 0.05, 900, 0.11, 200);
    this.addWind();
    this.initCreature();
  }

  // 세이노: 숨소리 반복음과 방향이 들리는 소리 길. 가까이 오기 전에도 들리도록 멀리까지 감쇠를 약하게 둔다.
  initCreature() {
    this.stepT = 0;
    this.heartT = 0;
    this.mode = 'patrol';
    this.suspended = false;
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 6;
    this.panner.rolloffFactor = 1;
    this.panner.connect(this.out);

    const breath = this.ctx.createBufferSource();
    breath.buffer = sfx.noise;
    breath.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1300;
    band.Q.value = 1.1; // 900~1800Hz 쯤이 넓게 남는다
    this.swell = this.ctx.createGain();
    this.swell.gain.value = 0.5;
    this.breathLevel = this.ctx.createGain();
    this.breathLevel.gain.value = 0;
    breath.connect(band).connect(this.swell).connect(this.breathLevel).connect(this.panner);
    breath.start();
    // 들숨 날숨: 이득이 천천히 오르내린다
    this.swellLfo = this.ctx.createOscillator();
    this.swellLfo.frequency.value = 1 / SWELL_SEC.patrol;
    const depth = this.ctx.createGain();
    depth.gain.value = 0.5;
    this.swellLfo.connect(depth).connect(this.swell.gain);
    this.swellLfo.start();
    this.loops.push(breath, band, this.swell, this.breathLevel, this.swellLfo, depth, this.panner);
  }

  // 한 번 나는 짧은 소리. 오실레이터 하나가 높이를 미끄러뜨리며 사라진다.
  blip(dest, { freq, dur, vol, type = 'sine', slide = 0.5, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 필터를 거친 잡음 한 번
  puffNoise(dest, { dur, vol, freq, freqTo = null, type = 'bandpass', q = 1, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = sfx.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // 발톱 걸음: 마른 긁는 소리와 딱 하는 소리
  footstep() {
    if (!this.ctx || this.suspended) return;
    this.puffNoise(this.panner, { dur: 0.09, vol: 1.3, freq: 3200, freqTo: 1800, q: 1.5 });
    this.puffNoise(this.panner, { dur: 0.05, vol: 1.0, freq: 5200, q: 2, delay: 0.07 });
    this.blip(this.panner, { freq: 900, dur: 0.04, vol: 0.5, type: 'square', slide: 0.5 });
  }

  // 두근두근. 120~180Hz 성분을 더해 작은 스피커에도 들린다.
  heartbeat() {
    this.blip(this.out, { freq: 58, dur: 0.16, vol: 0.5 });
    this.blip(this.out, { freq: 150, dur: 0.12, vol: 0.4, slide: 0.7 });
    this.blip(this.out, { freq: 54, dur: 0.18, vol: 0.4, delay: 0.17 });
    this.blip(this.out, { freq: 130, dur: 0.12, vol: 0.3, slide: 0.7, delay: 0.17 });
  }

  play(name) {
    if (!this.ctx) return;
    const o = this.out;
    if (name === 'fuse') this.blip(o, { freq: 880, dur: 0.18, vol: 0.2, type: 'triangle', slide: 1.5 });
    if (name === 'door') {
      this.blip(o, { freq: 140, dur: 0.5, vol: 0.5, type: 'sawtooth' });
      this.puffNoise(o, { dur: 0.4, vol: 0.4, freq: 900, freqTo: 200, type: 'lowpass' });
    }
    if (name === 'punch') {
      this.puffNoise(o, { dur: 0.12, vol: 0.5, freq: 2200, q: 0.8 });
      this.blip(o, { freq: 180, dur: 0.12, vol: 0.4, type: 'triangle', slide: 0.5 });
    }
    if (name === 'scare') {
      // 올라가는 거친 숨소리
      this.puffNoise(o, { dur: 0.9, vol: 1.1, freq: 700, freqTo: 2400, q: 2.5 });
      this.blip(o, { freq: 95, dur: 0.9, vol: 0.7, slide: 0.6 });
    }
    if (name === 'caught') {
      this.puffNoise(o, { dur: 1.2, vol: 1.2, freq: 600, freqTo: 3000, q: 3 });
      this.blip(o, { freq: 150, dur: 1.1, vol: 0.8, slide: 0.4 });
    }
  }

  setPos(node, x, y, z) {
    if (node.positionX) {
      node.positionX.value = x;
      node.positionY.value = y;
      node.positionZ.value = z;
    } else node.setPosition(x, y, z);
  }

  // camera: 듣는 사람, stalkerPos: 미터 좌표 { x, y, z }, dist: 칸 단위 거리
  updateStalker(camera, stalkerPos, mode, dist, dt) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = camera.matrixWorld.elements;
    this.setPos(l, camera.position.x, camera.position.y, camera.position.z);
    if (l.forwardX) {
      l.forwardX.value = -e[8];
      l.forwardY.value = -e[9];
      l.forwardZ.value = -e[10];
      l.upX.value = e[4];
      l.upY.value = e[5];
      l.upZ.value = e[6];
    } else l.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
    this.setPos(this.panner, stalkerPos.x, stalkerPos.y, stalkerPos.z);
    const t = this.ctx.currentTime;
    if (mode !== this.mode) {
      this.mode = mode;
      this.swellLfo.frequency.setTargetAtTime(1 / (SWELL_SEC[mode] ?? 1.4), t, 0.2);
    }
    if (!this.suspended) this.breathLevel.gain.setTargetAtTime(BREATH_LEVEL[mode] ?? 0.5, t, 0.2);

    const every = STEP_EVERY[mode] ?? 0;
    this.stepT -= dt;
    if (every && this.stepT <= 0) {
      this.stepT = every;
      this.footstep();
    }
    const gap = heartInterval(dist, this.k);
    this.heartT -= dt;
    if (gap !== null && this.heartT <= 0) {
      this.heartT = gap;
      this.heartbeat();
    }
  }

  // 잡히는 장면: 숨소리와 발소리를 바로 끈다
  suspend() {
    this.suspended = true;
    if (this.ctx) this.breathLevel.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // 지속음 묶음. 필터가 천천히 열리고 닫혀서 숨 쉬듯 움직인다.
  addTones(freqs, type, vol, cutoff, lfoRate, lfoDepth) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    filter.connect(gain).connect(this.music);
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
      this.loops.push(osc);
    }
    this.addLfo(filter.frequency, lfoRate, lfoDepth);
    this.loops.push(filter, gain);
  }

  addWind() {
    const wind = this.ctx.createBufferSource();
    wind.buffer = sfx.noise;
    wind.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07;
    wind.connect(band).connect(gain).connect(this.music);
    wind.start();
    this.addLfo(band.frequency, 0.05, 180);
    this.loops.push(wind, band, gain);
  }

  addLfo(param, rate, depth) {
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(param);
    lfo.start();
    this.loops.push(lfo, amount);
  }

  // 한 번 울리고 사라지는 음
  ping(freq, dur, vol, dest) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(dest);
    gain.connect(this.echo);
    osc.start(t);
    osc.stop(t + dur);
  }

  note(rand) {
    const freq = NOTES[Math.floor(rand() * NOTES.length) % NOTES.length];
    this.ping(freq, 4, 0.1, this.music);
    this.ping(freq * 2.76, 1.6, 0.025, this.music); // 배음을 어긋나게 해서 쇠처럼 들린다
  }

  clang(rand) {
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = rand() * 1.6 - 0.8; // 어디서 났는지 몰라 더 불안하다
    pan.connect(this.music);
    CLANG.forEach((freq, i) => this.ping(freq * (0.9 + rand() * 0.2), 0.9 - i * 0.2, 0.09, pan));
  }

  gap(min, max, rand) {
    return min + rand() * (max - min);
  }

  update(dt, rand = Math.random) {
    if (!this.ctx) return;
    this.noteT -= dt;
    if (this.noteT <= 0) {
      this.noteT = this.gap(this.k.musicNoteMin, this.k.musicNoteMax, rand);
      this.note(rand);
    }
    this.clangT -= dt;
    if (this.clangT <= 0) {
      this.clangT = this.gap(this.k.musicClangMin, this.k.musicClangMax, rand);
      this.clang(rand);
    }
  }

  // 다른 탭으로 나가면 소리를 끈다
  setActive(on) {
    if (this.ctx) this.music.gain.setTargetAtTime(on ? this.k.musicVolume : 0.0001, this.ctx.currentTime, 0.1);
  }

  destroy() {
    if (!this.ctx) return;
    for (const node of this.loops) {
      node.stop?.();
      node.disconnect();
    }
    this.echoLoop.forEach((node) => node.disconnect());
    this.music.disconnect();
    this.out.disconnect();
  }
}
