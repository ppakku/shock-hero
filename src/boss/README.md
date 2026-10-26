# 보스 만들기 약속

스테이지 파일의 `boss.type` 이름으로 `src/boss/index.js` 의 `BOSS_TYPES` 에서 클래스를 고릅니다.
보스 클래스는 `new Cls(scene, cfg, stage, skin)` 으로 만들어지고, 아래를 지켜야 합니다.
(`BossBase.js` 를 상속하면 대부분 이미 들어 있습니다.)

## 속성
- `name`: HUD 와 등장 글자에 쓰는 이름
- `state`: `'dormant'`(대기) → `'intro'`(등장) → `'fight'` → `'dead'`
- `defeated`: 쓰러졌으면 true
- `groundY`, `bodyX`: 쓰러질 때 연출 위치
- `blocker`: 플레이어가 지나가면 안 되는 static body, 없으면 null
- `minX`: 싸움터 왼쪽 끝 근처 (스테이지 arena.startX + 60)

## 메서드
- `static makeTextures(scene, stage, skin)`: 그림 만들기 (`make()` 는 이미 있는 키면 건너뜀 = 아이들 그림 우선)
- `startFight()`, `update(dt)`
- `receiveAttack(rect, attack)`: 플레이어 공격 사각형이 맞았으면 피해를 주고 true. `attack.kind` 는 `'punch' | 'charged' | 'shot' | 'upper'` 등
- `receiveUltimate(damage)`: 궁극기. 맞았으면 true
- `hudParts()`: `[{ label, ratio(0~1), kind: 'part'|'core', locked }]` 최대 4개
- `collapse()`: 슬로모션 뒤 쓰러지는 연출
- 쓰러뜨리면 `defeat()` → `scene.onBossDefeated(this)`

## scene 에서 쓸 수 있는 것
함께하기(친구와 둘이서)면 주인공이 둘이다. 그래서 `scene.player` 를 직접 쓰지 말고:
- 노릴 사람: `this.target` (BossBase, 보스에게서 가장 가까운 살아 있는 주인공. `x`, `y`, `body`)
- 피해 주기: `this.hurtPlayer(rect, damage, fromX, knockback, hits)` (rect 에 닿은 사람 모두. `hits` Set 을 주면 한 사람을 한 번만 때린다)
- 그 밖: `scene.players` (주인공 목록), `scene.playersIn(rect)`, `scene.anyAlive`

`scene.sfxPlay(name)`, `scene.shake(i, ms)`,
`scene.dustAt/gooAt/greenGooAt(x, y, n)`, `scene.robot.say(text, urgent)`, `scene.bossTips`(Set), `scene.gainXp(n, x, y)`,
`scene.spawnMonster(spot)` (부하 소환, spot = `{ x, y, type }`), `scene.monsters`.
