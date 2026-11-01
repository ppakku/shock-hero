import { describe, expect, it, vi, beforeEach } from 'vitest';

// 가짜 오디오 장치: 만들어진 소리 객체와 시작 횟수만 센다
function makeCtx(counts) {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = (extra = {}) => {
    const n = {
      connect: (d) => d,
      disconnect() {
        n.disconnected = true;
      },
      start() {
        counts.started++;
        n.didStart = true;
      },
      stop(when) {
        counts.stopped++;
        n.stopAt = when ?? 0;
      },
      gain: param(),
      frequency: param(),
      Q: param(),
      pan: param(),
      delayTime: param(),
      ...extra,
    };
    return n;
  };
  return {
    currentTime: 0,
    state: 'running',
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => node(),
    createDynamicsCompressor: () => node(),
    createOscillator: () => {
      counts.osc++;
      const n = node();
      counts.sources.push(n);
      return n;
    },
    createBufferSource: () => {
      counts.noise++;
      const n = node();
      counts.sources.push(n);
      return n;
    },
    createBiquadFilter: () => node(),
    createDelay: () => node(),
    createStereoPanner: () => node(),
    createPanner: () => node({ positionX: param(), positionY: param(), positionZ: param() }),
  };
}

const counts = {};
const reset = () => Object.assign(counts, { started: 0, stopped: 0, osc: 0, noise: 0, sources: [] });
let sfx;
let HorrorAudio;
const cam = { position: { x: 0, y: 1.5, z: 0 }, matrixWorld: { elements: new Array(16).fill(0) } };
const pos = { x: 6, y: 1.5, z: 0 };

beforeEach(async () => {
  vi.resetModules();
  reset();
  ({ sfx } = await import('../src/audio/sfx.js'));
  sfx.unlock = () => {};
  sfx.ctx = makeCtx(counts);
  sfx.master = sfx.ctx.createGain();
  sfx.noise = {};
  ({ HorrorAudio } = await import('../src/horror/audio.js'));
});

describe('HorrorAudio 세이노 소리', () => {
  it('오디오가 없어도 안전하다', async () => {
    sfx.ctx = null;
    const a = new HorrorAudio({ muted: false });
    expect(() => {
      a.updateStalker(cam, pos, 'chase', 3, 0.1);
      a.footstep();
      a.play('caught');
      a.suspend();
      a.destroy();
    }).not.toThrow();
  });

  it('순찰은 느리게, 추격은 빠르게 발소리를 낸다', () => {
    const a = new HorrorAudio({ muted: false });
    const steps = vi.spyOn(a, 'footstep');
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'patrol', 30, 0.1);
    const patrol = steps.mock.calls.length;
    steps.mockClear();
    a.stepT = 0;
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'chase', 30, 0.1);
    expect(patrol).toBeGreaterThan(0);
    expect(steps.mock.calls.length).toBeGreaterThan(patrol);
  });

  it('기절 중에는 발소리가 없다', () => {
    const a = new HorrorAudio({ muted: false });
    const steps = vi.spyOn(a, 'footstep');
    for (let i = 0; i < 30; i++) a.updateStalker(cam, pos, 'stunned', 30, 0.1);
    expect(steps).not.toHaveBeenCalled();
  });

  it('심장 소리는 범위 안에서만 난다', () => {
    const a = new HorrorAudio({ muted: false });
    const beat = vi.spyOn(a, 'heartbeat');
    for (let i = 0; i < 30; i++) a.updateStalker(cam, pos, 'stunned', 40, 0.1);
    expect(beat).not.toHaveBeenCalled();
    for (let i = 0; i < 30; i++) a.updateStalker(cam, pos, 'stunned', 5, 0.1);
    expect(beat).toHaveBeenCalled();
  });

  it('추격 때 숨소리 목표 크기가 순찰보다 크다', () => {
    const a = new HorrorAudio({ muted: false });
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    a.updateStalker(cam, pos, 'patrol', 10, 0.1);
    a.updateStalker(cam, pos, 'chase', 10, 0.1);
    expect(set.mock.calls[1][0]).toBeGreaterThan(set.mock.calls[0][0]);
  });

  it('숨소리 크기는 목표가 바뀔 때만 정한다', () => {
    const a = new HorrorAudio({ muted: false });
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'patrol', 10, 0.016);
    expect(set).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'chase', 10, 0.016);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it('suspend 와 resume 뒤에는 같은 상태여도 크기를 다시 정한다', () => {
    const a = new HorrorAudio({ muted: false });
    a.updateStalker(cam, pos, 'patrol', 10, 0.016);
    a.suspend();
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    a.updateStalker(cam, pos, 'patrol', 10, 0.016);
    expect(set).not.toHaveBeenCalled(); // 잡혀 있는 동안은 조용하다
    a.resume();
    a.updateStalker(cam, pos, 'patrol', 10, 0.016);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('추격에는 배경 음악을 낮추고 세이노 소리를 키우고, 놓치면 돌려놓는다', () => {
    const a = new HorrorAudio({ muted: false });
    const music = vi.spyOn(a.music.gain, 'setTargetAtTime');
    const creature = vi.spyOn(a.creatureOut.gain, 'setTargetAtTime');
    a.updateStalker(cam, pos, 'chase', 10, 0.1);
    expect(music.mock.calls[0][0]).toBeCloseTo(a.k.musicVolume * a.k.musicChaseDuck);
    expect(creature.mock.calls[0][0]).toBe(a.k.chaseCreatureGain);
    a.updateStalker(cam, pos, 'search', 10, 0.1);
    expect(music.mock.calls[1][0]).toBeCloseTo(a.k.musicVolume);
    expect(creature.mock.calls[1][0]).toBe(1);
  });

  it('suspend 후에는 숨소리가 0으로 가고 다시 올라오지 않는다', () => {
    const a = new HorrorAudio({ muted: false });
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    a.suspend();
    a.updateStalker(cam, pos, 'chase', 3, 0.1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toBe(0);
  });

  it('play 는 모르는 이름도 견디고 알려진 이름은 소리를 만든다', () => {
    const a = new HorrorAudio({ muted: false });
    a.play('nope');
    const before = counts.osc + counts.noise;
    for (const n of ['fuse', 'codeKey', 'codeWrong', 'shockCharge', 'shockHit', 'shockMiss', 'shockEmpty', 'scare', 'caught', 'door']) a.play(n);
    expect(counts.osc + counts.noise).toBeGreaterThan(before);
  });

  it('충전 소리와 쏘는 소리는 각각 소리를 만든다', () => {
    const a = new HorrorAudio({ muted: false });
    for (const n of ['shockCharge', 'shockHit', 'shockMiss', 'shockEmpty']) {
      const before = counts.osc + counts.noise;
      a.play(n);
      expect(counts.osc + counts.noise).toBeGreaterThan(before);
    }
  });

  it('웅웅거림은 켜고 끌 때만 크기를 바꾼다', () => {
    const a = new HorrorAudio({ muted: false });
    const set = vi.spyOn(a.humLevel.gain, 'setTargetAtTime');
    a.setHum(true);
    a.setHum(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0][0]).toBeGreaterThan(0);
    a.setHum(false);
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[1][0]).toBe(0);
  });

  it('destroy 는 반복음을 모두 멈추고 out 을 끊는다', () => {
    const a = new HorrorAudio({ muted: false });
    const started = counts.sources.filter((n) => n.didStart);
    expect(started.length).toBeGreaterThan(0);
    a.destroy();
    for (const n of started) expect(n.stopAt).not.toBeUndefined();
    expect(a.out.disconnected).toBe(true);
    expect(a.comp.disconnected).toBe(true);
  });

  it('음소거면 out 이 0 이고 setActive(true) 해도 0 을 유지한다', () => {
    const a = new HorrorAudio({ muted: true });
    expect(a.out.gain.value).toBe(0);
    const set = vi.spyOn(a.out.gain, 'setTargetAtTime');
    a.setActive(false);
    a.setActive(true);
    expect(set.mock.calls.map((c) => c[0])).toEqual([0, 0]);
  });

  it('소리를 켠 상태면 setActive 가 out 을 끄고 되살린다', () => {
    const a = new HorrorAudio({ muted: false });
    const set = vi.spyOn(a.out.gain, 'setTargetAtTime');
    a.setActive(false);
    a.setActive(true);
    expect(set.mock.calls.map((c) => c[0])).toEqual([0, 1]);
  });

  it('positionX 가 없는 사파리는 setPosition 을 쓴다', () => {
    const a = new HorrorAudio({ muted: false });
    const node = { setPosition: vi.fn() };
    a.setPos(node, 1, 2, 3);
    expect(node.setPosition).toHaveBeenCalledWith(1, 2, 3);
  });

  it('한 번 나는 잡음은 loop 로 이어 붙이고 stop 을 예약한다', () => {
    const a = new HorrorAudio({ muted: false });
    counts.sources.length = 0;
    a.puffNoise(a.out, { dur: 1.2, vol: 1, freq: 600 });
    const src = counts.sources.find((n) => n.loop !== undefined || n.didStart);
    expect(src.loop).toBe(true);
    expect(src.stopAt).toBeCloseTo(1.22);
  });

  it('resume 하면 숨소리가 다시 올라온다', () => {
    const a = new HorrorAudio({ muted: false });
    a.suspend();
    a.resume();
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    a.updateStalker(cam, pos, 'chase', 3, 0.016);
    expect(set.mock.calls.some(([v]) => v > 0)).toBe(true);
  });

  it('suspend 후에는 숨소리와 심장 소리가 모두 멈춘다', () => {
    const a = new HorrorAudio({ muted: false });
    const beat = vi.spyOn(a, 'blip');
    a.suspend();
    a.heartbeat();
    for (let i = 0; i < 30; i++) a.updateStalker(cam, pos, 'chase', 3, 0.1);
    expect(beat).not.toHaveBeenCalled();
    expect(a.breathLevel.gain.setTargetAtTime).toBeDefined();
  });
});

describe('HorrorAudio 괴물 목소리', () => {
  it('기본은 세이노이고 세이노 값을 그대로 쓴다', () => {
    const a = new HorrorAudio({ muted: false });
    expect(a.voice).toBe('seino');
    expect(a.v).toBe(a.k);
  });

  it.each(['gazer', 'maw', 'ward'])('%s 은 자기 표를 쓰고 세이노와 다른 소리 높이를 낸다', (voice) => {
    const a = new HorrorAudio({ muted: false, voice });
    expect(a.v).toBe(a.k.voices[voice]);
    expect(a.v.breathFreq).not.toBe(a.k.breathFreq);
    expect(a.v.tone.freqs.length).toBeGreaterThan(0);
  });

  it('세 괴물의 숨소리 높이가 크게 떨어져 있다', () => {
    const k = new HorrorAudio({ muted: false }).k;
    const [low, mid, high] = [k.voices.maw.breathFreq, k.breathFreq, k.voices.gazer.breathFreq];
    expect(mid / low).toBeGreaterThan(2);
    expect(high / mid).toBeGreaterThan(1.6);
  });

  it('눈뜬이는 굳으면 끌리는 소리도 숨소리도 멈춘다', () => {
    const a = new HorrorAudio({ muted: false, voice: 'gazer' });
    const steps = vi.spyOn(a, 'dragStep');
    const set = vi.spyOn(a.breathLevel.gain, 'setTargetAtTime');
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'patrol', 30, 0.1);
    expect(steps).toHaveBeenCalled();
    steps.mockClear();
    for (let i = 0; i < 30; i++) a.updateStalker(cam, pos, 'watch', 30, 0.1);
    expect(steps).not.toHaveBeenCalled();
    expect(set.mock.calls.at(-1)[0]).toBe(0);
  });

  it('큰입이의 돌진은 음악을 낮추고 걸음이 빨라진다', () => {
    const a = new HorrorAudio({ muted: false, voice: 'maw' });
    const creature = vi.spyOn(a.creatureOut.gain, 'setTargetAtTime');
    const steps = vi.spyOn(a, 'heavyStep');
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'patrol', 30, 0.1);
    const walk = steps.mock.calls.length;
    steps.mockClear();
    a.stepT = 0;
    for (let i = 0; i < 20; i++) a.updateStalker(cam, pos, 'chase', 30, 0.1);
    expect(steps.mock.calls.length).toBeGreaterThan(walk);
    expect(creature.mock.calls.at(-1)[0]).toBe(a.k.chaseCreatureGain);
  });

  it('놀람과 잡힘 소리는 목소리마다 다르게 낸다', () => {
    for (const voice of ['gazer', 'maw', 'ward']) {
      const a = new HorrorAudio({ muted: false, voice });
      const jolt = vi.spyOn(a, 'jolt');
      a.play('scare');
      a.play('caught');
      expect(jolt).toHaveBeenCalledTimes(2);
    }
  });
});
