#!/usr/bin/env node
// The interactive tutorial, played through in the real game (Playwright + Chromium).
//   node qa/tutorial.js [config ...]        configs: land_en, land_es, port_en, port_es (default: all four)
// land_*: 960x540 with the keyboard (the mouse only for the bag screen); port_*: 540x960 with touch emulation (CDP touch events: a finger for the stick, taps for the buttons).
// Each config: title -> the class pick -> the forced tutorial room -> all 13 steps -> "Well done" -> the city -> the city's four steps -> the portal -> a run, where the first
// level-up card, the first door choice, the first merchant and Don Montoto's cage each show their step and end when the player does the thing.
// For every step it checks: the pop-up shows the right step and counter; it stays while the player does nothing (1.2 s idle); it is gone / changed right after the action;
// it covers neither the hero nor the arrow; it is inside the screen. Also: skip with confirmation, Settings (pop-ups off, replay), the save flags, 0 console errors.
// Screenshots: /tmp/tut_move.png, /tmp/tut_crack_portrait.png, /tmp/tut_identify.png, /tmp/tut_city_portrait.png (and qa/out/tutorial/ for the rest).
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./lib');

const CONFIGS = {
  land_en: { size: 'landscape', touch: false, lang: 'en', cls: 'warrior' },
  land_es: { size: 'landscape', touch: false, lang: 'es', cls: 'mage' },
  port_en: { size: 'portrait', touch: true, lang: 'en', cls: 'archer' },
  port_es: { size: 'portrait', touch: true, lang: 'es', cls: 'warrior' }
};
const IDS = ['move', 'attack', 'dodge', 'cross', 'skill', 'darken', 'super', 'chest', 'pickup', 'bag', 'identify', 'equip', 'exit'];
const OUTDIR = path.join(Q.OUT, 'tutorial');
fs.mkdirSync(OUTDIR, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

async function run(name, cfg, browser) {
  const results = [];
  const check = (n, ok, detail) => { results.push({ n, ok: !!ok, detail: detail || '' }); if (process.env.TV) console.log('    ' + (ok ? 'ok ' : 'NO ') + n); if (!ok) console.log('  FAIL ' + name + ': ' + n + (detail ? '  -> ' + detail : '')); };
  const touch = cfg.touch, V = Q.SIZES[cfg.size], t0 = Date.now();
  const page = await Q.open(browser, `?seed=5&fresh=1&tutorial=1&lang=${cfg.lang}&class=${cfg.cls}&speed=2`, cfg.size, { touch });
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const shot = async (file) => { await page.screenshot({ path: file }); };

  // ---------------------------------------------------------------- input: keyboard or fingers
  const keys = { w: false, a: false, s: false, d: false };
  const fingers = {};
  const send = type => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: Object.keys(fingers).map(id => ({ x: fingers[id].x, y: fingers[id].y, id: +id })) });
  const SX = Math.round(V.width * 0.25), SY = Math.round(V.height * 0.7);
  let stickOn = false;
  async function steer(dx, dy) {
    const l = Math.hypot(dx, dy);
    if (!touch) {
      const want = { w: dy < -2 && Math.abs(dy) > Math.abs(dx) * 0.4, s: dy > 2 && Math.abs(dy) > Math.abs(dx) * 0.4, a: dx < -2 && Math.abs(dx) > Math.abs(dy) * 0.4, d: dx > 2 && Math.abs(dx) > Math.abs(dy) * 0.4 };
      for (const k of Object.keys(keys)) {
        if (want[k] && !keys[k]) { await page.keyboard.down(k); keys[k] = true; }
        if (!want[k] && keys[k]) { await page.keyboard.up(k); keys[k] = false; }
      }
      return;
    }
    if (l < 3) { if (stickOn) { delete fingers[1]; await send('touchEnd'); stickOn = false; } return; }
    const ux = dx / l, uy = dy / l;
    if (!stickOn) { fingers[1] = { x: SX, y: SY }; await send('touchStart'); stickOn = true; }
    fingers[1] = { x: SX + ux * 40, y: SY + uy * 40 };
    await send('touchMove');
  }
  const stop = () => steer(0, 0);
  async function tapAt(x, y) {
    if (!touch) { await page.mouse.click(x, y); return; }
    fingers[2] = { x, y }; await send('touchStart'); await wait(40); delete fingers[2]; await send('touchEnd');
  }
  const hit = n => page.evaluate(k => G.qa.hits[k] || null, n);
  async function tapHit(n) { const h = await hit(n); if (!h) throw new Error('no control ' + n); await tapAt(h.x, h.y); await wait(120); }
  async function clickHit(n) { const h = await hit(n); if (!h) throw new Error('no control ' + n); if (touch) await tapAt(h.x, h.y); else await page.mouse.click(h.x, h.y); await wait(150); }
  const dodge = async () => { if (touch) await tapHit('tdodge'); else await page.keyboard.press('Space'); };
  const skill = async () => { if (touch) await tapHit('tpulse'); else await page.keyboard.press('e'); };

  // ---------------------------------------------------------------- reading the game
  const S = () => page.evaluate(() => {
    const gs = G.gameScene, sim = gs && gs.sim, T = G.Tut.snapshot();
    if (!sim || !sim.tut) return { tut: T, screen: G.screen };
    const p = sim.player, wv = gs.cameras.main.worldView, R = sim.room.tut, st = sim.tut;
    const live = sim.monsters.filter(m => !m.dead);
    return { tut: T, screen: G.screen, id: sim.tutId(), step: st.step, sub: st.sub, done: st.done, hero: { x: p.x, y: p.y, r: p.r }, wv: { x: wv.x, y: wv.y }, S: G.view.S, V: { W: G.view.W, H: G.view.H },
      dummy: st.dummy && !st.dummy.dead ? { x: st.dummy.x, y: st.dummy.y } : null, spot: R.spot, crackY: R.crackY, monsters: live.map(m => ({ x: m.x, y: m.y, t: m.type })),
      drops: sim.drops.map(d => ({ x: d.x, y: d.y })), chest: { x: sim.chest.x, y: sim.chest.y }, exit: { x: sim.exit.x, y: sim.exit.y + 4 }, bag: sim.bag.length, scrolls: sim.scrolls,
      itemIdx: st.item ? sim.bag.indexOf(st.item) : -1, unid: st.item ? !!st.item.unid : null, panel: G.Panels.current, sel: G.Panels.sel ? G.Panels.sel.key : null, range: sim.stats.range, hp: sim.player.hp,
      level: sim.player.level, gold: sim.gold, state: sim.state, kills: sim.kills };
  });
  const expectedText = (id, sub) => page.evaluate(([i, s, tc]) => { const k = 'tut.' + (i === 'skill' && s ? 'skill2' : i); return G.t(tc && G.LANG.en[k + 'T'] ? k + 'T' : k, { skill: G.skillLabel(G.gameScene.sim.clsId).toUpperCase(), btn: G.t(i === 'equip' ? 'inv.equip' : 'inv.identify') }); }, [id, sub, touch]);
  async function until(fn, ms, what) {
    const end = Date.now() + (ms || 8000);
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timeout: ' + what); await wait(50); }
  }
  const shown = async id => { const s = await S(); return s.tut && s.tut.shown && s.tut.id === id ? s : null; };

  // geometry: the pop-up against the hero, its arrow and the panel
  const overlap = (a, b, m) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + m * 2, h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + m * 2; return w > 0 && h > 0; };
  async function geometry(s, over) {
    const b = s.tut.box, H = s.hero;
    check(s.tut.id + ': pop-up inside the screen', b && b.x >= 0 && b.y >= 0 && b.x + b.w <= s.V.W && b.y + b.h <= s.V.H, JSON.stringify(b));
    if (over) {
      const m = await page.evaluate(() => { const L = G.Panels.L; return L ? { x: L.x, y: L.y, w: L.w, h: L.h } : null; });
      if (m) check(s.tut.id + ': pop-up beside the open panel, not over it', !overlap(b, m, 0), JSON.stringify({ b, m }));
      return;
    }
    const hero = { x: H.x - s.wv.x - 8, y: H.y - s.wv.y - 22, w: 16, h: 28 };
    check(s.tut.id + ': pop-up does not cover the hero', !overlap(b, hero, 0), JSON.stringify({ b, hero }));
    const a = s.tut.arrow;
    if (a && !a.edge) {
      const ab = a.ui ? { x: a.x - 6, y: a.y - 6, w: 12, h: 12 } : { x: a.tx - 8, y: a.ty - 20, w: 16, h: 24 };
      check(s.tut.id + ': pop-up does not cover the arrow or its target', !overlap(b, ab, 0), JSON.stringify({ b, ab }));
    }
  }

  const log = [];
  async function stepStart(i, opts) {
    opts = opts || {};
    const id = IDS[i], key = 'room.' + id;
    const s = await until(() => shown(key + (opts.sub ? '' : '')), 12000, 'pop-up of step ' + id);
    const sim = await page.evaluate(() => ({ step: G.gameScene.sim.tut.step, sub: G.gameScene.sim.tut.sub }));
    check(id + ': the pop-up shows step ' + (i + 1) + ' of 13', s.tut.n === i + 1 && s.tut.of === 13 && sim.step === i, JSON.stringify(s.tut) + ' sim ' + sim.step);
    const want = await expectedText(id, 0);
    check(id + ': the text is the ' + (touch ? 'touch' : 'keyboard') + ' text of the step in ' + cfg.lang, s.tut.text === want && want.length > 5, s.tut.text + ' | ' + want);
    if (opts.quick) return s;      // a ranged hero kills the dummy from afar before the pop-up has settled: nothing to measure
    await wait(700);      // the pop-up settles where it covers neither the hero nor the arrow
    const s2 = await S();
    await geometry(s2, id === 'bag' || id === 'identify' || id === 'equip');
    // idle: nothing done, the step must stay (a step that is a fight can finish by itself: the hero attacks on its own)
    if (opts.idle !== false) {
      await stop();
      await wait(1200);
      const s3 = await S();
      check(id + ': waits while the player does nothing (1.2 s)', s3.step === i && s3.tut.id === key, 'step ' + s3.step + ' ' + s3.tut.id);
    }
    return s2;
  }
  async function afterAction(i, what, noShow) {
    const next = IDS[i + 1];
    if (next) {
      const s = await until(async () => { const x = await S(); return x.step > i ? x : null; }, 6000, 'step after ' + IDS[i] + ' (' + what + ')');
      check(IDS[i] + ': advanced to ' + next + ' right after ' + what + ' (exactly one step)', s.step === i + 1 && s.id === next, s.id);
      if (!noShow) await until(() => shown('room.' + next), 3000, 'the pop-up of ' + next);
    }
  }

  const toward = async (x, y, close) => { const s = await S(); const dx = x - s.hero.x, dy = y - s.hero.y; if (Math.hypot(dx, dy) < (close || 6)) { await stop(); return true; } await steer(dx, dy); return false; };
  const nearestMon = s => s.monsters.reduce((b, m) => { const d = Math.hypot(m.x - s.hero.x, m.y - s.hero.y); return !b || d < b.d ? { m, d } : b; }, null);
  async function fightUntil(i, ms) {
    const end = Date.now() + ms;
    for (;;) {
      const s = await S();
      if (s.step > i) return;
      if (Date.now() > end) throw new Error('timeout fighting in step ' + IDS[i] + ' ' + JSON.stringify(await page.evaluate(() => { const m = G.gameScene.sim; return { hero: [m.player.x | 0, m.player.y | 0], crackY: m.room.tut.crackY, phase: m.phase, mons: m.monsters.filter(q => !q.dead).map(q => [q.id || q.type, q.x | 0, q.y | 0, q.hp | 0, q.fid]), fiss: m.fissures.map(f => [f.x | 0, f.y | 0, f.state, (f.queue || []).length, f.total]) }; })));
      const n = nearestMon(s), reach = Math.min(s.range * 0.55, 70);
      if (n && n.d > reach) await steer(n.m.x - s.hero.x, n.m.y - s.hero.y); else await stop();
      if (s.id === 'skill') { /* the skill was used already */ }
      await wait(60);
    }
  }

  try {
    // ----------------------------------------------------------- title -> the forced tutorial room
    await wait(400);
    const st0 = await page.evaluate(() => ({ screen: G.screen, state: G.save.hints.tut.state, cls: G.cls }));
    check('a fresh save starts on the main menu with the tutorial pending', st0.screen === 'menu' && st0.state === 'pending' && st0.cls === cfg.cls, JSON.stringify(st0));
    check('the main menu offers PLAY', !!(await hit('menu_play')));
    await clickHit('menu_play'); await wait(300);
    await clickHit('pick_' + cfg.cls);      // the hero choice; a fresh save goes on to the tutorial room
    await until(async () => (await S()).screen === 'game', 8000, 'the tutorial room after ENTER');
    const inTut = await page.evaluate(() => !!(G.tutorial && G.gameScene.sim.tut));
    check('PLAY + a hero on a fresh save goes to the tutorial room', inTut);
    if (touch) await page.evaluate(() => { G.touch = true; G.hud.build(); });      // the buttons show once a finger was seen (a real first touch does this)
    await wait(300);

    // ----------------------------------------------------------- 1 move
    let s = await stepStart(0);
    if (cfg.size === 'landscape' && !touch && cfg.lang === 'en') await shot('/tmp/tut_move.png');
    await shot(path.join(OUTDIR, `${name}_01_move.png`));
    const p0 = (await S()).hero;
    await steer(0, -50); await wait(120);
    let mid = await S();
    check('move: a few px of walking do not finish the step (it needs about 60)', mid.step === 0 || Math.hypot(mid.hero.x - p0.x, mid.hero.y - p0.y) >= 55, 'moved ' + Math.round(Math.hypot(mid.hero.x - p0.x, mid.hero.y - p0.y)));
    await until(async () => (await S()).step > 0, 6000, 'moving 60 px'); await stop();
    check('move: finished after about 60 px of walking', true);
    await until(() => shown('room.attack'), 3000, 'attack pop-up');

    // ----------------------------------------------------------- 2 attack (the dummy)
    s = await stepStart(1, { idle: false, quick: cfg.cls !== 'warrior' });
    check('attack: the dummy is out of reach of the idle hero (the hero has to walk)', cfg.cls !== 'warrior' || (s.dummy && Math.hypot(s.dummy.x - s.hero.x, s.dummy.y - s.hero.y) > Math.min(40, s.range * 0.5)), JSON.stringify(s.dummy));
    await shot(path.join(OUTDIR, `${name}_02_attack.png`));
    for (;;) {
      const x = await S();
      if (x.step > 1) break;
      if (x.dummy) { const d = Math.hypot(x.dummy.x - x.hero.x, x.dummy.y - x.hero.y); if (d > Math.min(x.range * 0.5, 40)) await steer(x.dummy.x - x.hero.x, x.dummy.y - x.hero.y); else await stop(); }
      await wait(60);
    }
    await stop(); await afterAction(1, 'the dummy died');

    // ----------------------------------------------------------- 3 dodge
    s = await stepStart(2);
    await shot(path.join(OUTDIR, `${name}_03_dodge.png`));
    await steer(50, 0); await wait(60); await dodge(); await stop();
    await afterAction(2, 'a dodge');

    // ----------------------------------------------------------- 4 cross the crack
    s = await stepStart(3);
    if (touch && cfg.size === 'portrait' && cfg.lang === 'en') await shot('/tmp/tut_crack_portrait.png');
    await shot(path.join(OUTDIR, `${name}_04_cross.png`));
    check('cross: the arrow points at the marked spot on the far side of the crack', !!s.tut.arrow, JSON.stringify(s.tut.arrow));
    // walk to the crack: walking alone must not finish the step (the crack blocks walkers)
    for (let k = 0; k < 120; k++) { const x = await S(); if (x.hero.y < x.crackY + 28 && Math.abs(x.hero.x - x.spot.x) < 24) break; await steer(x.spot.x - x.hero.x, x.crackY + 24 - x.hero.y); await wait(50); }
    await stop(); await wait(400);
    let ws = await S();
    check('cross: standing at the crack does not finish the step', ws.step === 3, 'step ' + ws.step);
    await steer(0, -50); await wait(500);
    ws = await S();
    check('cross: pushing into the crack without a dodge does not get across', ws.step === 3 && ws.hero.y > ws.crackY, 'y ' + Math.round(ws.hero.y) + ' crack ' + ws.crackY);
    await dodge(); await wait(300); await stop();
    await afterAction(3, 'dodging across the crack');

    // ----------------------------------------------------------- 5 skill
    s = await stepStart(4);
    await shot(path.join(OUTDIR, `${name}_05_skill.png`));
    check('skill: the text names the class skill', /./.test(s.tut.text) && s.tut.text.toUpperCase().includes(await page.evaluate(() => G.skillLabel(G.gameScene.sim.clsId).toUpperCase())), s.tut.text);
    await skill(); await wait(300);
    const sk = await S();
    check('skill: after the cast the pop-up asks to finish the monsters (or the skill already did, and the step moved on)', sk.step === 5 || (sk.step === 4 && sk.tut.text === (await expectedText('skill', 1))), sk.tut.text);
    await fightUntil(4, 40000);
    await afterAction(4, 'the skill and the monsters');

    // ----------------------------------------------------------- 6 darken the crack
    s = await stepStart(5, { idle: false });
    await shot(path.join(OUTDIR, `${name}_06_darken.png`));
    await fightUntil(5, 60000);
    await afterAction(5, 'the crack went dark');

    // ----------------------------------------------------------- 7 super fissure
    s = await stepStart(6, { idle: false });
    await fightUntil(6, 60000);
    await afterAction(6, 'the super fissure closed');

    // ----------------------------------------------------------- 8 chest
    s = await stepStart(7);
    for (let k = 0; k < 200; k++) { const x = await S(); if (x.step > 7) break; await toward(x.chest.x, x.chest.y, 4); await wait(50); }
    await stop(); await afterAction(7, 'the chest opened');

    // ----------------------------------------------------------- 9 pick up
    s = await stepStart(8);
    check('pickup: the loot lies away from the hero (the hero has to walk to it)', s.drops.length === 2 && s.drops.every(d => Math.hypot(d.x - s.hero.x, d.y - s.hero.y) > 14), JSON.stringify(s.drops));
    for (let k = 0; k < 300; k++) { const x = await S(); if (x.step > 8) break; const d = x.drops[0]; if (d) await toward(d.x, d.y, 3); await wait(50); }
    await stop(); await afterAction(8, 'both were picked up');

    // ----------------------------------------------------------- 10 bag
    s = await stepStart(9);
    check('bag: the arrow points at the bag button', !!s.tut.arrow && !!s.tut.arrow.ui, JSON.stringify(s.tut.arrow));
    await shot(path.join(OUTDIR, `${name}_10_bag.png`));
    if (touch) await tapHit('inv'); else await page.keyboard.press('i');
    await afterAction(9, 'opening the bag');

    // ----------------------------------------------------------- 11 identify
    s = await stepStart(10);
    check('identify: the bag is open and the item is hidden', s.panel === 'inventory' && s.unid === true, s.panel + ' ' + s.unid);
    if (cfg.size === 'landscape' && !touch && cfg.lang === 'en') await shot('/tmp/tut_identify.png');
    if (touch && cfg.lang === 'es') await shot('/tmp/tut_identify_portrait_es.png');
    await shot(path.join(OUTDIR, `${name}_11_identify.png`));
    await clickHit('sbag_' + s.itemIdx); await wait(200);
    let ss = await S();
    check('identify: selecting the item does not finish the step; the arrow moves to the IDENTIFY button', ss.step === 10 && ss.tut.arrow && ss.tut.arrow.ui, JSON.stringify(ss.tut.arrow));
    await clickHit('identify');
    await afterAction(10, 'identifying it');

    // ----------------------------------------------------------- 12 equip
    s = await stepStart(11);
    await shot(path.join(OUTDIR, `${name}_12_equip.png`));
    ss = await S();
    if (ss.sel !== ss.itemIdx) { await clickHit('sbag_' + ss.itemIdx); await wait(200); }
    await clickHit('equip');
    await afterAction(11, 'equipping it', true);
    await clickHit('inv_close'); await wait(300);

    // ----------------------------------------------------------- 13 exit
    s = await stepStart(12);
    await shot(path.join(OUTDIR, `${name}_13_exit.png`));
    for (let k = 0; k < 300; k++) { const x = await S(); if (x.tut.done || x.done) break; await toward(x.exit.x, x.exit.y, 3); await wait(50); }
    await stop();
    await until(async () => (await S()).tut.done, 6000, 'the Well done pop-up');
    check('exit: the walk through the gate ends the tutorial with a Well done pop-up', true);
    await shot(path.join(OUTDIR, `${name}_14_done.png`));
    const fin = await page.evaluate(() => { const g = G.gearOf(G.save, G.cls); const sim = G.gameScene.sim; return { state: G.save.hints.tut.state, got: G.save.hints.tut.got, weapon: g.equipped.weapon && { unid: !!g.equipped.weapon.unid, rarity: g.equipped.weapon.rarity }, gold: g.gold, bag: g.bag.length, starterKept: g.bag.length === 1 && g.bag[0].starter === true, level: sim.player.level, runs: g.ux.runs, stats: G.save.stats.runs }; });
    check('save: tutorial done, the weapon was given once, identified and worn; the starter weapon it replaced is the only kept item; no gold, runs or stats', fin.state === 'done' && fin.got === true && fin.weapon && !fin.weapon.unid && fin.weapon.rarity === 1 && fin.gold === 0 && fin.starterKept && fin.runs === 0 && fin.stats === 0, JSON.stringify(fin));
    await clickHit('tut_done');
    await until(async () => (await S()).screen === 'city', 8000, 'the city after the tutorial');
    await wait(500);

    // ----------------------------------------------------------- the city, first visit
    const C = () => page.evaluate(() => { if (!G.city || G.screen !== 'city') return null; const c = G.city.snapshot(); return { x: c.x, y: c.y, spots: c.spots, portal: c.portal, near: c.near, T: G.Tut.snapshot(), panel: G.Panels.current, entering: c.entering, view: c.view }; });
    const cityWalk = async (x, y, close) => { for (let k = 0; k < 400; k++) { const c = await C(); if (!c) break; if (Math.hypot(x - c.x, y - c.y) < (close || 6)) break; await steer(x - c.x, y - c.y); await wait(40); } await stop(); };
    let c = await until(async () => { const x = await C(); return x && x.T.shown && x.T.id === 'city.0' ? x : null; }, 6000, 'the city pop-up 1');
    check('city 1/4: "Walk to the Blacksmith" with an arrow', c.T.n === 1 && c.T.of === 4 && !!c.T.arrow, JSON.stringify(c.T));
    await shot(path.join(OUTDIR, `${name}_15_city1.png`));
    if (cfg.size === 'portrait' && cfg.lang === 'en') await shot('/tmp/tut_city_portrait.png');
    await wait(1200);
    c = await C(); check('city 1/4: waits while the player does nothing', c.T.id === 'city.0' && c.near !== 'smith', c.T.id);
    await cityWalk(c.spots.smith.x, c.spots.smith.y, 4);
    c = await until(async () => { const x = await C(); return x && x.T.shown && x.T.id === 'city.1' ? x : null; }, 4000, 'city pop-up 2');
    check('city 2/4: near the Blacksmith the pop-up asks to open his shop', c.T.n === 2, JSON.stringify(c.T));
    await shot(path.join(OUTDIR, `${name}_16_city2.png`));
    await wait(1200);
    c = await C(); check('city 2/4: waits until the shop is opened', c.T.id === 'city.1' && !c.panel, c.T.id);
    if (touch) await tapHit('city_talk'); else await page.keyboard.press('e');
    await until(async () => (await C()).panel === 'shop', 4000, 'the shop');
    await wait(300);
    c = await C(); check('city 2/4: done when the shop opens (the pop-up steps aside while it is open)', c.T.cityN === 2 && !c.T.shown, JSON.stringify(c.T));
    await clickHit('shop_close'); await wait(300);
    c = await until(async () => { const x = await C(); return x && x.T.shown && x.T.id === 'city.2' ? x : null; }, 4000, 'city pop-up 3');
    check('city 3/4: "Walk to the Trainer"', c.T.n === 3, JSON.stringify(c.T));
    await wait(1200);
    c = await C(); check('city 3/4: waits while the player does nothing', c.T.id === 'city.2', c.T.id);
    await cityWalk(c.spots.trainer.x, c.spots.trainer.y, 4);
    c = await until(async () => { const x = await C(); return x && x.T.shown && x.T.id === 'city.3' ? x : null; }, 4000, 'city pop-up 4');
    check('city 4/4: "Walk into the portal" with an arrow at the portal', c.T.n === 4 && !!c.T.arrow, JSON.stringify(c.T));
    await shot(path.join(OUTDIR, `${name}_17_city4.png`));
    await wait(1200);
    c = await C(); check('city 4/4: waits until the hero walks into the portal', c.T.id === 'city.3' && !c.entering, c.T.id);
    await cityWalk(c.portal.x, c.portal.y - 8, 3);
    await until(async () => (await S()).screen === 'game', 8000, 'a run from the portal');
    const gates1 = await page.evaluate(() => G.save.hints.tut.steps);
    check('city: walking into the portal finished the city steps (saved)', gates1.city === true, JSON.stringify(gates1));
    await wait(600);

    // ----------------------------------------------------------- gated steps in a run
    await page.evaluate(() => { const g = G.gameScene.sim; g.cheats.god = true; });
    const R = () => page.evaluate(() => { const gs = G.gameScene, sim = gs.sim, wv = gs.cameras.main.worldView; return { T: G.Tut.snapshot(), state: sim.state, S: G.view.S, wv: { x: wv.x, y: wv.y }, merchant: sim.merchant && { x: sim.merchant.x, y: sim.merchant.y }, cage: sim.cage && { x: sim.cage.x, y: sim.cage.y }, hero: { x: sim.player.x, y: sim.player.y }, phase: sim.phase, rescued: sim.rescued, gates: G.save.hints.tut.steps, panel: G.Panels.current, merch: !!G.hud.merchL }; });
    let r = await R();
    check('run: no step pop-up while nothing special happens', !r.T.shown, JSON.stringify(r.T));
    // level-up card
    await page.evaluate(() => G.gameScene.sim.cheatLevel());
    r = await until(async () => { const x = await R(); return x.T.shown && /^card/.test(x.T.id) ? x : null; }, 4000, 'the level-up pop-up');
    check('card: the first level-up asks to pick a card (pop-up beside the cards)', r.state === 'levelup', r.state);
    await shot(path.join(OUTDIR, `${name}_18_card.png`));
    const lb = await page.evaluate(() => { const L = G.hud.level; return L ? { x: L.x, y: L.y, w: L.w, h: L.h } : null; });
    r = await R(); if (lb) check('card: the pop-up does not cover the cards', !overlap(r.T.box, lb, 0), JSON.stringify({ b: r.T.box, lb }));
    await wait(1200);
    r = await R(); check('card: waits until a card is picked', r.state === 'levelup' && !r.gates.card, JSON.stringify(r.gates));
    await wait(500);
    await clickHit('card_0'); await wait(300);
    r = await R();
    if (/^card.true/.test(r.T.id)) {
      check('card: a replace choice shows "Choose which slot to replace"', true);
      await clickHit('slot_0'); await wait(300); r = await R();
    }
    check('card: picking finished the step (saved) and the pop-up is gone', r.gates.card === true && !r.T.shown, JSON.stringify(r.gates));
    // choice
    await page.evaluate(() => G.gameScene.sim.cheatChoice());
    r = await until(async () => { const x = await R(); return x.T.shown && x.T.id === 'choice' ? x : null; }, 4000, 'the choice pop-up');
    await shot(path.join(OUTDIR, `${name}_19_choice.png`));
    const cb = await page.evaluate(() => { const L = G.hud.choiceL; return L ? { x: L.x, y: L.y, w: L.w, h: L.h } : null; });
    if (cb) check('choice: the pop-up does not cover the choice', !overlap(r.T.box, cb, 0), JSON.stringify({ b: r.T.box, cb }));
    await wait(1200);
    r = await R(); check('choice: waits until a choice is made', r.state === 'choice' && !r.gates.choice);
    await wait(500);
    await clickHit('door_0'); await wait(500);
    r = await R(); check('choice: taking a door finished the step', r.gates.choice === true && !r.T.shown && r.state === 'play', JSON.stringify(r.gates));
    // merchant
    await page.evaluate(() => { const sim = G.gameScene.sim; sim.cheatMerchant(); sim.player.x = sim.merchant.x - 14; sim.player.y = sim.merchant.y + 4; });
    r = await until(async () => { const x = await R(); return x.T.shown && x.T.id === 'merchant' ? x : null; }, 4000, 'the merchant pop-up');
    await shot(path.join(OUTDIR, `${name}_20_merchant.png`));
    check('merchant: an arrow points at the merchant', !!r.T.arrow, JSON.stringify(r.T.arrow));
    await wait(1200);
    r = await R(); check('merchant: waits until his screen opens', r.T.id === 'merchant' && !r.merch && !r.gates.merchant);
    const mx = Math.round((r.merchant.x - r.wv.x) * r.S), my = Math.round((r.merchant.y - r.wv.y - 6) * r.S);
    if (process.env.TV) console.log('TAP', mx, my, JSON.stringify(await page.evaluate(([x, y]) => Object.entries(G.qa.hits).filter(([k, h]) => Math.abs(h.x - x) < 60 && Math.abs(h.y - y) < 60), [mx, my])));
    await tapAt(mx, my); await wait(400);
    r = await R(); check('merchant: tapping him opened his screen and finished the step', r.merch && r.gates.merchant === true, JSON.stringify(r.gates));
    await clickHit('merch_close'); await wait(300);
    // Don Montoto's cage
    await page.evaluate(() => { const sim = G.gameScene.sim; sim.cheatCage(); sim.player.x = sim.cage.x - 40; sim.player.y = sim.cage.y; });
    r = await until(async () => { const x = await R(); return x.T.shown && x.T.id === 'cage' ? x : null; }, 4000, 'the cage pop-up');
    await shot(path.join(OUTDIR, `${name}_21_cage.png`));
    check('cage: an arrow points at the cage', !!r.T.arrow, JSON.stringify(r.T.arrow));
    await wait(1200);
    r = await R(); check('cage: waits while the room is not clear and he is not freed', r.T.id === 'cage' && !r.gates.cage);
    for (let k = 0; k < 12; k++) {
      await page.evaluate(() => { const sim = G.gameScene.sim; if (sim.state === 'play' && !sim.roomClear()) sim.cheatSkipPhase(); });
      await wait(250);
      for (let j = 0; j < 6 && (await page.evaluate(() => G.gameScene.sim.state)) === 'levelup'; j++) { await wait(450); await clickHit((await hit('slot_0')) && !(await hit('card_0')) ? 'slot_0' : 'card_0'); await wait(200); }      // the kills level the hero up
    }
    await page.evaluate(() => { const sim = G.gameScene.sim; sim.player.x = sim.cage.x - 10; sim.player.y = sim.cage.y; });
    await wait(300);
    await steer(0, 0);
    if (touch) { const cgx = await page.evaluate(() => { const gs = G.gameScene, c = gs.sim.cage, wv = gs.cameras.main.worldView; return { x: (c.x - wv.x) * G.view.S, y: (c.y - wv.y - 6) * G.view.S }; }); await tapAt(Math.round(cgx.x), Math.round(cgx.y)); }
    else await page.keyboard.press('i');
    await wait(500);
    r = await R(); check('cage: freeing him finished the step', r.rescued === true && r.gates.cage === true && !r.T.shown, JSON.stringify(r.gates) + ' phase ' + r.phase + ' panel ' + r.panel + ' hero ' + JSON.stringify(r.hero) + ' cage ' + JSON.stringify(r.cage) + ' ' + JSON.stringify(await page.evaluate(() => ({ clear: G.gameScene.sim.roomClear(), near: G.gameScene.sim.cageNear(), st: G.gameScene.sim.state, lvl: !!G.hud.level, ch: !!G.hud.choiceL }))));
    const allGates = await page.evaluate(() => G.save.hints.tut.steps);
    check('save: every gate is saved as done', ['city', 'card', 'choice', 'merchant', 'cage'].every(k => allGates[k] === true), JSON.stringify(allGates));
    check('the run was a normal run (no tutorial state, bot-free)', await page.evaluate(() => !G.gameScene.sim.tut && !G.tutorial));

    // ----------------------------------------------------------- settings: pop-ups off, replay (once per config on the first one)
    if (name === 'land_en' || name === 'port_es') {
      await page.evaluate(() => G.toCity());
      await until(async () => (await S()).screen === 'city', 6000, 'back to the city');
      await clickHit('city_set'); await wait(300);
      check('settings: the tutorial pop-ups toggle and REPLAY TUTORIAL are there', !!(await hit('set_hints')) && !!(await hit('set_tutorial')));
      await shot(path.join(OUTDIR, `${name}_22_settings.png`));
      await clickHit('set_hints'); await wait(200);
      let off = await page.evaluate(() => G.save.hints.off);
      check('settings: pop-ups off is saved', off === true);
      await clickHit('set_hints'); await wait(200);
      check('settings: and on again', (await page.evaluate(() => G.save.hints.off)) === false);
      await clickHit('set_tutorial');
      await until(async () => (await S()).screen === 'game', 8000, 'the replayed tutorial');
      const rp = await page.evaluate(() => ({ tut: !!G.gameScene.sim.tut, reward: G.gameScene.sim.tut.reward, state: G.save.hints.tut.state, steps: Object.keys(G.save.hints.tut.steps).length, got: G.save.hints.tut.got }));
      check('settings: REPLAY TUTORIAL starts the room again, resets the flags, gives no second weapon', rp.tut && rp.reward === false && rp.state === 'pending' && rp.steps === 0 && rp.got === true, JSON.stringify(rp));
      await wait(600);
      // skip with confirmation
      await clickHit('tut_skip'); await wait(300);
      const cf = await S();
      check('skip: the SKIP button asks first (game paused)', cf.tut.confirm === true && !!(await hit('tut_skip_no')));
      await shot(path.join(OUTDIR, `${name}_23_skipask.png`));
      await clickHit('tut_skip_no'); await wait(300);
      const cf2 = await S(); check('skip: KEEP GOING goes on with the same step', cf2.tut.confirm === false && cf2.id === 'move' && cf2.tut.shown);
      await clickHit('tut_skip'); await wait(300); await clickHit('tut_skip_yes');
      await until(async () => (await S()).screen === 'city', 8000, 'the city after skipping');
      const sk = await page.evaluate(() => ({ state: G.save.hints.tut.state, w: G.gearOf(G.save, G.cls).equipped.weapon }));
      check('skip: confirmed, the state is saved as skipped and the worn weapon is unchanged', sk.state === 'skipped' && sk.w && !sk.w.unid, JSON.stringify(sk.state));
    }
  } catch (e) {
    check('script ran to the end', false, e.message);
    try { await shot(path.join(OUTDIR, `${name}_error.png`)); const s = await S(); console.log('  state at the error: ' + JSON.stringify(s.tut) + ' id ' + s.id + ' panel ' + s.panel + ' paused ' + (await page.evaluate(() => G.paused))); } catch (e2) { /* ignore */ }
  }
  check('0 console errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  const failed = results.filter(r => !r.ok);
  console.log(`${failed.length ? 'FAIL' : 'ok  '} ${name}: ${results.length - failed.length} of ${results.length} checks (${Math.round((Date.now() - t0) / 1000)} s)`);
  await page.context().close();
  return failed.length;
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CONFIGS);
  const browser = await Q.launch();
  let bad = 0;
  for (const n of names) { if (!CONFIGS[n]) { console.log('unknown config ' + n); bad++; continue; } bad += await run(n, CONFIGS[n], browser); }
  await browser.close();
  console.log(bad ? 'FAILED' : 'all passed');
  process.exit(bad ? 1 : 0);
})();
