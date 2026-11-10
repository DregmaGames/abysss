#!/usr/bin/env node
// Final check: one scripted session of the real game, in real time (speed x1), for --minutes
// (default 10) of wall clock. The script drives the game the way a player would: starts from the
// title, lets the bot fight, answers every level-up by clicking a card, opens the inventory and
// equips / unequips, changes zoom and shake in the settings, rotates the screen (960x540 <->
// 540x960), uses the touch buttons, and restarts from the result screen after each death or win.
// It fails on any console or page error, and on any "stuck" state: sim progress stalled > 400 s,
// or the game not advancing a single tick for 15 s outside a menu.
// Screenshots of every screen it passes through go to qa/out/session/.
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

(async () => {
  const minutes = +(process.argv.includes('--minutes') ? process.argv[process.argv.indexOf('--minutes') + 1] : 10);
  const dir = path.join(Q.OUT, 'session');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await Q.launch();
  const page = await Q.open(browser, '?seed=3&fresh=1&bot=1&manual=1&touch=1', 'landscape');
  const t0 = Date.now(), end = t0 + minutes * 60000, seen = {}, log = [], problems = [];
  const el = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's';
  const note = m => { log.push(el() + ' ' + m); };
  let orient = 'landscape', shots = 0;
  const snap = async (name) => {
    const key = orient + '_' + name;
    if (seen[key]) return;
    seen[key] = true; shots++;
    await page.screenshot({ path: path.join(dir, `${String(shots).padStart(2, '0')}_${key}.png`) });
  };

  await snap('title');
  await Q.click(page, 'start');
  await page.waitForFunction(() => G.screen === 'game' && G.gameScene && G.gameScene.sim);
  note('run started from the title');

  let lastTick = -1, lastTickAt = Date.now(), nextInv = t0 + 45000, nextRotate = t0 + 100000, nextSettings = t0 + 70000, nextTouch = t0 + 20000;
  let runs = 1, deaths = 0, wins = 0, levelups = 0, equips = 0, rotations = 0, roomsCleared = 0, maxStuck = 0, lastRoom = 0, lastRooms = 0;
  while (Date.now() < end) {
    const st = await Q.state(page), now = Date.now();
    if (st.errors.length || page.errors.length) break;
    const s = st.sim;
    if (s) {
      maxStuck = Math.max(maxStuck, s.worstStuck);
      if (s.rooms !== lastRooms) { if (s.rooms > lastRooms) roomsCleared += s.rooms - lastRooms; lastRooms = s.rooms; }
      if (s.room !== lastRoom) { lastRoom = s.room; note(`room ${s.room + 1} (level ${s.level}, hp ${s.hp}/${s.maxHp})`); await snap('room_' + (s.room + 1)); }
      if (s.tick !== lastTick) { lastTick = s.tick; lastTickAt = now; }
      else if (st.screen === 'game' && now - lastTickAt > 15000) { problems.push('game frozen: no sim tick for 15 s on screen ' + st.screen); break; }
      if (s.worstStuck > 400) { problems.push('softlock: no progress for ' + s.worstStuck + ' s'); break; }
    }
    if (st.screen === 'levelup') {
      await snap('levelup');
      await Q.click(page, 'card_' + (levelups % 3 === 2 ? 1 : 0)); levelups++;
    } else if (st.screen === 'result') {
      await snap(s.state === 'won' ? 'result_won' : 'result_dead');
      if (s.state === 'won') wins++; else deaths++;
      note(`${s.state === 'won' ? 'WON' : 'died in room ' + (s.room + 1)}: level ${s.level}, kills ${s.kills}, gear score ${s.gearScore}`);
      if (runs % 3 === 0) {             // every third run: go back through the title and its equipment screen
        await Q.click(page, 'res_gear'); await page.waitForFunction(() => G.screen === 'title'); await page.waitForTimeout(300);
        await snap('title_equipment'); await Q.click(page, 'inv_close'); await snap('title_with_gear');
        await Q.click(page, 'start');
      } else await Q.click(page, 'res_again');
      await page.waitForFunction(() => G.screen === 'game' && G.gameScene && G.gameScene.sim && G.gameScene.sim.tick < 30);
      runs++; lastRoom = 0; lastRooms = 0; lastTick = -1; lastTickAt = Date.now();
      note('run ' + runs + ' started');
    } else if (st.screen === 'game') {
      if (s.fissures.includes('open')) await snap('fissure_open');
      if (s.fissures.includes('scar')) await snap('scar');
      if (s.phase === 'super' && s.monsters > 0) await snap('super_fissure');
      if (s.phase === 'exit') await snap('chest_open_exit');
      if (now > nextTouch) {            // touch buttons: real taps on dodge and pulse
        nextTouch = now + 30000;
        await Q.click(page, 'tpulse'); await Q.click(page, 'tdodge');
        await snap('touch_buttons');
      }
      if (now > nextInv && s.bag + s.gearScore > 0) {
        nextInv = now + 50000;
        await Q.click(page, 'inv'); await page.waitForTimeout(200);
        await snap('inventory');
        const eq = await page.evaluate(() => Object.keys(G.gameScene.sim.gear.equipped).find(k => G.gameScene.sim.gear.equipped[k]));
        if (eq) {
          await Q.click(page, 'slot_' + eq); await snap('inventory_slot');
          await Q.click(page, 'unequip');
          const idx = await page.evaluate(() => G.gameScene.sim.gear.bag.length - 1);
          await Q.click(page, 'bag_' + idx); await snap('inventory_item');
          await Q.click(page, 'equip'); equips++;
        }
        await Q.click(page, 'inv_close');
        lastTickAt = Date.now();
      } else if (now > nextSettings) {
        nextSettings = now + 80000;
        await Q.click(page, 'inv'); await Q.click(page, 'inv_settings'); await page.waitForTimeout(200);
        await snap('settings');
        const v = (await Q.state(page)).view;
        if (v.steps > 1) {
          const to = v.S === v.base ? 1 : 0;
          await Q.click(page, 'zoom_' + to); await page.waitForTimeout(500);
          note('zoom set to ' + (await Q.state(page)).view.S + 'x');
          await snap('settings_zoom_' + to);
        }
        await Q.click(page, 'shake_' + (rotations % 2 ? 10 : 4));
        await Q.click(page, 'set_close'); await Q.click(page, 'inv_close');
        await page.waitForTimeout(300); await snap('gameplay_zoom_' + (await Q.state(page)).view.S + 'x');
        lastTickAt = Date.now();
      } else if (now > nextRotate) {
        nextRotate = now + 100000;
        orient = orient === 'landscape' ? 'portrait' : 'landscape'; rotations++;
        await page.setViewportSize(Q.SIZES[orient]); await page.waitForTimeout(600);
        note('rotated to ' + orient + ' ' + JSON.stringify(Q.SIZES[orient]));
        await snap('gameplay_after_rotate');
      }
    }
    await page.waitForTimeout(150);
  }
  const fin = await Q.state(page), errors = page.errors.concat(fin.errors);
  await page.screenshot({ path: path.join(dir, 'final.png') });
  await browser.close();
  const secs = Math.round((Date.now() - t0) / 1000);
  const summary = { wallSeconds: secs, runs, deaths, wins, roomsCleared, levelups, equipChanges: equips, rotations, screenshots: shots,
    worstStuckSeconds: maxStuck, uncaughtErrors: errors.length, problems };
  log.forEach(l => console.log(l));
  errors.forEach(e => console.log('ERROR', e));
  console.log(JSON.stringify(summary));
  fs.writeFileSync(path.join(Q.OUT, 'session.json'), JSON.stringify({ summary, log, errors }, null, 1));
  process.exit(errors.length || problems.length || secs < minutes * 60 - 5 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
