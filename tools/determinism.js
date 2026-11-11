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
const SIM = ['balance.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/passives.js', 'sim/core.js', 'sim/combat.js', 'sim/fissures.js', 'sim/boss.js', 'qa/bot.js', 'save.js'];
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
console.log(`${checked} rooms generated twice: ${bad} mismatches; ${hashes.size} distinct layouts out of ${checked}`);
const r1 = G.botRun(3), r2 = G2.botRun(3);
const same = JSON.stringify(r1) === JSON.stringify(r2);
console.log(`bot run seed 3 twice: ${same ? 'identical' : 'DIFFERENT'} (${r1.result}, ${r1.rooms} rooms, level ${r1.level}, ${r1.kills} kills, ${r1.seconds} s)`);
process.exit(bad || !same || hashes.size !== checked ? 1 : 0);
