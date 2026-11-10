#!/usr/bin/env node
// Bulk bot runs of the sim under Node (same sim + bot code the browser runs, no rendering).
//   node tools/sim_bot.js [--seeds 1-200] [--tier 0] [--career N] [--json] [--set path=value ...]
// Reports win rate, deaths per room, softlocks, and the seeds used.
// --career N: play N consecutive runs keeping gear (always the highest unlocked tier).
// --set player.hp=120: override a balance number for this invocation (for tuning experiments).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/passives.js', 'sim/core.js', 'sim/combat.js',
  'sim/fissures.js', 'sim/boss.js', 'qa/bot.js', 'save.js'];

function load() {
  const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}

function parseArgs(argv) {
  const a = { seeds: '1-100', tier: 0, career: 0, json: false, set: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--seeds') a.seeds = argv[++i];
    else if (k === '--tier') a.tier = +argv[++i];
    else if (k === '--career') a.career = +argv[++i];
    else if (k === '--json') a.json = true;
    else if (k === '--set') a.set.push(argv[++i]);
  }
  return a;
}
function seedList(spec) {
  const out = [];
  for (const part of spec.split(',')) {
    const m = part.split('-').map(Number);
    if (m.length === 2) for (let s = m[0]; s <= m[1]; s++) out.push(s); else out.push(m[0]);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv), G = load();
  for (const kv of args.set) {
    const [p, v] = kv.split('='), keys = p.split('.');
    let o = G.BAL;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = JSON.parse(v);
  }
  const seeds = seedList(args.seeds), rooms = G.BAL.run.rooms;
  const res = [], deaths = new Array(rooms).fill(0);
  let gear = null;
  const t0 = Date.now();
  if (args.career) {
    gear = G.newSave().gear;
    for (let i = 0; i < args.career; i++) {
      const gs = G.gearScore(gear);
      let tier = 0;
      G.BAL.run.tierGear.forEach((need, t) => { if (gs >= need) tier = t; });
      const r = G.botRun(seeds[i % seeds.length], { tier, gear });
      r.tier = tier; r.gearBefore = gs;
      res.push(r);
    }
  } else {
    for (const s of seeds) res.push(G.botRun(s, { tier: args.tier }));
  }
  const wins = res.filter(r => r.result === 'win').length;
  const soft = res.filter(r => r.result === 'softlock'), tout = res.filter(r => r.result === 'timeout');
  res.forEach(r => { if (r.result === 'dead') deaths[r.room]++; });
  const avg = k => (res.reduce((s, r) => s + r[k], 0) / res.length);
  const summary = {
    runs: res.length, tier: args.tier, seeds: args.seeds, wins, winRate: +(100 * wins / res.length).toFixed(1),
    softlocks: soft.map(r => r.seed), timeouts: tout.map(r => r.seed), deathsByRoom: deaths,
    avgRoomsCleared: +avg('rooms').toFixed(2), avgSeconds: Math.round(avg('seconds')), avgLevel: +avg('level').toFixed(1),
    worstStuck: Math.max(...res.map(r => r.worstStuck)), winSeeds: res.filter(r => r.result === 'win').map(r => r.seed),
    wallSeconds: +((Date.now() - t0) / 1000).toFixed(1)
  };
  if (args.json) console.log(JSON.stringify({ summary, runs: res }));
  else {
    console.log(summary);
    if (args.career) res.forEach((r, i) => console.log(`run ${i + 1}: tier ${r.tier + 1} gear ${r.gearBefore}->${r.gearScore} ${r.result} room ${r.room + 1} lvl ${r.level} ${r.seconds}s`));
  }
  process.exit(soft.length || tout.length ? 2 : 0);
}
main();
