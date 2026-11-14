// Visible equipment, a test (src/view/hd.js heroEnt / heroWeapon, tools/hand_weapon.py): the warrior with no armour and
// no weapon, with a sword in the fist (plain and with a rarity glow), and in plate. For each: the sheet in use, the
// weapon image, close-ups standing and walking, 0 console errors. Also what a fresh warrior shows with no parameters:
// the bare sheet with the starter weapon in the fist.
// node qa/equip.js [outDir] -> equip_<case>_<n>.png
const fs = require('fs');
const path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await Q.launch();
  let fails = 0;
  const cases = [['bare', '&look=bare&wpn=0', 'warrior_bare', false], ['sword', '&look=bare&wpn=1', 'warrior_bare', true],
    ['sword_legendary', '&look=bare&wpn=1&glow=legendary', 'warrior_bare', true], ['leather_rare', '&look=leather&wpn=1&arar=2', 'warrior_leather', true], ['chain_epic', '&look=chain&wpn=1&arar=3&glow=epic', 'warrior_chain', true],
    ['plate', '&look=plate&wpn=1', 'warrior_plate', true], ['old_full', '&look=full', 'warrior', false], ['fresh', '', 'warrior_bare', true],
    ['mage_leather', '&look=leather&wpn=1&arar=1', 'mage_leather', true, 'mage'], ['mage_chain', '&look=chain&wpn=1&arar=2', 'mage_chain', true, 'mage'], ['mage_plate', '&look=plate&wpn=1&arar=3&glow=legendary', 'mage_plate', true, 'mage']];      // the mage's robes (one per armour weight)      // fresh: a new warrior wears no armour and holds the starter sword (step gear data)
  for (const [name, q, ent, wpn, cls] of cases) {
    const page = await Q.open(browser, '?scene=game&room=test&fresh=1&seed=4&hd=1&class=' + (cls || 'warrior') + q, { width: 1640, height: 922 });
    await page.evaluate(() => { G.cheats.god = true; });
    await sleep(900);
    const snap = () => page.evaluate(() => { const gs = G.gameScene, p = gs.sim.player, wv = gs.cameras.main.worldView, S = G.view.S, r = gs.prig, eq = gs.sim.gear.equipped;
      return { ent: r.ent, frame: gs.player.frame.name, wpn: !!(r.wpnImg && r.wpnImg.visible), glow: !!(r.wpnGlow && r.wpnGlow.visible), armor: !!eq.armor, weapon: !!eq.weapon,
        trim: !!(r.trimImg && r.trimImg.visible), x: Math.round((p.x - 30 - wv.x) * S), y: Math.round((p.y - 40 - wv.y) * S), w: 60 * S, h: 50 * S }; });
    const shot = async (n) => { const r = await snap(); await page.screenshot({ path: path.join(OUT, 'equip_' + name + '_' + n + '.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h } }); return r; };
    const a = await shot(0);
    await page.keyboard.down('KeyD'); await sleep(260); await shot(1); await sleep(170); await shot(2); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyA'); await sleep(300); await shot(3); await page.keyboard.up('KeyA');
    await page.evaluate(() => G.gameScene.sim.cheatSpawn('skeleton', 2, 22)); await sleep(500); await shot(4); await sleep(160); await shot(5);
    const ok = page.errors.length === 0 && (ent === null || (a.ent === ent && a.wpn === wpn)) && (name !== 'fresh' || (a.weapon && !a.armor));
    if (!ok) fails++;
    console.log((ok ? 'ok   ' : 'FAIL ') + name + ' ' + JSON.stringify({ ent: a.ent, frame: a.frame, weaponDrawn: a.wpn, glow: a.glow, trim: a.trim, armorEquipped: a.armor, weaponEquipped: a.weapon, errors: page.errors.slice(0, 2) }));
    await page.close();
  }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'PASS');
  process.exit(fails ? 1 : 0);
})();
