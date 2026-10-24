// 소리 파일 없이 브라우저가 직접 만드는 효과음.
// 나중에 진짜 소리 파일로 바꾸려면 play() 안의 이름별 코드를 교체하면 된다.

class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // 브라우저는 사용자가 클릭/키를 누른 뒤에만 소리를 허락한다.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, { type = 'square', vol = 0.2, slideTo = null, delay = 0 } = {}) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  hiss(dur, { vol = 0.3, freq = 1200, freqTo = null, delay = 0 } = {}) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case 'punch':
        this.hiss(0.08, { vol: 0.35, freq: 2500 });
        this.tone(180, 0.08, { type: 'triangle', vol: 0.3, slideTo: 90 });
        break;
      case 'charged':
        this.hiss(0.2, { vol: 0.5, freq: 1800, freqTo: 300 });
        this.tone(120, 0.25, { type: 'sawtooth', vol: 0.3, slideTo: 45 });
        break;
      case 'chargeFull':
        this.tone(660, 0.08, { type: 'square', vol: 0.12 });
        this.tone(990, 0.12, { type: 'square', vol: 0.12, delay: 0.07 });
        break;
      case 'hit':
        this.tone(220, 0.1, { type: 'square', vol: 0.18, slideTo: 110 });
        break;
      case 'tink':
        this.tone(1400, 0.12, { type: 'triangle', vol: 0.18, slideTo: 1100 });
        break;
      case 'dash':
        this.hiss(0.18, { vol: 0.25, freq: 600, freqTo: 3000 });
        break;
      case 'jump':
        this.tone(300, 0.1, { type: 'square', vol: 0.08, slideTo: 520 });
        break;
      case 'hurt':
        this.tone(400, 0.25, { type: 'square', vol: 0.2, slideTo: 120 });
        break;
      case 'dodge':
        this.tone(900, 0.06, { type: 'triangle', vol: 0.15 });
        this.tone(1300, 0.08, { type: 'triangle', vol: 0.15, delay: 0.05 });
        break;
      case 'slam':
        this.hiss(0.45, { vol: 0.6, freq: 500, freqTo: 60 });
        this.tone(70, 0.4, { type: 'sine', vol: 0.5, slideTo: 30 });
        break;
      case 'break':
        this.hiss(0.5, { vol: 0.5, freq: 3000, freqTo: 200 });
        this.tone(200, 0.4, { type: 'sawtooth', vol: 0.25, slideTo: 40 });
        break;
      case 'warn':
        this.tone(520, 0.1, { type: 'square', vol: 0.08 });
        break;
      case 'roar':
        this.tone(90, 0.9, { type: 'sawtooth', vol: 0.35, slideTo: 55 });
        this.hiss(0.9, { vol: 0.3, freq: 800, freqTo: 150 });
        break;
      case 'spit':
        this.hiss(0.15, { vol: 0.3, freq: 900, freqTo: 2500 });
        this.tone(260, 0.12, { type: 'triangle', vol: 0.15, slideTo: 520 });
        break;
      case 'bombDrop': // 폭탄벌레가 폭탄을 떨어뜨림 (휘이익)
        this.tone(900, 0.35, { type: 'sine', vol: 0.12, slideTo: 250 });
        break;
      case 'bomb': // 폭탄 폭발
        this.hiss(0.35, { vol: 0.5, freq: 1500, freqTo: 120 });
        this.tone(110, 0.3, { type: 'sawtooth', vol: 0.25, slideTo: 40 });
        break;
      case 'venomCharge': // 프로스가 배를 구부리고 맹독을 모음 (우우웅)
        this.tone(180, 0.6, { type: 'sawtooth', vol: 0.08, slideTo: 480 });
        this.tone(360, 0.6, { type: 'triangle', vol: 0.06, slideTo: 960 });
        break;
      case 'venomShot': // 맹독 발사 (퓨욱)
        this.hiss(0.18, { vol: 0.3, freq: 700, freqTo: 2200 });
        this.tone(420, 0.16, { type: 'triangle', vol: 0.14, slideTo: 160 });
        break;
      case 'venomSplash': // 맹독이 터지며 독구름이 생김 (푸슉)
        this.hiss(0.4, { vol: 0.35, freq: 1200, freqTo: 300 });
        this.tone(140, 0.25, { type: 'sine', vol: 0.15, slideTo: 70 });
        break;
      case 'poisonTick': // 독구름에 체력이 깎임 (작게 칙)
        this.tone(300, 0.07, { type: 'square', vol: 0.06, slideTo: 200 });
        break;
      case 'spitCharge': // 침뱉기가 볼을 부풀림
        this.tone(200, 0.5, { type: 'triangle', vol: 0.12, slideTo: 420 });
        break;
      case 'shieldBreak': // 방패가 깨짐
        this.hiss(0.25, { vol: 0.4, freq: 4000, freqTo: 800 });
        this.tone(900, 0.15, { type: 'square', vol: 0.12, slideTo: 300 });
        break;
      case 'fire':
        this.hiss(0.5, { vol: 0.45, freq: 400, freqTo: 2500 });
        this.tone(110, 0.35, { type: 'sawtooth', vol: 0.2, slideTo: 220 });
        break;
      case 'gate':
        this.tone(220, 0.5, { type: 'sawtooth', vol: 0.15, slideTo: 880 });
        [659, 880].forEach((f, i) => this.tone(f, 0.18, { vol: 0.1, delay: 0.3 + i * 0.1 }));
        break;
      case 'locked':
        this.tone(160, 0.18, { type: 'square', vol: 0.15 });
        this.tone(120, 0.2, { type: 'square', vol: 0.15, delay: 0.12 });
        break;
      case 'beep':
        this.tone(880, 0.12, { type: 'sine', vol: 0.12 });
        break;
      case 'coin':
        this.tone(988, 0.08, { type: 'square', vol: 0.1 });
        this.tone(1319, 0.2, { type: 'square', vol: 0.1, delay: 0.08 });
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, { vol: 0.12, delay: i * 0.08 }));
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          this.tone(f, 0.25, { vol: 0.13, delay: i * 0.14 }),
        );
        break;
      case 'shot': // 파란 에너지탄 발사
        this.tone(300, 0.25, { type: 'sawtooth', vol: 0.18, slideTo: 1200 });
        this.hiss(0.25, { vol: 0.25, freq: 900, freqTo: 4000 });
        break;
      case 'upper': // 어퍼컷 휙
        this.hiss(0.12, { vol: 0.35, freq: 800, freqTo: 5000 });
        this.tone(220, 0.12, { type: 'triangle', vol: 0.25, slideTo: 660 });
        break;
      case 'ultReady': // 궁극기 게이지 꽉 참
        [659, 880, 1175].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'ultimate': // 궁극기 시작 (하늘로 뜀)
        this.tone(200, 0.45, { type: 'sawtooth', vol: 0.22, slideTo: 1400 });
        this.hiss(0.45, { vol: 0.3, freq: 600, freqTo: 5000 });
        break;
      case 'ultimateBoom': // 땅을 찍는 큰 충격파
        this.hiss(0.9, { vol: 0.7, freq: 1500, freqTo: 50 });
        this.tone(90, 0.8, { type: 'sine', vol: 0.6, slideTo: 25 });
        this.tone(440, 0.5, { type: 'sawtooth', vol: 0.15, slideTo: 110, delay: 0.05 });
        break;
      case 'rocket':
        this.hiss(0.5, { vol: 0.4, freq: 400, freqTo: 3000 });
        this.tone(140, 0.4, { type: 'sawtooth', vol: 0.2, slideTo: 420 });
        break;
      case 'inhale':
        this.hiss(1.4, { vol: 0.35, freq: 3500, freqTo: 300 });
        this.tone(200, 1.2, { type: 'sine', vol: 0.15, slideTo: 80 });
        break;
      case 'bite':
        this.tone(120, 0.12, { type: 'square', vol: 0.3, slideTo: 60 });
        this.hiss(0.1, { vol: 0.4, freq: 1500, delay: 0.05 });
        break;
      case 'rage':
        this.tone(70, 1.1, { type: 'sawtooth', vol: 0.4, slideTo: 40 });
        this.tone(140, 1.1, { type: 'square', vol: 0.15, slideTo: 90 });
        this.hiss(1.0, { vol: 0.35, freq: 1200, freqTo: 100 });
        break;
      case 'icicle':
        this.tone(1800, 0.25, { type: 'triangle', vol: 0.12, slideTo: 2600 });
        this.hiss(0.2, { vol: 0.3, freq: 5000, freqTo: 1500, delay: 0.05 });
        break;
      case 'freeze':
        this.hiss(0.9, { vol: 0.35, freq: 6000, freqTo: 800 });
        this.tone(900, 0.6, { type: 'sine', vol: 0.08, slideTo: 1600 });
        break;
      case 'swoop':
        this.hiss(0.7, { vol: 0.4, freq: 300, freqTo: 2500 });
        break;
      case 'flap':
        this.hiss(0.12, { vol: 0.15, freq: 500, freqTo: 200 });
        break;
      case 'breathCharge': // 혹한의 아스트라 입에 냉기가 모임 (점점 높아짐)
        this.tone(300, 1.0, { type: 'sine', vol: 0.12, slideTo: 1400 });
        this.hiss(1.0, { vol: 0.12, freq: 800, freqTo: 5000 });
        break;
      case 'freezeBreath': // 냉기 브레스 쏴아아
        this.hiss(1.4, { vol: 0.45, freq: 7000, freqTo: 600 });
        this.tone(1200, 0.9, { type: 'triangle', vol: 0.07, slideTo: 500 });
        this.tone(90, 0.8, { type: 'sawtooth', vol: 0.12, slideTo: 60 });
        break;
      case 'avalanche': // 빙천지락 땅울림
        this.tone(55, 1.0, { type: 'sawtooth', vol: 0.35, slideTo: 35 });
        this.hiss(1.0, { vol: 0.35, freq: 400, freqTo: 80 });
        break;
      case 'spikeBurst': // 얼음 가시가 솟음 (쩡!)
        this.tone(2200, 0.18, { type: 'triangle', vol: 0.14, slideTo: 3200 });
        this.hiss(0.25, { vol: 0.35, freq: 6000, freqTo: 1200 });
        this.tone(140, 0.2, { type: 'square', vol: 0.15, slideTo: 70 });
        break;
      case 'summon':
        [330, 415, 494, 622].forEach((f, i) => this.tone(f, 0.18, { type: 'sine', vol: 0.12, delay: i * 0.07 }));
        this.hiss(0.6, { vol: 0.15, freq: 900, freqTo: 3000 });
        break;
      case 'powerup': // 보물 상자의 특별한 힘을 얻음 (반짝반짝 올라감)
        [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.1, delay: i * 0.06 }));
        this.tone(2093, 0.3, { type: 'sine', vol: 0.08, delay: 0.3 });
        break;
      case 'powerEnd': // 특별한 힘이 끝남 (뿅 내려감)
        this.tone(660, 0.18, { type: 'triangle', vol: 0.1, slideTo: 330 });
        break;
      case 'zap': // 로봇 볼트 레이저 (찌릿)
        this.tone(1800, 0.08, { type: 'sawtooth', vol: 0.06, slideTo: 600 });
        this.hiss(0.06, { vol: 0.08, freq: 4000 });
        break;
      case 'cardMove': // 레벨 업 카드 옮겨 고르기
        this.tone(740, 0.05, { type: 'square', vol: 0.06 });
        break;
      case 'pick': // 레벨 업 카드 결정
        [784, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.1, delay: i * 0.05 }));
        break;
      default:
        break;
    }
  }
}

export const sfx = new Sfx();
