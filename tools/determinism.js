#!/usr/bin/env node
// Determinism check: same seed = same map, same run.
//  1. every room of N run seeds is generated twice and compared (tiles, fissure cells, layout hash)
//  2. different seeds must give different rooms
//  3. a full bot run of a seed is played twice and must end identically
//  4. the sim runs with a Math whose inexact functions throw: sin, cos, atan2, pow, exp, log... give
//     different last bits in Node, Chrome, Firefox and Safari, so the sim must use G.M (src/rng.js)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'lore.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/tutorial.js', 'sim/boss.js', 'sim/daily.js', 'qa/bot.js', 'save.js'];
const INEXACT = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot'];
const StrictMath = {};
for (const k of Object.getOwnPropertyNames(Math)) StrictMath[k] = Math[k];
for (const k of INEXACT) StrictMath[k] = () => { throw new Error(`Math.${k} is engine-dependent: use G.M.${k} (src/rng.js)`); };
function load() {
  const ctx = { Math: StrictMath, console, Uint8Array, Int16Array, Object, JSON, Array };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}
const G = load(), G2 = load(), N = +(process.argv[2] || 50), rooms = G.BAL.run.rooms;
const key = r => JSON.stringify([r.w, r.h, Array.from(r.tiles), r.start, r.exit, r.chest, r.fissures.map(f => [f.x, f.y, f.big, f.cells.length, f.cells[0], f.cells[f.cells.length - 1]]), r.decals.length, r.torches, r.hash]);
let bad = 0, checked = 0;
const hashes = new Set();
for (let seed = 1; seed <= N; seed++) for (let i = 0; i < rooms; i++) {
  const a = key(G.genRoom(seed, i, G.BAL)), b = key(G2.genRoom(seed, i, G2.BAL));   // two separate VM contexts
  if (a !== b) { bad++; console.log('MISMATCH seed', seed, 'room', i); }
  hashes.add(a); checked++;
}
// room sanity (step big rooms): every generated room has the size BAL.room asks for, every crack BAL.fissure.count asks for (a stub
// would have been retried), open floor at the start, the chest, under the exit and at the super fissure, a spot for the merchant and for
// Don Montoto's cage, all of it reachable on foot from the start, and no wall tile that floor cannot be walked round (2 x 2 rule)
let sane = 0;
for (let seed = 1; seed <= N; seed++) for (let i = 0; i < rooms; i++) {
  const r = G.genRoom(seed, i, G.BAL), R = G.BAL.room, boss = i === rooms - 1, why = [];
  const at = (tx, ty) => tx < 0 || ty < 0 || tx >= r.w || ty >= r.h ? 1 : r.tiles[ty * r.w + tx];
  const size = boss ? r.w === R.boss.w && r.h === R.boss.h : r.w >= R.w[0] && r.w <= R.w[1] && r.h >= R.h[0] && r.h <= R.h[1];
  if (!size) why.push('size ' + r.w + 'x' + r.h);
  const normal = r.fissures.filter(f => !f.big);
  if (normal.length !== G.BAL.fissure.count[i]) why.push('cracks ' + normal.length + '/' + G.BAL.fissure.count[i]);
  if (normal.some(f => f.cells.length < G.BAL.fissure.minCells)) why.push('a stub crack');
  const sx = Math.floor(r.start.x / 16), sy = Math.floor(r.start.y / 16), big = r.fissures[r.fissures.length - 1];
  const dist = new Int16Array(r.w * r.h).fill(-1), q = [sy * r.w + sx]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) { const c = q[h], x = c % r.w, y = (c - x) / r.w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * r.w + x + dx; if (!at(x + dx, y + dy) && dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); } } }
  const reach = (px, py) => dist[Math.floor(py / 16) * r.w + Math.floor(px / 16)] >= 0;
  if (!reach(r.chest.x, r.chest.y)) why.push('chest');
  if (!reach(r.exit.x, r.exit.y)) why.push('exit');
  if (!reach(big.x, big.y)) why.push('super fissure');
  const ms = G.merchantSpot(r, G.BAL), cs = G.cageSpot(r, G.BAL, ms);
  if (!ms || !reach(ms.x, ms.y)) why.push('merchant spot');
  if (!cs || !reach(cs.x, cs.y)) why.push('cage spot');
  let floor = 0; for (let k = 0; k < r.tiles.length; k++) if (!r.tiles[k]) { floor++; if (dist[k] < 0) { why.push('unreachable floor'); break; } }
  if (floor < 0.55 * r.w * r.h) why.push('floor share ' + (floor / (r.w * r.h)).toFixed(2));
  // every crack px lies on floor and outside the reserved start box
  for (const f of normal) if (f.cells.some(c => at(Math.floor((f.x + c.x) / 16), Math.floor((f.y + c.y) / 16)) || (Math.abs(f.x + c.x - r.start.x) <= 40 && Math.abs(f.y + c.y - r.start.y) <= 34))) { why.push('crack on a wall or on the start'); break; }
  if (why.length) { sane++; console.log('ROOM PROBLEM seed', seed, 'room', i, why.join(', ')); }
}
console.log(`${checked} rooms checked (size, crack count, floor, reach of chest / exit / super fissure / merchant / cage): ${sane} problems`);
console.log(`${checked} rooms generated twice: ${bad} mismatches; ${hashes.size} distinct layouts out of ${checked}`);
// door modifiers: the same (seed, room, modifier) gives the same room; a modifier changes the cracks but not the walls;
// the doors offered after room N depend only on the seed and N
let modBad = 0, modChecked = 0;
for (let seed = 1; seed <= Math.min(N, 20); seed++) for (let i = 0; i < rooms; i++) {
  const base = G.genRoom(seed, i, G.BAL);
  for (const mod of Object.keys(G.BAL.doors.mods)) {
    const a = key(G.genRoom(seed, i, G.BAL, mod)), b = key(G2.genRoom(seed, i, G2.BAL, mod)), m = G.genRoom(seed, i, G.BAL, mod);
    modChecked++;
    if (a !== b || Array.from(m.tiles).join() !== Array.from(base.tiles).join()) { modBad++; console.log('MOD MISMATCH seed', seed, 'room', i, mod); }
  }
  const d1 = JSON.stringify(G.doorsFor(seed, i, G.BAL)), d2 = JSON.stringify(G2.doorsFor(seed, i, G2.BAL));
  if (d1 !== d2 || G.doorsFor(seed, i, G.BAL).length !== 2 || G.doorsFor(seed, i, G.BAL)[0] === G.doorsFor(seed, i, G.BAL)[1]) { modBad++; console.log('DOORS MISMATCH', seed, i); }
}
console.log(`${modChecked} modified rooms generated twice (walls unchanged), doors offered twice: ${modBad} problems`);
const r1 = G.botRun(3), r2 = G2.botRun(3);
const same = JSON.stringify(r1) === JSON.stringify(r2);
console.log(`bot run seed 3 twice: ${same ? 'identical' : 'DIFFERENT'} (${r1.result}, ${r1.rooms} rooms, level ${r1.level}, ${r1.kills} kills, ${r1.seconds} s)`);
// a run that leaves after room 5 (doors chosen by the bot's rule), twice
const l1 = G.botRun(3, { leave: 5 }), l2 = G2.botRun(3, { leave: 5 });
console.log(`bot run seed 3 leave 5 twice: ${JSON.stringify(l1) === JSON.stringify(l2) ? 'identical' : 'DIFFERENT'} (${l1.result}, ${l1.rooms} rooms, doors ${l1.doors.join('>')}, bag ${JSON.stringify(l1.bag)})`);
if (JSON.stringify(l1) !== JSON.stringify(l2)) bad++;
// the ability system: each named build of every class played twice (a seed-3 run), with the inexact Math functions throwing
let abilBad = 0;
for (const cls of Object.keys(G.BAL.builds)) {
  for (const build of Object.keys(G.BAL.builds[cls])) {
    const a = G.botRun(3, { cls, build }), b = G2.botRun(3, { cls, build }), ok = JSON.stringify(a) === JSON.stringify(b);
    if (!ok) abilBad++;
    console.log(`bot run ${cls}/${build} seed 3 twice: ${ok ? 'identical' : 'DIFFERENT'} (${a.result}, ${a.rooms} rooms, level ${a.level}, ${a.kills} kills, ${a.seconds} s)`);
  }
}
// economy: seed 3 with merchant rooms (chance raised so the bot meets and uses them), twice, with gold and purchases
[G, G2].forEach(g => { g.BAL.economy.merchant.chance = 0.6; });
let ecoBad = 0;
for (const cls of ['mage', 'warrior', 'archer']) {
  const gearA = G.newGear(), gearB = G2.newGear(); gearA.gold = gearB.gold = 0;
  const a = G.botRun(3, { cls, leave: 8, gear: gearA }), b = G2.botRun(3, { cls, leave: 8, gear: gearB }), ok = JSON.stringify([a, gearA]) === JSON.stringify([b, gearB]);
  if (!ok) ecoBad++;
  console.log(`economy ${cls} seed 3 with merchants (rooms ${G.merchantRooms(3, G.BAL).join(',')}) twice: ${ok ? 'identical' : 'DIFFERENT'} (${a.result}, gold earned ${a.bag.goldEarned} kept ${a.bag.goldKept} spent ${a.bag.goldSpent}, merchants met ${a.merchants.met} used ${a.merchants.used}, scrolls bought ${a.bag.scrollsBought})`);
}
// Don Montoto's cage (step 8): a career-style run that frees him, twice (cage placement and the walk to it use no inexact Math)
let cageBad = 0;
{
  const seed = 1;
  const gA = G.newGear(), gB = G2.newGear();
  const a = G.botRun(seed, { gear: gA, rescue: true, leave: 7, cls: 'warrior' }), b = G2.botRun(seed, { gear: gB, rescue: true, leave: 7, cls: 'warrior' }), ok = JSON.stringify([a, gA]) === JSON.stringify([b, gB]);
  if (!ok) cageBad++;
  console.log(`cage seed ${seed} (room ${G.cageRoom(seed, G.BAL, G.newGear()) + 1}) rescue run twice: ${ok ? 'identical' : 'DIFFERENT'} (${a.result}, ${a.rooms} rooms, Don Montoto ${gA.city.montoto ? 'freed' : 'not freed'})`);
}
// the daily challenge (step 10): the date gives seed, class, kit and doors; the bot's daily run twice
let dailyBad = 0;
{
  const ia = G.dailyInfo('2026-11-12', G.BAL), ib = G2.dailyInfo('2026-11-12', G2.BAL);
  const a = G.botRun(ia.seed, { cls: ia.cls, gear: G.dailyGear(ia, G.BAL), daily: ia }), b = G2.botRun(ib.seed, { cls: ib.cls, gear: G2.dailyGear(ib, G2.BAL), daily: ib });
  const ok = JSON.stringify([ia, a]) === JSON.stringify([ib, b]);
  if (!ok) dailyBad++;
  console.log(`daily 2026-11-12 (seed ${ia.seed}, ${ia.cls}) twice: ${ok ? 'identical' : 'DIFFERENT'} (${a.result}, ${a.rooms} rooms, ${a.kills} kills, ${a.seconds} s, doors ${a.doors.join('>')})`);
}
process.exit(dailyBad || cageBad || sane || bad || modBad || ecoBad || abilBad || !same || hashes.size !== checked ? 1 : 0);
