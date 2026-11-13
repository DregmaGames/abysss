#!/usr/bin/env node
// Touch pass: the game played with a finger at 540x960 (a Playwright context with hasTouch; taps through
// page.touchscreen.tap, held and dragged fingers through CDP touch events, two fingers at once for stick + button).
//   node qa/touch.js [portrait|landscape] [lang]
// Checks, in order: title -> city by tap; the city stick walks and stops; the stick walks the hero to a stall; a tap on
// the stall and a tap on TALK open its panel; inventory and settings (language buttons, [+], the slider dragged) by tap;
// Don Montoto; the portal by stick; in a run: the stick, DODGE while the stick is held, SKILL, a level-up card (a fresh one ignores a tap), a door,
// loot picked up with the stick, the inventory (select, identify, equip), its settings, the stick again after the panels, the result screen -> city.
// On every screen it also measures the hit box of each named control (at least 40 CSS px on the short side).
// Screenshots go to qa/out/touch/. Exits non-zero on a failed check or any console / page error.
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

(async () => {
  const size = process.argv[2] || 'portrait', lang = process.argv[3] || 'en';
  const dir = path.join(Q.OUT, 'touch');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await Q.launch();
  const page = await Q.open(browser, `?seed=5&fresh=1&lang=${lang}`, size, { touch: true });
  const cdp = await page.context().newCDPSession(page);
  const results = [];
  let shots = 0;
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: detail || '' }); };
  const snap = async name => { await page.screenshot({ path: path.join(dir, `${size}_${String(++shots).padStart(2, '0')}_${name}.png`) }); };
  const wait = ms => page.waitForTimeout(ms);
  const hit = name => page.evaluate(n => G.qa.hits[n] || null, name);
  const tap = async name => {
    const h = await hit(name);
    if (!h) throw new Error('no such control: ' + name);
    await page.touchscreen.tap(h.x, h.y);
    await wait(160);
  };
  const panel = () => page.evaluate(() => G.Panels.current);
  // finger room: every named control on screen must offer a hit box of at least 40 CSS px on its short side (the debug button is not for players)
  const small = [];
  const fingers40 = async where => {
    const bad = await page.evaluate(() => {
      const out = [], S = G.view.S, names = G.qa.hits;
      G.game.scene.getScenes(true).forEach(sc => (sc.input._list || []).forEach(o => {
        if (!o.input || !o.input.enabled || !o.visible) return;
        const ha = o.input.hitArea, z = sc.cameras.main.zoom, w = (ha.width || 0) * z, h = (ha.height || 0) * z;
        const cx = (o.x + (ha.x || 0) - (o.displayOriginX || 0) + (ha.width || 0) / 2) * S, cy = (o.y + (ha.y || 0) - (o.displayOriginY || 0) + (ha.height || 0) / 2) * S;
        for (const k in names) if (k !== 'dbg' && Math.abs(names[k].x - cx) < 6 && Math.abs(names[k].y - cy) < 6 && Math.min(w, h) < 40) out.push(k + ' ' + Math.round(w) + 'x' + Math.round(h));
      }));
      return out;
    });
    bad.forEach(b => small.push(where + ': ' + b));
  };
  // fingers: every event lists the fingers that are down after it
  const fingers = {};
  const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.keys(fingers).map(id => ({ x: fingers[id].x, y: fingers[id].y, id: +id })) });
  const down = async (id, x, y) => { fingers[id] = { x, y }; await send('touchStart'); };
  const move = async (id, x, y) => { fingers[id] = { x, y }; await send('touchMove'); };
  const up = async id => { delete fingers[id]; await send('touchEnd'); };
  const V = Q.SIZES[size], SX = Math.round(V.width * 0.28), SY = Math.round(V.height * 0.72);      // where the stick finger lands (left 60 %)
  const stick = async (dx, dy, ms) => { await down(1, SX, SY); await move(1, SX + dx * 25, SY + dy * 25); await move(1, SX + dx * 50, SY + dy * 50); await wait(ms); };
  const city = () => page.evaluate(() => G.city && G.city.snapshot());
  // a level-up can come at any moment in a run (the hero keeps fighting): answer it with a tap and go on
  const settle = async () => {
    for (let i = 0; i < 12; i++) {
      const sc = await page.evaluate(() => G.screen);
      if (sc !== 'levelup') return;
      await wait(450);                                       // a fresh level-up ignores taps for 400 ms
      await tap((await hit('slot_0')) && !(await hit('card_0')) ? 'slot_0' : 'card_0');
      await wait(250);
    }
  };
  const hero = () => page.evaluate(() => { const p = G.gameScene.sim.player; return { x: p.x, y: p.y, dodgeCd: p.dodgeCd, pulseCd: p.pulseCd, hp: p.hp }; });

  try {
    // ---------------------------------------------------------------- title -> city
    await wait(500);
    await page.evaluate(() => { const g = G.gearOf(G.save, G.cls); g.city = { montoto: true, story: 0 }; g.gold = 400; g.scrolls = 2; });
    await tap('start');
    await page.waitForFunction(() => G.screen === 'city' && G.city, null, { timeout: 10000 });
    await wait(500);
    check('title: tap ENTER THE CITY', true);

    // ---------------------------------------------------------------- city: stick
    let a = await city();
    const onScr = t => t.x >= a.view.x && t.y >= a.view.y && t.x + t.w <= a.view.x + a.view.w && t.y + t.h <= a.view.y + a.view.h;
    check('city: the portal, the Blacksmith and the Trainer are on screen on arrival (one town, the camera follows)', a.layout === 'town' && ['portal', 'smith', 'trainer'].every(n => a.things.some(t => t.name === n && onScr(t))), `layout ${a.layout}, map ${a.map.w}x${a.map.h}, view ${JSON.stringify(a.view)}`);
    await stick(1, 0, 700);
    let b = await city();
    const stickOn = await page.evaluate(() => ({ touch: !!G.touch, held: G.cityHud.stickId != null, shown: G.cityHud.stickBase.visible }));
    await snap('city_stick');
    await up(1); await wait(200);
    const c0 = await city(); await wait(300); const c1 = await city();
    check('city: the stick walks the hero', b.x - a.x > 10 && stickOn.held && stickOn.shown && stickOn.touch, `x ${a.x} -> ${b.x}`);
    await fingers40('city');
    check('city: lifting the finger stops him', c0.x === c1.x && c0.y === c1.y && !(await page.evaluate(() => G.cityHud.stickId != null)));

    // walk to the Blacksmith with the stick (steering toward the spot in front of the stall)
    await down(1, SX, SY);
    let reached = false;
    for (let i = 0; i < 80 && !reached; i++) {
      const s = await city(), t = s.spots.smith, dx = t.x - s.x, dy = t.y + 4 - s.y, l = Math.hypot(dx, dy) || 1;
      reached = s.near === 'smith' && l < 12;
      if (!reached) { await move(1, SX + dx / l * 50, SY + dy / l * 50); await wait(100); }
    }
    await up(1); await wait(250);
    a = await city();
    check('city: the stick reaches the Blacksmith', reached && a.near === 'smith', `near ${a.near}`);
    check('city: the prompt does not touch a label', a.tag && a.labels.every(l => !(a.tag.x < l.x + l.w + 1 && l.x < a.tag.x + a.tag.w + 1 && a.tag.y < l.y + l.h + 1 && l.y < a.tag.y + a.tag.h + 1)), JSON.stringify(a.tag));
    await snap('city_smith_near');

    // a tap on the stall itself, then the TALK button
    const scr = await page.evaluate(() => { const c = G.city.snapshot(), S = G.view.S, t = c.spots.smith; return { x: Math.round((t.sx - c.view.x) * S), y: Math.round((t.sy - 24 - c.view.y) * S) }; });
    await page.touchscreen.tap(scr.x, scr.y); await wait(300);
    check('city: a tap on the stall opens the shop', await panel() === 'shop');
    await fingers40('shop');
    await snap('city_shop');
    await tap('shop_close');
    check('city: the shop closes by tap', await panel() === null);
    await tap('city_talk'); await wait(200);
    check('city: the TALK button opens the shop', await panel() === 'shop');
    await tap('shop_close');

    // inventory and settings
    await tap('inv'); await wait(200);
    check('city: the inventory opens by tap', await panel() === 'inventory');
    await fingers40('city inventory');
    await snap('city_inventory');
    await tap('inv_close');
    await tap('city_set'); await wait(200);
    check('city: the settings open by tap', await panel() === 'settings');
    await fingers40('settings');
    await tap('lang_' + (lang === 'en' ? 'es' : 'en')); await wait(400);
    const l1 = await page.evaluate(() => G.lang);
    await tap('lang_' + lang); await wait(400);
    const l2 = await page.evaluate(() => G.lang);
    check('settings: the language buttons work by tap', l1 !== lang && l2 === lang && await panel() === 'settings', `${l1} -> ${l2}`);
    const sh0 = await page.evaluate(() => G.save.settings.shake);
    await tap(sh0 >= 100 ? 'shake_minus' : 'shake_plus');
    const sh1 = await page.evaluate(() => G.save.settings.shake);
    check('settings: [+] / [-] change the shake by tap', sh1 !== sh0, `${sh0} -> ${sh1}`);
    const from = await hit('shake_2'), to = await hit('shake_8');
    await down(2, from.x, from.y); await move(2, (from.x + to.x) / 2, from.y + 30); await move(2, to.x, to.y + 40); await wait(100); await up(2); await wait(200);
    const sh2 = await page.evaluate(() => G.save.settings.shake);
    check('settings: the slider follows a dragged finger (also off the track)', sh2 === 80, `shake ${sh2}`);
    await snap('city_settings');
    await tap('set_close');
    check('settings: close by tap', await panel() === null && !(await page.evaluate(() => G.paused)));

    // Don Montoto
    await page.evaluate(() => { const c = G.city, o = c.spots.montoto; c.px = o.front.x + 12; c.py = o.front.y + 6; });
    await wait(300);
    await snap('city_montoto_near');
    await tap('city_talk'); await wait(250);
    check('city: Don Montoto talks by tap', await panel() === 'montoto');
    await fingers40('Don Montoto');
    await snap('city_montoto');
    await tap('monto_close');

    // the portal, by stick
    await page.evaluate(() => { const c = G.city, p = c.snapshot().portal; c.px = p.x; c.py = p.y + 24; });      // in front of it: the portal is entered from the plaza
    await wait(200);
    await stick(0, -1, 100);
    await page.waitForFunction(() => G.screen === 'game' && G.gameScene && G.gameScene.sim && G.hud, null, { timeout: 10000 }).catch(() => {});
    await up(1);
    check('city: the stick walks into the portal and the run starts', await page.evaluate(() => G.screen === 'game' && !!G.gameScene));
    await wait(900);

    // ---------------------------------------------------------------- run: stick and buttons
    await page.evaluate(() => { G.gameScene.sim.cheats.god = true; });      // the checks take their time: nothing may kill the hero meanwhile
    check('run: the DODGE and SKILL buttons are on screen', !!(await hit('tdodge')) && !!(await hit('tpulse')));
    await fingers40('run');
    let moved = 0, dirUsed = null, p0, p1;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      p0 = await hero();
      await stick(d[0], d[1], 600);
      p1 = await hero();
      moved = (p1.x - p0.x) * d[0] + (p1.y - p0.y) * d[1];
      if (moved > 8) { dirUsed = d; break; }
      await up(1); await wait(150);
    }
    check('run: the stick moves the hero', moved > 8, `moved ${moved.toFixed(1)} px`);
    // second finger on DODGE while the first holds the stick
    const hd = await hit('tdodge');
    await down(2, hd.x, hd.y); await wait(120);
    const pd = await hero(), held = await page.evaluate(() => ({ id: G.hud.stickId != null, mx: G.gameScene.controls.virtual.mx, my: G.gameScene.controls.virtual.my }));
    await snap('run_stick_dodge');
    await up(2); await wait(100);
    check('run: DODGE with a second finger while the stick is held', pd.dodgeCd > 0 && held.id && (held.mx || held.my), `dodgeCd ${pd.dodgeCd.toFixed(2)}, stick ${held.mx.toFixed(1)},${held.my.toFixed(1)}`);
    await up(1); await wait(200);
    const q0 = await hero(); await wait(300); const q1 = await hero();
    check('run: lifting the finger stops the hero', Math.abs(q1.x - q0.x) + Math.abs(q1.y - q0.y) < 0.5 && !(await page.evaluate(() => G.hud.stickId != null)));
    // a level-up can open between the look and the tap (the skill kills, the kills level up): answer it and press again
    const press = async (name, cd) => {
      for (let i = 0; i < 4; i++) {
        await settle();
        await page.evaluate(k => { G.gameScene.sim.player[k] = 0; }, cd); await wait(80);
        await tap(name);
        if ((await hero())[cd] > 0) return true;
      }
      return false;
    };
    check('run: SKILL by tap', await press('tpulse', 'pulseCd'));
    check('run: DODGE by tap', await press('tdodge', 'dodgeCd'));

    // level-up cards
    await settle();
    const n0 = await page.evaluate(() => { const s = G.gameScene.sim; const n = Object.keys(s.player.abil).length; s.cheatLevel(); return n; });
    await page.waitForFunction(() => G.screen === 'levelup', null, { timeout: 15000 });
    // a tap in the first 400 ms must not pick a card (it was on its way to DODGE or SKILL)
    const early = await hit('card_1');
    await page.touchscreen.tap(early.x, early.y); await wait(60);
    check('run: a level-up that has just opened ignores a tap', await page.evaluate(() => G.screen === 'levelup'));
    await wait(500);
    await snap('run_levelup');
    await fingers40('level-up');
    await tap('card_1');
    await page.waitForFunction(() => G.screen === 'game', null, { timeout: 8000 }).catch(() => {});
    const n1 = await page.evaluate(() => { const s = G.gameScene.sim; return { n: Object.keys(s.player.abil).length, ranks: Object.values(s.player.abil).reduce((t, v) => t + (v.rank || v || 0), 0), screen: G.screen }; });
    check('run: a level-up card is picked by tap', n1.screen === 'game' && n1.n >= n0 && n1.ranks >= 1, JSON.stringify(n1));

    // door choice
    await settle();
    const r0 = await page.evaluate(() => { const s = G.gameScene.sim; s.cheatChoice(); return s.roomIndex; });
    await page.waitForFunction(() => G.screen === 'choice', null, { timeout: 15000 });
    await wait(500);
    await snap('run_door_choice');
    await fingers40('door choice');
    await tap('door_1');
    await page.waitForFunction(r => G.gameScene.sim.roomIndex === r + 1 && G.screen === 'game', r0, { timeout: 10000 }).catch(() => {});
    check('run: a door is chosen by tap', await page.evaluate(r => G.gameScene.sim.roomIndex === r + 1 && G.screen === 'game' && G.gameScene.sim.mod != null, r0));
    await wait(600);

    // inventory in a run: loot, select, identify, equip; settings from it
    await settle();
    await page.evaluate(() => { const s = G.gameScene.sim; s.scrolls = 5; s.cheatLoot(); s.cheatLoot(); });
    await down(1, SX, SY);                                   // the stick walks over the drops
    for (let i = 0; i < 60; i++) {
      const t = await page.evaluate(() => { const s = G.gameScene.sim, p = s.player, d = s.drops.filter(d => d.kind === 'item')[0]; return { n: s.bag.length, dx: d ? d.x - p.x : 0, dy: d ? d.y - p.y : 0, lv: G.screen === 'levelup' }; });
      if (t.n >= 3 || (!t.dx && !t.dy)) break;
      if (t.lv) { await up(1); await settle(); await down(1, SX, SY); continue; }
      const l = Math.hypot(t.dx, t.dy) || 1;
      await move(1, SX + t.dx / l * 50, SY + t.dy / l * 50); await wait(100);
    }
    await up(1); await wait(150);
    await settle();
    check('run: the stick walks over drops and picks them up', await page.evaluate(() => G.gameScene.sim.bag.length >= 3), 'bag ' + await page.evaluate(() => G.gameScene.sim.bag.length));
    await tap('inv'); await wait(250);
    await fingers40('run inventory');
    check('run: the inventory opens by tap and pauses the run', await panel() === 'inventory' && await page.evaluate(() => G.paused));
    const pick = await page.evaluate(() => { const s = G.gameScene.sim; for (let i = 0; i < s.bag.length; i++) { const it = s.bag[i]; if (G.canEquip(it, s.B, s.clsId)) return { i, unid: !!it.unid, id: it.id, slot: it.slot }; } return null; });
    if (pick) {
      await tap('sbag_' + pick.i); await wait(200);
      await snap('run_inventory');
      if (pick.unid) { await tap('identify'); await wait(200); }
      const idOk = await page.evaluate(i => !G.gameScene.sim.bag[i].unid, pick.i);
      await tap('equip'); await wait(200);
      const worn = await page.evaluate(p => { const e = G.gameScene.sim.gear.equipped[p.slot]; return !!e && e.id === p.id; }, pick);
      check('run: select, identify and equip an item by tap', idOk && worn, `slot ${pick.slot}, unidentified ${pick.unid}`);
    } else check('run: select, identify and equip an item by tap', false, 'no equippable item dropped');
    await tap('inv_settings'); await wait(200);
    check('run: settings from the inventory by tap', await panel() === 'settings');
    await fingers40('run settings');
    await snap('run_settings');
    await tap('set_close'); await wait(200);
    check('run: settings go back to the inventory', await panel() === 'inventory');
    await tap('inv_close'); await wait(200);
    check('run: closing the panels resumes the run', await panel() === null && !(await page.evaluate(() => G.paused)) && ['game', 'levelup'].includes(await page.evaluate(() => G.screen)));
    await settle();
    let again = 0;
    for (const d of [dirUsed || [1, 0], [-1, 0], [0, 1], [0, -1], [1, 0]]) {
      p0 = await hero(); await stick(d[0], d[1], 500); p1 = await hero(); await up(1); await wait(120);
      again = (p1.x - p0.x) * d[0] + (p1.y - p0.y) * d[1];
      if (again > 6) break;
    }
    check('run: the stick works again after the panels', again > 6, `moved ${again.toFixed(1)} px`);

    // result -> city
    await settle();
    await page.evaluate(() => { const s = G.gameScene.sim; s.cheats.god = false; s.player.iframes = 0; s.hurtPlayer(99999, 0, 0); });
    await page.waitForFunction(() => G.screen === 'result', null, { timeout: 20000 });
    await wait(300);
    await snap('result');
    await fingers40('result');
    await tap('res_city');
    await page.waitForFunction(() => G.screen === 'city' && G.city, null, { timeout: 10000 }).catch(() => {});
    check('result: BACK TO CITY by tap', await page.evaluate(() => G.screen === 'city'));
    check('finger room: every control offers at least 40 CSS px', small.length === 0, small.join('; '));
  } catch (e) {
    check('script', false, String(e && e.message || e));
    await snap('failed').catch(() => {});
  }
  const st = await Q.state(page).catch(() => ({ errors: [] }));
  const errors = page.errors.concat(st.errors || []);
  await browser.close();
  const bad = results.filter(r => !r.ok);
  results.forEach(r => console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.detail ? '  (' + r.detail + ')' : '')));
  errors.forEach(e => console.log('ERROR', e));
  console.log(`${size} ${lang}: ${results.length - bad.length} of ${results.length} touch checks pass, ${errors.length} errors, ${shots} screenshots`);
  process.exit(bad.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
