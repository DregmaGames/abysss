// The weapon's rarity glow on the HD hero (src/view/hd.js, G.ANIM.glow, tools/weapon_fx.py): each glow previewed with
// ?glow=<key> in the test room, a close-up of the hero per glow, the glow image present and following the hero's frame,
// no glow without a key on a hero with no weapon, 0 console errors. node qa/glow.js [outDir] -> glow_<key>.png
const fs = require('fs');
const path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await Q.launch();
  let fails = 0;
  for (const key of ['none', 'magic', 'rare', 'epic', 'legendary', 'mythic', 'unique']) {
    const page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&hd=1&glow=' + key, { width: 1640, height: 922 });
    await page.evaluate(() => { G.cheats.god = true; });
    await sleep(1500);
    const r = await page.evaluate(() => {
      const gs = G.gameScene, p = gs.sim.player, wv = gs.cameras.main.worldView, S = G.view.S, gi = gs.prig.glowImg;
      return { glow: !!(gi && gi.visible), frame: gi && gi.frame.name, hero: gs.player.frame.name, tint: gi ? gi.tintTopLeft.toString(16) : '', alpha: gi ? +gi.alpha.toFixed(2) : 0,
        x: Math.round((p.x - 24 - wv.x) * S), y: Math.round((p.y - 40 - wv.y) * S), w: 48 * S, h: 50 * S };
    });
    const want = key !== 'none';
    const ok = r.glow === want && (!want || r.frame === 'fx_' + r.hero) && page.errors.length === 0;
    if (!ok) fails++;
    await page.screenshot({ path: path.join(OUT, 'glow_' + key + '.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h } });
    console.log((ok ? 'ok   ' : 'FAIL ') + key + ' ' + JSON.stringify({ glow: r.glow, frame: r.frame, tint: r.tint, alpha: r.alpha, errors: page.errors.length }));
    await page.close();
  }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'PASS');
  process.exit(fails ? 1 : 0);
})();
