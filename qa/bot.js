#!/usr/bin/env node
// Automated QA: the bot plays full runs of the REAL game in headless Chromium (render loop, HUD,
// level-up cards, inventory auto-equip), fast-forwarded. For every seed it records the result,
// rooms cleared, console/page errors and the worst "no progress" time (softlock if > 400 s).
// Each browser run is also compared with the same seed in the Node sim: they must match exactly.
//   node qa/bot.js [--seeds 3,4,8,1,2,5] [--speed 12] [--size landscape|portrait] [--parallel 3]
// Exit code 0 only if: no errors, no softlocks, sim matches Node, and at least one run clears all rooms.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const Q = require('./lib');

function args() {
  const a = { seeds: '1-12', speed: 12, size: 'landscape', parallel: 3 };
  const v = process.argv;
  for (let i = 2; i < v.length; i++) if (v[i].startsWith('--')) a[v[i].slice(2)] = v[++i];
  const list = [];
  for (const part of String(a.seeds).split(',')) {
    const m = part.split('-').map(Number);
    if (m.length === 2) for (let s = m[0]; s <= m[1]; s++) list.push(s); else list.push(m[0]);
  }
  a.list = list; a.speed = +a.speed; a.parallel = +a.parallel;
  return a;
}

async function runSeed(browser, seed, a) {
  const page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&bot=1&speed=${a.speed}`, a.size);
  const t0 = Date.now();
  let st, softlock = false;
  for (;;) {
    st = await Q.state(page);
    if (st.screen === 'result') break;
    if (st.sim.worstStuck > 400) { softlock = true; break; }
    if (Date.now() - t0 > 600000) break;
    await page.waitForTimeout(400);
  }
  const s = st.sim, B = await page.evaluate(() => ({ rooms: G.BAL.run.rooms }));
  const out = { seed, result: softlock ? 'softlock' : (st.screen !== 'result' ? 'timeout' : (s.state === 'won' ? 'win' : 'dead')),
    room: s.room, rooms: s.rooms, level: s.level, kills: s.kills, seconds: Math.round(s.tick / 60), worstStuck: s.worstStuck,
    errors: page.errors.concat(st.errors), wall: +((Date.now() - t0) / 1000).toFixed(1), totalRooms: B.rooms };
  if (out.result === 'win' && a.shots) await Q.shot(page, `bot_win_seed${seed}_${a.size}`);
  await page.context().close();
  return out;
}

(async () => {
  const a = args();
  const browser = await Q.launch();
  const queue = a.list.slice(), res = [];
  await Promise.all(Array.from({ length: a.parallel }, async () => {
    while (queue.length) { const seed = queue.shift(); res.push(await runSeed(browser, seed, a)); }
  }));
  await browser.close();
  res.sort((x, y) => x.seed - y.seed);

  // the same seeds in the Node sim: the browser game must reproduce them exactly
  let node = {};
  try {
    const raw = execFileSync('node', [path.join(Q.ROOT, 'tools', 'sim_bot.js'), '--seeds', a.list.join(','), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
    JSON.parse(raw).runs.forEach(r => { node[r.seed] = r; });
  } catch (e) { if (e.stdout) JSON.parse(e.stdout).runs.forEach(r => { node[r.seed] = r; }); }

  let mismatches = 0, errors = 0, softlocks = 0;
  console.log(`seed  result  rooms  level  kills  simSec  worstStuck  errors  matchesNode  (${a.size}, speed x${a.speed})`);
  for (const r of res) {
    const n = node[r.seed], same = n && n.result === r.result && n.rooms === r.rooms && n.level === r.level && n.kills === r.kills;
    if (!same) mismatches++;
    errors += r.errors.length; if (r.result === 'softlock' || r.result === 'timeout') softlocks++;
    console.log(`${String(r.seed).padStart(4)}  ${r.result.padEnd(6)}  ${String(r.rooms).padStart(2)}/${r.totalRooms}  ${String(r.level).padStart(5)}  ${String(r.kills).padStart(5)}  ${String(r.seconds).padStart(6)}  ${String(r.worstStuck).padStart(10)}  ${String(r.errors.length).padStart(6)}  ${same ? 'yes' : 'NO ' + JSON.stringify(n && [n.result, n.rooms, n.level, n.kills])}`);
    r.errors.slice(0, 5).forEach(e => console.log('      ' + e));
  }
  const wins = res.filter(r => r.result === 'win');
  const summary = { size: a.size, seeds: a.list, runs: res.length, wins: wins.length, winRate: +(100 * wins.length / res.length).toFixed(1),
    winSeeds: wins.map(r => r.seed), clearedAll: wins.length > 0, consoleErrors: errors, softlocks, nodeMismatches: mismatches,
    worstStuck: Math.max(...res.map(r => r.worstStuck)), roomsClearedTotal: res.reduce((s, r) => s + r.rooms, 0) };
  console.log(JSON.stringify(summary));
  fs.mkdirSync(Q.OUT, { recursive: true });
  fs.writeFileSync(path.join(Q.OUT, `bot_${a.size}.json`), JSON.stringify({ summary, runs: res }, null, 1));
  process.exit(errors || softlocks || mismatches || !wins.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
