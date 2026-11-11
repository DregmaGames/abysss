#!/usr/bin/env node
// Step 2 check: the test room. Landscape enters with the mouse, portrait with touch (title button,
// floating stick, DODGE button, DBG button). In each: push into an open crack (blocked feedback),
// dodge across it and screenshot the mage mid-hop, then use the debug panel to clear the room and
// check that it restarts. Also loads ?scene=game&room=test directly.
// node qa/test_room.js [outDir]   -> <outDir>/step2_landscape.png, step2_portrait.png
'use strict';
const Q = require('./lib'), path = require('path');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, ms) {
  await page.waitForFunction(fn, null, { timeout: ms || 8000 });
}

// a floor spot just left of an open crack pixel, with a clear dodge lane to the far side
function findSpot() {
  const s = G.gameScene.sim, W = s.crackW, H = s.crackH, g = s.crackGrid, r = s.player.r, D = s.cls.dodge.dist;
  for (let y = 72; y < H - 40; y += 2) for (let x = 24; x < W - 24; x++) {
    if (!g[y * W + x] || g[y * W + x - 1]) continue;
    const px = x - r - 2, ex = px + D;
    if (s.boxHits(px, y, r) || s.crackHits(px, y, r) || s.boxHits(ex, y, r) || s.crackHits(ex, y, r)) continue;
    let ok = true;
    for (let xx = px; xx <= ex && ok; xx += 2) if (s.boxHits(xx, y, r)) ok = false;
    if (ok) return { x: px, y: y };
  }
  return null;
}

async function run(browser, size, touch) {
  const out = { size };
  const page = await Q.open(browser, '', size, { touch });
  const tap = async name => {
    const h = await page.evaluate(n => G.qa.hits[n], name);
    if (!h) throw new Error('no such control: ' + name);
    if (touch) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y);
    await sleep(150);
  };
  await tap('title_test');
  await waitFor(page, () => G.screen === 'game' && G.gameScene && G.hud);
  await sleep(1500);                                   // cracks finish opening
  let st = await Q.state(page);
  out.entry = { test: st.sim.test, room: st.sim.room + 1, touch: st.sim.touch };

  // count sim events, god mode so a stray monster cannot end the check
  await page.evaluate(() => {
    const s = G.gameScene.sim, emit = s.emit.bind(s);
    window.__ev = {};
    s.emit = o => { window.__ev[o.t + (o.cross ? '+' : '')] = (window.__ev[o.t + (o.cross ? '+' : '')] || 0) + 1; emit(o); };
    G.cheats.god = true;
  });
  const spot = await page.evaluate(findSpot);
  out.spot = spot;
  if (spot) {
    await page.evaluate(p => { const s = G.gameScene.sim; s.player.x = p.x; s.player.y = p.y; s.player.fx = 1; s.player.fy = 0; G.gameScene.cam.x = p.x; G.gameScene.cam.y = p.y; }, spot);
    // freeze the sim half way through the dodge so the screenshot shows the hop
    await page.evaluate(() => {
      const s = G.gameScene.sim, step = s.step.bind(s), dur = s.cls.dodge.time;
      window.__frozen = false; let once = false;
      s.step = () => { if (window.__frozen) return; step(); if (!once && s.player.dashT > 0 && s.player.dashT <= dur * 0.45) { once = window.__frozen = true; G.paused = true; } };
    });
    let cdp = null, sx = 0, sy = 0;
    if (touch) {
      cdp = await page.context().newCDPSession(page);
      sx = Math.round(Q.SIZES[size].width * 0.2); sy = Math.round(Q.SIZES[size].height * 0.7);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
      for (let i = 1; i <= 4; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 15, y: sy, id: 1 }] }); await sleep(30); }
    } else await page.keyboard.down('d');
    await sleep(900);                                  // walking into the crack: blocked feedback
    out.pushX = (await Q.state(page)).sim.x - spot.x;
    if (touch) {
      const h = await page.evaluate(() => G.qa.hits.tdodge);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx + 60, y: sy, id: 1 }, { x: h.x, y: h.y, id: 2 }] });
      await sleep(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: sx + 60, y: sy, id: 1 }] });
    } else await page.keyboard.press('Space');
    try { await waitFor(page, () => window.__frozen, 3000); out.frozen = true; } catch (e) { out.frozen = false; }
    await sleep(250);
    out.shot = path.join(OUT, 'step2_' + size + '.png');
    await page.screenshot({ path: out.shot });
    await page.evaluate(() => { window.__frozen = false; G.paused = false; });
    await sleep(500);
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.keyboard.up('d');
    await sleep(300);
    st = await Q.state(page);
    out.afterDodgeX = st.sim.x - spot.x;
  }

  // debug panel: SKIP PHASE until the room is cleared; the test room must restart, same room
  for (let i = 0; i < 16; i++) {
    st = await Q.state(page);
    if (st.sim.loops >= 1) break;
    if (st.sim.state === 'levelup') { await page.keyboard.press('1'); await sleep(300); continue; }
    if (touch) await tap('dbg'); else { await page.keyboard.press('F2'); await sleep(150); }
    const scr = await page.evaluate(() => G.screen);
    if (scr !== 'debug') { out.debugOpenFail = (out.debugOpenFail || 0) + 1; continue; }
    await tap('dbg_skip');
    await sleep(2500);
  }
  st = await Q.state(page);
  out.after = { loops: st.sim.loops, room: st.sim.room + 1, phase: st.sim.phase, test: st.sim.test };
  out.events = await page.evaluate(() => window.__ev);
  out.errors = page.errors.concat(st.errors || []);
  await page.context().close();
  return out;
}

(async () => {
  const b = await Q.launch();
  const res = [];
  res.push(await run(b, 'landscape', false));
  res.push(await run(b, 'portrait', true));
  // the URL entry point
  const page = await Q.open(b, '?scene=game&room=test', 'landscape');
  await sleep(800);
  const st = await Q.state(page);
  res.push({ size: 'url', test: st.sim.test, room: st.sim.room + 1, errors: page.errors.concat(st.errors || []) });
  await b.close();
  for (const r of res) console.log(JSON.stringify(r));
})().catch(e => { console.error(e); process.exit(1); });
