#!/usr/bin/env node
// Screenshot tour: every screen of the game at 960x540 and 540x960, driven like a player
// (real clicks on real controls; the bot only plays the fights in between).
//   node qa/screens.js [landscape|portrait|both] [seed]
// Writes qa/out/screens/<size>_<nn>_<name>.png and exits non-zero on any console/page error.
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

async function tour(browser, size, seed) {
  const dir = path.join(Q.OUT, 'screens');
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const log = [];
  const snap = async (page, name) => {
    // a level-up card may pop up at any moment: answer it first unless that is the shot we want
    if (name !== 'levelup') {
      for (let i = 0; i < 5 && (await Q.state(page)).screen === 'levelup'; i++) { await Q.click(page, 'card_0'); await page.waitForTimeout(80); }
    }
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
      if (st.screen === 'levelup') await Q.click(page, 'card_0');
      else await page.waitForTimeout(60);
      if (Date.now() - t0 > (maxMs || 120000)) throw new Error(size + ': timed out waiting for ' + what + ' ' + JSON.stringify(st.sim));
    }
  };
  const errors = [];

  // ---- title, title panels
  let page = await Q.open(browser, `?seed=${seed}&fresh=1`, size);
  await page.waitForTimeout(600);
  await snap(page, 'title');
  await Q.click(page, 'title_settings'); await page.waitForTimeout(200);
  await snap(page, 'title_settings');
  await Q.click(page, 'set_close');
  await Q.click(page, 'title_gear'); await page.waitForTimeout(200);
  await snap(page, 'title_equipment_empty');
  await Q.click(page, 'inv_close');
  await Q.click(page, 'tier_r'); await page.waitForTimeout(150);
  await snap(page, 'title_tier_locked');
  await Q.click(page, 'tier_l');
  await Q.click(page, 'start');
  await page.waitForFunction(() => G.screen === 'game' && G.gameScene && G.gameScene.sim);
  await page.waitForTimeout(700);
  await snap(page, 'room_start_explore');
  errors.push(...page.errors);
  await page.context().close();

  // ---- a run: bot fights, test handles every level-up by clicking a card
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&bot=1&manual=1&speed=3`, size);
  let st = await until(page, s => s.sim.fissures.includes('opening'), 'a fissure opening');
  await snap(page, 'fissure_expanding');
  st = await until(page, s => s.sim.fissures.includes('open') && s.sim.monsters >= 3, 'monsters out');
  await snap(page, 'combat');
  st = await until(page, s => s.screen === 'levelup', 'level up');
  await page.waitForTimeout(250);
  await snap(page, 'levelup');
  await Q.click(page, 'card_0');
  st = await until(page, s => s.sim.fissures.includes('closing'), 'a fissure closing');
  await snap(page, 'fissure_closing');
  st = await until(page, s => s.sim.fissures.includes('scar'), 'a scar');
  await page.waitForTimeout(300);
  await snap(page, 'scar');
  st = await until(page, s => s.sim.phase === 'super' && s.sim.monsters >= 3, 'super fissure wave');
  await page.waitForTimeout(400);
  await snap(page, 'super_fissure');
  st = await until(page, s => s.sim.phase === 'chest', 'chest');
  await page.waitForTimeout(500);
  await snap(page, 'super_scar_chest');
  // freeze the frame the chest opens (the bot is through the gate a moment later)
  await page.evaluate(() => { const iv = setInterval(() => { if (G.gameScene.sim.phase === 'exit') { G.paused = true; clearInterval(iv); } }, 4); });
  st = await until(page, s => s.sim.phase === 'exit', 'exit open');
  await page.waitForTimeout(250);
  await snap(page, 'exit_open_loot');
  await page.evaluate(() => { G.paused = false; });
  st = await until(page, s => s.sim.room >= 1 && s.sim.bag + s.sim.gearScore > 0, 'room 2 with loot');
  // inventory: the bot auto-equips, so take one piece off to show bag + details + equip
  await Q.click(page, 'inv'); await page.waitForTimeout(250);
  await snap(page, 'inventory');
  const eq = await page.evaluate(() => Object.keys(G.gameScene.sim.gear.equipped).find(k => G.gameScene.sim.gear.equipped[k]));
  if (eq) {
    await Q.click(page, 'slot_' + eq); await page.waitForTimeout(150);
    await snap(page, 'inventory_slot_selected');
    await Q.click(page, 'unequip'); await page.waitForTimeout(150);
    const before = await page.evaluate(() => JSON.stringify(G.gameScene.sim.stats));
    const idx = await page.evaluate(() => G.gameScene.sim.gear.bag.length - 1);
    await Q.click(page, 'bag_' + idx); await page.waitForTimeout(150);
    await snap(page, 'inventory_item_details');
    await Q.click(page, 'equip'); await page.waitForTimeout(150);
    const after = await page.evaluate(() => JSON.stringify(G.gameScene.sim.stats));
    if (before === after) errors.push('equip did not change stats');
    await snap(page, 'inventory_equipped');
  }
  await Q.click(page, 'inv_settings'); await page.waitForTimeout(200);
  await snap(page, 'settings');
  const steps = (await Q.state(page)).view.steps;
  if (steps > 1) {
    await Q.click(page, 'zoom_1'); await page.waitForTimeout(500);
    await snap(page, 'settings_zoom_in');
    await Q.click(page, 'set_close'); await page.waitForTimeout(150);
    await Q.click(page, 'inv_close'); await page.waitForTimeout(300);
    await snap(page, 'gameplay_zoom_in');
    await Q.click(page, 'inv'); await page.waitForTimeout(150);
    await snap(page, 'inventory_zoom_in');
    await Q.click(page, 'inv_settings'); await page.waitForTimeout(150);
    await Q.click(page, 'zoom_0'); await page.waitForTimeout(500);
  }
  await Q.click(page, 'shake_3'); await page.waitForTimeout(150);
  const shake = await page.evaluate(() => G.save.settings.shake);
  if (shake !== 30) errors.push('shake slider: expected 30, got ' + shake);
  await Q.click(page, 'shake_10');
  await Q.click(page, 'set_close'); await Q.click(page, 'inv_close');
  // death -> result (forced through the sim's own damage path so the tour stays short)
  await page.evaluate(() => { const s = G.gameScene.sim; s.player.iframes = 0; s.hurtPlayer(99999, 0, 0); });
  await page.waitForFunction(() => G.screen === 'result', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await snap(page, 'result_dead');
  await Q.click(page, 'res_title');
  await page.waitForFunction(() => G.screen === 'title');
  await page.waitForTimeout(300);
  await snap(page, 'title_with_gear');
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await page.context().close();

  // ---- touch controls
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&touch=1`, size, { touch: true });
  await page.waitForTimeout(500);
  const vp = Q.SIZES[size];
  await page.mouse.move(vp.width * 0.25, vp.height * 0.7); await page.mouse.down();
  await page.mouse.move(vp.width * 0.25 + 30, vp.height * 0.7 - 22, { steps: 4 });
  await page.waitForTimeout(900);
  const moved = await Q.state(page);
  await snap(page, 'touch_controls');
  await page.mouse.up();
  await Q.click(page, 'tpulse'); await page.waitForTimeout(120);
  await snap(page, 'touch_pulse');
  errors.push(...page.errors);
  await page.context().close();
  if (moved.sim.tick < 10) errors.push('touch: sim not running');

  // ---- boss room and win screen (bot at speed, forced forward to the last room for the picture)
  page = await Q.open(browser, `?scene=game&seed=${seed}&fresh=1&bot=1&speed=4`, size);
  // picture only: jump to the last room with its fissures already sealed and a mage that survives the photo
  await page.evaluate(() => {
    const s = G.gameScene.sim;
    s.loadRoom(s.B.run.rooms - 1);
    s.fissures.forEach(f => { if (!f.big) { f.state = 'scar'; f.reveal = 0; f.queue = []; f.scarTick = s.tick; } });
    s.player.maxHp = s.stats.maxHp = 5000; s.player.hp = 5000;
  });
  st = await until(page, s => s.sim.phase === 'super' && s.sim.monsters >= 1, 'boss');
  await page.waitForTimeout(1500);
  await snap(page, 'boss_room');
  await page.evaluate(() => { const s = G.gameScene.sim; s.state = 'won'; s.emit({ t: 'won' }); });
  await page.waitForFunction(() => G.screen === 'result', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await snap(page, 'result_won');
  errors.push(...page.errors);
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
