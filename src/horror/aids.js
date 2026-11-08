// 공포 모드 도움 아이템의 화면 쪽: 바닥의 아이템과 벽 지도 3D, 오른쪽 위 아이템 칸, 지도 화면, 나침반 화살표.
// 규칙은 logic/horrorAids.js 가 맡고, 여기서는 HorrorGame 의 손전등, 소리, 안내 글과 잇는다.
import * as THREE from 'three';
import { CELL, cellOf, blocked } from '../logic/horrorGrid.js';
import { KEY_NAMES } from '../logic/horrorRun.js';
import { artLoader, loadArt } from './art.js';
import { AID_ART } from './aidArtSizes.js';
import { createAids, takeAid, useAid, seeBoard, addMark, addAidTargets, seenBoardNear, makeSound, stepSounds, throwSpot, compassGoal, compassYaw, AID_KINDS, AID_NAMES } from '../logic/horrorAids.js';

const SLOT_LABEL = { flare: '조명탄', compass: '나침반', toy: '장난감', chalk: '분필' };
const ITEM_LOOK = { // 바닥에 놓인 모양. 어둠 속에서 찾을 수 있게 스스로 빛난다
  flare: { geo: () => new THREE.CylinderGeometry(0.06, 0.06, 0.38, 8), color: 0xff3a2a, turn: Math.PI / 2 },
  compass: { geo: () => new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), color: 0xffd060, turn: Math.PI / 2 },
  toy: { geo: () => new THREE.SphereGeometry(0.13, 12, 8), color: 0xf0c040, turn: 0 },
  chalk: { geo: () => new THREE.BoxGeometry(0.06, 0.06, 0.28), color: 0xf4f1e6, turn: 0 },
};
const BOARD = { w: 1.3, h: 0.95, y: 1.55, glow: 0.75, seen: 0.35 }; // 벽 지도 크기와 높이 (미터), 밝기
// 맵마다 Gemini 그림 (tools/make_aid_art.py). 그림을 받기 전이나 못 받으면 위의 빛나는 모양과 그린 지도판 그대로다
// item: 바닥 아이템 그림의 긴 쪽 (미터), toy: 던진 장난감 그림의 긴 쪽. board: 그림 지도판의 너비 (미터). stand 면 기둥이 땅에 닿게 세운다
const ART = { item: 0.42, toy: 0.32, glow: 1.5, board: { w: 1.7, y: 1.55 }, stand: { forest: { w: 2.4 } } };
export const artMap = (mapId) => (AID_ART.items[mapId] ? mapId : 'factory');
const MARK = { size: 0.9, y: 0.02, glow: 0.8 }; // 분필 화살표 크기와 바닥에서 높이 (미터)
const COMPASS_EVERY = 0.4; // 나침반 길을 다시 찾는 간격 (초)
const MAP_COLORS = { paper: '#c9b48a', wall: '#3a2a18', locker: '#5a4a34', fuse: '#e0a020', clue: '#c02020', mark: '#ffffff', me: '#1a8a3a', panel: '#7a3ad0', gate: '#30d0c0' };
const LOCK_COLORS = ['#e04848', '#4a8ef0'];
const MINI_CELL = 8; // 작은 지도 한 칸의 그림 크기 (px). 화면에서는 폭에 맞춰 늘거나 준다
const MINI_EVERY = 0.1; // 작은 지도를 다시 그리는 간격 (초)
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// 위에서 내려다본 지도. full 이면 내 자리, 물건, 분필 표시까지 그린다 (벽에 붙은 그림은 길만 그린다)
// paper 가 null 이면 바탕을 칠하지 않고 길 사이 벽만 그린다 (그림 지도판 위에 그릴 때)
export function drawMap(ctx, map, cell, full = null, paper = MAP_COLORS.paper) {
  if (paper) {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, map.w * cell, map.h * cell);
  }
  map.rows.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (ch === '#' || ch === 'E') ctx.fillStyle = MAP_COLORS.wall;
    else if (ch === 'L') ctx.fillStyle = MAP_COLORS.locker;
    else return;
    ctx.fillRect(cx * cell, cy * cell, cell, cell);
  }));
  if (!full) return;
  const { run, aids, p, yaw } = full;
  const box = (c, color, pad = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(c.cx * cell + pad, c.cy * cell + pad, cell - pad * 2, cell - pad * 2);
  };
  const dot = (c, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((c.cx + 0.5) * cell, (c.cy + 0.5) * cell, r, 0, Math.PI * 2);
    ctx.fill();
  };
  run.doors.forEach((d, i) => !d.open && box(d, LOCK_COLORS[i], 0));
  box(run.level.panel, MAP_COLORS.panel, 0);
  box(run.level.gate, MAP_COLORS.gate, 0);
  aids.marks.forEach((m) => dot(m, MAP_COLORS.mark, cell * 0.18));
  run.clues.forEach((c) => !c.taken && box(c, MAP_COLORS.clue, cell * 0.25));
  run.fuses.forEach((f) => !f.taken && dot(f, MAP_COLORS.fuse, cell * 0.38));
  run.keys.forEach((c, i) => !c.taken && dot(c, LOCK_COLORS[i], cell * 0.38));
  // 나: 보는 쪽을 가리키는 세모 (앞이 -y)
  const x = p.x * cell;
  const y = p.y * cell;
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const r = cell * 0.9;
  ctx.fillStyle = MAP_COLORS.me;
  ctx.beginPath();
  ctx.moveTo(x + fx * r, y + fy * r);
  ctx.lineTo(x - fx * r * 0.6 - fy * r * 0.6, y - fy * r * 0.6 + fx * r * 0.6);
  ctx.lineTo(x - fx * r * 0.6 + fy * r * 0.6, y - fy * r * 0.6 - fx * r * 0.6);
  ctx.closePath();
  ctx.fill();
}

function canvasTexture(draw, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 벽에 붙은 안내도 그림. 제목 아래에 길만 그린다
function boardTexture(map, name) {
  const cell = 8;
  const w = map.w * cell + 24;
  const h = map.h * cell + 56;
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#d8c9a0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${name} 안내도`, w / 2, 34);
    ctx.save();
    ctx.translate(12, 44);
    drawMap(ctx, map, cell);
    ctx.restore();
  }, w, h);
}

// 그림 지도판: 테두리 그림의 빈 안쪽 inner [왼, 위, 오른, 아래] (0~1) 에 제목과 길을 그린다
function boardArtTexture(img, inner, map, name) {
  const w = img.width;
  const h = img.height;
  return canvasTexture((ctx) => {
    ctx.drawImage(img, 0, 0, w, h);
    const x0 = inner[0] * w;
    const y0 = inner[1] * h;
    const iw = (inner[2] - inner[0]) * w;
    const ih = (inner[3] - inner[1]) * h;
    const title = Math.round(ih * 0.16);
    ctx.fillStyle = '#2a1e12';
    ctx.font = `bold ${Math.round(title * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${name} 안내도`, x0 + iw / 2, y0 + title / 2, iw);
    const cell = Math.min(iw / map.w, (ih - title) / map.h);
    ctx.save();
    ctx.translate(x0 + (iw - map.w * cell) / 2, y0 + title + (ih - title - map.h * cell) / 2);
    ctx.globalAlpha = 0.85;
    drawMap(ctx, map, cell, null, null);
    ctx.restore();
  }, w, h);
}

// 바닥에 그리는 분필 화살표. 그림 위쪽이 앞이다
function markTexture() {
  return canvasTexture((ctx) => {
    ctx.strokeStyle = '#f4f1e6';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(64, 112);
    ctx.lineTo(64, 18);
    ctx.moveTo(26, 56);
    ctx.lineTo(64, 18);
    ctx.lineTo(102, 56);
    ctx.stroke();
  }, 128, 128);
}

const css = (el, text) => {
  el.style.cssText = text;
  return el;
};

export class HorrorAids {
  // g: HorrorGame. 판의 물건(퓨즈, 열쇠, 단서, 쪽지)과 겹치지 않게 놓는다
  constructor(g, rand = Math.random) {
    this.g = g;
    this.k = g.k.aids;
    const { run, map } = g;
    this.easy = Boolean(g.easy);
    this.state = createAids(map, this.k, rand, [...run.fuses, ...run.keys, ...run.clues, ...map.notes], this.easy);
    this.mapT = 0; // 지도가 열려 있는 남은 시간
    this.flareT = 0;
    this.compassT = 0;
    this.compassAgain = 0;
    this.compass = null;
    this.chalkT = 0;
    this.pending = null; // 터치로 누른 아이템 칸
    this.textures = [];
    this.group = new THREE.Group();
    g.scene.add(this.group);
    this.art = artMap(g.round?.mapId);
    this.loader = artLoader();
    this.itemMats = {}; // 종류마다 그림 한 장. 받으면 바닥 아이템과 던진 장난감이 같이 쓴다
    this.buildItems();
    this.buildBoards(g.place.name);
    this.markTex = markTexture();
    this.textures.push(this.markTex);
    this.markMat = new THREE.MeshBasicMaterial({ map: this.markTex, transparent: true, depthWrite: false });
    this.markMat.color.setScalar(MARK.glow);
    this.markGeo = new THREE.PlaneGeometry(MARK.size, MARK.size);
    // 던진 장난감. 그림을 받으면 바닥에 선 그림으로 바뀐다
    this.toy = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: ITEM_LOOK.toy.color }));
    const toySprite = this.itemSprite('toy', ball, ART.toy, true);
    toySprite.position.y = -0.11; // throwToy 가 공 가운데 높이에 놓으므로 그림 밑은 바닥으로 내린다
    this.toy.add(ball, toySprite);
    this.toy.visible = false;
    this.group.add(this.toy);
    this.buildHud(g.root, g.touch);
    this.showSlots();
  }

  // 종류마다 그림 재질 하나. 불빛과 상관없이 밝게 그려 어둠 속에서도 찾을 수 있다
  itemMat(kind) {
    if (!this.itemMats[kind]) {
      const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.3 });
      mat.color.setScalar(ART.glow);
      const shown = [];
      this.itemMats[kind] = { mat, shown };
      const tex = loadArt(this.loader, `aid_${this.art}_${kind}.webp`, () => {
        mat.map = tex;
        mat.needsUpdate = true;
        shown.forEach(([sprite, prim]) => {
          sprite.visible = true;
          prim.visible = false;
        });
      });
      if (tex) this.textures.push(tex);
    }
    return this.itemMats[kind];
  }

  // 어디서 봐도 정면인 아이템 그림. 그림을 받기 전에는 숨기고, 받으면 prim (빛나는 모양) 을 숨긴다. floor 면 밑이 바닥에 닿는다
  itemSprite(kind, prim, size, floor = false) {
    const { mat, shown } = this.itemMat(kind);
    const aspect = AID_ART.items[this.art][kind];
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size * Math.min(1, aspect), size * Math.min(1, 1 / aspect), 1);
    if (floor) sprite.center.set(0.5, 0);
    sprite.visible = false;
    shown.push([sprite, prim]);
    return sprite;
  }

  buildItems() {
    this.itemMeshes = this.state.items.map((c) => {
      const look = ITEM_LOOK[c.kind];
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(look.geo(), new THREE.MeshBasicMaterial({ color: look.color }));
      mesh.rotation.z = look.turn;
      holder.add(mesh, this.itemSprite(c.kind, mesh, ART.item));
      holder.position.set((c.cx + 0.5) * CELL, 0.6, (c.cy + 0.5) * CELL);
      this.group.add(holder);
      return holder;
    });
  }

  buildBoards(name) {
    const tex = boardTexture(this.g.map, name);
    this.textures.push(tex);
    this.boardMeshes = this.state.boards.map((b) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      mat.color.setScalar(BOARD.glow);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), mat);
      // 벽 바로 앞에 붙이고 앞면이 방 쪽을 보게 돌린다
      mesh.position.set((b.cx + 0.5 + b.dx * 0.49) * CELL, BOARD.y, (b.cy + 0.5 + b.dy * 0.49) * CELL);
      mesh.rotation.y = Math.atan2(-b.dx, -b.dy);
      this.group.add(mesh);
      return mesh;
    });
    // 그림 지도판을 받으면 테두리 그림 안에 같은 지도를 그려 바꿔 끼운다. 숲은 기둥이 땅에 닿게 세운다
    const look = AID_ART.boards[this.art];
    const frame = loadArt(this.loader, `aid_board_${this.art}.webp`, () => {
      if (!frame.image) return;
      const art = boardArtTexture(frame.image, look.inner, this.g.map, name);
      this.textures.push(art);
      const stand = ART.stand[this.art];
      const w = stand ? stand.w : ART.board.w;
      const h = w / look.aspect;
      for (const mesh of this.boardMeshes) {
        mesh.material.map = art;
        mesh.material.alphaTest = 0.5;
        mesh.material.needsUpdate = true;
        mesh.geometry.dispose();
        mesh.geometry = new THREE.PlaneGeometry(w, h);
        mesh.position.y = stand ? h / 2 : ART.board.y;
      }
    });
    if (frame) this.textures.push(frame);
  }

  buildHud(root, touch) {
    const box = css(document.createElement('div'), 'position:absolute;inset:0;z-index:4;pointer-events:none;font:16px sans-serif;color:#eee');
    root.appendChild(box);
    this.box = box;
    const row = css(document.createElement('div'), 'position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:calc(8px + env(safe-area-inset-top,0px));display:flex;gap:6px');
    box.appendChild(row);
    const size = this.g.device === 'phone' ? 44 : 54;
    this.slots = AID_KINDS.map((kind, i) => {
      const el = document.createElement(touch ? 'button' : 'div');
      css(el, `position:relative;width:${size}px;height:${size}px;border-radius:50%;border:2px solid #777;background:rgba(40,40,40,.6);color:#eee;font:${size > 50 ? 12 : 11}px sans-serif;line-height:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;touch-action:none;pointer-events:${touch ? 'auto' : 'none'}`);
      el.title = SLOT_LABEL[kind];
      el.setAttribute?.('aria-label', SLOT_LABEL[kind]);
      // 이번 맵의 아이템 그림. 못 받으면 그림을 숨기고 글자만 남는다. 터치 화면은 개수 표시와 겹치지 않게 이름을 위에 쓴다
      const icon = `<img src="art/aid_${this.art}_${kind}.webp" alt="" draggable="false" onerror="this.style.display='none'" style="position:absolute;left:6px;top:${touch ? 9 : 3}px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;filter:drop-shadow(0 0 3px #000)">`;
      const digit = touch ? '' : `<span style="position:absolute;left:3px;top:0;font-size:10px;color:#aaa;text-shadow:0 0 3px #000">${i + 1}</span>`;
      el.innerHTML = `${icon}<span style="position:absolute;left:0;right:0;${touch ? 'top:1px' : 'bottom:1px'};font-size:${size > 50 ? 10 : 9}px;text-shadow:0 0 3px #000,0 0 3px #000">${SLOT_LABEL[kind]}</span>${digit}<span style="position:absolute;right:-4px;bottom:-4px;min-width:12px;padding:0 4px;border-radius:9px;background:#3a1414;border:1px solid #a33;font-size:11px"></span>`;
      if (touch) {
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault(); // 같은 자리로 마우스 클릭이 새어 나가지 않게 한다
          e.stopPropagation();
          this.pending = kind;
        });
      }
      row.appendChild(el);
      return { el, count: el.lastChild, kind };
    });
    // 나침반 화살표
    this.arrow = css(document.createElement('div'), 'position:absolute;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:2px;color:#ffd080;font-size:14px;text-shadow:0 0 4px #000');
    this.arrow.innerHTML = '<svg width="48" height="48" viewBox="0 0 46 46" style="filter:drop-shadow(0 0 6px #ffd08088)"><path d="M23 4 L38 30 L27 26 L27 42 L19 42 L19 26 L8 30 Z" fill="#ffd080"/></svg><span></span>';
    this.arrowSvg = this.arrow.firstChild;
    this.arrowText = this.arrow.lastChild;
    box.appendChild(this.arrow);
    // 쉬움: 왼쪽 위에 늘 떠 있는 작은 지도. 체력 막대 밑에 둔다 (휴대폰은 화면이 낮아 조금 작게)
    if (this.easy) {
      const wide = this.g.device === 'phone' ? '24vw' : 'min(24vw,300px)';
      this.mini = css(document.createElement('canvas'), `position:absolute;left:calc(16px + env(safe-area-inset-left,0px));top:calc(56px + env(safe-area-inset-top,0px));width:${wide};height:auto;opacity:.88;border:2px solid rgba(255,255,255,.35);border-radius:4px;box-shadow:0 2px 10px #000;image-rendering:pixelated`);
      this.mini.dataset.miniMap = '';
      this.miniT = 0;
      box.appendChild(this.mini);
      this.paintMini();
    }
    // 지도 화면
    this.mapLayer = css(document.createElement('div'), 'position:absolute;inset:0;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;box-sizing:border-box;background:rgba(0,0,0,.84)');
    this.mapTimer = css(document.createElement('div'), 'font:bold 22px monospace;color:#ffd080');
    this.mapCanvas = css(document.createElement('canvas'), 'max-width:94%;max-height:72%;border-radius:3px;box-shadow:0 4px 20px #000;image-rendering:pixelated');
    const legend = css(document.createElement('div'), 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;font-size:13px');
    const marks = [['나', MAP_COLORS.me], ['퓨즈', MAP_COLORS.fuse], [`${KEY_NAMES[0]} 열쇠, 문`, LOCK_COLORS[0]], [`${KEY_NAMES[1]} 열쇠, 문`, LOCK_COLORS[1]], ['붉은 쪽지', MAP_COLORS.clue], ['전원', MAP_COLORS.panel], ['정문', MAP_COLORS.gate], ['분필', MAP_COLORS.mark]];
    legend.innerHTML = marks.map(([t, c]) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px;background:${c}"></i>${t}</span>`).join('');
    const warn = css(document.createElement('div'), 'font-size:14px;color:#ffb0a0');
    warn.textContent = `지도를 보는 동안 움직일 수 없고, 괴물이 소리를 듣고 다가온다 (${touch ? '사용' : 'E'}: 닫기)`;
    this.mapLayer.append(this.mapTimer, this.mapCanvas, legend, warn);
    box.appendChild(this.mapLayer);
  }

  showSlots() {
    for (const s of this.slots) {
      const n = this.state.held[s.kind];
      s.count.textContent = n === Infinity ? '∞' : n;
      s.el.style.opacity = n > 0 ? '1' : '0.35';
    }
  }

  get mapOpen() {
    return this.mapT > 0;
  }

  // 손이 닿는 아이템과 지도를 nearestUse 에 더한다
  targets(add) {
    addAidTargets(this.state, add);
  }

  seenNear() {
    return this.g.hidden === null ? seenBoardNear(this.state, this.g.p, this.g.k.useRange) : null;
  }

  // nearestUse 가 고른 것을 쓴다. 아이템이나 지도가 아니면 false
  use(t) {
    if (t.kind === 'aid') {
      const item = this.state.items[t.index];
      if (!takeAid(this.state, t.index, this.k)) return true;
      this.itemMeshes[t.index].visible = false;
      this.g.audio?.play('fuse');
      const n = AID_KINDS.indexOf(item.kind) + 1;
      this.g.hud.say(`${AID_NAMES[item.kind]}을 주웠다! ${this.g.touch ? '오른쪽 위 칸을 눌러' : `${n}번을 눌러`} 쓰자`, 3);
      this.showSlots();
      return true;
    }
    if (t.kind === 'board') {
      if (seeBoard(this.state, t.index)) this.openMap(t.index);
      return true;
    }
    return t.kind === 'seenBoard';
  }

  openMap(i) {
    this.mapT = this.k.boardTime;
    this.boardMeshes[i].material.color.setScalar(BOARD.seen);
    this.g.audio?.play('map');
    this.mapLayer.style.display = 'flex';
    this.paintMap();
  }

  paintMap() {
    const cell = 12;
    const { map, run, p, yaw } = this.g;
    this.mapCanvas.width = map.w * cell;
    this.mapCanvas.height = map.h * cell;
    const ctx = this.mapCanvas.getContext('2d');
    if (ctx) drawMap(ctx, map, cell, { run, aids: this.state, p, yaw });
    this.mapTimer.textContent = Math.ceil(this.mapT);
    this.mapTimer.style.color = this.mapT <= 3 ? '#e04848' : '#ffd080';
  }

  // 작은 지도는 MINI_EVERY 초마다 다시 그린다. 내 세모가 따라 움직인다
  paintMini() {
    const { map, run, p, yaw } = this.g;
    this.mini.width = map.w * MINI_CELL;
    this.mini.height = map.h * MINI_CELL;
    const ctx = this.mini.getContext('2d');
    if (ctx) drawMap(ctx, map, MINI_CELL, { run, aids: this.state, p, yaw });
  }

  // 열려 있었으면 닫고 true
  closeMap() {
    if (!this.mapOpen) return false;
    this.mapT = 0;
    this.mapLayer.style.display = 'none';
    return true;
  }

  // 일시정지 때는 지도를 가렸다가 계속하면 다시 보인다 (남은 시간은 그대로)
  setPaused(paused) {
    this.mapLayer.style.display = this.mapOpen && !paused ? 'flex' : 'none';
  }

  // 판에서 누른 아이템. 키보드 숫자는 정문 번호 칸이 닫혀 있을 때만 아이템이다
  pressed(typed) {
    const kind = this.pending;
    this.pending = null;
    if (kind) return kind;
    const digit = typed?.find((d) => d >= '1' && d <= String(AID_KINDS.length));
    return digit ? AID_KINDS[Number(digit) - 1] : null;
  }

  // 아이템을 쓴다. 없거나 숨어 있으면 글만 띄운다
  useKind(kind) {
    const g = this.g;
    if (g.hidden !== null) {
      g.hud.say('숨어 있을 때는 쓸 수 없다', 1.5);
      return;
    }
    if (this.mapOpen) return;
    if (!useAid(this.state, kind)) {
      g.hud.say(`${AID_NAMES[kind]}이 없다`, 1.5);
      return;
    }
    if (kind === 'flare') this.fireFlare();
    if (kind === 'compass') {
      this.compassT = this.k.compassTime;
      this.compassAgain = 0;
      g.audio?.play('codeKey');
    }
    if (kind === 'toy') this.throwToy();
    if (kind === 'chalk') this.drawMark();
    this.showSlots();
  }

  fireFlare() {
    const g = this.g;
    this.flareT = this.k.flareTime;
    makeSound(this.state, cellOf(g.p), this.k.flareNoise, 0.2, false);
    g.audio?.play('flare');
    g.hud.say('펑! 근처 괴물이 소리를 들었다. 빨리 떠나자', 3);
  }

  throwToy() {
    const g = this.g;
    const spot = throwSpot(g.map, g.p, g.yaw, this.k.toyRange);
    makeSound(this.state, spot, this.k.toyNoise, this.k.toyTime, true);
    this.toy.position.set((spot.cx + 0.5) * CELL, 0.12, (spot.cy + 0.5) * CELL);
    this.toy.visible = true;
    this.toyT = this.k.toyTime;
    g.audio?.play('toy');
    g.hud.say('딸랑딸랑... 괴물이 소리 쪽으로 간다', 3);
  }

  drawMark() {
    const g = this.g;
    const c = cellOf(g.p);
    if (blocked(g.map, c.cx, c.cy)) return;
    const mark = addMark(this.state, c, g.yaw);
    this.marks ??= new Map();
    const key = `${c.cx},${c.cy}`;
    let mesh = this.marks.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(this.markGeo, this.markMat);
      mesh.rotation.order = 'YXZ';
      mesh.position.set((c.cx + 0.5) * CELL, MARK.y, (c.cy + 0.5) * CELL);
      this.group.add(mesh);
      this.marks.set(key, mesh);
    }
    mesh.rotation.set(-Math.PI / 2, mark.yaw, 0);
    this.chalkT = this.k.chalkPause;
    g.audio?.play('chalk');
    g.hud.say(this.easy ? '분필 표시를 남겼다' : `분필 표시를 남겼다 (${this.state.held.chalk}번 남음)`, 2);
  }

  // 판이 도는 동안 한 번. 지도가 열려 있거나 분필을 그리는 동안은 움직이지 못한다
  tick(dt, typed) {
    const kind = this.pressed(typed);
    if (kind) this.useKind(kind);
    stepSounds(this.state, dt);
    for (const m of this.itemMeshes) if (m.visible) m.rotation.y += dt * 1.5;
    if (this.toyT > 0 && (this.toyT -= dt) <= 0) this.toy.visible = false;
    this.chalkT = Math.max(0, this.chalkT - dt);
    if (this.mapOpen) {
      this.mapT -= dt;
      if (this.mapT <= 0) this.closeMap();
      else this.mapTimer.textContent = Math.ceil(this.mapT);
      if (this.mapT <= 3) this.mapTimer.style.color = '#e04848';
    }
    this.tickFlare(dt);
    this.tickCompass(dt);
    if (this.mini && (this.miniT -= dt) <= 0) {
      this.miniT = MINI_EVERY;
      this.paintMini();
    }
  }

  get frozen() {
    return this.mapOpen || this.chalkT > 0;
  }

  // 환한 정도 (0~1). 끝날 때 flareFade 동안 줄어든다
  get flareLevel() {
    return Math.min(1, this.flareT / this.k.flareFade);
  }

  tickFlare(dt) {
    if (this.flareT <= 0) return;
    const g = this.g;
    this.flareT = Math.max(0, this.flareT - dt);
    this.applyFlare();
    if (this.flareT === 0) g.hud.say('다시 어두워졌다', 1.5);
  }

  // 놀람 장면은 스스로 불을 끄고 켜므로 그동안은 손대지 않는다
  applyFlare() {
    const g = this.g;
    const f = this.flareLevel;
    if (!g.scare) {
      const bright = Math.max(g.ambient, g.k.ambient * this.k.flareAmbient);
      g.ambientLight.intensity = g.ambient + (bright - g.ambient) * f;
    }
    g.scene.fog.far = g.fogFar * (1 + (this.k.flareFog - 1) * f); // 숲은 해 질 녘 안개에서 늘리고 돌아온다
  }

  // 잡히면 조명탄과 지도를 끝낸다. 나침반과 분필 표시는 그대로다
  stop() {
    this.closeMap();
    if (this.flareT > 0) {
      this.flareT = 0;
      this.g.scene.fog.far = this.g.fogFar;
    }
    this.chalkT = 0;
  }

  tickCompass(dt) {
    if (this.compassT <= 0) {
      this.arrow.style.display = 'none';
      return;
    }
    const g = this.g;
    this.compassT = Math.max(0, this.compassT - dt);
    this.compassAgain -= dt;
    if (this.compassAgain <= 0) {
      this.compassAgain = COMPASS_EVERY;
      this.compass = compassGoal(g.run, g.k, g.p);
    }
    this.arrow.style.display = this.compassT > 0 && !this.mapOpen ? 'flex' : 'none';
    if (!this.compass) {
      this.arrowSvg.style.visibility = 'hidden';
      this.arrowText.textContent = '갈 곳을 찾지 못했다';
      return;
    }
    const yaw = this.compass.path.length ? compassYaw(g.map, g.p, this.compass.path, this.k.compassAhead) : null;
    this.arrowSvg.style.visibility = yaw === null ? 'hidden' : 'visible';
    if (yaw !== null) this.arrowSvg.style.transform = `rotate(${-wrapAngle(yaw - g.yaw)}rad)`;
    this.arrowText.textContent = `${this.compass.path.length ? `${this.compass.name} 쪽` : `${this.compass.name} 바로 앞`}, ${Math.ceil(this.compassT)}초`;
  }

  destroy() {
    this.textures.forEach((t) => t.dispose());
    this.box.remove();
  }
}
