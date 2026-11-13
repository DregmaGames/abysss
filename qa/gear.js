// Gear data (step gear data): the city inventory of a new character (the default class) with armour pieces in the bag. For each size and
// language: the starter weapon is worn, an armour piece's card shows its name with the material and the material line,
// the texts stay inside the card, 0 console errors. One screenshot per case.
// node qa/gear.js [outDir] -> gear_inv_<W>x<H>_<lang>.png
const fs = require('fs');
const path = require('path');
const Q = require('./lib');
const OUT = process.argv[2] || Q.OUT;
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await Q.launch();
  let fails = 0;
  const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
  for (const size of [{ width: 960, height: 540 }, { width: 1640, height: 922 }]) {
    for (const lang of ['en', 'es']) {
      const tag = size.width + 'x' + size.height + ' ' + lang;
      const page = await Q.open(browser, '?scene=city&fresh=1&lang=' + lang, size);
      await page.waitForFunction(() => G.screen === 'city' && G.city);
      await page.waitForTimeout(400);
      // a bag with one piece per slot and material; the first one has the longest name the generator can give
      const made = await page.evaluate(() => {
        const g = G.gearOf(G.save, G.cls), B = G.BAL, M = B.items.material, mk = (slot, mat, rarity, stats, ilvl) => {
          const it = { id: g.nextId++, slot, rarity, ilvl: ilvl || 2, name: '', stats, power: (ilvl || 2) * (2 + rarity), mat };
          const keys = Object.keys(stats); it.name = (rarity ? { hp: 'Stalwart', pulsePct: 'Resonant', armor: 'Warded', crit: 'Keen', movePct: 'Fleet' }[keys[1]] + ' ' : 'Worn ') + M.base[slot][mat];
          return it;
        };
        g.bag.push(mk('gloves', 2, 2, { atkPct: 7, pulsePct: 14, crit: 3 }, 3), mk('armor', 1, 1, { armor: 6, hp: 12 }), mk('helmet', 0, 0, { hp: 9 }, 1), mk('shield', 2, 3, { armor: 9, crit: 4, hp: 15, movePct: 4 }, 4),
          mk('boots', 1, 0, { movePct: 3 }, 1), mk('helmet', 2, 4, { hp: 30, armor: 9, crit: 5, movePct: 6, pulsePct: 20 }, 5));
        g.bag.push({ id: g.nextId++, slot: 'belt', rarity: 1, ilvl: 2, name: 'Keen Sash', stats: { hp: 11, crit: 2 }, power: 6 });
        G.equipFromBag(g, 1, B, G.cls);      // the chainmail hauberk goes on
        return { cls: G.classDef(B, G.cls).id, wt: G.starterType(B, G.cls).id, worn: G.gearLook(g.equipped), weapon: g.equipped.weapon, names: g.bag.map(it => G.itemName(it)), mats: g.bag.map(it => G.itemMat(it)), stored: g.bag.map(it => it.name) };
      });
      check(tag + ': a new ' + made.cls + ' wears the starter ' + made.wt + '; the look says ' + made.wt + ', common, chainmail body armour, no helmet', !!made.weapon && made.weapon.starter === true && made.worn.weapon.wtype === made.wt && made.worn.weapon.rarity === 0 && made.worn.armor === 1 && made.worn.helmet === null, JSON.stringify(made.worn) + ' ' + JSON.stringify(made.weapon));
      if (lang === 'en') check(tag + ': English names = the stored names', made.names.join('|') === made.stored.join('|'), made.names.join(' | '));
      await Q.click(page, 'inv'); await page.waitForTimeout(250);
      await Q.click(page, 'bag_0'); await page.waitForTimeout(250);
      // the texts on screen: every text object of the UI layers (UI.layer marks them with _dz; the town's signs are not UI), with its bounds in art pixels
      const seen = await page.evaluate(() => {
        const out = [];
        G.game.scene.getScenes(true).forEach(sc => sc.children.list.forEach(function walk(o) {
          if (o.list) { o.list.forEach(walk); return; }
          if (typeof o.text === 'string' && o.text && o.visible !== false && o.getBounds && o._dz !== undefined) { const b = o.getBounds(); out.push({ t: o.text.replace(/\n/g, ' '), x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.right), b: Math.round(b.bottom) }); }
        }));
        return { texts: out, W: G.view.W, H: G.view.H, sel: G.panels && G.panels.sel };
      });
      const find = s => seen.texts.find(o => o.t === s);
      const nm = find(made.names[0]), ml = find(made.mats[0]);
      check(tag + ': the card shows the name with the material (' + made.names[0] + ') and the material line (' + made.mats[0] + ')', !!nm && !!ml && ml.y > nm.y, JSON.stringify({ nm, ml }));
      const inside = seen.texts.filter(o => o.r > seen.W || o.b > seen.H || o.x < 0 || o.y < 0);
      check(tag + ': no text leaves the screen (' + seen.texts.length + ' texts, view ' + seen.W + 'x' + seen.H + ')', inside.length === 0, JSON.stringify(inside.slice(0, 3)));
      await page.screenshot({ path: path.join(OUT, 'gear_inv_' + size.width + 'x' + size.height + '_' + lang + '.png') });
      // the worn hauberk and the belt (no material line)
      await Q.click(page, 'bag_5'); await page.waitForTimeout(200);
      const belt = await page.evaluate(() => { const g = G.gearOf(G.save, G.cls); return { name: G.itemName(g.bag[5]), mat: G.itemMat(g.bag[5]), slot: g.bag[5].slot }; });
      check(tag + ': a belt has no material (' + belt.name + ')', belt.slot === 'belt' && belt.mat === '');
      check(tag + ': 0 console errors', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
      await page.close();
    }
  }
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'PASS');
  process.exit(fails ? 1 : 0);
})();
