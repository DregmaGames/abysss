#!/usr/bin/env node
// City layout check at 960x540 and 540x960, in English and Spanish, with Don Montoto rescued and with his stall empty:
//   - 540x960 uses the portrait layout and the whole city is on screen (no scrolling): every stall, label, the sign and the portal;
//   - every stall, the sign and the portal can be reached on foot from the start;
//   - no two labels share pixels, and none is cut by the edge of the view;
//   - standing at each stall and at the sign: the prompt (TALK / LOOK / READ) is shown, touches no label and is inside the view;
//     the TALK button of the overlay covers no label, stall or the portal;
//   - a rotation (960x540 <-> 540x960) swaps the layout and keeps the hero at the stall.
//   node qa/city.js        screenshots in qa/out/city/, exits non-zero on a failed check or a console / page error
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

const hitRect = (a, b, m) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (a, v) => a.x >= v.x && a.y >= v.y && a.x + a.w <= v.x + v.w && a.y + a.h <= v.y + v.h;

(async () => {
  const dir = path.join(Q.OUT, 'city');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await Q.launch();
  const fails = [], errors = [];
  let checks = 0;
  const ok = (cond, what) => { checks++; if (!cond) fails.push(what); };
  // the overlay's TALK button and the top strip, in world px
  const read = page => page.evaluate(() => {
    const c = G.city.snapshot(), h = G.cityHud, b = h.talkBtn, S = 1;
    c.btn = b.bg.visible ? { x: b.x * S + c.view.x, y: b.y * S + c.view.y, w: b.w, h: b.h } : null;
    c.things = Object.keys(c.spots).map(k => ({ name: k, x: c.spots[k].sx - 25, y: c.spots[k].sy - 48, w: 50, h: 62 }))
      .concat([{ name: 'portal', x: c.portal.x - 12, y: c.portal.y - 34, w: 24, h: 34 }, { name: 'sign', x: c.sign.x + 6 - 6, y: c.sign.y - 6 - 14, w: 12, h: 14 }]);
    return c;
  });
  const place = async (page, id, dx) => {
    await page.evaluate(([id, dx]) => { const c = G.city, o = id === 'plot' ? c.plotOwner : c.spots[id]; c.px = o.front.x + dx; c.py = o.front.y + 6; c.follow(true); }, [id, dx]);
    await page.waitForTimeout(260);
  };

  for (const size of ['landscape', 'portrait']) for (const lang of ['en', 'es']) for (const rescued of [true, false]) {
    const tagName = `${size} ${lang} ${rescued ? 'rescued' : 'empty stall'}`;
    const page = await Q.open(browser, `?scene=city&seed=5&fresh=1&lang=${lang}`, size);
    await page.evaluate(r => { const g = G.gearOf(G.save, G.cls); g.city = { montoto: r, story: 0 }; G.city.scene.restart(); }, rescued);
    await page.waitForTimeout(700);
    let c = await read(page);
    if (size === 'portrait') {
      ok(c.layout === 'port', `${tagName}: portrait layout expected, got ${c.layout}`);
      ok(c.map.w <= c.view.w && c.map.h <= c.view.h, `${tagName}: the city ${c.map.w}x${c.map.h} does not fit the view ${c.view.w}x${c.view.h}`);
    } else ok(c.layout === 'land', `${tagName}: landscape layout expected, got ${c.layout}`);
    c.things.forEach(t => ok(inside(t, c.view), `${tagName}: ${t.name} is not fully on screen`));
    // on foot from the start: the front of every stall, the sign and the portal can be reached
    const reach = await page.evaluate(() => {
      const c = G.city, L = c.lay, seen = new Set([L.start.x + ',' + L.start.y]), q = [[L.start.x, L.start.y]];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && !c.blocked(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } }
      }
      const near = (x, y, r) => { for (const k of seen) { const [a, b] = k.split(',').map(Number); if ((a - x) * (a - x) + (b - y) * (b - y) <= r * r) return true; } return false; };
      const out = { sign: near(c.plotOwner.front.x, c.plotOwner.front.y, 10), portal: near(L.portal.x, L.portal.y - 9, 6) };
      for (const k in c.spots) out[k] = near(c.spots[k].front.x, c.spots[k].front.y, 10);
      return out;
    });
    Object.keys(reach).forEach(k => ok(reach[k], `${tagName}: ${k} cannot be reached on foot`));
    c.labels.forEach((l, i) => {
      ok(inside(l, c.view), `${tagName}: label ${l.key} is cut by the view`);
      c.labels.slice(i + 1).forEach(m => ok(!hitRect(l, m, 1), `${tagName}: labels ${l.key} and ${m.key} overlap`));
    });
    for (const id of ['smith', 'trainer', 'montoto', 'plot']) for (const dx of [0, -18, 18]) {
      await place(page, id, dx);
      c = await read(page);
      const at = `${tagName}, at ${id}${dx ? (dx > 0 ? '+' : '') + dx : ''}`;
      if (c.near !== id) { if (!dx) ok(false, `${at}: not in reach (near ${c.near})`); continue; }
      ok(!!c.tag, `${at}: no prompt`);
      if (!c.tag) continue;
      // the prompt bobs 1 px: check both positions
      for (const bob of [0, 1]) {
        const t = { x: c.tag.x, y: c.tag.y - bob, w: c.tag.w, h: c.tag.h };
        c.labels.forEach(l => ok(!hitRect(t, l, 1), `${at}: prompt "${c.tag.text}" touches label ${l.key}`));
        ok(inside(t, c.view), `${at}: prompt is cut by the view`);
      }
      ok(!!c.btn, `${at}: no TALK button`);
      if (c.btn) {
        c.labels.forEach(l => ok(!hitRect(c.btn, l, 0), `${at}: the TALK button covers label ${l.key}`));
        c.things.forEach(t => ok(!hitRect(c.btn, t, 0), `${at}: the TALK button covers ${t.name}`));
      }
      if (!dx && (id === 'montoto' || (id === 'smith' && rescued))) await page.screenshot({ path: path.join(dir, `${size}_${lang}_${rescued ? '' : 'empty_'}${id}.png`) });
    }
    errors.push(...page.errors, ...(await Q.state(page)).errors);
    await page.context().close();
  }

  // rotation: the layout follows the screen and the hero stays at the stall
  const page = await Q.open(browser, '?scene=city&seed=5&fresh=1&lang=en', 'landscape');
  await page.evaluate(() => { const g = G.gearOf(G.save, G.cls); g.city = { montoto: true, story: 0 }; G.city.scene.restart(); });
  await page.waitForTimeout(600);
  await place(page, 'montoto', 0);
  await page.setViewportSize(Q.SIZES.portrait); await page.waitForTimeout(700);
  let r = await read(page);
  ok(r.layout === 'port' && r.near === 'montoto' && r.map.w <= r.view.w, `rotation to portrait: layout ${r.layout}, near ${r.near}`);
  await page.screenshot({ path: path.join(dir, 'rotated_portrait.png') });
  await page.setViewportSize(Q.SIZES.landscape); await page.waitForTimeout(700);
  r = await read(page);
  ok(r.layout === 'land' && r.near === 'montoto', `rotation back to landscape: layout ${r.layout}, near ${r.near}`);
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await browser.close();

  fails.forEach(f => console.log('FAIL', f));
  errors.forEach(e => console.log('ERROR', e));
  console.log(`city: ${checks - fails.length} of ${checks} checks pass, ${errors.length} errors`);
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
