# 보스 패턴 덜 읽히게 만들기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보스 6종의 쉬는 박자, 지치기 횟수, 공격 모양을 난이도별로 흔들고 어려움에 속임 동작을 넣는다.

**Architecture:** 무작위 계산은 `src/logic/bossVariety.js` 순수 함수로 두고, `BossBase` 가 `variety`, `restTime()`, `prepareAttack()`, `checkFeint()` 를 제공한다. 각 보스는 공격 시작, 끝, 경고 단계에서 이 도우미를 부른다.

**Tech Stack:** Phaser 3, Vitest

## Global Constraints

- 경고 없는 공격은 넣지 않고, 경고 시간은 지금보다 짧아지지 않는다.
- 쉬는 시간과 지치기 횟수의 평균은 지금과 같다.
- 새 그림과 새 공격은 만들지 않는다.
- 값: easy `{rest:0.15,tired:0,shape:0,feint:0}`, normal `{rest:0.3,tired:1,shape:0.3,feint:0}`, hard `{rest:0.4,tired:1,shape:0.6,feint:0.25}`

---

### Task 1: 공통 계산

**Files:** Create `src/logic/bossVariety.js`, `tests/boss_variety.test.js`. Modify `src/logic/dragon.js`(`pillarWaves` 에 `offset`), `src/logic/boss.js`(`avalancheWaves` 에 `swap`).

- [ ] 실패하는 테스트 작성, 실행
- [ ] 구현, `npx vitest run tests/boss_variety.test.js` 통과
- [ ] 커밋

### Task 2: BossBase 도우미

**Files:** Modify `src/boss/BossBase.js`

- `get variety()`: `bossVarietyOf(this.diff?.level)`
- `restTime(base)`: `jitterRest(base, this.variety)`
- `prepareAttack(a, warnTimes, canFeint = true)`: `a.late` 설정, 속임이면 `a.feintAt = warnTimes[a.type] * a.late * this.speed * 0.4`. 직전이 속임이면 이번은 속이지 않는다.
- `checkFeint()`: 경고 단계에서 `feintAt` 이 지나면 `onFeintCancel(a)` 를 부르고 `action = null`, `timer = 0.35`, `?` 표시. 참을 돌려준다.

### Task 3: 보스별 적용

**Files:** Modify `src/boss/ArmBoss.js`, `KingBoss.js`, `WatcherBoss.js`, `DragonBoss.js`, `FrostAstraBoss.js`, `SeaBoss.js`, `src/stage/stage1.js`

- [ ] 쉬는 시간: 각 `endAction` 의 `idleTime` 을 `restTime()` 으로 감싼다.
- [ ] 지치기 횟수: 와처, 얼음, 바다에 `tiredRoll` 을 두고 지친 뒤 다시 뽑는다.
- [ ] 시작 시점, 개수, 자리, 속임 동작: 설계 문서 표대로 넣는다. 강제 공격(`forceType`)은 속이지 않는다.
- [ ] 스테이지 1 목록 추가
- [ ] `npm test`, `npm run build`, 커밋

### Task 4: 실제 확인과 문서

- [ ] 봇 시험을 이전 코드와 비교한다.
- [ ] 실제 화면에서 어려움 속임 동작을 본다.
- [ ] `docs/DECISIONS.md` 기록, 커밋, PR, 머지
