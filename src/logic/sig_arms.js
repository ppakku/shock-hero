// 파쇄자 변종의 전용 공격 계산 (화면과 상관없는 부분)

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// 경고 시간. 보스가 빨라져도 floor 초 아래로는 줄지 않아서 늘 피할 수 있다.
export function warnTime(base, speed, floor) {
  return Math.max(floor, base * speed);
}

// 전기 기둥 두 곳 [왼쪽, 오른쪽]. 주인공이 사이에 들어가게 놓고 싸움터 밖으로 나가지 않는다.
export function chainPosts(targetX, span, minX, maxX, rand = Math.random) {
  const w = Math.min(span, maxX - minX);
  const left = clamp(targetX - w * (0.25 + 0.5 * rand()), minX, maxX - w);
  return [left, left + w];
}

// 점프했을 때 발이 height 보다 높이 떠 있는 시간
export function airTimeAbove(height, jumpSpeed, gravity) {
  const peak = (jumpSpeed * jumpSpeed) / (2 * gravity);
  if (peak <= height) return 0;
  return (2 * Math.sqrt(2 * gravity * (peak - height))) / gravity;
}

// 싸움마다 전용 공격을 꼭 보도록, by 번 공격할 때까지 안 나왔으면 다음은 전용 공격이다.
export function signatureDue(phases, attacks, seen, by) {
  return !seen && attacks >= by && phases.flat().includes('signature');
}

// 번개 사슬의 꺾인 점들. 양 끝은 기둥에 붙어 있다.
export function zigzag(a, b, y, parts, jitter, rand = Math.random) {
  return Array.from({ length: parts + 1 }, (_, i) => {
    const end = i === 0 || i === parts;
    return { x: a + ((b - a) * i) / parts, y: end ? y : y + (rand() * 2 - 1) * jitter };
  });
}
