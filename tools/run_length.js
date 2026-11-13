#!/usr/bin/env node
// Run length report (step big rooms): how long a run and each room take for the Node bot.
//   node tools/run_length.js [--seeds 1-10] [--class mage|warrior|archer|all] [--md] [--only fresh,career,full] [--set path=value ...]
// Three measures per class, each ONE sim_bot command of at most 10 seeds (the bot budget):
//   fresh    sim_bot --seeds S --class C            a new character, no gear (most runs die late)
//   career   sim_bot --career 10 --seeds S --class C  ten consecutive runs keeping gear (extractions, later wins)
//   full     sim_bot --seeds S --class C --set classes.C.base.hp=1000000
//            the same fresh hero who cannot die: the length of all ten rooms at a new character's kill speed
// Prints win rate, average run minutes, seconds per room (average over the runs that finished that room), deaths by room,
// and per run: rooms cleared, kills, hero level at the end, gold earned and items found (what the extra monsters pay).
'use strict';
const { execFileSync } = require('child_process'), path = require('path');
const BOT = path.join(__dirname, 'sim_bot.js');
const args = { seeds: '1-10', cls: 'all', md: false, set: [], only: null };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k === '--seeds') args.seeds = process.argv[++i];
  else if (k === '--class') args.cls = process.argv[++i];
  else if (k === '--md') args.md = true;
  else if (k === '--set') args.set.push('--set', process.argv[++i]);      // passed on to sim_bot (tuning experiments)
  else if (k === '--only') args.only = process.argv[++i].split(',');
}
const nSeeds = args.seeds.split(',').reduce((t, p) => { const m = p.split('-').map(Number); return t + (m.length === 2 ? m[1] - m[0] + 1 : 1); }, 0);
if (nSeeds > 10) { console.error('at most 10 seeds per command'); process.exit(1); }

function run(extra) {
  let out;
  try { out = execFileSync('node', [BOT, '--seeds', args.seeds, '--json'].concat(args.set, extra), { encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (e) { out = e.stdout; }      // exit code 2 = softlock / timeout: the JSON is still there
  return JSON.parse(out);
}
const mean = a => a.length ? a.reduce((t, v) => t + v, 0) / a.length : NaN;
function digest(d) {
  const runs = d.runs, rooms = d.summary.deathsByRoom.length, per = [];
  for (let i = 0; i < rooms; i++) per.push(Math.round(mean(runs.filter(r => r.roomSeconds.length > i).map(r => r.roomSeconds[i]))));
  // the last room has no "next room" tick: its time is the rest of a won run
  const won = runs.filter(r => r.result === 'win');
  if (won.length) per[rooms - 1] = Math.round(mean(won.map(r => r.seconds - r.roomSeconds.slice(0, rooms - 1).reduce((t, v) => t + v, 0))));
  const cleared = runs.reduce((t, r) => t + r.roomSeconds.length, 0), clearedSec = runs.reduce((t, r) => t + r.roomSeconds.reduce((a, v) => a + v, 0), 0);
  return {
    runs: runs.length, wins: won.length, left: runs.filter(r => r.result === 'left').length,
    bad: runs.filter(r => r.result === 'softlock' || r.result === 'timeout').map(r => r.seed + ':' + r.result),
    avgMin: mean(runs.map(r => r.seconds)) / 60, winMin: won.length ? mean(won.map(r => r.seconds)) / 60 : NaN,
    secPerRoom: cleared ? clearedSec / cleared : NaN, perRoom: per, level: mean(runs.map(r => r.level)), gold: mean(runs.map(r => r.bag ? r.bag.goldEarned | 0 : 0)), items: mean(runs.map(r => r.bag ? r.bag.items | 0 : 0)), deaths: d.summary.deathsByRoom, rooms: mean(runs.map(r => r.rooms)), kills: mean(runs.map(r => r.kills))
  };
}
const f1 = v => isNaN(v) ? '-' : v.toFixed(1);
const classes = args.cls === 'all' ? ['mage', 'warrior', 'archer'] : [args.cls];
const rows = [];
for (const c of classes) {
  const want = m => !args.only || args.only.indexOf(m) >= 0;
  if (want('fresh')) rows.push([c, 'fresh', digest(run(['--class', c]))]);
  if (want('career')) rows.push([c, 'career', digest(run(['--class', c, '--career', '10']))]);
  if (want('full')) rows.push([c, 'full', digest(run(['--class', c, '--set', 'classes.' + c + '.base.hp=1000000']))]);
}
if (args.md) {
  console.log('| class | measure | wins | left | avg run min | win min | s / room | rooms | kills | level | gold | items | s by room | deaths by room |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [c, m, d] of rows) console.log(`| ${c} | ${m} | ${d.wins}/${d.runs} | ${d.left} | ${f1(d.avgMin)} | ${f1(d.winMin)} | ${Math.round(d.secPerRoom)} | ${f1(d.rooms)} | ${Math.round(d.kills)} | ${f1(d.level)} | ${Math.round(d.gold)} | ${f1(d.items)} | ${d.perRoom.map(v => isNaN(v) ? '-' : v).join(' ')} | ${d.deaths.join(' ')} |${d.bad.length ? ' ' + d.bad.join(' ') : ''}`);
} else {
  for (const [c, m, d] of rows) console.log(`${c} ${m}: wins ${d.wins}/${d.runs}, left ${d.left}, avg run ${f1(d.avgMin)} min, win ${f1(d.winMin)} min, ${Math.round(d.secPerRoom)} s/room, rooms ${f1(d.rooms)}, kills ${Math.round(d.kills)}, level ${f1(d.level)}, gold ${Math.round(d.gold)}, items ${f1(d.items)}, s by room ${d.perRoom.map(v => isNaN(v) ? '-' : v).join(' ')}, deaths by room ${d.deaths.join(' ')}${d.bad.length ? ', BAD ' + d.bad.join(' ') : ''}`);
}
