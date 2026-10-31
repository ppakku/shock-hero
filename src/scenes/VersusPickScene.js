import Phaser from 'phaser';
import { sfx } from '../audio/sfx.js';
import { saveStore } from '../save.js';
import { coop } from '../net/coop.js';
import { CONTROL_KEYS } from '../logic/controls.js';
import { HERO_IDS, HERO_INFO, cycleHero, normalizeHero } from '../logic/heroes.js';
import { newMatch, sideName } from '../logic/versus.js';
import { HERO_LOOKS, fitHero } from '../fx/heroTextures.js';
import { isTouchDevice } from '../ui/touch.js';
import { makeText } from '../ui/text.js';

const KEY = Phaser.Input.Keyboard.KeyCodes;
// 주인공 수만큼 960 너비에 나란히 놓는다 (카드 5장이면 양쪽 여백 29)
const CARD_W = 174;
const CARD_GAP = 8;
const CARD_XS = HERO_IDS.map((_, i) => 480 + (i - (HERO_IDS.length - 1) / 2) * (CARD_W + CARD_GAP));
const CARD_Y = 232;
const CARD_H = 250;
const SIDE_COLORS = [0x7af0ff, 0xffd23f];

// 겨루기 주인공 고르기. 방장 기기에서 돌고, 친구는 영상으로 같은 화면을 보며 자기 키로 고른다.
// 친구 키는 게임과 같은 길(coop.takeInput)로 온다: 왼쪽 오른쪽으로 옮기고, 공격이나 점프로 결정 (다시 누르면 취소).
// 여기서 고른 주인공은 이번 겨루기에만 쓰고 저장은 바꾸지 않는다. 둘 다 결정하면 첫 판을 시작한다.
export class VersusPickScene extends Phaser.Scene {
  constructor() {
    super('VersusPick');
  }

  // data.heroes: '한 번 더' 로 왔으면 지난 판의 두 주인공
  create(data = {}) {
    const save = saveStore.load();
    const start = data.heroes || [save.settings.hero, coop.partner?.hero ?? 'gunner'];
    this.picks = start.map((id) => ({ hero: normalizeHero(id), locked: false }));
    this.starting = false;
    this.prev = null; // 친구가 지난 프레임에 누르던 키 (이 화면에 들어올 때 누르고 있던 키는 결정으로 치지 않는다)
    this.touch = isTouchDevice();

    this.add.rectangle(480, 270, 960, 540, 0x0b0e14, 1);
    makeText(this, 480, 44, '겨루기 주인공 고르기', 34, '#ff8a6a', { strokeThickness: 7 }).setOrigin(0.5);
    this.cards = HERO_IDS.map((id, i) => this.makeCard(id, CARD_XS[i]));
    this.status = [0, 1].map((side) => makeText(this, side ? 720 : 240, 432, '', 20, side ? '#ffd23f' : '#7af0ff').setOrigin(0.5));
    const help = this.touch ? '1P: 카드를 누른 뒤 결정 버튼' : '1P: 왼쪽 오른쪽으로 고르고 Enter 로 결정 (다시 누르면 취소)    Esc: 방으로';
    makeText(this, 480, 476, help, 15, '#cccccc').setOrigin(0.5);
    makeText(this, 480, 502, '2P: 왼쪽 오른쪽으로 고르고 공격이나 점프로 결정', 15, '#cccccc').setOrigin(0.5);
    if (this.touch) {
      makeText(this, 240, 396, '결정', 22, '#ffffff', { backgroundColor: '#1d2a44', padding: { x: 28, y: 8 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.toggle(0));
    }

    const scheme = CONTROL_KEYS[save.settings.controls] || CONTROL_KEYS.classic;
    const addKeys = (names) => names.map((n) => this.input.keyboard.addKey(KEY[n]));
    this.keys = { left: addKeys(scheme.left), right: addKeys(scheme.right), confirm: addKeys([...scheme.attack, ...scheme.jump, 'ENTER']) };
    this.input.keyboard.on('keydown-ESC', () => this.leave());

    coop.sendInfo('');
    const off = coop.on((e) => e === 'lost' && this.leave());
    this.events.once('shutdown', off);
    this.paint();
  }

  makeCard(id, x) {
    const info = HERO_INFO[id];
    const c = this.add.container(x, CARD_Y);
    const bg = this.add.graphics();
    bg.fillStyle(0x1c2028, 0.95).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);
    const key = `${HERO_LOOKS[id].prefix}_idle0`;
    const custom = id === 'shock' && this.registry.get('heroCustomArt');
    const img = this.add.image(0, 20, custom || !this.textures.exists(key) ? 'player' : key).setOrigin(0.5, 1);
    fitHero(img, 120);
    const name = makeText(this, 0, 44, info.name, 22, info.color, { strokeThickness: 5 }).setOrigin(0.5);
    const short = makeText(this, 0, 86, info.short, 14, '#dddddd', { wordWrap: { width: CARD_W - 18 } }).setOrigin(0.5);
    const ring = this.add.graphics();
    const tags = [0, 1].map((side) => makeText(this, side ? 62 : -62, -CARD_H / 2 + 22, sideName(side), 20, side ? '#ffd23f' : '#7af0ff').setOrigin(0.5));
    c.add([bg, img, name, short, ring, ...tags]);
    c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(0, id));
    return { id, ring, tags };
  }

  paint() {
    for (const card of this.cards) {
      card.ring.clear();
      this.picks.forEach((pick, side) => {
        const here = pick.hero === card.id;
        card.tags[side].setVisible(here);
        if (!here) return;
        const gap = side * 7; // 둘이 같은 카드면 테두리 두 겹
        card.ring
          .lineStyle(pick.locked ? 6 : 3, SIDE_COLORS[side], 1)
          .strokeRoundedRect(-CARD_W / 2 + gap, -CARD_H / 2 + gap, CARD_W - gap * 2, CARD_H - gap * 2, 14);
      });
    }
    this.picks.forEach((pick, side) => {
      this.status[side].setText(`${sideName(side)} ${HERO_INFO[pick.hero].name}${pick.locked ? ': 결정!' : ': 고르는 중'}`);
    });
  }

  choose(side, hero) {
    const pick = this.picks[side];
    if (this.starting || pick.locked || pick.hero === hero) return;
    pick.hero = hero;
    sfx.play('beep');
    this.paint();
  }

  toggle(side) {
    if (this.starting) return;
    const pick = this.picks[side];
    pick.locked = !pick.locked;
    sfx.play(pick.locked ? 'powerup' : 'beep');
    this.paint();
    if (!this.picks.every((p) => p.locked)) return;
    this.starting = true;
    this.time.delayedCall(700, () => {
      this.scene.start('Game', { versus: newMatch(this.picks.map((p) => p.hero)) });
      this.scene.launch('HUD');
    });
  }

  // 친구가 누른 키 (인터넷 함께하기는 coop.takeInput(), 시험용 ?duo 는 window.__p2)
  readFriend() {
    if (coop.hostConnected) return coop.takeInput();
    const i = { ...window.__p2 };
    if (window.__p2) window.__p2.jumpPressed = false;
    return i;
  }

  update() {
    const justDown = (keys) => keys.map((key) => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    if (justDown(this.keys.left)) this.choose(0, cycleHero(this.picks[0].hero, -1));
    if (justDown(this.keys.right)) this.choose(0, cycleHero(this.picks[0].hero, 1));
    if (justDown(this.keys.confirm)) this.toggle(0);

    const i = this.readFriend();
    const was = this.prev ?? i;
    if (i.left && !was.left) this.choose(1, cycleHero(this.picks[1].hero, -1));
    if (i.right && !was.right) this.choose(1, cycleHero(this.picks[1].hero, 1));
    if ((i.attackDown && !was.attackDown) || (this.prev && i.jumpPressed)) this.toggle(1);
    this.prev = i;
  }

  leave() {
    this.scene.start('Title', { openRoom: true });
  }
}
