export class Health {
  constructor(max) {
    this.max = Math.max(1, max);
    this.current = this.max;
  }

  get isDead() {
    return this.current <= 0;
  }

  get ratio() {
    return this.current / this.max;
  }

  // 실제로 깎인 양을 돌려준다.
  damage(amount) {
    if (this.isDead || !(amount > 0)) return 0;
    const dealt = Math.min(this.current, amount);
    this.current -= dealt;
    return dealt;
  }

  heal(amount) {
    if (this.isDead || !(amount > 0)) return 0;
    const healed = Math.min(this.max - this.current, amount);
    this.current += healed;
    return healed;
  }

  healFull() {
    if (!this.isDead) this.current = this.max;
  }

  setMax(max) {
    this.max = Math.max(1, max);
    this.current = Math.min(this.current, this.max);
  }
}
