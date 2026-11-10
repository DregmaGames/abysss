// UI toolkit. Everything is laid out in art pixels (320x180) and drawn by a camera
// zoomed x3, so UI and world share one pixel size. UI_SCALE is the one knob for
// the larger mobile UI in Phase 2.
(function (G) {
  var UI = G.UI = {
    S: 3, W: 960 / 3, H: 540 / 3,
    SAFE_X: 16, SAFE_Y: 8,          // safe margins in art px (48 / 24 logical px)
    hex: function (key) { return parseInt(G_ASSETS.palette[key].slice(1), 16); },
    RARITY: ['r_common', 'r_magic', 'r_rare', 'r_epic', 'r_legend'],
    RARITY_NAME: ['Common', 'Magic', 'Rare', 'Epic', 'Legendary'],
    // every (text colour, background) pair the HUD and panels use; checked by tools/contrast.js
    TEXT_PAIRS: [['ui_text', 'ui_bg'], ['ui_dim', 'ui_bg'], ['ui_warn', 'ui_bg'], ['ui_good', 'ui_bg'], ['ui_bad', 'ui_bg'],
      ['r_common', 'ui_bg'], ['r_magic', 'ui_bg'], ['r_rare', 'ui_bg'], ['r_epic', 'ui_bg'], ['r_legend', 'ui_bg'],
      ['ui_text', 'wf2'], ['ui_text', 'w1'], ['ui_text', 'outline'], ['ui_dim', 'outline'], ['ui_warn', 'outline'],
      ['ui_bad', 'outline'], ['ui_good', 'outline']]
  };

  UI.registerFonts = function (scene) {
    var meta = G_ASSETS.fontJson;
    ['font', 'fontbig'].forEach(function (key) {
      var m = meta[key], data = { font: key, size: m.size, lineHeight: m.lineHeight, retroFont: true, chars: {} };
      Object.keys(m.chars).forEach(function (code) {
        var c = m.chars[code];
        data.chars[code] = { x: c[0], y: c[1], width: c[2], height: c[3], centerX: c[2] >> 1, centerY: c[3] >> 1,
          xOffset: c[4], yOffset: c[5], xAdvance: c[6], data: {}, kerning: {},
          u0: c[0] / meta.w, v0: c[1] / meta.h, u1: (c[0] + c[2]) / meta.w, v1: (c[1] + c[3]) / meta.h };
      });
      scene.cache.bitmapFont.add(key, { data: data, texture: 'font', frame: null });
    });
  };

  UI.camera = function (scene) { scene.cameras.main.setOrigin(0, 0).setZoom(UI.S); };

  UI.text = function (scene, x, y, str, color, big) {
    var t = scene.add.bitmapText(x, y, big ? 'fontbig' : 'font', str);
    t.setTint(UI.hex(color || 'ui_text'));
    return t;
  };

  UI.panel = function (scene, x, y, w, h, key) {
    return scene.add.nineslice(x, y, 'atlas', key || 'panel', w, h, 4, 4, 4, 4).setOrigin(0, 0);
  };

  // Button: min 16 px tall (48 logical) so it stays tappable when scaled to a phone.
  UI.button = function (scene, x, y, w, h, label, onClick) {
    var c = scene.add.container(x, y);
    var bg = UI.panel(scene, 0, 0, w, h, 'btn');
    var t = UI.text(scene, 0, 0, label);
    c.add([bg, t]);
    var b = { c: c, bg: bg, t: t, enabled: true, w: w, h: h };
    b.setLabel = function (s, color) {
      t.setText(s); if (color) t.setTint(UI.hex(color));
      t.setPosition(Math.round((w - t.width) / 2), Math.round((h - 7) / 2) - 1);
    };
    b.setEnabled = function (on) { b.enabled = on; c.setAlpha(on ? 1 : 0.45); };
    b.click = function () { if (b.enabled && c.visible) onClick(); };
    b.setLabel(label);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', function () { if (b.enabled) bg.setFrame('btn_hot'); });
    bg.on('pointerout', function () { bg.setFrame('btn'); });
    bg.on('pointerdown', function (p) { if (!p.rightButtonDown()) b.click(); });
    return b;
  };

  // Modal frame: dim overlay that swallows clicks + a centred panel. Panels are laid out to fit
  // 320x180 art px, so they still fit if UI.S changes.
  UI.modal = function (scene, w, h, title) {
    var c = scene.add.container(0, 0).setDepth(1000);
    var ov = scene.add.image(0, 0, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(UI.W, UI.H).setTint(UI.hex('rift_void')).setAlpha(0.72);
    ov.setInteractive();
    var x0 = Math.round((UI.W - w) / 2), y0 = Math.round((UI.H - h) / 2);
    c.add([ov, UI.panel(scene, x0, y0, w, h)]);
    var m = { c: c, x: x0, y: y0, w: w, h: h, buttons: [] };
    if (title) c.add(UI.text(scene, x0 + 7, y0 + 6, title, 'ui_warn'));
    m.add = function (o) { c.add(o.c || o); return o; };
    m.text = function (x, y, str, color, big) { var t = UI.text(scene, x0 + x, y0 + y, str, color, big); c.add(t); return t; };
    m.button = function (x, y, bw, bh, label, fn) { var b = UI.button(scene, x0 + x, y0 + y, bw, bh, label, fn); c.add(b.c); m.buttons.push(b); return b; };
    m.image = function (x, y, frame) { var i = scene.add.image(x0 + x, y0 + y, 'atlas', frame); c.add(i); return i; };
    m.destroy = function () { c.destroy(); };
    return m;
  };

  // WCAG contrast ratio between two palette colours (used by the HUD contrast check).
  UI.contrast = function (a, b) {
    function lum(key) {
      var v = UI.hex(key), ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(function (c) {
        c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
})(globalThis.G = globalThis.G || {});
