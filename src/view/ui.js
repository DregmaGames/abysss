// UI toolkit. The whole game is drawn at ONE integer pixel scale S (G.view.S): world and UI
// share it, so there is a single pixel size on screen. Layouts are computed in art pixels
// from G.view.W x G.view.H and re-run on resize / rotation / zoom change.
//   960x540 landscape -> S=2, 480x270 art px        540x960 portrait -> S=2, 270x480 art px
//   1640x922 -> S=2, 820x461 art px                 1920x1080 -> S=2, 960x540 art px (the far default, G.computeView)
// The zoom setting moves S (never below what fits): layouts must hold from 320x180 / 180x320 up to 960x540 and more.
(function (G) {
  G.qa = { hits: {}, errors: [] };     // QA hooks: named control positions, uncaught errors
  var UI = G.UI = {
    PAD: 4,
    hex: function (key) { return parseInt(G_ASSETS.palette[key].slice(1), 16); },
    rgb: function (key) { var v = UI.hex(key); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; },
    RARITY: ['r_common', 'r_magic', 'r_rare', 'r_epic', 'r_legend'],
    // every (text colour, background) pair the HUD and panels use; checked by tools/contrast.js
    TEXT_PAIRS: [['ui_text', 'ui_bg'], ['ui_dim', 'ui_bg'], ['ui_warn', 'ui_bg'], ['ui_good', 'ui_bg'], ['ui_bad', 'ui_bg'],
      ['r_common', 'ui_bg'], ['r_magic', 'ui_bg'], ['r_rare', 'ui_bg'], ['r_epic', 'ui_bg'], ['r_legend', 'ui_bg'],
      ['ui_text', 'ui_bg2'], ['ui_dim', 'ui_bg2'], ['ui_warn', 'ui_bg2'], ['ui_good', 'ui_bg2'], ['ui_bad', 'ui_bg2'],
      ['r_common', 'ui_bg2'], ['r_magic', 'ui_bg2'], ['r_rare', 'ui_bg2'], ['r_epic', 'ui_bg2'], ['r_legend', 'ui_bg2'],
      ['ui_text', 'wb1'], ['ui_text', 'outline'], ['ui_dim', 'outline'], ['ui_warn', 'outline'], ['ui_bad', 'outline'],
      ['ui_good', 'outline'], ['ui_text', 'hp_d'], ['ui_text', 'hp'],
      // family names on cards and panels (BAL.families.<id>.text)
      ['em3', 'ui_bg'], ['orb', 'ui_bg'], ['gold', 'ui_bg'], ['iron3', 'ui_bg'], ['rg3', 'ui_bg'],
      ['em3', 'ui_bg2'], ['orb', 'ui_bg2'], ['gold', 'ui_bg2'], ['r_epic', 'ui_bg2'], ['iron3', 'ui_bg2'], ['rg3', 'ui_bg2']]
  };

  // Pixel scale and art-pixel viewport for a canvas of w x h CSS pixels.
  // Default scale (step big rooms): on a big screen the view is FAR, about twice as much world as before, so a room of
  // BAL.room size fills a desktop window and the hero stays small (S=2 on a 922-1080 px high window). Small screens keep
  // the old, closer default (short side / 240). The zoom setting is an offset from this default; its range:
  //   lo   = the smallest S that still shows at most VIEW.maxArt art px on the short side (below that the room is an
  //          island again and the 7 px font is unreadable), never under default - 2;
  //   maxS = short side / 180 (panels need 180 art px).
  // short side 300 -> 1 | 390, 540, 720, 922, 1080 -> 2 | 1440 -> 3 (HD sprites are uneven at odd S, see STATUS).
  UI.VIEW = { near: 240, far: 470, farMin: 2, tight: 180, maxArt: 720 };
  G.oldViewBase = function (w, h) { return Math.max(1, Math.round(Math.min(w, h) / UI.VIEW.near)); };      // the default before this step
  G.computeView = function (w, h, zoom) {
    var Q = UI.VIEW, min = Math.min(w, h), near = G.oldViewBase(w, h);
    var base = Math.min(near, Math.max(Q.farMin, Math.round(min / Q.far)));
    var maxS = Math.max(base, Math.floor(min / Q.tight));
    var lo = Math.min(base, Math.max(1, base - 2, Math.ceil(min / Q.maxArt)));
    var z = isFinite(zoom) ? Math.round(zoom) : 0;
    var S = Math.max(lo, Math.min(maxS, base + z));
    return { S: S, W: Math.ceil(w / S), H: Math.ceil(h / S), portrait: h > w, base: base, lo: lo, maxS: maxS, steps: maxS - lo + 1 };
  };
  // A save from before the far default (settings.zoomRule missing): its zoom offset counted from the old, closer default.
  // A player who had moved the slider keeps the scale S they chose on this screen (the user's -2 on a 922 px window stays
  // S=2 instead of dropping below the new range); a save that never touched it (0) takes the new default.
  G.migrateZoom = function (set, w, h) {
    if (set.zoomRule >= 2) return false;
    var z = isFinite(set.zoom) ? Math.round(set.zoom) : 0;
    if (z) {
      var min = Math.min(w, h), near = G.oldViewBase(w, h), oldLo = Math.max(1, near - 2), oldMax = Math.max(near, Math.floor(min / UI.VIEW.tight));
      var S = Math.max(oldLo, Math.min(oldMax, near + z)), V = G.computeView(w, h, 0);
      z = Math.max(V.lo, Math.min(V.maxS, S)) - V.base;
    }
    set.zoom = z; set.zoomRule = 2;
    return true;
  };

  UI.registerFonts = function (scene) {
    var meta = G_ASSETS.fontJson;
    ['font', 'fontbig', 'fontbold'].forEach(function (key) {
      var m = meta[key];
      if (!m) return;
      m = meta[key];
      var data = { font: key, size: m.size, lineHeight: m.lineHeight, retroFont: true, chars: {} };
      Object.keys(m.chars).forEach(function (code) {
        var c = m.chars[code];
        data.chars[code] = { x: c[0], y: c[1], width: c[2], height: c[3], centerX: c[2] >> 1, centerY: c[3] >> 1,
          xOffset: c[4], yOffset: c[5], xAdvance: c[6], data: {}, kerning: {},
          u0: c[0] / meta.w, v0: c[1] / meta.h, u1: (c[0] + c[2]) / meta.w, v1: (c[1] + c[3]) / meta.h };
      });
      scene.cache.bitmapFont.add(key, { data: data, texture: 'font', frame: null });
    });
  };

  // UI scenes: origin top-left, zoomed by S, so object coordinates are art pixels.
  UI.camera = function (scene) { scene.cameras.main.setOrigin(0, 0).setZoom(G.view.S).setScroll(0, 0); };

  UI.text = function (scene, x, y, str, color, big) {
    var t = scene.add.bitmapText(Math.round(x), Math.round(y), big === 'bold' ? 'fontbold' : big ? 'fontbig' : 'font', str);
    t.setTint(UI.hex(color || 'ui_text'));
    return t;
  };
  UI.centerX = function (t, cx) { t.x = Math.round(cx - t.width / 2); return t; };

  UI.panel = function (scene, x, y, w, h, key) {
    return scene.add.nineslice(Math.round(x), Math.round(y), 'atlas', key || 'panel', w, h, 4, 4, 4, 4).setOrigin(0, 0);
  };
  UI.bar = function (scene, x, y, w, h, color) {
    return scene.add.image(x, y, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(Math.max(0.01, w), h).setTint(UI.hex(color));
  };

  // QA hook: screen position (CSS px) of a named control, so tests click what a player would
  UI.hit = function (name, x, y, w, h) {
    G.qa.hits[name] = { x: Math.round((x + w / 2) * G.view.S), y: Math.round((y + h / 2) * G.view.S) };
  };

  UI.FINGER = 44;      // CSS px: the smallest side of a button's hit box once a touch has been seen
  // Button. A list `into` collects every object it creates so the owner can destroy them.
  UI.RAISED = /[\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00dc]/;
  UI.button = function (scene, x, y, w, h, label, onClick, opts) {
    opts = opts || {};
    x = Math.round(x); y = Math.round(y);
    // opts.main: the gold call-to-action frame; opts.bold: the bold font (main buttons use it too)
    var F0 = opts.main ? 'btn_main' : 'btn', F1 = opts.main ? 'btn_main_hot' : 'btn_hot';
    var bg = UI.panel(scene, x, y, w, h, F0);
    var t = UI.text(scene, 0, 0, label || '', opts.color, opts.main || opts.bold ? 'bold' : false);
    var icon = opts.icon ? scene.add.image(x + (w >> 1), y + (h >> 1), 'atlas', opts.icon) : null;
    var b = { bg: bg, t: t, icon: icon, enabled: true, x: x, y: y, w: w, h: h, objs: icon ? [bg, t, icon] : [bg, t] };
    b.setLabel = function (s, color) {
      t.setText(s); if (color) t.setTint(UI.hex(color));
      // accented capitals (Ñ, Á...) rise 2 px over the line: move the label down so the mark clears the frame
      var ty = Math.round((h - 7) / 2) - 1;
      if (UI.RAISED.test(s)) ty += Math.max(0, Math.min(4 - ty, h - 10 - ty));
      t.setPosition(x + Math.round((w - t.width) / 2), y + ty); b.ty = y + ty;
    };
    b.setEnabled = function (on) { b.enabled = on; b.objs.forEach(function (o) { o.setAlpha(on ? 1 : 0.4); }); };
    b.setVisible = function (on) { b.objs.forEach(function (o) { o.setVisible(on); }); if (on) bg.setInteractive(); else bg.disableInteractive(); };
    b.setDepth = function (d) { bg.setDepth(d); t.setDepth(d + 1); if (icon) icon.setDepth(d + 1); return b; };
    b.click = function () { if (b.enabled && bg.visible) onClick(); };
    b.destroy = function () { b.objs.forEach(function (o) { o.destroy(); }); };
    b.setLabel(label || '');
    // touch: a finger needs about FINGER CSS px. A smaller button keeps its look and gets a hit box that reaches out around it.
    var need = G.finger || G.touch ? Math.ceil(UI.FINGER / G.view.S) : 0, ex = Math.max(0, Math.ceil((need - w) / 2)), ey = Math.max(0, Math.ceil((need - h) / 2));
    bg.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-ex, -ey, w + 2 * ex, h + 2 * ey), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    var back = opts.icon === 'i_close' || /(^|_)(close|back|resume)/.test(opts.name || '');
    bg.on('pointerover', function () { if (b.enabled) { bg.setFrame(F1); if (!G.finger) G.audio.ui('hover'); } });
    bg.on('pointerout', function () { bg.setFrame(F0); t.y = b.ty; });
    bg.on('pointerup', function () { t.y = b.ty; });      // pressed (pointerdown below): the label sinks a px
    bg.on('pointerdown', function (p) { if (p.rightButtonDown()) return; if (b.enabled) t.y = b.ty + 1; var live = b.enabled && bg.visible; b.click(); if (live) G.audio.ui(back ? 'back' : 'click'); });
    if (opts.name) UI.hit(opts.name, x, y, w, h);
    return b;
  };

  // A layer of objects with a common base depth; destroy() removes them all.
  UI.layer = function (scene, depth) {
    var L = { scene: scene, depth: depth || 0, objs: [], buttons: [] };
    L.add = function (o) { if (o.setDepth) o.setDepth(L.depth + (o._dz || 0)); L.objs.push(o); return o; };
    L.text = function (x, y, str, color, big) { var t = UI.text(scene, x, y, str, color, big); t._dz = 2; return L.add(t); };
    L.image = function (x, y, frame, dz) { var i = scene.add.image(Math.round(x), Math.round(y), 'atlas', frame); i._dz = dz == null ? 2 : dz; return L.add(i); };
    L.panel = function (x, y, w, h, key, dz) { var p = UI.panel(scene, x, y, w, h, key); p._dz = dz || 0; return L.add(p); };
    L.bar = function (x, y, w, h, color, dz) { var b = UI.bar(scene, x, y, w, h, color); b._dz = dz == null ? 1 : dz; return L.add(b); };
    L.button = function (x, y, w, h, label, fn, opts) {
      var b = UI.button(scene, x, y, w, h, label, fn, opts);
      b.setDepth(L.depth + 1);
      b.objs.forEach(function (o) { L.objs.push(o); });
      L.buttons.push(b);
      return b;
    };
    L.destroy = function () { L.objs.forEach(function (o) { o.destroy(); }); L.objs.length = 0; L.buttons.length = 0; };
    return L;
  };

  // Modal: dim overlay that swallows clicks + a centred panel, sized to fit the current view.
  UI.modal = function (scene, w, h, title) {
    var V = G.view, L = UI.layer(scene, 2000);
    w = Math.min(w, V.W - 8); h = Math.min(h, V.H - 8);
    var ov = L.add(scene.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(V.W, V.H).setTint(UI.hex('void')).setAlpha(0.74));
    ov.setInteractive();
    L.x = Math.round((V.W - w) / 2); L.y = Math.round((V.H - h) / 2); L.w = w; L.h = h;
    L.panel(L.x, L.y, w, h, 'panel', 0.5);
    if (title) L.text(L.x + 7, L.y + 6, title, 'ui_warn');
    return L;
  };

  // Slider with discrete steps. onChange(index) fires live (tap, drag, set); onCommit(index) once when the gesture ends (pointer up)
  // or on set(k, true): use it for changes that rebuild the screen (zoom, language), so a drag is never cut by a rebuild.
  // Tapping anywhere on the track picks the nearest step; dragging keeps working when the pointer leaves the track (mouse and touch).
  UI.slider = function (L, x, y, w, steps, index, onChange, name, onCommit) {
    var scene = L.scene, s = { index: index }, i;
    L.bar(x, y + 6, w, 3, 'ui_bg2');
    var fill = L.bar(x, y + 6, 1, 3, 'ui_hi', 1.2);
    function tickX(k) { return Math.round(x + (steps === 1 ? 0 : k * (w - 1) / (steps - 1))); }
    for (i = 0; i < steps; i++) L.bar(tickX(i), y + 4, 1, 7, 'ui_dim', 1.1);
    var knob = L.image(x, y + 7, 'knob', 3);
    var zone = L.add(scene.add.zone(x - 5, y - 5, w + 10, 22).setOrigin(0, 0));
    zone._dz = 4; zone.setDepth(L.depth + 4);
    zone.setInteractive({ useHandCursor: true });
    function place() { var kx = tickX(s.index); knob.x = kx; fill.setDisplaySize(Math.max(0.01, kx - x), 3); }
    function stepAt(p) {
      var ax = p.x / G.view.S, k = steps === 1 ? 0 : Math.round((ax - x) / (w - 1) * (steps - 1));
      return Math.max(0, Math.min(steps - 1, k));
    }
    function move(p) { var k = stepAt(p); if (k !== s.index) { s.index = k; place(); onChange(k); } }
    zone.on('pointerdown', function (p) {
      move(p);
      var id = p.id;
      function mv(q) { if (q.id === id && zone.active) move(q); }
      function up(q) {
        if (q.id !== id) return;
        scene.input.off('pointermove', mv); scene.input.off('pointerup', up); scene.input.off('pointerupoutside', up);
        if (zone.active && onCommit) onCommit(s.index);
      }
      scene.input.on('pointermove', mv); scene.input.on('pointerup', up); scene.input.on('pointerupoutside', up);
    });
    s.set = function (k, commit) {
      k = Math.max(0, Math.min(steps - 1, k));
      if (k !== s.index) { s.index = k; place(); onChange(k); if (commit && onCommit) onCommit(k); }
    };
    place();
    if (name) for (i = 0; i < steps; i++) UI.hit(name + '_' + i, tickX(i) - 1, y + 6, 2, 2);
    return s;
  };

  // WCAG contrast ratio between two palette colours (used by the HUD contrast check).
  UI.contrast = function (a, b) {
    function lum(key) {
      var ch = UI.rgb(key).map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  // Vignette, generated for the current view size (ordered dither, same pixel size as the art).
  UI.vignette = function (scene) {
    var V = G.view, key = 'vignette', B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    if (scene.textures.exists(key)) scene.textures.remove(key);
    var tex = scene.textures.createCanvas(key, V.W, V.H), ctx = tex.getContext(), img = ctx.createImageData(V.W, V.H), d = img.data;
    var c = UI.rgb('void');
    for (var y = 0; y < V.H; y++) for (var x = 0; x < V.W; x++) {
      var dx = (x + 0.5) / V.W * 2 - 1, dy = (y + 0.5) / V.H * 2 - 1;
      var v = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 0.62) * 2.3;     // 0 in the middle, ~1.8 in the corners
      var lv = Math.floor(v * 3), fr = v * 3 - lv;
      if (fr > (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16) lv++;
      if (lv <= 0) continue;
      var i = (y * V.W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.min(200, lv * 46);
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    return key;
  };
})(globalThis.G = globalThis.G || {});
