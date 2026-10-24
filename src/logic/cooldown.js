export class Cooldown {
  constructor(duration) {
    this.duration = duration;
    this.remaining = 0;
  }

  get ready() {
    return this.remaining <= 0;
  }

  // 0 = 방금 씀, 1 = 다시 쓸 수 있음
  get progress() {
    if (this.duration <= 0) return 1;
    return 1 - this.remaining / this.duration;
  }

  trigger() {
    this.remaining = this.duration;
  }

  update(dt) {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }
}
