#!/usr/bin/env node
// Bulk bot runs of the sim under Node (same sim + bot code the browser runs, no rendering).
//   node tools/sim_bot.js [--seeds 1-100] [--class mage] [--build id] [--leave N] [--career N [--careers K]] [--brief] [--json] [--set path=value ...]
// --brief: one summary line (no per-seed lines). --careers K (with --career N): K careers of N runs, career k on seeds[k*N ..]; one line:
//   first win run per career, win share of the runs after the first win, win time, deaths per room, bestFromDrops.
// Reports win rate, deaths per room, softlocks, and the seeds used.
// --career N: play N consecutive runs keeping gear. Between runs the bot equips the best and discards
//   the rest; it leaves when hurt or at a target room that rises after each extraction (BAL.bot.career). --leave N overrides the target.
// --leave N: the bot leaves with the sealed bag after clearing room N (default: it goes on to the boss; doors: the milder one, the smaller loot bonus).
// --class id: play this class (BAL.classes; default BAL.defaultClass).
// --build id: the bot's named ability build (BAL.builds.<class>.<id>; default: the class's first). 
// --set classes.mage.base.hp=120: override a balance number for this invocation (for tuning experiments).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'lore.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js',
  'sim/fissures.js', 'sim/boss.js', 'sim/daily.js', 'qa/bot.js', 'save.js'];

function load() {
  const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}

function parseArgs(argv) {
  const a = { seeds: '1-100', cls: null, build: null, career: 0, careers: 0, leave: 0, json: false, brief: false, set: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--seeds') a.seeds = argv[++i];
    else if (k === '--class') a.cls = argv[++i];
    else if (k === '--build') a.build = argv[++i];
    else if (k === '--leave') a.leave = +argv[++i];
    else if (k === '--career') a.career = +argv[++i];
    else if (k === '--json') a.json = true;
    else if (k === '--brief') a.brief = true;
    else if (k === '--careers') a.careers = +argv[++i];
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
  function career(startIdx) {      // one career of args.career consecutive runs on seeds[startIdx ..]; returns { runs, gear }
    const g = G.newGear(), out = [];
    const cp = G.BAL.bot.career, cls = G.classDef(G.BAL, args.cls).id;
    let target = cp.startRoom;
    G.Bot.shopVisit(g, G.BAL, cls);      // between runs, as a player on the title screen: identify, equip, sell, buy
    for (let i = 0; i < args.career; i++) {
      const gs = G.gearScore(g);
      const r = G.botRun(seeds[(startIdx + i) % seeds.length], { gear: g, cls: args.cls, build: args.build, leave: args.leave || target, lowHp: cp.lowHp, pushHp: args.leave ? 0 : cp.pushHp, pushGear: cp.pushGear, rescue: true });
      r.gearBefore = gs; r.target = args.leave || target;
      G.restockShop(g, G.BAL, cls);      // after every run, any result
      const next = G.Bot.shopVisit(g, G.BAL, cls);      // the title visit after this run (the last one counts too)
      const bg = r.bag || {};
      r.eco = { earned: bg.goldEarned | 0, kept: bg.goldKept | 0, lost: bg.goldLost | 0, merchant: bg.goldSpent | 0, visit: next, gearAfter: G.gearScore(g),
        gold: g.gold | 0, ranks: G.rankTotal(g), scrollsFound: bg.found | 0, scrollsBought: bg.scrollsBought | 0 };
      if (r.result === 'left' || r.result === 'win') target = Math.min(cp.cap, target + cp.step);
      out.push(r);
    }
    return { runs: out, gear: g };
  }
  function dropsPass(g) {      // the best worn items are drops, not shop items
    const worn = G.SLOTS.map(k => g.equipped[k]).filter(Boolean), val = it => G.itemValue(it, G.BAL);
    worn.sort((a, b) => val(b) - val(a));
    const bestDrop = worn.filter(it => it.src !== 'shop').map(val)[0] || 0, shopWorn = worn.filter(it => it.src === 'shop');
    return { worn, shopWorn, pass: worn.slice(0, 3).every(it => it.src !== 'shop') && shopWorn.every(it => val(it) <= bestDrop) && !worn.some(it => it.src === 'shop' && it.rarity >= 3) };
  }
  if (args.careers > 1) {      // several careers from different starting seeds (career k starts at seeds[k * career]): one line per class
    const firsts = [], post = [0, 0], dr = new Array(rooms).fill(0), winSec = [], soft = [];
    let pass = 0, totalWins = 0;
    for (let k = 0; k < args.careers; k++) {
      const c = career(k * args.career), runs = c.runs;
      const fw = runs.findIndex(r => r.result === 'win');
      firsts.push(fw < 0 ? null : fw + 1);
      if (fw >= 0) runs.slice(fw + 1).forEach(r => { post[1]++; if (r.result === 'win') post[0]++; });
      runs.forEach(r => { if (r.result === 'dead') dr[r.room]++; if (r.result === 'win') { winSec.push(r.seconds); totalWins++; } if (r.result === 'softlock' || r.result === 'timeout') soft.push(r.seed); });
      if (dropsPass(c.gear).pass) pass++;
    }
    const got = firsts.filter(v => v !== null), mean = a => a.length ? (a.reduce((t, v) => t + v, 0) / a.length) : NaN;
    console.log(`${G.classDef(G.BAL, args.cls).id} careers ${args.careers}x${args.career}: wins ${totalWins}/${args.careers * args.career}, first win avg run ${mean(got).toFixed(1)} (${got.length}/${args.careers} careers won; [${firsts.map(v => v === null ? '-' : v).join(' ')}]), ` +
      `after first win ${post[1] ? Math.round(100 * post[0] / post[1]) : 0}% (${post[0]}/${post[1]}), win time avg ${Math.round(mean(winSec))} s, deaths/room ${dr.join(',')}, softlocks ${soft.length}${soft.length ? ' [seeds ' + soft.join(' ') + ']' : ''}, bestFromDrops ${pass}/${args.careers}`);
    process.exit(soft.length ? 2 : 0);
  }
  if (args.career) {
    const c = career(0);
    gear = c.gear;
    c.runs.forEach(r => res.push(r));
  } else {
    for (const s of seeds) res.push(G.botRun(s, { cls: args.cls, build: args.build, leave: args.leave }));
  }
  const wins = res.filter(r => r.result === 'win').length, lefts = res.filter(r => r.result === 'left');
  const soft = res.filter(r => r.result === 'softlock'), tout = res.filter(r => r.result === 'timeout');
  res.forEach(r => { if (r.result === 'dead') deaths[r.room]++; });
  const avg = k => (res.reduce((s, r) => s + r[k], 0) / res.length);
  const avg2 = a => (a.reduce((t, v) => t + v, 0) / a.length).toFixed(1);
  const summary = {
    runs: res.length, cls: res.length ? res[0].cls : null, seeds: args.seeds, wins, left: lefts.length, winRate: +(100 * wins / res.length).toFixed(1),
    softlocks: soft.map(r => r.seed), timeouts: tout.map(r => r.seed), deathsByRoom: deaths,
    avgRoomsCleared: +avg('rooms').toFixed(2), avgSeconds: Math.round(avg('seconds')), avgLevel: +avg('level').toFixed(1),
    worstStuck: Math.max(...res.map(r => r.worstStuck)), winSeeds: res.filter(r => r.result === 'win').map(r => r.seed),
    avgBagItems: +avg2(res.map(r => r.bag ? r.bag.items : 0)), avgBagKept: +avg2(res.map(r => r.bag ? r.bag.kept : 0)), avgBagLost: +avg2(res.map(r => r.bag ? r.bag.lost : 0)),
    avgScrollsFound: +avg2(res.map(r => r.bag ? r.bag.found : 0)), avgScrollsKept: +avg2(res.map(r => r.bag ? r.bag.scrollsKept : 0)), identifiedInRun: res.reduce((t, r) => t + r.identified, 0),
    wallSeconds: +((Date.now() - t0) / 1000).toFixed(1)
  };
  if (res.length && res[0].build) {      // what the build came to
    const wr = res.filter(r => r.result === 'win'), fam = G.BAL.builds[res[0].cls][res[0].build].fams[0];
    summary.build = res[0].build;
    summary.avgWinSeconds = wr.length ? Math.round(wr.reduce((t, r) => t + r.seconds, 0) / wr.length) : null;
    summary.mainFamily4 = res.filter(r => (r.fams[fam] || 0) >= 4).length;
  }
  summary.leave = args.leave || null;
  if (args.brief && !args.career) {      // one line: win rate, deaths per room, win time, softlocks
    const ws = res.filter(r => r.result === 'win').map(r => r.seconds), wavg = ws.length ? Math.round(ws.reduce((t, v) => t + v, 0) / ws.length) : 0;
    console.log(`${summary.cls} seeds ${args.seeds}: wins ${wins}/${res.length} (${summary.winRate}%), left ${lefts.length}, deaths/room ${deaths.join(',')}, win time avg ${wavg} s (min ${ws.length ? Math.min(...ws) : 0}), softlocks ${soft.length + tout.length}${soft.length + tout.length ? " [seeds " + soft.concat(tout).map(r => r.seed).join(" ") + "]" : ""}, worst stuck ${summary.worstStuck} s, ${summary.wallSeconds} s wall`);
  } else if (args.json) console.log(JSON.stringify({ summary, runs: res }));
  else {
    console.log(summary);
    if (args.career) {
      res.forEach((r, i) => {
        const e = r.eco, v = e.visit;
        console.log(`run ${i + 1}: seed ${r.seed} target ${r.target} gear ${r.gearBefore}->${e.gearAfter} ${r.result} room ${r.room + 1} lvl ${r.level} scrolls found ${e.scrollsFound} | gold +${e.earned} (kept ${e.kept}, lost ${e.lost}, merchant ${e.merchant}) sold ${v.sold} (+${v.goldSold}) | bought: scrolls ${v.scrollsBought}, items [${v.itemsBought.join(', ')}], upgrades [${v.upgrades.join(', ')}], ranks [${v.ranks.join(', ')}] | gold left ${e.gold} | merchants met ${r.merchants.met} used ${r.merchants.used}`);
      });
      const tot = { scrolls: 0, items: 0, upgrades: 0, ranks: 0 }, ed = res.map(r => r.eco.earned + r.eco.visit.goldSold);
      res.forEach(r => { for (const k in tot) tot[k] += r.eco.visit.spent[k]; });
      const dp = dropsPass(gear), worn = dp.worn, val = it => G.itemValue(it, G.BAL);
      console.log(`gold per run (earned + sold): ${ed.join(' ')} avg ${Math.round(ed.reduce((t, v) => t + v, 0) / ed.length)}; merchant spent ${res.reduce((t, r) => t + r.eco.merchant, 0)}; shop spent ${JSON.stringify(tot)}; ranks ${G.rankTotal(gear)}/25 ${JSON.stringify(gear.ranks)}`);
      worn.forEach(it => console.log(`  worn ${it.slot} ${it.name} rarity ${it.rarity} ilvl ${it.ilvl}${it.up ? ' (+' + it.up + ')' : ''} src ${it.src === 'shop' ? 'shop' : 'drop'} value ${val(it).toFixed(2)}`));
      console.log(`worn shop items ${dp.shopWorn.length}; bestFromDrops: ${dp.pass ? 'PASS' : 'FAIL'}`);
    }
  }
  process.exit(soft.length || tout.length ? 2 : 0);
}
main();
