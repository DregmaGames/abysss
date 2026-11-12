// First-time guidance (step UX): short contextual hints, each shown once per save, dismissed by a tap or after a few seconds.
// The interactive tutorial (src/view/tutorial.js) took over everything that asks the player to act; these four only explain.
// They never pause anything. The table is data: id, trigger, text key (and a touch variant, a position, a time).
// Triggers are fired with G.Hints.on(trigger, alt) from the HUD, the city and the game; `alt` picks the row's `alt` text when it has one.
// State: G.save.hints = { off, seen: { id: true } } (settings: Hints on/off, Reset hints). The sim never sees any of it.
(function (G) {
  var UI = G.UI;
  var SEC = 6.5;      // seconds a hint stays when nobody taps it
  // The hints that are not actions stay here. What the tutorial teaches (moving, cracks, the super fissure, the chest, the exit, level-ups, the door choice,
  // the merchant, the cage, the city's first visit) is now a step in src/view/tutorial.js and has no hint.
  G.HINTS = [
    { id: 'unid', trig: 'run.unid', text: 'hint.unid' },
    { id: 'scroll', trig: 'run.scroll', text: 'hint.scroll' },
    { id: 'gold', trig: 'run.gold', text: 'hint.gold' },
    { id: 'montoto', trig: 'city.near.montoto', text: 'hint.montoto', alt: 'hint.montotoEmpty' }
  ];

  var H = G.Hints = { q: [], cur: null, scene: null, L: null };
  function st() { if (!G.save.hints) G.save.hints = G.cleanHints(null); return G.save.hints; }
  H.enabled = function () {
    var gs = G.gameScene, inRun = G.screen !== 'title' && G.screen !== 'city';
    if (st().off || (G.Tut && (G.Tut.active() || G.tutorial))) return false;      // never under a tutorial pop-up or in the tutorial room
    if (inRun && gs && gs.sim && (gs.sim.testRoom >= 0 || gs.bot)) return false;      // not in the test room, not while the QA bot plays
    return true;
  };
  H.on = function (trig, alt) {
    if (!G.save || !H.enabled()) return;
    var seen = st().seen;
    G.HINTS.forEach(function (h) {
      if (h.trig !== trig || seen[h.id] || (H.cur && H.cur.h === h) || H.q.some(function (r) { return r.h === h; })) return;
      if (H.q.length >= 4) return;      // an old hint that was never shown can fire again later
      H.q.push({ h: h, alt: !!alt && !!h.alt });
    });
  };
  H.seenOf = function (id) { return !!st().seen[id]; };
  H.setOff = function (off) { st().off = !!off; if (off) { H.q = []; H.hide(); } G.storeSave(G.save); };
  H.reset = function () { st().seen = {}; H.q = []; H.hide(); G.storeSave(G.save); };

  // a scene (HUD or city overlay) builds its layer: draw the current hint again, or drop everything left from another scene
  H.attach = function (scene) {
    if (H.scene !== scene) { H.q = []; H.cur = null; }
    H.scene = scene;
    if (H.L) { H.L.destroy(); H.L = null; }
    if (H.cur) H.draw();
  };
  H.hide = function () { delete G.qa.hits.hint; if (H.L) { H.L.destroy(); H.L = null; } H.cur = null; };
  H.tick = function (scene) {
    if (H.scene !== scene) return;
    var now = scene.time.now;
    // a panel (settings, inventory, shop...) is open: keep the hint off screen and its clock paused
    if (G.Panels && G.Panels.current) {
      if (H.L) { H.L.destroy(); H.L = null; delete G.qa.hits.hint; }
      if (H.cur) H.cur.until = Math.max(H.cur.until, now + 1500);
      return;
    }
    if (H.cur && !H.L) H.draw();
    if (H.cur && now >= H.cur.until) H.hide();
    if (!H.cur && H.q.length) {
      if (!H.enabled()) { H.q = []; return; }
      var r = H.q.shift(), h = r.h;
      st().seen[h.id] = true; G.storeSave(G.save);
      if (h.id === 'blocked') st().seen.crack = true;      // blocked by a crack says it better than seeing one
      H.cur = { h: h, alt: r.alt, until: now + (h.sec || SEC) * 1000 };
      H.draw();
    }
  };
  H.draw = function () {
    var scene = H.scene, c = H.cur, h = c.h, V = G.view, inCity = G.screen === 'city' || scene.scene.key === 'cityhud';
    if (!scene || !scene.sys || !scene.sys.isActive()) return;
    var key = c.alt ? h.alt : (G.touch && h.touch ? h.touch : h.text);
    var L = H.L = UI.layer(scene, 2600);
    var w = Math.min(V.W - 16, inCity && V.W >= 300 ? 300 : 232), probe = UI.text(scene, 0, 0, G.t(key), 'ui_text').setMaxWidth(w - 12), th = probe.height;
    probe.destroy();
    var ph = th + 12, x = Math.round((V.W - w) / 2), y;
    if (h.pos === 'bottom' || (inCity && V.W < 300)) y = V.H - ph - (inCity ? 54 : 6);
    else y = (inCity ? 6 : (G.hud && G.hud.obj ? G.hud.obj.y + 30 : 34)) + 3;
    L.panel(x, y, w, ph, 'plate', 0);
    L.text(x + 6, y + 6, G.t(key), 'ui_text').setMaxWidth(w - 12);
    var hit = scene.add.image(x, y, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(w, ph).setAlpha(0.01);
    hit._dz = 3; hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', function () { H.hide(); });
    L.add(hit);
    UI.hit('hint', x, y, w, ph);
    H.box = { x: x, y: y, w: w, h: ph };
  };
})(globalThis.G = globalThis.G || {});
