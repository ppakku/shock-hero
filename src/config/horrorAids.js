// 공포 모드에서 길 찾기를 돕는 아이템. 쓸 수 있는 수가 정해져 있고, 지도와 조명탄은 괴물을 부른다 (balance.horror.aids)
export const horrorAids = {
  boards: 3, // 맵마다 벽에 붙는 지도 수. 한 장은 한 판에 한 번 본다
  boardTime: 10, // 지도를 볼 수 있는 시간 (초). 보는 동안 못 움직이고 달릴 때만큼 소리가 난다
  count: { flare: 2, compass: 1, toy: 2, chalk: 1 }, // 한 판에 바닥에 놓이는 수
  flareTime: 5, // 조명탄으로 환한 시간 (초)
  flareFade: 1, // 끝날 때 어둠으로 돌아가는 시간 (초). 갑자기 깜깜해져 놀라지 않게 한다
  flareAmbient: 7, // 환한 동안 윤곽 밝기 배수
  flareFog: 2.2, // 환한 동안 어둠에 묻히는 거리 배수
  flareNoise: 12, // 조명탄 터지는 소리가 들리는 거리 (칸)
  compassTime: 15, // 나침반 화살표가 떠 있는 시간 (초)
  compassAhead: 4, // 화살표는 길에서 이 칸 안쪽의 보이는 칸을 가리킨다
  toyRange: 6, // 장난감을 던지는 거리 (칸)
  toyTime: 4, // 장난감이 딸랑거리는 시간 (초)
  toyNoise: 10, // 장난감 소리가 들리는 거리 (칸)
  gazerLure: 2.5, // 눈뜬이가 장난감 쪽으로 끌려가는 시간 (초). 소리보다 눈이라 짧다
  chalkUses: 10, // 분필 한 자루로 그리는 수
  chalkPause: 0.5, // 그리는 동안 멈추는 시간 (초)
};
