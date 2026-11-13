// The interactive tutorial (view side). Each pop-up asks the player to DO something and the next one only comes once they did it.
//   1. The tutorial room (G.tutorial; the sim's director in src/sim/tutorial.js decides when a step is done; this file only shows the step).
//   2. Gated steps outside it, each shown the first time its moment comes and finished by doing it: the city (4 steps), the first level-up
//      card (and the slot to replace), the first after-room choice, the first merchant, Don Montoto's cage.
// State: G.save.hints.tut = { state: 'pending' | 'done' | 'skipped', got, steps: { city, card, choice, merchant, cage } } (src/save.js), and hints.off
// ("Tutorial pop-ups: off") which silences every pop-up and the passive hints. The pop-up never pauses anything; it sits where it covers neither the hero
// nor the thing it points at, and an arrow marks that thing (a world target, or a button of the interface).
(function (G) {
  var UI = G.UI, N = 13;
  var T = G.Tut = { cur: null, L: null, scene: null, box: null, sig: '', pos: 'top', posAt: 0, gfx: null, confirm: null, doneL: null, cityN: 0, arrow: null, shown: false };

  function tut() {
    if (!G.save.hints) G.save.hints = G.cleanHints(null);
    if (!G.save.hints.tut) G.save.hints.tut = G.newTut(false);
    return G.save.hints.tut;
  }
  T.off = function () { return !!(G.save && G.save.hints && G.save.hints.off); };
  T.gate = function (k) { return !!tut().steps[k]; };
  // the very first launch of a fresh save: the tutorial room starts by itself after the class pick (the title's ENTER)
  T.forced = function () { return !!G.save && !T.off() && tut().state === 'pending'; };
  T.active = function () { return !!(T.cur || T.confirm || T.doneL); };
  T.inRoom = function () { return !!(G.tutorial && G.gameScene && G.gameScene.sim && G.gameScene.sim.tut); };

  T.setOff = function (off) {
    G.save.hints.off = !!off;
    if (off) { T.hide(); if (G.Hints) { G.Hints.q = []; G.Hints.hide(); } }
    G.storeSave(G.save);
  };
  // a gated step was finished by doing it
  T.did = function (k) {
    if (T.gate(k)) return;
    tut().steps[k] = true; G.storeSave(G.save);
    if (T.cur && T.cur.gate === k) T.hide();
  };
  // replay: everything is shown again, from the tutorial room on. The weapon is given only once (got).
  T.replay = function () {
    G.resetTut(G.save);
    G.storeSave(G.save);
    T.launch();
  };
  // go to the tutorial room from wherever we are (title, city, the room itself)
  T.launch = function () {
    var g = G.game.scene;
    G.tutorial = true; G.testRoom = false; G.daily = null; G.paused = false;
    G.Panels.close(true); T.hide(); T.cityN = 0;
    ['hud', 'cityhud', 'backdrop', 'city', 'title', 'game'].forEach(function (k) { var sc = g.getScene(k); if (sc && (g.isActive(k) || g.isPaused(k) || g.isSleeping(k))) g.stop(k); });
    g.start('game');
  };
  T.leaveRoom = function () { G.tutorial = false; G.toCity(); };

  // ------------------------------------------------------------ finishing
  T.skipAsk = function (scene) {
    if (T.confirm) return;
    var V = G.view, was = G.paused, mw = Math.min(V.W - 8, 220), self = this, sim = T.inRoom() ? G.gameScene.sim : null;
    T.hideBox(); G.paused = true;
    var m = T.confirm = UI.modal(scene, mw, 96, G.t('tut.skipTitle'));
    m.text(m.x + 8, m.y + 22, G.t('tut.skipText'), 'ui_text').setMaxWidth(mw - 16);
    var bw = Math.floor((mw - 22) / 2);
    m.button(m.x + 8, m.y + 96 - 26, bw, 18, G.t('tut.skipYes'), function () {
      m.destroy(); T.confirm = null;
      if (sim) { sim.tutEnd(false); T.settle(sim, 'skipped'); T.leaveRoom(); }
    }, { name: 'tut_skip_yes', color: 'ui_warn' });
    m.button(m.x + 14 + bw, m.y + 96 - 26, bw, 18, G.t('tut.skipNo'), function () { m.destroy(); T.confirm = null; G.paused = was; }, { name: 'tut_skip_no' });
  };
  // the room is over (done or skipped): the state is saved, the topics it taught need no passive hint any more
  T.settle = function (sim, state) {
    var t = tut(), H = G.save.hints;
    t.state = state;
    if (sim.tut && sim.tut.kept) t.got = true;
    if (state === 'done') { H.seen.unid = true; H.seen.scroll = true; }
    G.storeSave(G.save);
  };
  T.complete = function (scene, e) {
    var sim = G.gameScene.sim, V = G.view, mw = Math.min(V.W - 8, 220);
    T.settle(sim, 'done'); T.hide();
    G.paused = true;
    var m = T.doneL = UI.modal(scene, mw, e.kept ? 104 : 90, G.t('tut.doneTitle'));
    var t1 = m.text(m.x + 8, m.y + 22, G.t('tut.doneText'), 'ui_text').setMaxWidth(mw - 16), y = m.y + 22 + t1.height + 4;
    if (e.kept) { var t2 = m.text(m.x + 8, y, G.t('tut.doneGift'), 'ui_good').setMaxWidth(mw - 16); y += t2.height + 4; }
    m.button(m.x + 8, m.y + m.h - 26, mw - 16, 18, G.t('tut.doneBtn'), function () { m.destroy(); T.doneL = null; T.leaveRoom(); }, { name: 'tut_done', color: 'ui_warn' });
  };

  // ------------------------------------------------------------ which step is on
  function hasKey(k) { return G.LANG.en[k] !== undefined; }
  function txt(base, extra) { var k = 'tut.' + base; if (G.touch && hasKey(k + 'T')) k += 'T'; return G.t(k, extra); }
  function ui(name) { var h = G.qa.hits[name]; return h ? { ui: true, x: h.x / G.view.S, y: h.y / G.view.S } : null; }
  function gameCam(scene) { return scene.game_ ? scene.game_.cameras.main : null; }

  // the tutorial room: the sim says which step it is on
  function roomStep(scene, sim) {
    var t = sim.tut, id = sim.tutId(), P = G.Panels;
    if (t.done) return null;
    var base = id === 'skill' && t.sub ? 'skill2' : id, over = id === 'bag' || id === 'identify' || id === 'equip';
    var s = { id: 'room.' + base, n: t.step + 1, of: N, room: true, over: over, params: { skill: G.skillLabel(sim.clsId).toUpperCase(), btn: G.t(id === 'equip' ? 'inv.equip' : 'inv.identify') } };
    s.text = function () { return txt(base, s.params); };
    s.target = function () {
      var w = sim.tutTarget(), item = t.item, i;
      if (id === 'skill' && G.touch) return t.sub ? null : ui('tpulse');
      if (id === 'dodge' && G.touch) return ui('tdodge');
      if (id === 'bag') return ui('inv');
      if ((id === 'identify' || id === 'equip')) {
        if (P.current !== 'inventory') return ui('inv');
        i = sim.bag.indexOf(item);
        var sel = P.sel && P.sel.kind === 'sbag' && sim.bag[P.sel.key] === item;
        return sel ? ui(id === 'equip' ? 'equip' : 'identify') : ui('sbag_' + i);
      }
      return w ? { world: true, x: w.x, y: w.y } : null;
    };
    return s;
  }

  // gated steps in a run: the first level-up, the first door choice, the first merchant, Don Montoto's cage
  function runStep(scene, sim) {
    var gs = scene.game_;
    if (gs.bot || sim.testRoom >= 0 || sim.daily || G.daily) return null;
    if (!T.gate('card') && sim.state === 'levelup' && scene.level) {
      var slot = scene.pickCard >= 0;
      return { id: 'card.' + slot, gate: 'card', over: true, text: function () { return txt(slot ? 'slot' : 'card'); }, target: function () { return null; } };
    }
    if (!T.gate('choice') && sim.state === 'choice' && scene.choiceL) return { id: 'choice', gate: 'choice', over: true, text: function () { return txt('choice'); }, target: function () { return null; } };
    var p = sim.player, m = sim.merchant, c = sim.cage;
    if (!T.gate('merchant') && m && sim.state === 'play' && Math.abs(m.x - p.x) < 70 && Math.abs(m.y - p.y) < 70) {
      return { id: 'merchant', gate: 'merchant', text: function () { return txt('merchant'); }, target: function () { return { world: true, x: m.x, y: m.y - 22 }; } };
    }
    if (!T.gate('cage') && c && sim.state === 'play') {
      var cam = gameCam(scene), wv = cam && cam.worldView;
      if (wv && c.x > wv.x && c.x < wv.x + wv.width && c.y > wv.y && c.y < wv.y + wv.height) {
        return { id: 'cage', gate: 'cage', text: function () { return txt('cage'); }, target: function () { return { world: true, x: c.x, y: c.y - 24 }; } };
      }
    }
    return null;
  }

  // the city, first visit: walk to the Blacksmith, open his shop, walk to the Trainer, walk into the portal
  function cityStep(scene) {
    var c = G.city, P = G.Panels;
    if (!c || T.gate('city') || c.entering) return null;
    var near = c.near && c.near.s.id, n = T.cityN;
    if (n === 0 && near === 'smith') n = 1;
    if (n === 1 && P.current === 'shop' && P.shop.who === 'smith') n = 2;
    if (n === 2 && near === 'trainer') n = 3;
    T.cityN = n;
    var spot = ['smith', 'smith', 'trainer', null][n];
    var s = { id: 'city.' + n, gate: 'city', n: n + 1, of: 4, text: function () { return txt('city' + (n + 1), { btn: G.t('city.talk') }); } };
    s.target = function () {
      if (n === 1 && P.current) return null;
      if (n === 3) return c.pointAt('portal');
      if (n === 1 && c.near && c.near.s.id === 'smith' && G.touch) return ui('city_talk');
      return c.pointAt(spot);
    };
    return s;
  }

  T.resolve = function (scene) {
    if (!G.save || T.off()) return null;
    var key = scene.scene.key;
    if (key === 'hud') {
      var sim = scene.game_.sim;
      return sim.tut ? roomStep(scene, sim) : runStep(scene, sim);
    }
    if (key === 'cityhud') return cityStep(scene);
    return null;
  };

  // ------------------------------------------------------------ drawing
  T.attach = function (scene) {
    T.hide(); T.scene = scene; T.sig = '';
  };
  T.hideBox = function () {
    if (T.L) { T.L.destroy(); T.L = null; }
    if (T.gfx) { T.gfx.destroy(); T.gfx = null; }
    delete G.qa.hits.tut; delete G.qa.hits.tut_skip; T.box = null; T.shown = false;
  };
  T.hide = function () { T.hideBox(); T.cur = null; T.sig = ''; };

  function rectOverlap(a, b, m) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + m * 2, h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + m * 2;
    return w > 0 && h > 0 ? w * h : 0;
  }
  // screen (art px) of a world point, in the game or the city camera
  function toScreen(scene, x, y) {
    var cam = scene.scene.key === 'hud' ? gameCam(scene) : (G.city && G.city.cameras.main);
    if (!cam) return { x: x, y: y };
    return { x: x - cam.worldView.x, y: y - cam.worldView.y };
  }
  function heroScreen(scene) {
    if (scene.scene.key === 'hud') { var p = scene.game_.sim.player, s = toScreen(scene, p.x, p.y); return { x: s.x - 9, y: s.y - 22, w: 18, h: 30 }; }
    var c = G.city; if (!c) return null; var q = toScreen(scene, c.px, c.py); return { x: q.x - 9, y: q.y - 22, w: 18, h: 26 };
  }
  // the box the pop-up must keep clear of: the thing it points at (a ring around the target and its arrow)
  function targetBox(scene, tg) {
    if (!tg) return null;
    if (tg.ui) return { x: tg.x - 14, y: tg.y - 14, w: 28, h: 28 };
    var s = toScreen(scene, tg.x, tg.y);
    return { x: s.x - 12, y: s.y - 24, w: 24, h: 40 };
  }

  // where the pop-up goes: a free band beside an open modal, else the top or the bottom strip, whichever covers the hero and the target less
  function place(scene, step, w, ph, tg) {
    var V = G.view, inCity = scene.scene.key === 'cityhud', modal = null, i, k;
    var ms = [G.Panels.L, scene.level, scene.choiceL, scene.merchL];
    for (i = 0; i < ms.length; i++) if (ms[i] && ms[i].w) { modal = ms[i]; break; }
    if (step.over && modal) {
      var above = modal.y, below = V.H - (modal.y + modal.h);
      var x = Math.round((V.W - w) / 2), y = above >= below ? Math.max(2, Math.floor((above - ph) / 2)) : modal.y + modal.h + Math.max(2, Math.floor((below - ph) / 2));
      if (Math.max(above, below) < ph + 2) y = 2;      // no free band (a very small screen): over the top of the panel
      return { x: x, y: y, w: w, pos: 'band', free: Math.max(above, below) };
    }
    var hero = heroScreen(scene), tb = targetBox(scene, tg), best = null, bo = 1e12;
    var topY = inCity ? 34 : (G.hud && G.hud.obj ? G.hud.obj.y + 30 : 34) + 2;
    var botY = V.H - ph - (inCity ? (V.W >= 300 ? 36 : 36) : 6);
    var bw = w;
    if (G.touch && !inCity) bw = Math.min(w, V.W - 92);      // the dodge and skill buttons sit at the bottom right
    var cands = [{ pos: 'top', x: Math.round((V.W - Math.min(w, V.W - (inCity ? 70 : 8))) / 2), y: topY, w: Math.min(w, V.W - (inCity ? 70 : 8)) }, { pos: 'bottom', x: G.touch && !inCity ? 4 : Math.round((V.W - bw) / 2), y: botY, w: bw }];
    for (k = 0; k < cands.length; k++) {
      var c = cands[k], r = { x: c.x, y: c.y, w: c.w, h: ph }, o = 0;
      if (hero) o += rectOverlap(r, hero, 4) * 3;
      if (tb) o += rectOverlap(r, tb, 3) * 3;
      if (c.pos === T.pos) o -= 40;      // keep where it is unless the other place is clearly better (no flicker)
      if (o < bo) { bo = o; best = c; }
    }
    return best;
  }

  // The pop-up: the text on the left, the counter and SKIP on the right. Beside a big panel in a short view (the bag in 960x540 leaves 35 px above and below it)
  // a compact one-row form is used: counter, text, SKIP, all vertically centred.
  function build(scene, step, tg) {
    T.hideBox();
    var V = G.view, text = step.text(), compact = false, w = Math.min(V.W - 8, 256), right = 46, ph, th, at, probe;
    function measure() {
      if (compact) w = Math.min(V.W - 8, 380);
      var tw = compact ? w - 14 - 36 - 34 : w - 14 - right;
      probe = UI.text(scene, 0, 0, text, 'ui_text').setMaxWidth(tw); th = probe.height; probe.destroy();
      ph = compact ? Math.max(th + 10, 24) : Math.max(th + 12, 34);
      at = place(scene, step, w, ph, tg);
    }
    measure();
    if (at.pos === 'band' && at.free < ph + 2) { compact = true; measure(); }
    T.pos = at.pos === 'band' ? T.pos : at.pos;
    var L = T.L = UI.layer(scene, 2600), lab = G.t('tut.skip'), sw = Math.max(36, lab.length * 6 + 10);
    L.panel(at.x, at.y, at.w, ph, 'plate', 0);
    if (compact) {
      var cx0 = at.x + 6;
      if (step.n) { L.text(cx0, at.y + Math.round((ph - 7) / 2), step.n + '/' + step.of, 'ui_dim'); cx0 += 34; }
      L.text(cx0, at.y + Math.round((ph - th) / 2), text, 'ui_text').setMaxWidth(at.w - 14 - 36 - 34 + (step.n ? 0 : 34));
      L.button(at.x + at.w - 5 - sw, at.y + Math.round((ph - 14) / 2), sw, 14, lab, function () { T.skipAsk(scene); }, { name: 'tut_skip' });
    } else {
      L.text(at.x + 6, at.y + 6, text, 'ui_text').setMaxWidth(at.w - 14 - right);
      if (step.n) { var ct = L.text(0, at.y + 5, step.n + '/' + step.of, 'ui_dim'); ct.x = at.x + at.w - 6 - ct.width; }
      L.button(at.x + at.w - 5 - sw, at.y + ph - 5 - 14, sw, 14, lab, function () { T.skipAsk(scene); }, { name: 'tut_skip' });
    }
    UI.hit('tut', at.x, at.y, at.w, ph);
    T.box = { x: at.x, y: at.y, w: at.w, h: ph };
    T.gfx = scene.add.graphics().setDepth(2599);
    T.shown = true; T.posAt = scene.time.now;
  }

  // the arrow: above a world target, or on the screen edge pointing at it when it is off screen; beside a button of the interface
  function drawArrow(scene, tg, frame) {
    var g = T.gfx, V = G.view;
    if (!g) return;
    g.clear();
    T.arrow = null;
    if (!tg) return;
    var bob = Math.round(Math.sin(frame / 7) * 2), top = (scene.scene.key === 'hud' && G.hud && G.hud.obj ? G.hud.obj.y + 34 : 36), m = 10;
    function tri(tx, ty, ang, sz) {
      var ca = Math.cos(ang), sa = Math.sin(ang);
      function P(a, b) { return [Math.round(tx + a * ca - b * sa), Math.round(ty + a * sa + b * ca)]; }
      var p0 = P(0, 0), p1 = P(-sz * 1.15, -sz * 0.75), p2 = P(-sz * 1.15, sz * 0.75), q1 = P(1, 0), q2 = P(-sz * 1.15 - 2, -sz * 0.75 - 2), q3 = P(-sz * 1.15 - 2, sz * 0.75 + 2);
      g.fillStyle(UI.hex('outline'), 1); g.fillTriangle(q1[0], q1[1], q2[0], q2[1], q3[0], q3[1]);
      g.fillStyle(UI.hex('ui_warn'), 1); g.fillTriangle(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]);
    }
    if (tg.ui) {      // beside the button, on the side facing the middle of the screen, pointing at it
      var dx = V.W / 2 - tg.x, dy = V.H / 2 - tg.y, l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, d = 20 + bob;
      tri(tg.x + ux * (d - 6), tg.y + uy * (d - 6), Math.atan2(-uy, -ux), 7);
      T.arrow = { x: tg.x + ux * d, y: tg.y + uy * d, ui: true };
      return;
    }
    var s = toScreen(scene, tg.x, tg.y);
    if (s.x >= m && s.x <= V.W - m && s.y >= top && s.y <= V.H - m) {
      tri(s.x, s.y - 4 + bob, Math.PI / 2, 7);      // pointing down at it
      T.arrow = { x: s.x, y: s.y - 10 + bob, tx: s.x, ty: s.y };
    } else {
      var cx = V.W / 2, cy = (top + V.H - m) / 2, ex = s.x - cx, ey = s.y - cy;
      var k = Math.min(ex ? (ex > 0 ? V.W - m - cx : cx - m) / Math.abs(ex) : 1e9, ey ? (ey > 0 ? V.H - m - cy : cy - top) / Math.abs(ey) : 1e9);
      tri(cx + ex * k, cy + ey * k, Math.atan2(ey, ex), 7);
      T.arrow = { x: cx + ex * k, y: cy + ey * k, edge: true };
    }
  }

  T.tick = function (scene) {
    if (T.scene !== scene || !G.save) return;
    var step = T.confirm || T.doneL ? null : T.resolve(scene), P = G.Panels;
    var sig = step ? step.id + '|' + G.lang + '|' + (G.touch ? 1 : 0) + '|' + G.view.W + 'x' + G.view.H + '|' + step.text() : '';
    if (sig !== T.sig) {
      T.sig = sig; T.cur = step;
      if (!step) { T.hideBox(); return; }
      T.hideBox();
    } else if (step) T.cur = step;
    if (!step) return;
    // a panel that is not the step's own hides it (settings, a shop...): it comes back when the panel closes
    var modalOpen = !!(P.current || scene.level || scene.choiceL || scene.merchL);
    var okOpen = step.over ? (!P.current || P.current === 'inventory') : !modalOpen;
    if (!okOpen) { if (T.L) T.hideBox(); return; }
    var tg = step.target();
    if (!T.L) build(scene, step, tg);
    else if (scene.time.now - T.posAt > 400) {      // look again where the pop-up is best placed (the hero and the target move)
      T.posAt = scene.time.now;
      var tmp = place(scene, step, T.box.w, T.box.h, tg);
      if (tmp.pos !== 'band' && tmp.pos !== T.pos) { T.pos = tmp.pos; build(scene, step, tg); }
      else if (step.over && (Math.abs(tmp.y - T.box.y) > 1)) build(scene, step, tg);
    }
    var f = scene.scene.key === 'hud' ? scene.game_.frame : (G.city ? G.city.frame : 0);
    drawArrow(scene, tg, f);
  };

  // QA: what is on screen right now
  T.snapshot = function () {
    var c = T.cur;
    return { id: c ? c.id : null, n: c ? c.n || 0 : 0, of: c ? c.of || 0 : 0, text: c && T.L ? c.text() : null, shown: !!T.L, box: T.box, arrow: T.arrow, pos: T.pos, state: G.save ? tut().state : null, gates: G.save ? Object.assign({}, tut().steps) : null, cityN: T.cityN, confirm: !!T.confirm, done: !!T.doneL };
  };
})(globalThis.G = globalThis.G || {});
