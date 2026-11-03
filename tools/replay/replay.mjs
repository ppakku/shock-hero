// 같은 입력으로 게임을 다시 돌려 녹화하고, 두 녹화를 프레임마다 비교하는 도구 (개발용)
//
//   node tools/replay/replay.mjs record <시나리오.js> <폴더> [--runs 2]
//   node tools/replay/replay.mjs compare <폴더A> <폴더B>
//
// 같은 결과가 나오게 하는 장치 세 가지
// 1. Playwright 가상 시계: 시각을 항상 같은 값에서 출발시켜 도구가 정한 만큼만 흐르게 한다.
//    출발 시각이 다르면 물리 엔진의 소수점 오차가 달라져 점프 높이가 바뀐다.
// 2. 스테이지를 한 번 열어 그림을 받아 둔 뒤 정해진 시각에 다시 시작한다 (첫 로딩은 실제 시간이 걸림).
// 3. 다시 시작하는 순간 Math.random 을 같은 씨앗으로 다시 맞춘다 (보물 자리, 불꽃).
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const START = 1000; // 가상 시계 출발 시각 (고정)
const STEP = 50; // 가상 시계를 한 번에 밀어 주는 크기 (ms)
const TITLE_AT = 3000; // 이 시각까지 타이틀 로딩
const WARM = 1500; // 스테이지를 한 번 열고 이만큼 뒤 다시 시작
const SEED = 12345;

const MULBERRY = (seed) => `(() => { let s = ${seed}; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

// 프레임마다 남기는 게임 상태 (화면 픽셀보다 믿을 만한 기준)
const SNAPSHOT = `(() => {
  const s = window.__shock && window.__shock.scene;
  if (!s || !s.player) return null;
  const r = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
  const hp = (o) => (o && o.health ? r(o.health.current) : null);
  const ms = (s.monsters || []).filter((m) => !m.dead);
  const b = s.boss;
  return {
    x: r(s.player.x), y: r(s.player.y), vx: r(s.player.body && s.player.body.velocity.x), vy: r(s.player.body && s.player.body.velocity.y),
    hp: hp(s.player), level: s.save && s.save.level,
    monsters: ms.length, monsterHp: r(ms.reduce((a, m) => a + (m.health ? m.health.current : 0), 0)),
    boss: b && b.coreHealth ? r(b.coreHealth.current) : hp(b), bossStarted: !!s.bossStarted,
    gate: !!s.gateOpen, ended: !!s.ended,
  };
})()`;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : def;
}

async function startServer() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen();
  const { port } = server.httpServer.address();
  return { server, url: `http://localhost:${port}/?notouch` };
}

async function recordOnce(scn, out, url, browser) {
  fs.mkdirSync(out, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await context.addInitScript(MULBERRY(SEED));
  await context.clock.install({ time: START });
  await context.clock.pauseAt(START);
  const page = await context.newPage();
  await page.goto(url);
  let now = START;
  const advance = async (ms) => { await page.clock.runFor(ms); now += ms; };

  // 타이틀까지: 그림 로딩은 실제 시간이라 시계를 밀면서 실제로도 조금씩 기다린다
  while (now < START + TITLE_AT) { await advance(STEP); await page.waitForTimeout(20); }
  const titleOk = await page.evaluate(() => !!window.__shockGame && window.__shockGame.scene.isActive('Title'));
  if (!titleOk) throw new Error('타이틀 화면이 정해진 시간 안에 안 떴습니다');

  // 스테이지를 한 번 열어 그림을 받아 두기
  await page.evaluate((stage) => window.__shockGame.scene.getScene('Title').scene.start('Game', { stage }), scn.stage);
  const warmEnd = now + WARM;
  while (now < warmEnd) {
    await advance(STEP);
    const ready = await page.evaluate(() => !!(window.__shock && window.__shock.scene && window.__shock.scene.player));
    if (!ready) await page.waitForTimeout(50);
  }
  const loaded = await page.evaluate(() => !!(window.__shock && window.__shock.scene && window.__shock.scene.player));
  if (!loaded) throw new Error('스테이지가 정해진 시간 안에 안 열렸습니다');

  // 같은 씨앗으로 다시 시작
  await page.evaluate(`${MULBERRY(SEED)} window.__shockGame.scene.getScene('Game').scene.restart({ stage: ${scn.stage} });`);
  await advance(STEP); // 다시 시작은 다음 프레임에 처리되므로 한 번 민 뒤부터 녹화
  const t0 = now;

  // 키 누름/뗌을 시각순으로 펼친다
  const events = [];
  for (const k of scn.keys) {
    events.push({ at: k.at, type: 'down', key: k.key });
    events.push({ at: k.at + (k.hold ?? 80), type: 'up', key: k.key });
  }
  events.sort((a, b) => a.at - b.at || (a.type === 'up' ? -1 : 1));

  const frameMs = Math.round(1000 / (scn.fps ?? 10));
  const total = scn.seconds * 1000;
  const states = [];
  let ei = 0;
  for (let f = 0; f * frameMs <= total; f++) {
    const target = f * frameMs;
    while (now - t0 < target) {
      const nextEvent = ei < events.length ? events[ei].at : Infinity;
      const goal = Math.min(target, nextEvent, now - t0 + STEP);
      if (goal > now - t0) await advance(goal - (now - t0));
      while (ei < events.length && events[ei].at <= now - t0) {
        const e = events[ei++];
        if (e.type === 'down') await page.keyboard.down(e.key); else await page.keyboard.up(e.key);
      }
    }
    while (ei < events.length && events[ei].at <= now - t0) {
      const e = events[ei++];
      if (e.type === 'down') await page.keyboard.down(e.key); else await page.keyboard.up(e.key);
    }
    states.push({ frame: f, ms: target, ...(await page.evaluate(SNAPSHOT)) });
    await page.screenshot({ path: path.join(out, `f${String(f).padStart(4, '0')}.png`) });
  }
  fs.writeFileSync(path.join(out, 'state.json'), JSON.stringify(states, null, 1));
  await context.close();
  return states.length;
}

function listFrames(dir) {
  return fs.readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort();
}

// 두 녹화 비교: 게임 상태가 처음 달라진 프레임, 화면이 처음 달라진 프레임, 프레임별 다른 픽셀 수
function compare(a, b, { quiet = false } = {}) {
  const sa = JSON.parse(fs.readFileSync(path.join(a, 'state.json'), 'utf8'));
  const sb = JSON.parse(fs.readFileSync(path.join(b, 'state.json'), 'utf8'));
  let firstState = null;
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    const keys = Object.keys({ ...sa[i], ...sb[i] }).filter((k) => JSON.stringify(sa[i][k]) !== JSON.stringify(sb[i][k]));
    if (keys.length) { firstState = { frame: i, ms: sa[i].ms, diff: Object.fromEntries(keys.map((k) => [k, [sa[i][k], sb[i][k]]])) }; break; }
  }
  const fa = listFrames(a);
  const diffDir = path.join(b, 'diff');
  fs.rmSync(diffDir, { recursive: true, force: true });
  const rows = [];
  for (const f of fa) {
    if (!fs.existsSync(path.join(b, f))) continue;
    const A = PNG.sync.read(fs.readFileSync(path.join(a, f)));
    const B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
    const D = new PNG({ width: A.width, height: A.height });
    const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0 });
    if (n > 0) {
      fs.mkdirSync(diffDir, { recursive: true });
      fs.writeFileSync(path.join(diffDir, f), PNG.sync.write(D));
    }
    rows.push({ f, n });
  }
  const changed = rows.filter((r) => r.n > 0);
  const lastA = sa[sa.length - 1] || {};
  const lastB = sb[sb.length - 1] || {};
  if (!quiet) {
    console.log(`비교: ${a}  →  ${b}`);
    console.log(firstState
      ? `게임 상태가 처음 달라진 프레임: ${firstState.frame} (${firstState.ms}ms) ${JSON.stringify(firstState.diff)}`
      : '게임 상태: 모든 프레임이 같음');
    console.log(changed.length
      ? `화면이 다른 프레임: ${changed.length}/${rows.length}장, 처음은 ${changed[0].f} (차이 그림은 ${diffDir})`
      : `화면: ${rows.length}장 모두 픽셀까지 같음`);
    const keys = ['hp', 'level', 'monsters', 'monsterHp', 'boss', 'x'];
    console.log('마지막 프레임 비교: ' + keys.map((k) => `${k} ${lastA[k]}→${lastB[k]}`).join(', '));
  }
  return { firstState, changed: changed.length, total: rows.length };
}

async function main() {
  const [cmd, x, y] = process.argv.slice(2);
  if (cmd === 'compare' && x && y) { compare(x, y); return; }
  if (cmd !== 'record' || !x || !y) {
    console.log('사용법:\n  node tools/replay/replay.mjs record <시나리오.js> <폴더> [--runs 2]\n  node tools/replay/replay.mjs compare <폴더A> <폴더B>');
    process.exit(1);
  }
  const scn = (await import(pathToFileURL(path.resolve(x)).href)).default;
  const runs = Number(arg('--runs', '1'));
  const { server, url } = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-smooth-scrolling'] });
  try {
    const dirs = runs === 1 ? [y] : Array.from({ length: runs }, (_, i) => path.join(y, `run${i + 1}`));
    for (const d of dirs) {
      fs.rmSync(d, { recursive: true, force: true });
      const n = await recordOnce(scn, d, url, browser);
      console.log(`녹화 완료: ${d} (${n}장)`);
    }
    for (let i = 1; i < dirs.length; i++) {
      const r = compare(dirs[0], dirs[i], { quiet: true });
      const same = !r.firstState && r.changed === 0;
      console.log(`${dirs[0]} 와 ${dirs[i]}: ${same ? '완전히 같음' : `게임 상태 ${r.firstState ? `${r.firstState.frame}프레임부터 다름` : '같음'}, 화면 ${r.changed}장 다름`}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
