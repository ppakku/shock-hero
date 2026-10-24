// 발판을 차례로 밟고 올라가는 봇 (window.__steps = [{x,y}...])
(() => {
  const s = window.__shock.scene;
  const steps = window.__steps;
  const B = (window.__climb = { step: 0 });
  s.readInput = function () {
    const p = this.player;
    const inp = { left: false, right: false, jumpDown: true, jumpPressed: false, attackDown: false, dashPressed: false };
    const go = (tx, tol) => { if (tx > p.x + tol) inp.right = true; else if (tx < p.x - tol) inp.left = true; };
    const grounded = p.body.blocked.down || p.body.touching.down;
    const landed = steps.findIndex((st) => grounded && Math.abs(p.y + 28 - st.y) < 10 && Math.abs(p.x - st.x) < 80);
    if (landed >= 0) B.step = landed + 1;
    else if (grounded && p.y > 420) B.step = 0;
    if (B.step >= steps.length) return { ...inp, jumpDown: false };
    const next = steps[B.step];
    const fromX = B.step === 0 ? next.x - 90 : steps[B.step - 1].x + 10;
    if (grounded) {
      if (Math.abs(p.x - fromX) > 12) go(fromX, 8);
      else { inp.right = true; inp.jumpPressed = true; }
    } else go(next.x, 8);
    return inp;
  };
  return 'climb installed';
})();
