#!/usr/bin/env node
// Step big rooms: the far default view and the bigger rooms, on desktop and phone sizes.
//   node qa/rooms.js [outDir] [ui|rooms|all] [size ...]
// ui    : HUD, Settings, inventory, the level-up cards and the door choice at 1640x922 and 1920x1080 (S=2): every panel inside
//         the screen and centred, the zoom slider up and back down, an old save's zoom offset (-2, +1) keeps its scale.
// rooms : a normal room (room 3), the boss room and the test room at 1640x922, 1920x1080, 960x540, 844x390 and 540x960:
//         how much of the screen the room covers, the camera follows on small screens, 0 console errors.
// Screenshots: <out>/<what>_<WxH>.png
'use strict';
const Q = require('./lib'), path = require('path'), fs = require('fs');
const args = process.argv.slice(2);
const OUT = args[0] || path.join(Q.OUT, 'rooms'), MODE = args[1] || 'all';
const ALL = ['1640x922', '1920x1080', '960x540', '844x390', '540x960'];
const SIZES = args.slice(2).length ? args.slice(2) : ALL;
const sz = s => { const [w, h] = s.split('x').map(Number); return { width: w, height: h }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); return ok; };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

// every UI object of the top panel layer: its bounding box in art px must be inside the view
const panelBox = page => page.evaluate(() => {
  const L = G.Panels && G.Panels.L, V = G.view;
  if (!L || !L.objs) return null;
  let x0 = L.x, y0 = L.y, x1 = L.x + L.w, y1 = L.y + L.h, n = 0;
  L.objs.forEach(o => {
    if (!o || !o.getBounds || o.visible === false) return;
    const b = o.getBounds();
    if (b.width >= V.W && b.height >= V.H) return;      // the dim backdrop
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); n++;
  });
  return { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1), px: L.x, pw: L.w, n, W: V.W, H: V.H, S: V.S };
});

async function ui(browser, size) {
  const page = await Q.open(browser, '?scene=game&fresh=1&seed=4&lang=en&mute=1', sz(size));
  await page.evaluate(() => { G.cheats.god = true; });
  await sleep(900);
  const v = (await Q.state(page)).view;
  check(v.S === 2, `${size}: default S is ${v.S}, expected 2`);
  await shot(page, 'ui_hud_' + size);
  const row = { size, S: v.S, art: v.W + 'x' + v.H, lo: v.lo, maxS: v.maxS };
  const inside = async (what) => {
    const b = await panelBox(page);
    if (!b) { row[what] = 'no layer info'; return; }
    const ok = b.x0 >= 0 && b.y0 >= 0 && b.x1 <= b.W && b.y1 <= b.H, off = Math.abs(b.px + b.pw / 2 - b.W / 2);
    row[what] = `${b.x1 - b.x0}x${b.y1 - b.y0} at ${b.x0},${b.y0}${ok ? '' : ' OFF SCREEN'}${off > 3 ? ' off centre ' + Math.round(off) : ''}`;
    check(ok, `${size}: ${what} leaves the screen`); check(off <= 3, `${size}: ${what} is ${Math.round(off)} art px off centre`);
  };
  // settings
  await page.keyboard.press('Escape'); await sleep(300);
  check((await Q.state(page)).panel === 'settings', size + ': settings did not open');
  await shot(page, 'ui_settings_' + size); await inside('settings');
  // zoom: up one step, back down, and down once more (must stop at the lowest step)
  const zs = [v.S];
  for (const b of ['zoom_plus', 'zoom_minus', 'zoom_minus']) { await Q.click(page, b); await sleep(350); zs.push((await Q.state(page)).view.S); }
  row.zoom = zs.join('>');
  check(zs[1] === Math.min(v.maxS, v.S + 1) && zs[2] === v.S && zs[3] === Math.max(v.lo, v.S - 1), `${size}: zoom steps ${row.zoom} (range ${v.lo}-${v.maxS})`);
  await page.evaluate(() => { G.save.settings.zoom = 0; G.applyView(); }); await sleep(250);
  await page.evaluate(() => G.Panels.close()); await sleep(200);
  // inventory (with some loot in the sealed bag)
  await page.evaluate(() => { const s = G.gameScene.sim; s.cheatLoot(); });
  await sleep(700);
  await Q.click(page, 'inv'); await sleep(300);
  await shot(page, 'ui_inventory_' + size); await inside('inventory');
  await page.evaluate(() => G.Panels.close()); await sleep(200);
  // level-up cards
  await page.evaluate(() => G.gameScene.sim.cheatLevel()); await sleep(700);
  check((await Q.state(page)).screen === 'levelup', size + ': no level-up screen');
  await shot(page, 'ui_cards_' + size);
  const cards = await page.evaluate(() => ['card_0', 'card_1', 'card_2'].map(n => G.qa.hits[n]));
  check(cards.every(Boolean), size + ': level-up cards missing');
  if (cards.every(Boolean)) { const mid = (cards[0].x + cards[2].x) / 2; row.cards = cards.map(c => c.x + ',' + c.y).join(' '); check(Math.abs(mid - sz(size).width / 2) <= 8 || cards[0].x === cards[2].x, `${size}: cards off centre (${row.cards})`); }
  await sleep(450); await Q.click(page, 'card_0'); await sleep(300);
  // door choice
  await page.evaluate(() => G.gameScene.sim.cheatChoice()); await sleep(700);
  await shot(page, 'ui_doors_' + size);
  row.errors = page.errors.length + (await Q.state(page)).errors.length;
  check(row.errors === 0, `${size}: ${row.errors} console errors (ui) ${page.errors.slice(0, 2).join(' | ')}`);
  await page.context().close();
  return row;
}

// an old save (no zoomRule) with a zoom offset: the scale the player had must survive
async function oldSave(browser, size, zoom, wantS) {
  const ctx = await browser.newContext({ viewport: sz(size), deviceScaleFactor: 1 });
  await ctx.addInitScript(z => {
    try { if (!localStorage.getItem('riftscar.save.v2')) localStorage.setItem('riftscar.save.v2', JSON.stringify({ v: 8, gears: {}, settings: { zoom: z, shake: 100, lang: 'en', music: 0, sfx: 0, hd: true }, stats: { runs: 3, wins: 0, best: 4 } })); } catch (e) { /* no storage */ }
  }, zoom);
  const page = await ctx.newPage();
  await page.goto(Q.GAME + '?mute=1');
  await page.waitForFunction(() => window.G && G.ready, null, { timeout: 20000 });
  await sleep(300);
  const r = await page.evaluate(() => ({ S: G.view.S, zoom: G.save.settings.zoom, rule: G.save.settings.zoomRule, stored: JSON.parse(localStorage.getItem('riftscar.save.v2') || '{}').settings }));
  check(r.S === wantS && r.rule === 2 && r.stored && r.stored.zoomRule === 2, `${size}: old save zoom ${zoom} gives S=${r.S} (want ${wantS}), rule ${r.rule}, stored ${JSON.stringify(r.stored)}`);
  await ctx.close();
  return { size, oldZoom: zoom, S: r.S, newZoom: r.zoom };
}

// room cover: the part of the screen (art px) the room's rectangle takes, with the camera where the game put it
const cover = page => page.evaluate(() => {
  const gs = G.gameScene, r = gs.sim.room, V = G.view, wv = gs.cameras.main.worldView;
  const x0 = Math.max(0, -wv.x), y0 = Math.max(0, -wv.y), x1 = Math.min(V.W, r.w * 16 - wv.x), y1 = Math.min(V.H, r.h * 16 - wv.y);
  return { room: r.w + 'x' + r.h, art: V.W + 'x' + V.H, S: V.S, cover: Math.round(100 * Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / (V.W * V.H)),
    follows: r.w * 16 > V.W || r.h * 16 > V.H, monsters: gs.sim.monsters.length, fissures: gs.sim.fissures.length };
});

async function rooms(browser, size) {
  const out = [];
  // a normal room: room 3 of a run, cracks awake
  let page = await Q.open(browser, '?scene=game&fresh=1&seed=4&lang=en&mute=1', sz(size));
  await page.evaluate(() => { G.cheats.god = true; G.gameScene.sim.cheatRoom(2); });
  await sleep(900);
  await shot(page, 'room_start_' + size);
  // walk the bot for a while so cracks open and monsters are out, then freeze the picture
  await page.evaluate(() => { const gs = G.gameScene; gs.bot = new G.Bot(gs.sim); gs.speed = 4; });      // fast-forward: headless Chromium is slow
  for (let i = 0; i < 40; i++) { await sleep(400); if ((await Q.state(page)).sim.monsters >= 6) break; }
  await page.evaluate(() => { G.gameScene.speed = 1; }); await sleep(300);
  await shot(page, 'room_fight_' + size);
  out.push(Object.assign({ what: 'room 3', size }, await cover(page), { errors: page.errors.length + (await Q.state(page)).errors.length }));
  // the boss room
  await page.evaluate(() => { G.gameScene.bot = null; G.gameScene.sim.cheatRoom(G.BAL.run.rooms - 1); });
  await sleep(1800);
  await shot(page, 'boss_' + size);
  out.push(Object.assign({ what: 'boss', size }, await cover(page), { errors: page.errors.length + (await Q.state(page)).errors.length }));
  await page.context().close();
  // the test room
  page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&lang=en&mute=1', sz(size));
  await page.evaluate(() => { G.cheats.god = true; });
  await sleep(1500);
  await shot(page, 'test_' + size);
  out.push(Object.assign({ what: 'test', size }, await cover(page), { errors: page.errors.length + (await Q.state(page)).errors.length }));
  await page.context().close();
  out.forEach(r => check(r.errors === 0, `${r.size} ${r.what}: ${r.errors} console errors`));
  return out;
}

(async () => {
  const browser = await Q.launch();
  try {
    if (MODE === 'ui' || MODE === 'all') {
      for (const s of SIZES.filter(s => s === '1640x922' || s === '1920x1080' || args.length > 2)) console.log(JSON.stringify(await ui(browser, s)));
      console.log(JSON.stringify(await oldSave(browser, '1640x922', -2, 2)));      // the user's own setting: stays S=2
      console.log(JSON.stringify(await oldSave(browser, '1640x922', 1, 5)));       // had chosen closer than the old default: stays S=5
      console.log(JSON.stringify(await oldSave(browser, '1640x922', 0, 2)));       // never touched: the new default
      console.log(JSON.stringify(await oldSave(browser, '540x960', -1, 1)));
    }
    if (MODE === 'rooms' || MODE === 'all') for (const s of SIZES) (await rooms(browser, s)).forEach(r => console.log(JSON.stringify(r)));
  } finally { await browser.close(); }
  console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
