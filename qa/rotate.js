// Phones are landscape only (src/main.js): an upright phone window gets the game turned a quarter.
// Checks at 390x844 with touch and ?rotate=1: the game is laid out 844x390 and not as portrait, the canvas is turned,
// a tap lands on the control under the finger (the bag button opens the inventory), the stick moves the hero the way the
// finger moves on the turned screen, and turning the window to 844x390 drops the turn. Also that ?rotate=0 keeps the
// portrait layout. node qa/rotate.js [outDir]
const fs = require('fs');
const path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const UP = { width: 390, height: 844 };

(async () => {
  const browser = await Q.launch();
  const fails = [];
  const ok = (cond, what, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + what + (extra ? '  ' + JSON.stringify(extra) : '')); if (!cond) fails.push(what); };
  // game point (CSS px) -> page point of the turned game
  const toPage = (g) => ({ x: UP.width - g.y, y: g.x });

  let page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&touch=1&rotate=1', UP, { touch: true });
  await sleep(800);
  const v = await page.evaluate(() => ({ rot: G.rot, portrait: G.view.portrait, w: G.game.scale.gameSize.width, h: G.game.scale.gameSize.height,
    tf: G.game.canvas.style.transform, box: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(G.game.canvas.getBoundingClientRect()) }));
  ok(v.rot && !v.portrait && v.w === 844 && v.h === 390, 'upright phone: game laid out 844x390, landscape', v);
  ok(/rotate\(90deg\)/.test(v.tf) && v.box.join() === '0,0,390,844', 'canvas turned and covering the screen', v.box);
  await page.screenshot({ path: path.join(OUT, 'rotate_upright_room.png') });

  // a tap on the bag button, at the place it shows on the turned screen
  const inv = await page.evaluate(() => G.qa.hits.inv);
  const pt = toPage(inv);
  await page.touchscreen.tap(pt.x, pt.y); await sleep(400);
  const open = await page.evaluate(() => G.Panels.current);
  ok(!!open, 'tap on the turned bag button opens a panel', { panel: open, tap: pt });
  await page.screenshot({ path: path.join(OUT, 'rotate_upright_inventory.png') });
  await page.keyboard.press('Escape'); await sleep(300);
  if (await page.evaluate(() => G.Panels.isOpen())) await page.evaluate(() => G.Panels.close && G.Panels.close());

  // the stick: a finger dragged "right" in the game (down the upright screen) walks the hero to the right
  const x0 = await page.evaluate(() => G.gameScene.sim.player.x);
  const a = toPage({ x: 150, y: 250 }), b = toPage({ x: 210, y: 250 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  await sleep(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x, y: b.y, id: 1 }] });
  await sleep(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = await page.evaluate(() => G.gameScene.sim.player.x);
  ok(x1 > x0 + 4, 'stick pushed to the game right moves the hero right', { from: Math.round(x0), to: Math.round(x1) });

  // the phone turned on its side: the browser is landscape now, no turn
  await page.setViewportSize({ width: 844, height: 390 }); await sleep(900);
  const s = await page.evaluate(() => ({ rot: G.rot, w: G.game.scale.gameSize.width, h: G.game.scale.gameSize.height, tf: G.game.canvas.style.transform, portrait: G.view.portrait }));
  ok(!s.rot && s.w === 844 && s.h === 390 && s.tf === 'none' && !s.portrait, 'landscape window: no turn, same layout', s);
  await page.screenshot({ path: path.join(OUT, 'rotate_side_room.png') });
  // and upright again
  await page.setViewportSize(UP); await sleep(900);
  const u = await page.evaluate(() => ({ rot: G.rot, w: G.game.scale.gameSize.width, h: G.game.scale.gameSize.height }));
  ok(u.rot && u.w === 844 && u.h === 390, 'upright again: turned again', u);
  ok(page.errors.length === 0, 'no console errors (turned)', page.errors);
  await page.close();

  // the city, turned
  page = await Q.open(browser, '?scene=city&fresh=1&touch=1&rotate=1', UP, { touch: true });
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, 'rotate_upright_city.png') });
  ok(page.errors.length === 0 && await page.evaluate(() => G.rot), 'city turned, no console errors', page.errors);
  await page.close();

  // a tall desktop window keeps the portrait layout
  page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4', UP);
  await sleep(500);
  const d = await page.evaluate(() => ({ rot: G.rot, portrait: G.view.portrait, w: G.game.scale.gameSize.width }));
  ok(!d.rot && d.portrait && d.w === 390, 'rotate=0: portrait layout as before', d);
  await page.close();

  await browser.close();
  console.log(fails.length ? 'FAILED: ' + fails.join('; ') : 'PASS');
  process.exit(fails.length ? 1 : 0);
})();
