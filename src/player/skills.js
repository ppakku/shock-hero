// 주인공 기술(궁극기, 에너지탄, 대공 공격 등)을 관리하는 곳.
// GameScene 이 만들고 매 프레임 update 를 부른다. Player 는 scene.skills 로 접근한다.
export class HeroSkills {
  constructor(scene) {
    this.scene = scene;
  }

  update(_dt) {}

  // 화면을 바꾸거나 스테이지가 끝날 때
  destroy() {}
}
