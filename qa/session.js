#!/usr/bin/env node
// Scripted real-time session of today's game (speed x1) for --minutes (default 2) of wall clock:
// title -> city -> walk into the Rift -> run (the bot fights, the script clicks every level-up card)
// -> LEAVE at the first door choice -> result -> BACK TO CITY -> into the Rift again, and so on.
// After a death it also goes back to the city. Halfway through it rotates the screen (960x540 <-> 540x960).
// It fails on any console or page error, and on a stuck game: no sim tick for 15 s during a run,
// or the sim's own stuck clock over 400 s. Screenshots go to qa/out/session/.
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

(async () => {
  const minutes = +(process.argv.includes('--minutes') ? process.argv[process.argv.indexOf('--minutes') + 1] : 2);
  const dir = path.join(Q.OUT, 'session');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await Q.launch();
  const page = await Q.open(browser, '?seed=3&fresh=1&lang=en&bot=1&manual=1', 'landscape');
  const t0 = Date.now(), end = t0 + minutes * 60000, log = [], problems = [];
  const el = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's';
  const note = m => { log.push(el() + ' ' + m); };
  let orient = 'landscape', shots = 0;
  const snap = async name => { shots++; await page.screenshot({ path: path.join(dir, `${String(shots).padStart(2, '0')}_${orient}_${name}.png`) }); };
  // the city hero walks into the portal (placed just in front of it, then a real key press carries him in)
  const intoRift = async () => {
    await page.evaluate(() => { const c = G.city, p = c.snapshot().portal; c.px = p.x; c.py = p.y - 22; c.follow(true); });
    await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
    await page.waitForFunction(() => G.screen === 'game' && G.gameScene && G.gameScene.sim, null, { timeout: 10000 });
  };

  await page.waitForTimeout(500);
  await snap('title');
  await Q.click(page, 'start');
  await page.waitForFunction(() => G.screen === 'city' && G.city);
  await page.waitForTimeout(500);
  await snap('city');
  note('title -> city');
  await intoRift();
  note('run 1 started from the portal');

  let runs = 1, left = 0, deaths = 0, wins = 0, levelups = 0, rooms = 0, rotated = false, lastTick = -1, lastTickAt = Date.now(), maxStuck = 0;
  while (Date.now() < end) {
    const st = await Q.state(page), now = Date.now();
    if (st.errors.length || page.errors.length) break;
    const s = st.sim;
    if (s && st.screen === 'game') {
      maxStuck = Math.max(maxStuck, s.worstStuck);
      if (s.tick !== lastTick) { lastTick = s.tick; lastTickAt = now; }
      else if (now - lastTickAt > 15000) { problems.push('game frozen: no sim tick for 15 s'); break; }
      if (s.worstStuck > 400) { problems.push('softlock: no progress for ' + s.worstStuck + ' s'); break; }
    }
    if (!rotated && now > t0 + minutes * 30000) {
      rotated = true; orient = 'portrait';
      await page.setViewportSize(Q.SIZES.portrait); await page.waitForTimeout(600);
      note('rotated to portrait'); await snap('after_rotate_' + st.screen);
    }
    if (st.screen === 'levelup') { await Q.click(page, 'card_' + (levelups++ % 3)); }
    else if (st.screen === 'choice') {
      rooms++;
      await snap('door_choice');
      await Q.click(page, 'leave'); note(`run ${runs}: left after room ${s.room + 1}`); left++;
    } else if (st.screen === 'result') {
      if (s.state === 'dead') { deaths++; note(`run ${runs}: died in room ${s.room + 1}`); }
      if (s.state === 'won') wins++;
      await snap('result_' + s.state);
      await Q.click(page, 'res_city');
      await page.waitForFunction(() => G.screen === 'city' && G.city, null, { timeout: 10000 });
      await page.waitForTimeout(400);
      await snap('city_again');
      if (Date.now() > end - 5000) break;
      await intoRift(); runs++; lastTick = -1; lastTickAt = Date.now();
      note(`run ${runs} started from the portal`);
    }
    await page.waitForTimeout(150);
  }
  const fin = await Q.state(page), errors = page.errors.concat(fin.errors);
  await page.screenshot({ path: path.join(dir, 'final.png') });
  await browser.close();
  const secs = Math.round((Date.now() - t0) / 1000);
  const summary = { wallSeconds: secs, runs, left, deaths, wins, roomsCleared: rooms, levelups, rotated, screenshots: shots,
    worstStuckSeconds: maxStuck, uncaughtErrors: errors.length, problems };
  log.forEach(l => console.log(l));
  errors.forEach(e => console.log('ERROR', e));
  console.log(JSON.stringify(summary));
  fs.writeFileSync(path.join(Q.OUT, 'session.json'), JSON.stringify({ summary, log, errors }, null, 1));
  process.exit(errors.length || problems.length || runs < 2 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
