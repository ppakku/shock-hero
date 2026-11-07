// 공포 모드 소리. 파일 없이 합성한다.
import { sfx } from '../audio/sfx.js';
import { cfg } from '../config/index.js';
import { heartInterval } from '../logic/horrorStalker.js';
import { CELL } from '../logic/horrorGrid.js';

const DRONE = [82.41, 82.9, 123.47]; // 살짝 어긋난 낮은 음이 천천히 울렁인다
const PAD = [155.56, 164.81]; // 반음이 부딪혀 불안하게 들린다
const NOTES = [196, 207.65, 293.66, 311.13, 392]; // 어둠 속에서 가끔 울리는 쇳소리 음
const CLANG = [310, 467, 811]; // 멀리서 쇠가 부딪히는 소리
const HUM = [98, 147.5]; // 충전된 전기충격기의 웅웅거림
const CRACKLE = 5; // 맞혔을 때 이어지는 지지직 수
const STING = [466.16, 493.88, 739.99, 783.99]; // 반음씩 부딪히는 놀람 소리
const WHISPER = 6; // 속삭임 한 번의 음절 수
export class HorrorAudio {
  // voice: 첫째 괴물의 목소리. more: 함께 나오는 괴물의 목소리들
  constructor({ muted, voice = 'seino', more = [] }) {
    sfx.unlock();
    this.ctx = sfx.ctx;
    this.k = cfg.horror;
    this.loops = [];
    this.noteT = this.k.musicNoteMin / 2;
    this.clangT = this.k.musicClangMin;
    this.whisperT = this.k.scare.whisperMin;
    this.hushed = false;
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
    this.creatures = [voice, ...more].map((id) => this.initCreature(id));
    this.lead = this.creatures[0];
    this.heartT = 0;
    this.suspended = false;
    this.active = true;
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
  // 괴물마다 하나씩 만들어 돌려준다
  initCreature(voice) {
    const c = {
      voice,
      v: this.k.voices[voice] ?? this.k, // 세이노 값은 balance.horror 에 바로 있다
      stepT: 0,
      mode: 'patrol',
      breathGoal: null, // 마지막으로 정한 숨소리 크기
      panner: this.ctx.createPanner(),
      creatureOut: this.ctx.createGain(), // 추격 중에는 괴물 소리 전체를 키운다
    };
    c.panner.panningModel = 'HRTF';
    c.panner.distanceModel = 'inverse';
    c.panner.refDistance = this.k.stalkerRefDist;
    c.panner.rolloffFactor = 1;
    c.panner.connect(c.creatureOut);
    c.creatureOut.connect(this.out);

    const breath = this.ctx.createBufferSource();
    breath.buffer = sfx.noise;
    breath.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = c.v.breathFreq;
    band.Q.value = c.v.breathQ ?? 1.1; // 세이노는 900~1800Hz 쯤이 넓게 남는다
    c.swell = this.ctx.createGain();
    c.swell.gain.value = 0.5;
    c.breathLevel = this.ctx.createGain();
    c.breathLevel.gain.value = 0;
    breath.connect(band).connect(c.swell).connect(c.breathLevel).connect(c.panner);
    breath.start();
    // 들숨 날숨: 이득이 천천히 오르내린다
    c.swellLfo = this.ctx.createOscillator();
    c.swellLfo.frequency.value = 1 / c.v.breathSwellSec.patrol;
    const depth = this.ctx.createGain();
    depth.gain.value = 0.5;
    c.swellLfo.connect(depth).connect(c.swell.gain);
    c.swellLfo.start();
    this.creatureNodes.push(breath, band, c.swell, c.breathLevel, c.swellLfo, depth, c.panner, c.creatureOut);
    if (c.v.tone) this.addVoiceTone(c.v.tone, c.swell);
    if (c.v.layers) this.addLayers(c, c.v.layers);
    return c;
  }

  // 처녀귀신: 멀면 흐느낌, 중간이면 흥얼거림, 코앞이면 속삭임. 겹쳐 둔 소리의 크기만 거리 구간이 바뀔 때 바꾼다
  addLayers(c, { sob, hum }) {
    const ctx = this.ctx;
    const vibrato = (rate, depth, params) => {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const amount = ctx.createGain();
      amount.gain.value = depth;
      lfo.connect(amount);
      for (const p of params) amount.connect(p);
      lfo.start();
      this.creatureNodes.push(lfo, amount);
    };
    // 흐느낌: 떨리는 여린 음을 목소리처럼 걸러서, 숨이 끊기듯 툭툭 끊어 낸다
    const cry = ctx.createOscillator();
    cry.type = 'triangle';
    cry.frequency.value = sob.freq;
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = sob.formant;
    formant.Q.value = sob.q;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    c.sobLevel = ctx.createGain();
    c.sobLevel.gain.value = 0;
    cry.connect(formant).connect(pulse).connect(c.sobLevel).connect(c.swell);
    cry.start();
    vibrato(sob.vibrato, sob.vibratoDepth, [cry.frequency]);
    vibrato(sob.pulse, 0.5, [pulse.gain]);
    this.creatureNodes.push(cry, formant, pulse, c.sobLevel);
    // 흥얼거림: 두 음이 천천히 흔들리는 낮은 콧노래
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = hum.cutoff;
    c.humLevel = ctx.createGain();
    c.humLevel.gain.value = 0;
    muffle.connect(c.humLevel).connect(c.swell);
    this.creatureNodes.push(muffle, c.humLevel);
    const voices = hum.freqs.map((freq) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.connect(muffle);
      osc.start();
      this.creatureNodes.push(osc);
      return osc.frequency;
    });
    vibrato(hum.vibrato, hum.vibratoDepth, voices);
    c.band = null;
    c.whisperT = 0;
  }

  // 거리 구간이 바뀔 때만 크기를 정하고, 코앞이면 속삭임을 띄엄띄엄 낸다. d: 이 괴물까지 칸 단위 거리
  tickLayers(c, d, dt) {
    const l = c.v.layers;
    const band = d < l.near ? 'near' : d > l.far ? 'far' : 'mid';
    if (band !== c.band) {
      c.band = band;
      const t = this.ctx.currentTime;
      c.sobLevel.gain.setTargetAtTime(l.sob.vol * l.sob.mix[band], t, 0.4);
      c.humLevel.gain.setTargetAtTime(l.hum.vol * l.hum.mix[band], t, 0.4);
    }
    c.whisperT -= dt;
    if (band !== 'near' || this.suspended || c.whisperT > 0 || !c.breathGoal) return;
    const w = l.whisper;
    c.whisperT = w.every + Math.random() * w.spread; // 고르지 않게 끊긴다
    this.puffNoise(c.panner, { dur: 0.05 + Math.random() * 0.1, vol: w.vol, freq: w.freq * (0.6 + Math.random() * 0.9), q: 5 });
  }

  // 숨소리와 함께 커졌다 작아지는 지속음. 숨소리 크기가 0 이면 함께 끊긴다
  addVoiceTone({ freqs, type, vol, cutoff }, swell) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    filter.connect(gain).connect(swell);
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
  footstep(c = this.lead) {
    if (!this.ctx || this.suspended) return;
    const p = c.panner;
    if (c.voice === 'gazer') return this.dragStep(p);
    if (c.voice === 'maw') return this.heavyStep(p);
    if (c.voice === 'ward') return this.dragStep(p);
    if (c.voice === 'maiden') return this.swish(p);
    this.puffNoise(p, { dur: 0.09, vol: 1.3, freq: 3200, freqTo: 1800, q: 1.5 });
    this.puffNoise(p, { dur: 0.05, vol: 1.0, freq: 5200, q: 2, delay: 0.07 });
    this.blip(p, { freq: 900, dur: 0.04, vol: 0.5, type: 'square', slide: 0.5 });
  }

  // 눈뜬이와 호러워드는 발이 없다: 옷자락이 바닥을 쓸며 끌리는 소리
  dragStep(p) {
    this.puffNoise(p, { dur: 0.32, vol: 1.1, freq: 1500, freqTo: 3400, q: 0.9 });
  }

  // 처녀귀신은 떠 있다: 소복 자락이 조용히 스치는 소리
  swish(p) {
    this.puffNoise(p, { dur: 0.45, vol: 0.45, freq: 700, freqTo: 2100, q: 0.7 });
  }

  // 처녀귀신이 순간이동한 자리에서 짧게 들이쉬고 속삭인다
  blinkCue(p) {
    this.puffNoise(p, { dur: 0.5, vol: 0.5, freq: 1500, freqTo: 3600, q: 2 });
    for (let i = 0; i < 5; i++) this.puffNoise(p, { dur: 0.06 + Math.random() * 0.08, vol: 1.2, freq: 2000 + Math.random() * 3000, q: 6, delay: 0.3 + i * 0.09 + Math.random() * 0.05 });
  }

  // 큰입이: 낮게 쿵 울리는 걸음. 가끔 긴 이빨이 딱딱 부딪힌다
  heavyStep(p) {
    this.blip(p, { freq: 200, dur: 0.2, vol: 0.5, slide: 0.6 });
    this.puffNoise(p, { dur: 0.14, vol: 0.8, freq: 700, freqTo: 260, type: 'lowpass' });
    if (Math.random() > 0.4) return;
    this.blip(p, { freq: 2300, dur: 0.03, vol: 0.5, type: 'square', delay: 0.16 });
    this.blip(p, { freq: 2000, dur: 0.03, vol: 0.45, type: 'square', delay: 0.26 });
  }

  // 두근두근. 120~180Hz 성분을 더해 작은 스피커에도 들린다. loud: 가까울수록 커진다
  heartbeat(loud = 1) {
    if (this.suspended) return;
    this.blip(this.out, { freq: 58, dur: 0.16, vol: 0.5 * loud });
    this.blip(this.out, { freq: 150, dur: 0.12, vol: 0.4 * loud, slide: 0.7 });
    this.blip(this.out, { freq: 54, dur: 0.18, vol: 0.4 * loud, delay: 0.17 });
    this.blip(this.out, { freq: 130, dur: 0.12, vol: 0.3 * loud, slide: 0.7, delay: 0.17 });
  }

  // who: 몇 번째 괴물의 소리인지
  play(name, who = 0) {
    if (!this.ctx) return;
    const o = this.out;
    const c = this.creatures[who];
    if (name === 'fuse') this.blip(o, { freq: 880, dur: 0.18, vol: 0.2, type: 'triangle', slide: 1.5 });
    if (name === 'door') {
      this.blip(o, { freq: 140, dur: 0.5, vol: 0.5, type: 'sawtooth' });
      this.puffNoise(o, { dur: 0.4, vol: 0.4, freq: 900, freqTo: 200, type: 'lowpass' });
    }
    if (name === 'codeKey') this.blip(o, { freq: 1200, dur: 0.05, vol: 0.14, type: 'square', slide: 1 });
    if (name === 'codeWrong') {
      this.blip(o, { freq: 160, dur: 0.5, vol: 0.5, type: 'sawtooth', slide: 0.9 });
      this.blip(o, { freq: 170, dur: 0.5, vol: 0.4, type: 'square', slide: 0.9 });
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
    if (name === 'wall') {
      // 벽이 안에서 밀려 돌이 갈라지는 소리. 벽이 있는 쪽에서 들린다
      const p = c.panner;
      this.blip(p, { freq: 120, dur: 0.6, vol: 0.9, type: 'sawtooth', slide: 0.4 });
      this.puffNoise(p, { dur: 0.7, vol: 1, freq: 2400, freqTo: 300, type: 'lowpass' });
      for (let i = 0; i < CRACKLE; i++) this.puffNoise(p, { dur: 0.05, vol: 0.6, freq: 1800 + i * 500, q: 3, delay: 0.1 + i * 0.07 });
    }
    if (name === 'blink' && c) this.blinkCue(c.panner);
    if (name === 'vanish') {
      // 쇼크를 맞은 처녀귀신이 비명을 지르며 멀어진다
      this.puffNoise(o, { dur: 0.9, vol: 0.7, freq: 4200, freqTo: 1200, q: 3 });
      this.blip(o, { freq: 960, dur: 0.8, vol: 0.25, type: 'triangle', slide: 0.4 });
    }
    if (name === 'scare' || name === 'caught') this.sting(name === 'scare' ? this.k.scareVol : this.k.caughtVol);
    if ((name === 'scare' || name === 'caught') && c.voice !== 'seino') return this.jolt(name === 'scare' ? this.k.scareVol : this.k.caughtVol, c.voice);
    if (name === 'scare') {
      // 올라가는 거친 숨소리
      this.puffNoise(o, { dur: 0.9, vol: this.k.scareVol, freq: 700, freqTo: 2400, q: 2.5 });
      this.blip(o, { freq: 95, dur: 0.9, vol: this.k.scareVol * 0.64, slide: 0.6 });
    }
    if (name === 'caught') {
      this.puffNoise(o, { dur: 1.2, vol: this.k.caughtVol, freq: 600, freqTo: 3000, q: 3 });
      this.blip(o, { freq: 150, dur: 1.1, vol: this.k.caughtVol * 0.67, slide: 0.4 });
    }
    if (name === 'bell') for (let i = 0; i < 3; i++) this.blip(o, { freq: 660, dur: 1.6, vol: 0.22, type: 'triangle', slide: 0.98, delay: i * 1.1 });
  }

  // 어느 괴물이든 먼저 터지는 날카로운 불협화음
  sting(vol) {
    const o = this.out;
    for (const freq of STING) this.blip(o, { freq, dur: 0.7, vol: vol * 0.3, type: 'sawtooth', slide: 0.82 });
    this.puffNoise(o, { dur: 0.25, vol, freq: 2600, freqTo: 800, q: 0.6 });
  }

  // 귀 가까이에서 들리는 알아들을 수 없는 속삭임
  whisper(rand) {
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = rand() < 0.5 ? -0.9 : 0.9;
    pan.connect(this.out);
    const vol = this.k.scare.whisperVol;
    for (let i = 0; i < WHISPER; i++) this.puffNoise(pan, { dur: 0.13 + rand() * 0.12, vol, freq: 1700 + rand() * 1800, q: 7, delay: i * 0.2 + rand() * 0.08 });
  }

  // 눈뜬이는 높이 치솟는 비명 숨, 큰입이는 낮은 포효 뒤에 이빨이 딱 닫힌다
  jolt(vol, voice) {
    const o = this.out;
    if (voice === 'maiden') {
      // 숨 섞인 날카로운 비명 밑에 낮게 쿵 하고 내려앉는다
      this.puffNoise(o, { dur: 1, vol, freq: 2200, freqTo: 5600, q: 3 });
      this.blip(o, { freq: 820, dur: 0.9, vol: vol * 0.35, type: 'triangle', slide: 1.7 });
      this.blip(o, { freq: 1240, dur: 0.7, vol: vol * 0.2, slide: 1.5 });
      this.blip(o, { freq: 62, dur: 0.5, vol: vol * 0.9, slide: 0.5 });
      this.puffNoise(o, { dur: 0.3, vol: vol * 0.7, freq: 400, freqTo: 120, type: 'lowpass' });
      return;
    }
    if (voice === 'gazer') {
      this.puffNoise(o, { dur: 0.9, vol, freq: 1800, freqTo: 5200, q: 6 });
      this.blip(o, { freq: 640, dur: 0.8, vol: vol * 0.4, type: 'triangle', slide: 1.9 });
      return;
    }
    if (voice === 'ward') {
      // 끓어오르는 낮은 웃음
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

  // camera: 듣는 사람, stalkerPos: 미터 좌표 { x, y, z }, dist: 가장 가까운 괴물까지 칸 단위 거리, who: 몇 번째 괴물인지
  updateStalker(camera, stalkerPos, mode, dist, dt, who = 0) {
    if (!this.ctx) return;
    const c = this.creatures[who];
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
    this.setPos(c.panner, stalkerPos.x, stalkerPos.y, stalkerPos.z);
    const t = this.ctx.currentTime;
    if (mode !== c.mode) {
      c.mode = mode;
      this.duckMusic(t, c);
      c.swellLfo.frequency.setTargetAtTime(1 / (c.v.breathSwellSec[mode] ?? 1.4), t, 0.2);
    }
    const level = c.v.breathLevel[mode] ?? 0.5;
    if (!this.suspended && level !== c.breathGoal) { // 매 프레임 일정을 쌓지 않는다
      c.breathGoal = level;
      c.breathLevel.gain.setTargetAtTime(level, t, 0.2);
    }

    const every = c.v.stepEvery[mode] ?? 0;
    c.stepT -= dt;
    if (every && c.stepT <= 0) {
      c.stepT = every;
      this.footstep(c);
    }
    if (c.v.layers) this.tickLayers(c, Math.hypot(stalkerPos.x - camera.position.x, stalkerPos.z - camera.position.z) / CELL, dt);
    if (c !== this.lead) return; // 심장은 하나다
    const gap = heartInterval(dist, this.k);
    this.heartT -= dt;
    if (gap !== null && !this.suspended && this.heartT <= 0) {
      this.heartT = gap;
      this.heartbeat(1 + this.k.scare.heartLoud * (1 - dist / this.k.heartFar));
    }
  }

  // 추격 중에는 배경 음악을 낮춰서 숨소리와 발소리가 앞에 나오게 한다
  musicLevel() {
    if (this.hushed) return 0.0001;
    return this.k.musicVolume * (this.creatures.some((c) => c.mode === 'chase') ? this.k.musicChaseDuck : 1);
  }

  // 놀라기 직전에 배경 음악을 뚝 끊는다
  hush(on) {
    if (!this.ctx || on === this.hushed) return;
    this.hushed = on;
    if (this.active) this.music.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, on ? 0.03 : 0.4);
  }

  duckMusic(t, c) {
    c.creatureOut.gain.setTargetAtTime(c.mode === 'chase' ? this.k.chaseCreatureGain : 1, t, 0.15);
    if (!this.active) return;
    this.music.gain.setTargetAtTime(this.musicLevel(), t, c.mode === 'chase' ? 0.15 : 0.8); // 쫓길 때는 빨리 낮추고, 놓치면 천천히 돌아온다
  }

  // 잡히는 장면: 숨소리와 발소리를 바로 끈다
  suspend() {
    this.suspended = true;
    for (const c of this.creatures ?? []) {
      c.breathGoal = null;
      c.breathLevel.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  // 잡힌 뒤 다시 시작할 때 부른다. 숨소리는 다음 updateStalker 에서 돌아온다.
  resume() {
    this.suspended = false;
    for (const c of this.creatures ?? []) c.breathGoal = null;
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
    this.whisperT -= dt;
    if (this.whisperT <= 0) {
      this.whisperT = this.gap(this.k.scare.whisperMin, this.k.scare.whisperMax, rand);
      if (!this.suspended) this.whisper(rand);
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
