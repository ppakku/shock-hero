import Phaser from 'phaser';
import { chooseBossAttack } from '../logic/boss.js';
import { makeText } from '../ui/text.js';

// 새 보스를 만들 때 쓰면 편한 공통 도우미.
// 꼭 상속할 필요는 없지만, README.md 의 약속(속성과 메서드)은 지켜야 한다.
export class BossBase {
  constructor(scene, cfg, stage, skin) {
    this.scene = scene;
    this.cfg = cfg;
    this.c = cfg.boss;
    this.def = stage.boss;
    this.name = this.def.name;
    this.skin = skin;
    this.groundY = stage.groundY;
    this.arenaStart = stage.arena.startX;
    this.arenaEnd = stage.arena.endX;
    this.minX = stage.arena.startX + 60;
    this.maxX = stage.arena.endX - 60;
    this.bodyX = stage.arena.endX - 150; // 쓰러질 때 연출 위치 (움직이는 보스는 계속 갱신)
    this.hpScale = this.def.healthScale || 1;
    this.tempo = this.def.speedScale || 1;
    this.blocker = null; // 플레이어가 통과하면 안 되는 몸통이 있으면 static body 를 넣는다

    this.state = 'dormant';
    this.defeated = false;
    this.raging = false;
    this.timer = 0;
    this.t = 0;
    this.lastType = null;
    this.lastBlockedAt = -10;

    this.warn = scene.add.graphics().setDepth(2);
    this.fxG = scene.add.graphics().setDepth(8);
    this.labels = [];
  }

  // 시간에 곱하는 값 (작을수록 빠름). 분노하면 30% 빨라진다.
  get speed() {
    return this.tempo * (this.raging ? 0.7 : 1);
  }

  startFight() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.timer = 1.8;
  }

  // 상태 진행: intro 가 끝나면 fight. 하위 클래스 update 맨 앞에서 부른다. fight 중이면 true.
  tickState(dt) {
    this.t += dt;
    if (this.state === 'intro') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'fight';
        this.timer = 0.6;
      }
      return false;
    }
    return this.state === 'fight';
  }

  // phases[단계] 목록에서 다음 공격 고르기 (방금 한 공격은 되도록 피함)
  pickAttack(phaseIndex, armsAlive = 0) {
    const phases = this.def.phases;
    const idx = Math.min(phaseIndex, phases.length - 1);
    const list = phases[idx] || [];
    const fresh = list.length > 1 ? list.filter((p) => p !== this.lastType) : list;
    const type = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : chooseBossAttack(phases, armsAlive, armsAlive);
    this.lastType = type;
    return type;
  }

  // 체력 비율이 절반 아래로 내려가면 분노 모드 (한 번만)
  checkRage(ratio, sprites = []) {
    if (this.raging || ratio > 0.5 || this.defeated) return;
    this.raging = true;
    this.scene.sfxPlay('roar');
    this.scene.shake(0.012, 500);
    for (const s of sprites) if (s?.active) s.setTint(0xff7070);
    this.scene.robot.say('보스가 화났어! 공격이 빨라진다, 조심해!', true);
  }

  // 경고 글자 (프레임마다 다시 그림)
  label(i, text, x, y, size = 22, color = '#ff5555') {
    if (!this.labels[i]) this.labels[i] = makeText(this.scene, 0, 0, '', size, color).setOrigin(0.5).setDepth(31);
    this.labels[i].setText(text).setFontSize(size).setColor(color).setPosition(x, y).setVisible(true);
  }

  hideLabels() {
    for (const l of this.labels) l?.setVisible(false); // 번호를 건너뛰어 만든 글자도 있을 수 있음
  }

  clearFx() {
    this.warn.clear();
    this.fxG.clear();
    this.hideLabels();
  }

  // 처음 보는 공격이면 로봇이 한 번 알려 준다
  tip(type, text) {
    const said = this.scene.bossTips;
    if (!text || said.has(type)) return;
    said.add(type);
    this.scene.robot.say(text, true);
  }

  // 노릴 주인공: 함께하기면 보스 몸에서 가장 가까운 살아 있는 사람 (혼자면 늘 1P)
  get target() {
    return this.scene.nearestPlayer(this.bodyX);
  }

  // rect 에 닿은 주인공 모두에게 피해 (대시 무적이면 'dodged', 아무도 안 닿으면 'miss')
  // hits (Set) 를 주면 이미 맞은 사람은 건너뛴다 (한 번만 때리는 공격)
  hurtPlayer(rect, damage, fromX, knockback, hits = null) {
    return this.scene.hurtPlayersIn(rect, damage, fromX, knockback, hits);
  }

  defeat() {
    if (this.defeated) return;
    this.defeated = true;
    this.state = 'dead';
    this.clearFx();
    this.scene.onBossDefeated(this);
  }

  // 아래는 하위 클래스가 채운다
  update(_dt) {}
  receiveAttack(_rect, _attack) {
    return false;
  }
  receiveUltimate(_damage) {
    return false;
  }
  hudParts() {
    return [];
  }
  collapse() {}
}
