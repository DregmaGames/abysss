// Art test "27 px" (?hd=2, src/view/hd.js, tools/lo_sprite.py): the mage and the skeletons in the test room at
// 960x540 and 540x960, the frames the hero shows while standing, walking and attacking, 0 console errors.
// node qa/lo.js [outDir]  ->  <out>/lo_<size>_room.png, lo_hero_<n>.png, and a JSON line per check.
const fs = require('fs');
const path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await Q.launch();
  let errors = 0;
  for (const size of ['landscape', 'portrait']) {
    const page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&hd=2', size);
    await page.evaluate(() => { G.cheats.god = true; });
    await sleep(600);
    await page.evaluate(() => G.gameScene.sim.cheatSpawn('skeleton', 3, 44));
    await sleep(1400);
    const info = await page.evaluate(() => {
      const gs = G.gameScene, ms = [];
      gs.maps.monsters.forEach(s => ms.push(s.frame.name));
      return { style: G.hdStyle, floor: !!(gs.roomView && gs.roomView.floor), hero: gs.player.frame.name, ms };
    });
    await page.screenshot({ path: path.join(OUT, 'lo_' + size + '_room.png') });
    const seen = {};
    if (size === 'landscape') {
      // walk right then left while the auto attack fires: collect the frame names and a few close-ups
      for (let i = 0; i < 14; i++) {
        const key = i < 7 ? 'KeyD' : 'KeyA';
        if (i === 0 || i === 7) { await page.keyboard.up('KeyD'); await page.keyboard.down(key); }
        await sleep(160);
        const b = await page.evaluate(() => {
          const gs = G.gameScene, p = gs.sim.player, wv = gs.cameras.main.worldView, S = G.view.S;
          return { f: gs.player.frame.name, flip: gs.player.flipX, x: Math.round((p.x - 30 - wv.x) * S), y: Math.round((p.y - 40 - wv.y) * S), w: 60 * S, h: 50 * S };
        });
        seen[b.f] = (seen[b.f] || 0) + 1;
        if (i % 2 === 0) await page.screenshot({ path: path.join(OUT, 'lo_hero_' + (i / 2) + '.png'), clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.w, height: b.h } });
      }
      await page.keyboard.up('KeyA');
    }
    errors += page.errors.length;
    console.log(JSON.stringify({ what: 'room ' + size + ' hd=2', style: info.style, hdFloor: info.floor, hero: info.hero, monsters: info.ms, heroFrames: seen, errors: page.errors.slice() }));
    await page.close();
  }
  await browser.close();
  console.log(errors + ' console errors');
  process.exit(errors ? 1 : 0);
})();
