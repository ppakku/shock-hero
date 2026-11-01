// 공포 모드 소리. 파일 없이 합성한다.
import { sfx } from '../audio/sfx.js';
import { cfg } from '../config/index.js';
import { heartInterval } from '../logic/horrorStalker.js';

const DRONE = [82.41, 82.9, 123.47]; // 살짝 어긋난 낮은 음이 천천히 울렁인다
const PAD = [155.56, 164.81]; // 반음이 부딪혀 불안하게 들린다
const NOTES = [196, 207.65, 293.66, 311.13, 392]; // 어둠 속에서 가끔 울리는 쇳소리 음
const CLANG = [310, 467, 811]; // 멀리서 쇠가 부딪히는 소리
const HUM = [98, 147.5]; // 충전된 전기충격기의 웅웅거림
const CRACKLE = 5; // 맞혔을 때 이어지는 지지직 수
export class HorrorAudio {
  constructor({ muted, voice = 'seino' }) {
    sfx.unlock();
    this.ctx = sfx.ctx;
    this.k = cfg.horror;
    this.loops = [];
    this.noteT = this.k.musicNoteMin / 2;
    this.clangT = this.k.musicClangMin;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.out = this.ctx.createGain();
    this.muted = !!muted;
    this.out.gain.value = muted ? 0 : 1;
    // 소리가 겹쳐도 찢어지지 않게 눌러 준다
    this.comp = this.ctx.createDynamicsCompressor();
    this.out.connect(this.comp);
    this.comp.connect(sfx.master);
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
    this.creatureNodes = [];
    this.initCreature(voice);
    this.initHum();
  }

  // 충전된 동안 낮게 나는 웅웅거림. 떨림은 안쪽 이득에 걸어서 꺼진 동안 새어 나가지 않게 한다
  initHum() {
    this.humOn = false;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 620;
    band.Q.value = 0.8;
    const flutter = this.ctx.createGain();
    flutter.gain.value = 0.7;
    this.humLevel = this.ctx.createGain();
    this.humLevel.gain.value = 0;
    band.connect(flutter).connect(this.humLevel).connect(this.out);
    for (const freq of HUM) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(band);
      osc.start();
      this.loops.push(osc);
    }
    this.addLfo(flutter.gain, 17, 0.3);
    this.loops.push(band, flutter, this.humLevel);
  }

  setHum(on) {
    if (!this.ctx || on === this.humOn) return;
    this.humOn = on;
    this.humLevel.gain.setTargetAtTime(on ? this.k.stunGun.humVol : 0, this.ctx.currentTime, 0.08);
  }

  stopNodes(nodes) {
    for (const node of nodes) {
      node.stop?.();
      node.disconnect();
    }
  }

  // 괴물 소리: 숨소리 반복음과 방향이 들리는 소리 길. 가까이 오기 전에도 들리도록 멀리까지 감쇠를 약하게 둔다.
  initCreature(voice) {
    this.voice = voice;
    this.v = this.k.voices[voice] ?? this.k; // 세이노 값은 balance.horror 에 바로 있다
    this.stepT = 0;
    this.heartT = 0;
    this.mode = 'patrol';
    this.breathGoal = null; // 마지막으로 정한 숨소리 크기
    this.suspended = false;
    this.active = true;
    this.panner = this.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = this.k.stalkerRefDist;
    this.panner.rolloffFactor = 1;
    this.creatureOut = this.ctx.createGain(); // 추격 중에는 괴물 소리 전체를 키운다
    this.panner.connect(this.creatureOut);
    this.creatureOut.connect(this.out);

    const breath = this.ctx.createBufferSource();
    breath.buffer = sfx.noise;
    breath.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = this.v.breathFreq;
    band.Q.value = this.v.breathQ ?? 1.1; // 세이노는 900~1800Hz 쯤이 넓게 남는다
    this.swell = this.ctx.createGain();
    this.swell.gain.value = 0.5;
    this.breathLevel = this.ctx.createGain();
    this.breathLevel.gain.value = 0;
    breath.connect(band).connect(this.swell).connect(this.breathLevel).connect(this.panner);
    breath.start();
    // 들숨 날숨: 이득이 천천히 오르내린다
    this.swellLfo = this.ctx.createOscillator();
    this.swellLfo.frequency.value = 1 / this.v.breathSwellSec.patrol;
    const depth = this.ctx.createGain();
    depth.gain.value = 0.5;
    this.swellLfo.connect(depth).connect(this.swell.gain);
    this.swellLfo.start();
    this.creatureNodes.push(breath, band, this.swell, this.breathLevel, this.swellLfo, depth, this.panner, this.creatureOut);
    if (this.v.tone) this.addVoiceTone(this.v.tone);
  }

  // 숨소리와 함께 커졌다 작아지는 지속음. 숨소리 크기가 0 이면 함께 끊긴다
  addVoiceTone({ freqs, type, vol, cutoff }) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    filter.connect(gain).connect(this.swell);
    this.creatureNodes.push(filter, gain);
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
      this.creatureNodes.push(osc);
    }
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
    src.loop = true; // 버퍼가 0.5초라 그냥 두면 긴 소리가 잘린다. stop 시각에 끝난다
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

  // 세이노는 발톱 걸음: 마른 긁는 소리와 딱 하는 소리
  footstep() {
    if (!this.ctx || this.suspended) return;
    if (this.voice === 'gazer') return this.dragStep();
    if (this.voice === 'maw') return this.heavyStep();
    if (this.voice === 'mole') return this.digStep();
    this.puffNoise(this.panner, { dur: 0.09, vol: 1.3, freq: 3200, freqTo: 1800, q: 1.5 });
    this.puffNoise(this.panner, { dur: 0.05, vol: 1.0, freq: 5200, q: 2, delay: 0.07 });
    this.blip(this.panner, { freq: 900, dur: 0.04, vol: 0.5, type: 'square', slide: 0.5 });
  }

  // 눈뜬이는 발이 없다: 옷자락이 바닥을 쓸며 끌리는 소리
  dragStep() {
    this.puffNoise(this.panner, { dur: 0.32, vol: 1.1, freq: 1500, freqTo: 3400, q: 0.9 });
  }

  // 큰입이: 낮게 쿵 울리는 걸음. 가끔 긴 이빨이 딱딱 부딪힌다
  heavyStep() {
    this.blip(this.panner, { freq: 200, dur: 0.2, vol: 0.5, slide: 0.6 });
    this.puffNoise(this.panner, { dur: 0.14, vol: 0.8, freq: 700, freqTo: 260, type: 'lowpass' });
    if (Math.random() > 0.4) return;
    this.blip(this.panner, { freq: 2300, dur: 0.03, vol: 0.5, type: 'square', delay: 0.16 });
    this.blip(this.panner, { freq: 2000, dur: 0.03, vol: 0.45, type: 'square', delay: 0.26 });
  }

  // 땅속이: 흙을 파고 돌이 구르는 소리
  digStep() {
    this.puffNoise(this.panner, { dur: 0.2, vol: 1, freq: 520, freqTo: 180, type: 'lowpass' });
    this.blip(this.panner, { freq: 170, dur: 0.14, vol: 0.5, slide: 0.6 });
    if (Math.random() < 0.3) this.puffNoise(this.panner, { dur: 0.05, vol: 0.5, freq: 2600, q: 2, delay: 0.09 });
  }

  // 두근두근. 120~180Hz 성분을 더해 작은 스피커에도 들린다.
  heartbeat() {
    if (this.suspended) return;
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
    if (name === 'shockCharge') {
      // 치직 하며 전기가 차오른다
      this.blip(o, { freq: 220, dur: 0.4, vol: 0.22, type: 'sawtooth', slide: 3 });
      this.puffNoise(o, { dur: 0.35, vol: 0.4, freq: 1800, freqTo: 5200, q: 1.2 });
      this.blip(o, { freq: 1320, dur: 0.14, vol: 0.14, type: 'triangle', slide: 1.2, delay: 0.3 });
    }
    if (name === 'shockHit') {
      // 빠직: 큰 터짐에 짧은 지지직이 이어 붙는다
      this.puffNoise(o, { dur: 0.3, vol: 0.85, freq: 3800, freqTo: 900, q: 0.7 });
      this.blip(o, { freq: 95, dur: 0.32, vol: 0.6, type: 'sawtooth', slide: 0.5 });
      for (let i = 0; i < CRACKLE; i++) this.puffNoise(o, { dur: 0.035, vol: 0.5, freq: 3000 + i * 900, q: 3, delay: 0.06 + i * 0.055 });
    }
    if (name === 'shockMiss') {
      this.puffNoise(o, { dur: 0.14, vol: 0.4, freq: 4200, freqTo: 1800, q: 1.2 });
      this.blip(o, { freq: 140, dur: 0.1, vol: 0.2, type: 'sawtooth', slide: 0.6 });
    }
    if (name === 'shockEmpty') {
      this.blip(o, { freq: 1600, dur: 0.03, vol: 0.22, type: 'square', slide: 0.6 });
      this.blip(o, { freq: 900, dur: 0.03, vol: 0.16, type: 'square', slide: 0.6, delay: 0.06 });
    }
    if (name === 'erupt') {
      // 바닥이 터지며 돌이 튄다
      this.blip(o, { freq: 120, dur: 0.6, vol: 0.7, type: 'sawtooth', slide: 0.4 });
      this.puffNoise(o, { dur: 0.7, vol: 0.8, freq: 2400, freqTo: 300, type: 'lowpass' });
      for (let i = 0; i < CRACKLE; i++) this.puffNoise(o, { dur: 0.05, vol: 0.4, freq: 1800 + i * 500, q: 3, delay: 0.1 + i * 0.07 });
    }
    if ((name === 'scare' || name === 'caught') && this.voice !== 'seino') return this.jolt(name === 'scare' ? this.k.scareVol : this.k.caughtVol);
    if (name === 'scare') {
      // 올라가는 거친 숨소리
      this.puffNoise(o, { dur: 0.9, vol: this.k.scareVol, freq: 700, freqTo: 2400, q: 2.5 });
      this.blip(o, { freq: 95, dur: 0.9, vol: this.k.scareVol * 0.64, slide: 0.6 });
    }
    if (name === 'caught') {
      this.puffNoise(o, { dur: 1.2, vol: this.k.caughtVol, freq: 600, freqTo: 3000, q: 3 });
      this.blip(o, { freq: 150, dur: 1.1, vol: this.k.caughtVol * 0.67, slide: 0.4 });
    }
  }

  // 눈뜬이는 높이 치솟는 비명 숨, 큰입이는 낮은 포효 뒤에 이빨이 딱 닫힌다
  jolt(vol) {
    const o = this.out;
    if (this.voice === 'gazer') {
      this.puffNoise(o, { dur: 0.9, vol, freq: 1800, freqTo: 5200, q: 6 });
      this.blip(o, { freq: 640, dur: 0.8, vol: vol * 0.4, type: 'triangle', slide: 1.9 });
      return;
    }
    if (this.voice === 'mole') {
      // 땅에서 끓어오르는 낮은 웃음
      for (let i = 0; i < 4; i++) this.blip(o, { freq: 190 - i * 18, dur: 0.16, vol: vol * 0.7, type: 'sawtooth', slide: 0.8, delay: i * 0.17 });
      this.puffNoise(o, { dur: 0.9, vol: vol * 0.7, freq: 400, freqTo: 1400, q: 1.2 });
      return;
    }
    this.puffNoise(o, { dur: 0.9, vol, freq: 320, freqTo: 900, q: 1.6 });
    this.blip(o, { freq: 82, dur: 0.9, vol: vol * 0.8, type: 'sawtooth', slide: 0.7 });
    this.blip(o, { freq: 2100, dur: 0.05, vol: vol * 0.5, type: 'square', delay: 0.72 });
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
      this.duckMusic(t);
      this.swellLfo.frequency.setTargetAtTime(1 / (this.v.breathSwellSec[mode] ?? 1.4), t, 0.2);
    }
    const level = this.v.breathLevel[mode] ?? 0.5;
    if (!this.suspended && level !== this.breathGoal) { // 매 프레임 일정을 쌓지 않는다
      this.breathGoal = level;
      this.breathLevel.gain.setTargetAtTime(level, t, 0.2);
    }

    const every = this.v.stepEvery[mode] ?? 0;
    this.stepT -= dt;
    if (every && this.stepT <= 0) {
      this.stepT = every;
      this.footstep();
    }
    const gap = heartInterval(dist, this.k);
    this.heartT -= dt;
    if (gap !== null && !this.suspended && this.heartT <= 0) {
      this.heartT = gap;
      this.heartbeat();
    }
  }

  // 추격 중에는 배경 음악을 낮춰서 숨소리와 발소리가 앞에 나오게 한다
  musicLevel() {
    return this.k.musicVolume * (this.mode === 'chase' ? this.k.musicChaseDuck : 1);
  }

  duckMusic(t) {
    this.creatureOut.gain.setTargetAtTime(this.mode === 'chase' ? this.k.chaseCreatureGain : 1, t, 0.15);
    if (!this.active) return;
    this.music.gain.setTargetAtTime(this.musicLevel(), t, this.mode === 'chase' ? 0.15 : 0.8); // 쫓길 때는 빨리 낮추고, 놓치면 천천히 돌아온다
  }

  // 잡히는 장면: 숨소리와 발소리를 바로 끈다
  suspend() {
    this.suspended = true;
    this.breathGoal = null;
    if (this.ctx) this.breathLevel.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // 잡힌 뒤 다시 시작할 때 부른다. 숨소리는 다음 updateStalker 에서 돌아온다.
  resume() {
    this.suspended = false;
    this.breathGoal = null;
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
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.active = on;
    this.music.gain.setTargetAtTime(on ? this.musicLevel() : 0.0001, t, 0.1);
    // 숨소리, 발소리, 심장 소리, 한 번 나는 소리까지 모두 out 을 지난다
    this.out.gain.setTargetAtTime(on && !this.muted ? 1 : 0, t, 0.1);
  }

  destroy() {
    if (!this.ctx) return;
    this.stopNodes(this.loops);
    this.stopNodes(this.creatureNodes);
    this.echoLoop.forEach((node) => node.disconnect());
    this.music.disconnect();
    this.out.disconnect();
    this.comp.disconnect();
  }
}
