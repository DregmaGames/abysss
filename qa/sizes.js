// Size tuning (step size panel; BAL.tune, DBG > SIZES): the test room with tune values from the URL against the defaults.
// Checks: the room's tile size and the cracks' reach scale as asked (they come from the sim: what is drawn is what collides),
// the hero's and a monster's drawn height scale (the hitbox radius does not), the SIZES panel opens from DBG, its +/- and
// RESET change the values and its copy line, 0 console errors. Screenshots: the room at 1640x922 with the defaults and with
// hero/monsters/room/fissures 1.3, and the SIZES panel at 960x540, 1640x922 (English) and 844x390 (Spanish).
//   node qa/sizes.js [outDir]  -> sizes_default.png, sizes_tuned.png, sizes_panel_960.png, sizes_panel_1640.png, sizes_panel_844.png,
//   sizes_city_default.png, sizes_city_tuned.png (city 1.4, hero 1.3)
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const TUNED = 'hero:1.3,monsters:1.3,room:1.3,fissures:1.3';

// what the page shows: room size, the cracks' reach (mean of the farthest core px from each normal crack's centre), the hero's
// and the first monster's drawn height, their sim radius
async function measure(page) {
  return page.evaluate(() => {
    const gs = G.gameScene, s = gs.sim, r = s.room;
    const reach = r.fissures.filter(f => !f.big).map(f => Math.max.apply(null, f.cells.filter(c => c.core).map(c => Math.sqrt(c.x * c.x + c.y * c.y))));
    const pit = r.fissures.filter(f => f.big)[0];
    const m = s.monsters[0], ms = m && gs.maps.monsters.get(m.id);
    // one room is a small sample (arms stop at walls and pillars): the reach over 20 rooms the page's generator makes with its values
    let sum = 0, n = 0;
    for (let seed = 1; seed <= 10; seed++) for (const i of [1, 4]) for (const f of G.genRoom(seed, i, G.BAL).fissures) {
      if (f.big) continue;
      const d = f.cells.filter(c => c.core).map(c => Math.sqrt(c.x * c.x + c.y * c.y)).sort((x, y) => y - x);
      sum += d[Math.floor(d.length * 0.02)]; n++;
    }
    return { w: r.w, h: r.h, cracks: reach.length, reach: reach.reduce((a, b) => a + b, 0) / Math.max(1, reach.length), reach20: sum / n, pit: pit ? pit.cells.length : 0,
      heroH: gs.player.displayHeight, heroR: s.player.r, mon: m ? m.type : null, monH: ms ? ms.displayHeight : 0, monR: m ? m.r : 0,
      tune: G.Tune.values(), text: G.Tune.text() };
  });
}

(async () => {
  const browser = await Q.launch();
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  const q = '?scene=game&room=test&fresh=1&seed=4&hd=1';
  const big = { width: 1640, height: 922 };

  // 1. defaults and 2. tuned, same seed: a monster to measure (the test room starts empty), then a screenshot
  const res = {};
  for (const [name, tune] of [['default', ''], ['tuned', TUNED]]) {
    const page = await Q.open(browser, q + (tune ? '&tune=' + tune : ''), big);
    await page.evaluate(() => { G.cheats.god = true; G.gameScene.sim.cheatSpawn('skeleton', 1, 44); });
    await sleep(1500);
    res[name] = await measure(page);
    res[name].errors = page.errors.length;
    await page.screenshot({ path: path.join(OUT, 'sizes_' + name + '.png') });
    console.log(name + ' ' + JSON.stringify(res[name]));
    await page.close();
  }
  const a = res.default, b = res.tuned, near = (v, want, tol) => Math.abs(v - want) <= tol;
  check('defaults: every value 1', Object.values(a.tune).every(v => v === 1), a.text);
  check('tuned: values from the URL', b.tune.hero === 1.3 && b.tune.monsters === 1.3 && b.tune.room === 1.3 && b.tune.fissures === 1.3 && b.tune.city === 1 && b.tune.obstacles === 1, b.text);
  check('room width x1.3 (whole tiles)', near(b.w / a.w, 1.3, 0.04), a.w + ' -> ' + b.w);
  check('room height x1.3 (whole tiles)', near(b.h / a.h, 1.3, 0.06), a.h + ' -> ' + b.h);
  check('crack reach x1.2..1.5 (20 rooms of the page\'s generator)', b.reach20 / a.reach20 > 1.2 && b.reach20 / a.reach20 < 1.5, a.reach20.toFixed(1) + ' -> ' + b.reach20.toFixed(1) + ' px (this test room: ' + a.reach.toFixed(1) + ' -> ' + b.reach.toFixed(1) + ')');
  check('super fissure bigger', b.pit > a.pit * 1.3, a.pit + ' -> ' + b.pit + ' px');
  check('hero drawn x1.3 (whole px)', near(b.heroH / a.heroH, 1.3, 0.06), a.heroH + ' -> ' + b.heroH);
  check('hero hitbox the same', a.heroR === b.heroR, a.heroR + ' / ' + b.heroR);
  check('monster drawn x1.3', a.monH > 0 && near(b.monH / a.monH, 1.3, 0.08), a.mon + ' ' + a.monH + ' -> ' + b.monH);
  check('monster hitbox the same', a.monR === b.monR, a.monR + ' / ' + b.monR);
  check('0 console errors', a.errors + b.errors === 0, a.errors + ' / ' + b.errors);

  // the city: its camera zoom is S x city (the town's layout is the same); F2 opens SIZES there too
  for (const [name, tune] of [['city_default', ''], ['city_tuned', 'city:1.4,hero:1.3']]) {
    const page = await Q.open(browser, '?scene=city&fresh=1&hd=1' + (tune ? '&tune=' + tune : ''), big);
    await sleep(900);
    const c = await page.evaluate(() => { const cam = G.city.cameras.main; return { zoom: +cam.zoom.toFixed(3), S: G.view.S, vw: Math.round(cam.worldView.width), heroH: G.city.player.displayHeight }; });
    await page.screenshot({ path: path.join(OUT, 'sizes_' + name + '.png') });
    const want = tune ? 1.4 : 1;
    check(name + ': camera zoom = S x ' + want, Math.abs(c.zoom - c.S * want) < 0.001, JSON.stringify(c));
    if (tune) {
      await page.keyboard.press('F2'); await sleep(200);
      await Q.click(page, 'size_city_minus'); await sleep(150);
      const c2 = await page.evaluate(() => ({ cur: G.Panels.current, zoom: +G.city.cameras.main.zoom.toFixed(3) }));
      check(name + ': F2 > SIZES in the city, CITY - applies at once', c2.cur === 'sizes' && Math.abs(c2.zoom - c.S * 1.3) < 0.001, JSON.stringify(c2));
    }
    check(name + ': 0 console errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
    await page.close();
  }

  // 3. the panel: DBG > SIZES at 960x540 and at the phone size 844x390 (it must fit), +/- and RESET
  for (const [tag, size, lang] of [['960', { width: 960, height: 540 }, 'en'], ['1640', big, 'en'], ['844', { width: 844, height: 390 }, 'es']]) {
    const page = await Q.open(browser, q + '&tune=hero:1.2,room:1.3&lang=' + lang, size);
    await sleep(600);
    await page.keyboard.press('F2');
    await sleep(200);
    await Q.click(page, 'dbg_sizes');
    await sleep(200);
    const p0 = await page.evaluate(() => ({ cur: G.Panels.current, L: { x: G.Panels.L.x, y: G.Panels.L.y, w: G.Panels.L.w, h: G.Panels.L.h }, V: { W: G.view.W, H: G.view.H }, text: G.qa.sizesText }));
    const fits = p0.L.x >= 0 && p0.L.y >= 0 && p0.L.x + p0.L.w <= p0.V.W && p0.L.y + p0.L.h <= p0.V.H;
    check(tag + ': SIZES panel open and inside the screen', p0.cur === 'sizes' && fits, JSON.stringify(p0.L) + ' in ' + p0.V.W + 'x' + p0.V.H);
    check(tag + ': copy line', p0.text === 'hero 1.2 monsters 1.0 room 1.3 city 1.0 obstacles 1.0 fissures 1.0', p0.text);
    await page.screenshot({ path: path.join(OUT, 'sizes_panel_' + tag + '.png') });
    await Q.click(page, 'size_monsters_plus'); await Q.click(page, 'size_monsters_plus');
    await Q.click(page, 'size_hero_minus');
    const p1 = await page.evaluate(() => G.Tune.values());
    check(tag + ': + and - step 0.1', p1.monsters === 1.2 && p1.hero === 1.1, JSON.stringify(p1));
    await Q.click(page, 'size_newroom');
    await sleep(300);
    const p2 = await page.evaluate(() => ({ cur: G.Panels.current, loops: G.gameScene.sim.loops, w: G.gameScene.sim.room.w }));
    check(tag + ': NEW ROOM restarts the test room', p2.cur === null && p2.loops === 1, JSON.stringify(p2));
    await page.keyboard.press('F2'); await sleep(150);
    await Q.click(page, 'dbg_sizes'); await sleep(150);
    await Q.click(page, 'size_reset');
    const p3 = await page.evaluate(() => ({ v: G.Tune.values(), stored: (() => { try { return localStorage.getItem('riftscar.tune'); } catch (e) { return 'refused'; } })() }));
    check(tag + ': RESET -> all 1, stored', Object.values(p3.v).every(v => v === 1), JSON.stringify(p3));
    check(tag + ': 0 console errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'PASS');
  process.exit(fails ? 1 : 0);
})();
