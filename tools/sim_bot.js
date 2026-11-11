#!/usr/bin/env node
// Bulk bot runs of the sim under Node (same sim + bot code the browser runs, no rendering).
//   node tools/sim_bot.js [--seeds 1-200] [--tier 0] [--class mage] [--build id] [--leave N] [--career N] [--json] [--set path=value ...]
// Reports win rate, deaths per room, softlocks, and the seeds used.
// --career N: play N consecutive runs keeping gear (always the highest unlocked tier). Between runs the bot equips the best and discards
//   the rest; it leaves when hurt or at a target room that rises after each extraction (BAL.bot.career). --leave N overrides the target.
// --leave N: the bot leaves with the sealed bag after clearing room N (default: it goes on to the boss; doors: the milder one, the smaller loot bonus).
// --class id: play this class (BAL.classes; default BAL.defaultClass).
// --build id: the bot's named ability build (BAL.builds.<class>.<id>; default: the class's first). 
// --set classes.mage.base.hp=120: override a balance number for this invocation (for tuning experiments).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js',
  'sim/fissures.js', 'sim/boss.js', 'qa/bot.js', 'save.js'];

function load() {
  const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}

function parseArgs(argv) {
  const a = { seeds: '1-100', tier: 0, cls: null, build: null, career: 0, leave: 0, json: false, set: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--seeds') a.seeds = argv[++i];
    else if (k === '--tier') a.tier = +argv[++i];
    else if (k === '--class') a.cls = argv[++i];
    else if (k === '--build') a.build = argv[++i];
    else if (k === '--leave') a.leave = +argv[++i];
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
    gear = G.newGear();
    const cp = G.BAL.bot.career, cls = G.classDef(G.BAL, args.cls).id;
    let target = cp.startRoom;
    for (let i = 0; i < args.career; i++) {
      const sc0 = gear.scrolls | 0;
      G.Bot.prepareGear(gear, G.BAL, cls);      // between runs, as a player on the title screen: equip the best, discard the rest
      const identBetween = sc0 - (gear.scrolls | 0);      // scrolls spent on the title before this run = items identified there
      const gs = G.gearScore(gear);
      let tier = 0;
      G.BAL.run.tierGear.forEach((need, t) => { if (gs >= need) tier = t; });
      const r = G.botRun(seeds[i % seeds.length], { tier, gear, cls: args.cls, build: args.build, leave: args.leave || target, lowHp: cp.lowHp });
      r.identBetween = identBetween;
      r.tier = tier; r.gearBefore = gs; r.target = args.leave || target;
      const sc1 = gear.scrolls | 0;
      G.Bot.prepareGear(gear, G.BAL, cls); r.gearAfter = G.gearScore(gear); r.identBetween += sc1 - (gear.scrolls | 0);      // after the run too (the next run's first step)
      if (r.result === 'left' || r.result === 'win') target = Math.min(cp.cap, target + cp.step);
      res.push(r);
    }
  } else {
    for (const s of seeds) res.push(G.botRun(s, { tier: args.tier, cls: args.cls, build: args.build, leave: args.leave }));
  }
  const wins = res.filter(r => r.result === 'win').length, lefts = res.filter(r => r.result === 'left');
  const soft = res.filter(r => r.result === 'softlock'), tout = res.filter(r => r.result === 'timeout');
  res.forEach(r => { if (r.result === 'dead') deaths[r.room]++; });
  const avg = k => (res.reduce((s, r) => s + r[k], 0) / res.length);
  const avg2 = a => (a.reduce((t, v) => t + v, 0) / a.length).toFixed(1);
  const summary = {
    runs: res.length, cls: res.length ? res[0].cls : null, tier: args.tier, seeds: args.seeds, wins, left: lefts.length, winRate: +(100 * wins / res.length).toFixed(1),
    softlocks: soft.map(r => r.seed), timeouts: tout.map(r => r.seed), deathsByRoom: deaths,
    avgRoomsCleared: +avg('rooms').toFixed(2), avgSeconds: Math.round(avg('seconds')), avgLevel: +avg('level').toFixed(1),
    worstStuck: Math.max(...res.map(r => r.worstStuck)), winSeeds: res.filter(r => r.result === 'win').map(r => r.seed),
    avgBagItems: +avg2(res.map(r => r.bag.items)), avgBagKept: +avg2(res.map(r => r.bag.kept)), avgBagLost: +avg2(res.map(r => r.bag.lost)),
    avgScrollsFound: +avg2(res.map(r => r.bag.found)), avgScrollsKept: +avg2(res.map(r => r.bag.scrollsKept)), identifiedInRun: res.reduce((t, r) => t + r.identified, 0),
    wallSeconds: +((Date.now() - t0) / 1000).toFixed(1)
  };
  if (res.length && res[0].build) {      // what the build came to
    const wr = res.filter(r => r.result === 'win'), fam = G.BAL.builds[res[0].cls][res[0].build].fams[0];
    summary.build = res[0].build;
    summary.avgWinSeconds = wr.length ? Math.round(wr.reduce((t, r) => t + r.seconds, 0) / wr.length) : null;
    summary.mainFamily4 = res.filter(r => (r.fams[fam] || 0) >= 4).length;
  }
  summary.leave = args.leave || null;
  if (args.json) console.log(JSON.stringify({ summary, runs: res }));
  else {
    console.log(summary);
    if (args.career) res.forEach((r, i) => console.log(`run ${i + 1}: seed ${r.seed} tier ${r.tier + 1}/${G.BAL.run.tierMult.length} target room ${r.target} gear ${r.gearBefore}->${r.gearAfter} ${r.result} room ${r.room + 1} bag ${r.bag.items} (kept ${r.bag.kept}) lvl ${r.level} scrolls found ${r.bag.found} identified ${r.identified} in run + ${r.identBetween} before ${r.seconds}s`));
  }
  process.exit(soft.length || tout.length ? 2 : 0);
}
main();
