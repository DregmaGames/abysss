#!/usr/bin/env node
// HD art pilot check (src/view/hd.js): the test room with HD skeletons, the boss spawned from the debug panel, Don Montoto
// in the city and in his cage, at 960x540 and 540x960, with ?hd=1 and ?hd=0; 0 console errors; the Settings toggle.
// Screenshots (raw, cropped and enlarged by tools/hd_atlas.py-free code below are left to the caller):
//   <out>/hd_<size>_<on|off>_room.png, hd_boss.png, hd_city.png, hd_cage.png, hd_walk_<n>.png, hd_attack_<n>.png
// node qa/hd.js [outDir]
'use strict';
const Q = require('./lib'), path = require('path'), fs = require('fs');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// screen box (CSS px) round a monster's feet: w x h art px
const boxOf = (page, id, w, h, up) => page.evaluate(([id, w, h, up]) => {
  const gs = G.gameScene, m = gs.sim.monsters.find(q => q.id === id), cam = gs.cameras.main, S = G.view.S, wv = cam.worldView;
  if (!m) return null;
  return { x: Math.round((m.x - w / 2 - wv.x) * S), y: Math.round((m.y + m.r - up - wv.y) * S), width: w * S, height: h * S };
}, [id, w, h, up]);

async function room(browser, size, hd, report) {
  const page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&hd=' + hd, size);
  await page.evaluate(() => { G.cheats.god = true; });
  await sleep(600);
  await page.evaluate(() => G.gameScene.sim.cheatSpawn('skeleton', 3, 44));
  await sleep(1400);
  const info = await page.evaluate(() => {
    const gs = G.gameScene, ms = [];
    gs.maps.monsters.forEach(s => ms.push({ hd: !!s.isHD, tex: s.texture.key, frame: s.frame.name, sx: s.scaleX }));
    return { hdMode: G.hdMode, floor: !!(gs.roomView && gs.roomView.floor), S: G.view.S, ms };
  });
  await Q.shot(page, 'hd_' + size + '_' + (hd ? 'on' : 'off') + '_room');
  report.push({ what: 'room ' + size + ' hd=' + hd, hdMode: info.hdMode, floor: info.floor, S: info.S,
    skeletonsHD: info.ms.filter(m => m.frame === 'skeleton' && m.hd).length, chunky: info.ms.filter(m => !m.hd).length, errors: page.errors.slice() });
  return page;
}

(async () => {
  const browser = await Q.launch(), report = [];
  try {
    for (const size of ['landscape', 'portrait']) for (const hd of [1, 0]) {
      const page = await room(browser, size, hd, report);
      if (size === 'landscape' && hd === 1) {
        // motion strips: one skeleton walking, then winding up and releasing
        const id = await page.evaluate(() => { const s = G.gameScene.sim; s.monsters.forEach(m => { if (m.type !== 'skeleton') s.kill(m); }); return s.monsters.filter(m => m.type === 'skeleton')[0].id; });
        let walk = 0, atk = 0, last = '';
        for (let i = 0; i < 400 && (walk < 4 || atk < 4); i++) {
          const st = await page.evaluate(id => { const s = G.gameScene.maps.monsters.get(id), m = G.gameScene.sim.monsters.find(q => q.id === id); return s && m ? { wa: s.rig.wa, wind: s.rig.wind, rel: s.rig.rel, ph: s.rig.ph, w: m.wind } : null; }, id);
          if (!st) break;
          const key = st.ph.toFixed(1);
          const b = await boxOf(page, id, 40, 34, 30);
          if (walk < 4 && st.wa > 0.7 && st.wind <= 0 && st.rel <= 0 && key !== last && b) { await page.screenshot({ path: path.join(OUT, 'hd_walk_' + walk + '.png'), clip: b }); walk++; last = key; await sleep(45); continue; }
          if (atk < 4 && (st.wind > 0 || st.rel > 0) && b) { await page.screenshot({ path: path.join(OUT, 'hd_attack_' + atk + '.png'), clip: b }); atk++; await sleep(st.wind > 0 ? 160 : 60); continue; }
          await sleep(25);
        }
        report.push({ what: 'motion strip', walkFrames: walk, attackFrames: atk });
        // the cage (debug CAGE) and the Settings toggle: off then on again, in the run
        await page.evaluate(() => G.gameScene.sim.cheatCage());
        await sleep(400);
        const cg = await page.evaluate(() => { const gs = G.gameScene, c = gs.sim.cage, S = G.view.S, wv = gs.cameras.main.worldView; return { x: Math.round((c.x - 30 - wv.x) * S), y: Math.round((c.y - 30 - wv.y) * S), width: 60 * S, height: 46 * S, hd: gs.cageImg.isHD }; });
        await page.screenshot({ path: path.join(OUT, 'hd_cage.png'), clip: { x: cg.x, y: cg.y, width: cg.width, height: cg.height } });
        // the boss, from the debug panel; pictures of its poses
        await page.evaluate(() => G.gameScene.sim.cheatKillAll());
        await sleep(900);
        await Q.click(page, 'dbg');
        await Q.click(page, 'dbg_spawn_boss');
        await sleep(1800);
        const poses = {};
        for (let i = 0; i < 300 && Object.keys(poses).length < 4; i++) {
          const b = await page.evaluate(() => { const gs = G.gameScene, m = gs.sim.monsters.find(q => q.def.boss); if (!m) return null; const s = gs.maps.monsters.get(m.id); return { st: m.st, id: m.id, f: s && s.frame.name }; });
          if (!b) break;
          if (b.f && !poses[b.f]) { poses[b.f] = 1; const bx = await boxOf(page, b.id, 90, 60, 50); await page.screenshot({ path: path.join(OUT, 'hd_boss_' + b.f + '.png'), clip: bx }); }
          await sleep(60);
        }
        await Q.shot(page, 'hd_boss_full');
        report.push({ what: 'boss', frames: Object.keys(poses), errors: page.errors.slice() });
        // the boss dies: the corpse plays
        await page.evaluate(() => G.gameScene.sim.cheatKillAll());
        await sleep(250);
        await Q.shot(page, 'hd_boss_dying');
        const corpses = await page.evaluate(() => (G.gameScene.corpses || []).length);
        report.push({ what: 'boss death', corpses });
        await page.evaluate(() => G.Panels.openSettings(G.hud)); await sleep(300);
        await Q.click(page, 'set_hd'); await sleep(300);
        const off = await page.evaluate(() => ({ hd: G.hdMode, floor: !!G.gameScene.roomView.floor, cage: G.gameScene.cageImg.isHD }));
        await Q.click(page, 'set_hd'); await sleep(300);
        const on = await page.evaluate(() => ({ hd: G.hdMode, floor: !!G.gameScene.roomView.floor, cage: G.gameScene.cageImg.isHD, saved: G.save.settings.hd }));
        await Q.shot(page, 'hd_settings');
        report.push({ what: 'cage + settings toggle', cageHD: cg.hd, off, on, errors: page.errors.slice() });
      }
      await page.close();
    }
    // the city, Don Montoto rescued
    for (const size of ['landscape', 'portrait']) for (const hd of [1, 0]) {
      const page = await Q.open(browser, '?scene=city&fresh=1&hd=' + hd, size);
      await page.evaluate(() => { G.gearOf(G.save, G.cls).city = { montoto: true, story: 0 }; G.city.scene.restart(); });
      await page.waitForFunction(() => G.city && G.city.spots && G.city.spots.montoto && G.city.spots.montoto.npc);
      await sleep(1200);
      const b = await page.evaluate(() => { const c = G.city, o = c.spots.montoto, S = G.view.S, wv = c.cameras.main.worldView; return { x: Math.round((o.s.x - 40 - wv.x) * S), y: Math.round((o.s.y - 66 - wv.y) * S), width: 80 * S, height: 84 * S, hd: o.npc.isHD, frame: o.npc.frame.name }; });
      await Q.shot(page, 'hd_city_' + size + '_' + (hd ? 'on' : 'off'));
      if (size === 'landscape') await page.screenshot({ path: path.join(OUT, 'hd_city_montoto_' + (hd ? 'on' : 'off') + '.png'), clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height } });
      report.push({ what: 'city ' + size + ' hd=' + hd, montotoHD: b.hd, frame: b.frame, errors: page.errors.slice() });
      await page.close();
    }
  } finally { await browser.close(); }
  let errs = 0;
  report.forEach(r => { errs += (r.errors || []).length; console.log(JSON.stringify(r)); });
  console.log(errs ? errs + ' console errors' : '0 console errors');
  process.exit(errs ? 1 : 0);
})();
