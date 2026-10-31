// 공포 모드 소리. 파일 없이 합성한다.
import { sfx } from '../audio/sfx.js';
import { cfg } from '../config/index.js';

const DRONE = [82.41, 82.9, 123.47]; // 살짝 어긋난 낮은 음이 천천히 울렁인다
const PAD = [155.56, 164.81]; // 반음이 부딪혀 불안하게 들린다
const NOTES = [196, 207.65, 293.66, 311.13, 392]; // 어둠 속에서 가끔 울리는 쇳소리 음
const CLANG = [310, 467, 811]; // 멀리서 쇠가 부딪히는 소리

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
