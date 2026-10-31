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

  // 남은 시간을 limit 이하로 줄인다
  limit(limit) {
    this.remaining = Math.min(this.remaining, limit);
  }

  update(dt) {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }
}
