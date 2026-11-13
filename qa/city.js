#!/usr/bin/env node
// City check (the town of step big city) at 1640x922, 1920x1080, 960x540, 844x390 (touch) and 540x960, in English and
// Spanish, with Don Montoto rescued and with his stall empty:
//   - one town on every screen (56 x 32 tiles); a screen bigger than the town shows it whole and centred, a smaller one
//     follows the hero and never shows the void;
//   - every stall, sign, the notice board and the portal can be reached on foot from where the hero arrives, and the places
//     used every visit (portal, Blacksmith, Trainer, Don Montoto, the board) are at most 3.5 s away for the slowest class;
//   - no label shares pixels with another label or covers a landmark (stalls, keepers, lots, signs, board, portal,
//     fountain, gate), and every label is inside the town;
//   - on arrival the portal, the Blacksmith and the Trainer are on screen with their labels, clear of the overlay's corners;
//   - standing at each stall, sign and the board: the prompt (TALK / LOOK / READ) is shown, touches no label and is on
//     screen, as are the thing's label and the hero; the TALK button covers none of them;
//   - the portal starts a run from the front and cannot be entered from behind;
//   - the hero is drawn from the HD frames (walk frames, facing) with ?hd=1 and from the chunky atlas with ?hd=0;
//   - a resize (960x540 <-> 540x960) keeps the hero at the stall.
//   node qa/city.js [outdir]     screenshots in qa/out/city/ (or outdir), exits non-zero on a failed check or a console / page error
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

const hitRect = (a, b, m) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (a, v) => a.x >= v.x && a.y >= v.y && a.x + a.w <= v.x + v.w && a.y + a.h <= v.y + v.h;
const SIZES = [['1640x922', 1640, 922], ['1920x1080', 1920, 1080], ['960x540', 960, 540], ['844x390', 844, 390, true], ['540x960', 540, 960]];
const DAILY = ['portal', 'smith', 'trainer', 'montoto', 'board'], MAX_S = 3.5, SLOWEST = 74;

(async () => {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(Q.OUT, 'city');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await Q.launch();
  const fails = [], errors = [], notes = [];
  let checks = 0;
  const ok = (cond, what) => { checks++; if (!cond) fails.push(what); };
  // the snapshot plus the overlay's pieces in world px: the TALK button, the top-left plate and the top-right buttons
  const read = page => page.evaluate(() => {
    const c = G.city.snapshot(), h = G.cityHud, b = h.talkBtn, V = G.view;
    c.btn = b.bg.visible ? { x: b.x + c.view.x, y: b.y + c.view.y, w: b.w, h: b.h } : null;
    c.hud = [{ x: c.view.x + 4, y: c.view.y + 4, w: 96, h: 27 }, { x: c.view.x + V.W - 30, y: c.view.y + 4, w: 26, h: 72 }];
    c.hero = { x: c.x - 9, y: c.y - 26, w: 18, h: 27 };
    c.V = { W: V.W, H: V.H, S: V.S };
    return c;
  });
  const owner = id => `(G.city.spots['${id}'] || G.city.signs['${id}'] || G.city.boardOwner)`;
  const place = async (page, id, dx) => {
    await page.evaluate(([id, dx]) => { const c = G.city, o = c.spots[id] || c.signs[id] || c.boardOwner; c.px = o.front.x + dx; c.py = o.front.y + 6; c.follow(true); }, [id, dx]);
    await page.waitForTimeout(140);
    await page.waitForFunction(() => { const c = G.city, h = G.cityHud, nl = c.nearLabel(c.near); return c.frame > 2 && (nl || null) === (h.shown.nl || null) && c.tag.visible === !!nl; }, null, { timeout: 3000 }).catch(() => {});
  };
  const restart = async (page, rescued) => {
    await page.evaluate(r => { const g = G.gearOf(G.save, G.cls); g.city = { montoto: r, story: 0 }; G.city.scene.restart(); }, rescued);
    await page.waitForFunction(r => G.city && G.city.spots && G.city.rescued === r && G.cityHud && G.cityHud.talkBtn, rescued);
    await page.waitForTimeout(400);
  };

  for (const [sname, w, h, touch] of SIZES) for (const lang of ['en', 'es']) for (const rescued of sname === '960x540' ? [true, false] : [lang === 'en']) {
    const tagName = `${sname} ${lang} ${rescued ? 'rescued' : 'empty stall'}`;
    const page = await Q.open(browser, `?scene=city&seed=5&fresh=1&hd=1&lang=${lang}${touch ? '&touch=1' : ''}`, { width: w, height: h }, { touch: !!touch });
    await restart(page, rescued);
    let c = await read(page);
    ok(c.layout === 'town' && c.map.w === 56 * 16 && c.map.h === 32 * 16, `${tagName}: the town is ${c.map.w}x${c.map.h} (${c.layout})`);
    // the screen: a bigger one shows the whole town in its middle, a smaller one is filled by it
    const fitW = c.map.w <= c.V.W, fitH = c.map.h <= c.V.H;
    if (fitW) ok(Math.abs((c.view.x + c.view.w / 2) - c.map.w / 2) <= 1, `${tagName}: the town is not centred across (${c.view.x})`);
    else ok(c.view.x >= 0 && c.view.x + c.view.w <= c.map.w, `${tagName}: the view shows the void across (${c.view.x}, ${c.view.w})`);
    if (fitH) ok(Math.abs((c.view.y + c.view.h / 2) - c.map.h / 2) <= 1, `${tagName}: the town is not centred down (${c.view.y})`);
    else ok(c.view.y >= 0 && c.view.y + c.view.h <= c.map.h, `${tagName}: the view shows the void down (${c.view.y}, ${c.view.h})`);
    ok(c.view.w - c.map.w <= 8 * 16 && c.view.h - c.map.h <= 8 * 16, `${tagName}: the view is wider than the town and its rampart`);
    // on arrival: the hero, the portal, the Blacksmith and the Trainer with their labels, clear of the overlay's corners
    const need = c.things.filter(t => ['portal', 'smith', 'trainer', 'smith_keeper', 'trainer_keeper'].includes(t.name))
      .concat(c.labels.filter(l => ['city.rift', 'city.smith', 'city.trainer'].includes(l.key)).map(l => Object.assign({ name: 'label ' + l.key }, l)), [Object.assign({ name: 'hero' }, c.hero)]);
    ok(need.length === 9, `${tagName}: ${need.length} of 9 things found on arrival`);
    need.forEach(t => {
      ok(inside(t, c.view), `${tagName}: on arrival ${t.name} is not fully on screen`);
      c.hud.forEach(r => ok(!hitRect(t, r, 0), `${tagName}: on arrival ${t.name} is under the overlay`));
    });
    await page.screenshot({ path: path.join(dir, `${sname}_${lang}_${rescued ? 'rescued' : 'empty'}.png`) });
    // labels: fixed to the town, so this holds on every screen
    c.labels.forEach((l, i) => {
      ok(inside(l, { x: 0, y: 0, w: c.map.w, h: c.map.h }), `${tagName}: label ${l.key} is outside the town`);
      c.labels.slice(i + 1).forEach(m => ok(!hitRect(l, m, 2), `${tagName}: labels ${l.key} and ${m.key} overlap`));
      c.things.forEach(t => ok(!hitRect(l, t, 0), `${tagName}: label ${l.key} covers ${t.name}`));
    });
    // on foot from the start: shortest paths over the town's own collision test, 2 px grid, 8 directions
    const walk = await page.evaluate(() => {
      const c = G.city, L = c.lay, W = L.w >> 1, H = L.h >> 1, dist = new Int32Array(W * H).fill(1e9), free = new Int8Array(W * H).fill(-1);
      const isFree = i => { if (free[i] < 0) free[i] = c.blocked((i % W) * 2, ((i / W) | 0) * 2) ? 0 : 1; return free[i] === 1; };
      const s = ((L.start.y >> 1) * W) + (L.start.x >> 1), buckets = [[s]];
      dist[s] = 0;
      for (let d = 0; d < buckets.length; d++) {
        const b = buckets[d]; if (!b) continue;
        for (let k = 0; k < b.length; k++) {
          const i = b[k]; if (dist[i] !== d) continue;
          const x = i % W, y = (i / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx, nd = d + (dx && dy ? 14 : 10);
            if (nd >= dist[j] || !isFree(j)) continue;
            if (dx && dy && (!isFree(y * W + nx) || !isFree(ny * W + x))) continue;      // no cutting corners
            dist[j] = nd; (buckets[nd] = buckets[nd] || []).push(j);
          }
        }
      }
      // the nearest reached cell within r px of a point, as px walked
      const to = (px, py, r) => { let best = 1e9; for (let y = Math.max(0, (py - r) >> 1); y <= Math.min(H - 1, (py + r) >> 1); y++) for (let x = Math.max(0, (px - r) >> 1); x <= Math.min(W - 1, (px + r) >> 1); x++) if ((x * 2 - px) ** 2 + (y * 2 - py) ** 2 <= r * r) best = Math.min(best, dist[y * W + x]); return best >= 1e9 ? -1 : best / 5; };
      const out = { portal: to(L.portal.x, L.portal.y - 2, 4), board: to(c.boardOwner.front.x, c.boardOwner.front.y, 10) };
      for (const k in c.spots) out[k] = to(c.spots[k].front.x, c.spots[k].front.y, 10);
      for (const k in c.signs) out['sign ' + k] = to(c.signs[k].front.x, c.signs[k].front.y, 10);
      // behind the portal: the cells of its trigger box must only be reached through its front edge
      const P = L.portal; let back = 0;
      for (let y = P.y - P.h; y < P.y - 5; y += 2) for (let x = P.x - P.w / 2; x <= P.x + P.w / 2; x += 2) if (!c.blocked(x, y)) back++;
      out.back = back;
      return out;
    });
    Object.keys(walk).filter(k => k !== 'back').forEach(k => ok(walk[k] >= 0, `${tagName}: ${k} cannot be reached on foot`));
    DAILY.forEach(k => ok(walk[k] >= 0 && walk[k] / SLOWEST <= MAX_S, `${tagName}: ${k} is ${(walk[k] / SLOWEST).toFixed(1)} s from the start (limit ${MAX_S})`));
    ok(walk.back === 0, `${tagName}: the hero can stand inside the portal's arch from behind (${walk.back} cells)`);
    if (!notes.length) notes.push('walk from the start, s at ' + SLOWEST + ' px/s: ' + Object.keys(walk).filter(k => k !== 'back').map(k => `${k} ${(walk[k] / SLOWEST).toFixed(1)}`).join(', '));
    // at every place to talk or read
    for (const id of ['smith', 'trainer', 'montoto', 'plot', 'neutral', 'daily']) for (const dx of [0, -18, 18]) {
      await place(page, id, dx);
      c = await read(page);
      const at = `${tagName}, at ${id}${dx ? (dx > 0 ? '+' : '') + dx : ''}`;
      if (c.near !== id) { if (!dx) ok(false, `${at}: not in reach (near ${c.near})`); continue; }
      ok(!!c.tag, `${at}: no prompt`);
      if (!c.tag) continue;
      const mine = await page.evaluate(o => { const b = eval(o).label.box; return { x: b.x, y: b.y, w: b.w, h: b.h }; }, owner(id));
      // the prompt bobs 1 px: check both positions
      for (const bob of [0, 1]) {
        const t = { x: c.tag.x, y: c.tag.y - bob, w: c.tag.w, h: c.tag.h };
        c.labels.forEach(l => ok(!hitRect(t, l, 1), `${at}: prompt "${c.tag.text}" touches label ${l.key}`));
        ok(inside(t, c.view), `${at}: prompt is cut by the view`);
        c.hud.forEach(r => ok(!hitRect(t, r, 0), `${at}: prompt is under the overlay`));
      }
      ok(inside(c.hero, c.view), `${at}: the hero is not on screen`);
      if (id !== 'plot' && id !== 'neutral') ok(inside(mine, c.view), `${at}: the label of ${id} is cut by the view`);
      ok(!!c.btn, `${at}: no TALK button`);
      if (c.btn) {
        ok(!hitRect(c.btn, mine, 0) || id === 'plot' || id === 'neutral', `${at}: the TALK button covers the label`);
        ok(!hitRect(c.btn, c.hero, 0), `${at}: the TALK button covers the hero`);
        c.things.filter(t => t.name.indexOf(id === 'daily' ? 'board' : id) === 0).forEach(t => ok(!hitRect(c.btn, t, 0), `${at}: the TALK button covers ${t.name}`));
      }
      if (!dx && sname === '960x540' && (id === 'montoto' || (id === 'smith' && rescued))) await page.screenshot({ path: path.join(dir, `${sname}_${lang}_${rescued ? '' : 'empty_'}${id}.png`) });
    }
    errors.push(...page.errors, ...(await Q.state(page)).errors);
    await page.context().close();
  }

  // the hero: HD frames, walk frames and facing with ?hd=1; the chunky atlas with ?hd=0
  for (const hd of [1, 0]) {
    const page = await Q.open(browser, `?scene=city&seed=5&fresh=1&lang=en&hd=${hd}`, { width: 960, height: 540 });
    await page.waitForTimeout(500);
    const look = () => page.evaluate(() => { const p = G.city.player; return { hd: !!p.isHD, tex: p.texture.key, frame: p.frame.name, flip: p.flipX, x: Math.round(G.city.px), h: Math.round(p.displayHeight) }; });
    const idle = await look(), seen = new Set();
    await page.keyboard.down('d');
    for (let k = 0; k < 14; k++) { await page.waitForTimeout(60); seen.add((await look()).frame); }
    const right = await look();
    await page.screenshot({ path: path.join(dir, `hero_hd${hd}_walk.png`), clip: { x: 300, y: 130, width: 360, height: 280 } });
    await page.keyboard.up('d'); await page.keyboard.down('a');
    await page.waitForFunction(() => G.city.player.flipX, null, { timeout: 3000 }).catch(() => {});
    const turn = await look();
    await page.waitForTimeout(500);
    const left = await look();
    await page.keyboard.up('a');
    if (hd) {
      ok(idle.hd && idle.tex === 'hd' && /^mage_idle/.test(idle.frame), `hd=1: the standing hero is ${idle.tex}/${idle.frame}`);
      ok([...seen].filter(f => /^mage_walk/.test(f)).length >= 2, `hd=1: walk frames seen: ${[...seen].join(' ')}`);
      ok(idle.h >= 24 && idle.h <= 30, `hd=1: the hero is ${idle.h} art px tall (the HD frame at half scale)`);
    } else {
      ok(!idle.hd && idle.tex === 'atlas' && /^mage_/.test(idle.frame), `hd=0: the standing hero is ${idle.tex}/${idle.frame}`);
      ok(seen.size >= 2, `hd=0: walk frames seen: ${[...seen].join(' ')}`);
    }
    ok(right.x > idle.x + 20 && !right.flip && left.flip && left.x < turn.x - 4, `hd=${hd}: walking right then left: x ${idle.x} -> ${right.x} -> ${turn.x} -> ${left.x}, flip ${right.flip} -> ${left.flip}`);
    errors.push(...page.errors, ...(await Q.state(page)).errors);
    await page.context().close();
  }

  // a resize: the same town, the hero stays at the stall
  const page = await Q.open(browser, '?scene=city&seed=5&fresh=1&lang=en', 'landscape');
  await restart(page, true);
  await place(page, 'montoto', 0);
  await page.setViewportSize(Q.SIZES.portrait); await page.waitForTimeout(700);
  let r = await read(page);
  ok(r.layout === 'town' && r.near === 'montoto' && inside(r.hero, r.view), `resize to 540x960: layout ${r.layout}, near ${r.near}`);
  await page.screenshot({ path: path.join(dir, 'resized_540x960.png') });
  await page.setViewportSize(Q.SIZES.landscape); await page.waitForTimeout(700);
  r = await read(page);
  ok(r.layout === 'town' && r.near === 'montoto' && inside(r.hero, r.view), `resize back to 960x540: layout ${r.layout}, near ${r.near}`);
  errors.push(...page.errors, ...(await Q.state(page)).errors);
  await browser.close();

  notes.forEach(n => console.log(n));
  fails.forEach(f => console.log('FAIL', f));
  errors.forEach(e => console.log('ERROR', e));
  console.log(`city: ${checks - fails.length} of ${checks} checks pass, ${errors.length} errors`);
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
