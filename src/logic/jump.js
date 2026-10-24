// 점프 판단: 땅 점프인지, 공중에서 한 번 더 뛰는 더블 점프인지 (Phaser 없이 테스트할 수 있게)
// jumpBuffer: 방금(0.12초 안) 점프를 눌렀는지, coyote: 땅에서 떨어진 지 0.1초 안인지,
// jumpPressed: 이번 순간에 눌렀는지, airJumpsLeft: 남은 공중 점프 수
export function jumpKind({ jumpPressed, jumpBuffer, coyote, airJumpsLeft }) {
  if (jumpBuffer > 0 && coyote > 0) return 'ground';
  // 공중 점프는 정말 공중에서 새로 눌렀을 때만 (땅에 닿기 직전 미리 누른 건 땅 점프로 남겨 둔다)
  if (jumpPressed && coyote <= 0 && airJumpsLeft > 0) return 'air';
  return null;
}
