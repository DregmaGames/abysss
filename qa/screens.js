#!/usr/bin/env node
// Screenshot tour: one picture of every screen the game has today, at 960x540 and 540x960, in English,
// driven like a player (real clicks on real controls; the bot only plays the fights in between).
//   node qa/screens.js [landscape|portrait|both] [seed]
// Writes qa/out/screens/<size>_<nn>_<name>.png and exits non-zero on any console/page error.
// Screens: title, title settings, city, city settings, city inventory, Blacksmith, Trainer, Don Montoto,
// a run (fissure, combat, level-up, door choice, inventory, settings), result (dead), back in the city, the cultist with its rune and pool,
// the boss room with each telegraphed attack (slam, burst, charge) and the result (won).
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

async function tour(browser, size, seed) {
  const dir = path.join(Q.OUT, 'screens');
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const log = [], errors = [];
  const snap = async (page, name) => {
    const f = path.join(dir, `${size}_${String(++n).padStart(2, '0')}_${name}.png`);
    await page.screenshot({ path: f });
    log.push(path.basename(f));
  };
  // keep the run going (answering level-ups with real clicks) until cond(state) holds
  const until = async (page, cond, what, maxMs) => {
    const t0 = Date.now();
    for (;;) {
      const st = await Q.state(page);
      if (cond(st)) return st;
      if (st.screen === 'levelup') { await page.waitForTimeout(450); await Q.click(page, 'card_0'); }
      else await page.waitForTimeout(60);
      if (Date.now() - t0 > (maxMs || 120000)) throw new Error(size + ': timed out waiting for ' + what + ' ' + JSON.stringify(st.sim));
    }
  };
  const closeAll = async page => { await page.evaluate(() => { if (G.Panels && G.Panels.isOpen()) G.Panels.close(); }); await page.waitForTimeout(150); };
  // put the city hero in front of a stall, a step to the side so the owner stays visible (a teleport: walking there is not what this tour checks)
  const goTo = async (page, id) => {
    await page.evaluate(id => { const c = G.city, o = c.spots[id]; c.px = o.front.x + 18; c.py = o.front.y + 6; c.follow(true); }, id);
    await page.waitForTimeout(250);
  };

  // ---- title and its settings
  let page = await Q.open(browser, `?seed=${seed}&fresh=1&lang=en`, size);
  await page.waitForTimeout(600);
  await snap(page, 'title');
  await Q.click(page, 'title_settings'); await page.waitForTimeout(200);
  await snap(page, 'title_settings');
  await Q.click(page, 'set_close');
  // Don Montoto already rescued and some gold, so every stall has its owner and the shop has something to show
  await page.evaluate(() => { const g = G.gearOf(G.save, G.cls); g.city = { montoto: true, story: 0 }; g.gold = 400; g.scrolls = 2; });
  await Q.click(page, 'start');
  await page.waitForFunction(() => G.screen === 'city' && G.city);
  await page.waitForTimeout(600);
  await snap(page, 'city');
  // ---- city panels
  await Q.click(page, 'city_set'); await page.waitForTimeout(200);
  await snap(page, 'city_settings');
  await Q.click(page, 'set_close');
  await Q.click(page, 'inv'); await page.waitForTimeout(200);
  await snap(page, 'city_inventory');
  await Q.click(page, 'inv_close');
  await goTo(page, 'smith');
  await snap(page, 'city_smith_near');
  await Q.click(page, 'city_talk'); await page.waitForTimeout(250);
  await snap(page, 'city_smith_shop');
  await closeAll(page);
  await goTo(page, 'trainer');
  await Q.click(page, 'city_talk'); await page.waitForTimeout(250);
  await snap(page, 'city_trainer');
  await closeAll(page);
  await goTo(page, 'montoto');
  await snap(page, 'city_montoto');
  await Q.click(page, 'city_talk'); await page.waitForTimeout(250);
  await snap(page, 'city_montoto_talk');
  await closeAll(page);
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await page.context().close();

  // ---- a run: the bot fights, the test answers level-ups and the door choice with real clicks
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&lang=en&bot=1&manual=1&speed=3`, size);
  await until(page, s => s.sim && s.sim.fissures.includes('opening'), 'a fissure opening');
  await snap(page, 'run_fissure_opening');
  await until(page, s => s.sim.fissures.includes('open') && s.sim.monsters >= 3, 'monsters out');
  await snap(page, 'run_combat');
  await until(page, s => s.screen === 'levelup', 'level up');
  await page.waitForTimeout(500);      // a fresh level-up or door choice ignores clicks for 400 ms
  await snap(page, 'run_levelup');
  await Q.click(page, 'card_0');
  await until(page, s => s.screen === 'choice', 'door choice', 240000);
  await page.waitForTimeout(500);
  await snap(page, 'run_door_choice');
  await Q.click(page, 'door_0');
  await until(page, s => s.sim.room >= 1 && s.screen === 'game', 'room 2');
  await Q.click(page, 'inv'); await page.waitForTimeout(250);
  await snap(page, 'run_inventory');
  await Q.click(page, 'inv_settings'); await page.waitForTimeout(200);
  await snap(page, 'run_settings');
  await Q.click(page, 'set_close'); await Q.click(page, 'inv_close');
  // death -> result (forced through the sim's own damage path so the tour stays short)
  await page.evaluate(() => { const s = G.gameScene.sim; s.player.iframes = 0; s.hurtPlayer(99999, 0, 0); });
  await page.waitForFunction(() => G.screen === 'result', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await snap(page, 'result_dead');
  await Q.click(page, 'res_city');
  await page.waitForFunction(() => G.screen === 'city' && G.city);
  await page.waitForTimeout(500);
  await snap(page, 'city_after_run');
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await page.context().close();

  // ---- the cultist (room 4 on): one has left a rift pool, the other is drawing its rune under the hero
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&lang=en&manual=1`, size);
  await page.evaluate(() => {
    const s = G.gameScene.sim;
    s.loadRoom(3); s.cheats.god = true;
    const p = s.player, free = (x, y) => !s.boxHits(x, y, 8) && !s.crackHits(x, y, 8);
    const spots = [[64, -14], [-60, 26], [26, -62], [-34, -56], [58, 40], [-64, -20]].filter(o => free(p.x + o[0], p.y + o[1])).slice(0, 2);
    spots.forEach((o, i) => { const m = s.spawnMonster('cultist', p.x + o[0], p.y + o[1], 0); m.emerge = 0; m.cd = i ? 2.2 : 0.2; });
    // when the first rune has become a pool the hero steps aside, so the second rune is drawn next to it
    const iv = setInterval(() => {
      if (s.pools.length && !iv.moved) {
        const q = s.pools[0], to = [[44, 0], [-44, 0], [0, 44], [0, -44]].find(o => free(q.x + o[0], q.y + o[1]));
        if (to) { p.x = q.x + to[0]; p.y = q.y + to[1]; }
        iv.moved = true;
      }
      if (s.pools.length && s.teles.some(t => t.rune && t.t / t.dur > 0.6)) { G.paused = true; clearInterval(iv); }
    }, 4);
  });
  await page.waitForFunction(() => G.paused, null, { timeout: 30000 });
  await page.waitForTimeout(250);
  await snap(page, 'run_cultist');
  await page.evaluate(() => { G.paused = false; });
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await page.context().close();

  // ---- boss room: each telegraphed attack frozen in its wind-up, then the win screen
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&lang=en&bot=1&speed=4`, size);
  await page.evaluate(() => {
    const s = G.gameScene.sim;
    s.loadRoom(s.B.run.rooms - 1);
    s.fissures.forEach(f => { if (!f.big) { f.state = 'scar'; f.reveal = 0; f.queue = []; f.scarTick = s.tick; } });
    s.player.maxHp = s.stats.maxHp = 50000; s.player.hp = 50000;
  });
  await until(page, s => s.sim.phase === 'super' && s.sim.monsters >= 1 && s.screen === 'game', 'boss');
  await page.waitForTimeout(1200);
  await snap(page, 'boss_room');
  for (const [k, st, name, wind] of [[0, 'slam', 'boss_slam', 'slamWindup'], [1, 'burstWind', 'boss_burst', 'burstWindup'], [2, 'chargeWind', 'boss_charge', 'chargeWindup']]) {
    // the next attack of the cycle is atk; freeze the frame half-way through its wind-up
    await page.evaluate(([k, st, wind]) => {
      const s = G.gameScene.sim, b = s.monsters.find(m => m.def.boss);
      b.st = 'chase'; b.t = 0; b.atk = k;
      const iv = setInterval(() => { if (b.st === st && b.t < b.def[wind] * 0.5) { G.paused = true; clearInterval(iv); } }, 4);
    }, [k, st, wind]);
    await page.waitForFunction(() => G.paused, null, { timeout: 15000 });
    await page.waitForTimeout(200);
    await snap(page, name);
    await page.evaluate(() => { G.paused = false; });
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => { const s = G.gameScene.sim; s.state = 'won'; s.emit({ t: 'won' }); });
  await page.waitForFunction(() => G.screen === 'result', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await snap(page, 'result_won');
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await page.context().close();
  return { size, shots: log, errors };
}

(async () => {
  const which = process.argv[2] || 'both', seed = +(process.argv[3] || 5);
  const sizes = which === 'both' ? ['landscape', 'portrait'] : [which];
  const browser = await Q.launch();
  let bad = 0;
  for (const s of sizes) {
    const r = await tour(browser, s, seed);
    console.log(`${s}: ${r.shots.length} screenshots, ${r.errors.length} errors`);
    r.errors.forEach(e => console.log('  ERROR', e));
    bad += r.errors.length;
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
