// Verifies every level can be finished, using the game's real player physics
// and tile collision: a breadth-first search over every spot the heroine can
// stand on, trying runs, walk-offs and jumps of different lengths from each.
// Enemies are ignored; spikes count as impassable.
//
// Usage (from the repo root):  node tools/check-levels.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// entities.js pulls in canvas helpers - a tiny stub is enough for physics.
const ctxStub = new Proxy({}, { get: () => () => ({ data: [] }) });
globalThis.document = { createElement: () => ({ getContext: () => ctxStub }) };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const load = (f) => import(pathToFileURL(path.join(root, f)).href);
const { Level } = await load('level.js');
const { Player } = await load('entities.js');
const { LEVELS } = await load('levels-data.js');
const { TILE } = await load('constants.js');

const fakeArt = { idle: { right: [], left: [] } };

function makeInput(plan) {
  let tick = 0;
  return {
    step() { tick++; },
    isDown(a) {
      if (a === 'right') return plan.dir > 0 && tick < plan.moveTicks;
      if (a === 'left') return plan.dir < 0 && tick < plan.moveTicks;
      if (a === 'jump') return plan.jump && tick < plan.holdTicks;
      return false;
    },
    wasPressed(a) { return a === 'jump' && plan.jump && tick === 0; },
  };
}

// Simulates one action from a standing position; returns where it lands.
function simulate(level, x, feetY, plan) {
  const p = new Player(fakeArt);
  p.x = x;
  p.y = feetY - p.h;
  p.onGround = true;
  const input = makeInput(plan);
  let leftGround = false;
  for (let t = 0; t < 240; t++) {
    p.update(input, level);
    input.step();
    if (level.touchesHazard(p)) return null;
    if (p.top > level.heightPx) return null;
    if (!p.onGround) leftGround = true;
    if (leftGround && p.onGround) break;
    if (!plan.jump && t > plan.moveTicks + 2 && p.onGround) break;
  }
  if (!p.onGround) return null;
  return { x: p.x, feetY: p.bottom };
}

const PLANS = [];
for (const dir of [-1, 1]) {
  for (const moveTicks of [6, 14, 30, 60]) PLANS.push({ dir, moveTicks, jump: false });
  for (const holdTicks of [4, 10, 30]) {
    for (const moveTicks of [0, 10, 22, 40, 240]) PLANS.push({ dir, moveTicks, jump: true, holdTicks });
  }
}
PLANS.push({ dir: 0, moveTicks: 0, jump: true, holdTicks: 30 });

function check(index) {
  const data = LEVELS[index];
  const level = new Level(data);
  const start = level.spawns.find((s) => s.type === 'P');
  const exit = level.spawns.find((s) => s.type === 'E');
  const doors = level.spawns.filter((s) => s.type === 'E' || s.type === 'S');
  const key = (x, feetY) => `${Math.round(x / 20)}:${Math.round(feetY)}`;
  const seen = new Set();
  const queue = [{ x: start.x - 42, feetY: start.feetY }];
  const reachedCols = new Map(); // feetY -> set of cols
  let reachedExit = false;
  while (queue.length) {
    const cur = queue.shift();
    const k = key(cur.x, cur.feetY);
    if (seen.has(k)) continue;
    seen.add(k);
    const col = Math.floor((cur.x + 42) / TILE);
    if (!reachedCols.has(cur.feetY)) reachedCols.set(cur.feetY, new Set());
    reachedCols.get(cur.feetY).add(col);
    if (Math.abs(cur.x + 42 - exit.x) < TILE && Math.abs(cur.feetY - exit.feetY) < 2) reachedExit = true;
    for (const plan of PLANS) {
      const land = simulate(level, cur.x, cur.feetY, plan);
      if (land && !seen.has(key(land.x, land.feetY))) queue.push(land);
    }
    // Also try lining up at the very edges of this platform, like a player
    // creeping to the brink before a long jump.
    for (const dir of [-1, 1]) {
      const probe = { x: cur.x, y: cur.feetY - 216, w: 84, h: 216 };
      const maxX = level.widthPx - probe.w;
      while (level.hasFloor(probe) && probe.x > 0 && probe.x < maxX) probe.x += dir * 4;
      probe.x = Math.max(0, Math.min(maxX, probe.x - dir * 4));
      if (!seen.has(key(probe.x, cur.feetY))) queue.push({ x: probe.x, feetY: cur.feetY });
    }
  }
  const unreachableDoors = doors.filter((d) => !reachedCols.get(d.feetY)?.has(d.col));
  const coins = level.spawns.filter((s) => s.type === 'c' || s.type === 'h');
  // A coin counts as reachable if some standing spot is within jump reach of it.
  const spots = [...seen].map((s) => s.split(':').map(Number)).map(([x, f]) => ({ x: x * 20 + 42, feetY: f }));
  const unreachableCoins = coins.filter((c) => !spots.some(
    (s) => Math.abs(s.x - c.x) < TILE * 1.6 && c.feetY <= s.feetY + 1 && s.feetY - (c.feetY - TILE / 2) < 3.4 * TILE + 60,
  ));
  return { name: data.name, reachedExit, positions: seen.size, unreachableDoors, unreachableCoins };
}

let failed = false;
for (let i = 0; i < LEVELS.length; i++) {
  const r = check(i);
  const ok = r.reachedExit && r.unreachableDoors.length === 0;
  if (!ok) failed = true;
  const coinNote = r.unreachableCoins.length
    ? ` - unreachable pickups at ${r.unreachableCoins.map((c) => `(${c.col},${c.row})`).join(' ')}`
    : '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${i + 1}. ${r.name}: ${r.positions} spots${r.reachedExit ? '' : ' - EXIT UNREACHABLE'}${
    r.unreachableDoors.length ? ` - doors unreachable: ${r.unreachableDoors.map((d) => d.col).join(',')}` : ''}${coinNote}`);
}
process.exit(failed ? 1 : 0);
