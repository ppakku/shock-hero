// tools/make_aid_art.py 가 만든다. 손으로 고치지 않는다.
// items: 아이템 그림의 가로/세로, boards: 지도판 그림의 가로/세로와 지도를 그릴 빈 안쪽 네모 [왼, 위, 오른, 아래] (0~1),
// forest: 숲의 충전 상자와 전원 그림의 가로/세로
export const AID_ART = {
  "items": {
    "factory": {
      "flare": 0.559,
      "compass": 0.812,
      "toy": 0.66,
      "chalk": 0.379
    },
    "sewer": {
      "flare": 0.504,
      "compass": 0.781,
      "toy": 1.249,
      "chalk": 0.562
    },
    "school": {
      "flare": 0.469,
      "compass": 1.062,
      "toy": 0.703,
      "chalk": 0.582
    },
    "park": {
      "flare": 0.328,
      "compass": 0.77,
      "toy": 0.609,
      "chalk": 0.395
    },
    "mart": {
      "flare": 0.52,
      "compass": 0.75,
      "toy": 0.316,
      "chalk": 0.48
    },
    "station": {
      "flare": 0.73,
      "compass": 0.828,
      "toy": 1.02,
      "chalk": 0.691
    },
    "pool": {
      "flare": 0.426,
      "compass": 0.758,
      "toy": 0.801,
      "chalk": 0.5
    },
    "forest": {
      "flare": 0.652,
      "compass": 0.699,
      "toy": 0.531,
      "chalk": 0.566
    }
  },
  "boards": {
    "factory": {
      "aspect": 1.497,
      "inner": [
        0.0804,
        0.1115,
        0.9196,
        0.8958
      ]
    },
    "sewer": {
      "aspect": 1.571,
      "inner": [
        0.2171,
        0.1684,
        0.7575,
        0.7304
      ]
    },
    "school": {
      "aspect": 1.652,
      "inner": [
        0.1224,
        0.1215,
        0.8825,
        0.8447
      ]
    },
    "park": {
      "aspect": 1.554,
      "inner": [
        0.1283,
        0.2214,
        0.8746,
        0.8105
      ]
    },
    "mart": {
      "aspect": 1.538,
      "inner": [
        0.1254,
        0.1952,
        0.859,
        0.8499
      ]
    },
    "station": {
      "aspect": 1.673,
      "inner": [
        0.1322,
        0.1375,
        0.8668,
        0.8412
      ]
    },
    "pool": {
      "aspect": 1.695,
      "inner": [
        0.115,
        0.165,
        0.895,
        0.84
      ]
    },
    "forest": {
      "aspect": 1.373,
      "inner": [
        0.225,
        0.2844,
        0.776,
        0.6861
      ]
    }
  },
  "forest": {
    "box": 1.076,
    "panel": 0.404
  }
};
