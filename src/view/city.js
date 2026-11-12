// The city (step 8): a small walkable plaza between runs, drawn at the game's one pixel size.
// Title -> class -> city. The Blacksmith (buy, sell, upgrade, scrolls), Don Montoto (stories, identifies the kept bag for free; rescued in room 5 of a run), the Trainer
// (permanent ranks, the Neutral quarter), an empty plot for the Mage quarter, and the portal that starts a run.
// CityScene is the world (camera follows the hero); CityHudScene is the overlay: gold, buttons, the touch stick, panels.
(function (G) {
  var UI = G.UI, T = 16;
  var SOLID_H = 14;                                   // a stall's counter: the part the hero cannot walk through
  var REACH = 30;                                     // px from the front of a stall to talk to its owner
  var LINE = 12;                                      // px from a label to the prompt above it (a text line is 7 px, 9 with an accent)
  var TOP = 30;                                       // art px of the screen's top strip that the overlay covers

  // The same city in two layouts, in px. A stall's (x, y) is the bottom centre of its sprite; the owner stands in front of the counter.
  // `land`: the three stalls in a row, 26 x 15 tiles (416 x 240): fills a 480 x 270 screen. `port`: the stalls two by two with the
  // portal at the bottom, 16 x 23 tiles (256 x 368): fits a 270 x 480 screen whole, between the top buttons and the talk button.
  function spots(a, b, c) {
    return [
      { id: 'smith', x: a[0], y: a[1], frame: 'stall_smith', npc: 'npc_smith', label: 'city.smith', color: 'ui_warn' },
      { id: 'trainer', x: b[0], y: b[1], frame: 'stall_trainer', npc: 'npc_trainer', label: 'city.trainer', color: 'ui_good' },
      { id: 'montoto', x: c[0], y: c[1], frame: 'stall_montoto', npc: 'npc_montoto', label: 'mon.name', color: 'tome2' }
    ];
  }
  var LAND = {
    id: 'land', cols: 26, rows: 15,
    spots: spots([100, 88], [208, 88], [316, 88]),
    plot: { x: 100, y: 186, w: 48, h: 32 },          // the Mage quarter: a fenced empty plot with a sign
    sign: { x: 144, y: 184 },
    crates: [[304, 200], [320, 202], [312, 188]],
    portal: { x: 208, y: 222, w: 20, h: 18 },        // walking into it starts a run
    board: { x: 244, y: 214 },                       // the daily challenge board (step 10), beside the portal
    start: { x: 208, y: 140 },
    path: function (x, y) { return (x >= 12 && x <= 13 && y >= 5) || (y >= 7 && y <= 8 && x >= 2 && x <= 23); }
  };
  var PORT = {
    id: 'port', cols: 16, rows: 23,
    spots: spots([72, 88], [184, 88], [72, 214]),
    plot: { x: 190, y: 218, w: 48, h: 32 },
    sign: { x: 150, y: 216 },
    crates: [[202, 322], [218, 324], [210, 310]],
    portal: { x: 128, y: 334, w: 20, h: 18 },
    board: { x: 84, y: 330 },
    start: { x: 128, y: 146 },
    path: function (x, y) { return (x >= 7 && x <= 8 && y >= 5) || ((y === 7 || y === 8 || y === 15 || y === 16) && x >= 2 && x <= 13); }
  };
  [LAND, PORT].forEach(function (L) {
    L.w = L.cols * T; L.h = L.rows * T;
    L.walk = [16, 34, L.w - 16, L.h - 16];            // the walkable box (feet), the plaza inside the walls
  });
  // the portrait layout when the screen is taller than wide and too narrow for the wide one
  function pickLayout() { var V = G.view; return V.H > V.W && V.W < LAND.w ? PORT : LAND; }

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }

  function solids(L) {
    var out = [];
    L.spots.forEach(function (s) { out.push([s.x - 22, s.y - SOLID_H, s.x + 22, s.y]); });
    out.push([L.plot.x - 24, L.plot.y - L.plot.h, L.plot.x + 24, L.plot.y]);
    out.push([L.sign.x - 4, L.sign.y - 5, L.sign.x + 4, L.sign.y]);
    out.push([L.board.x - 4, L.board.y - 5, L.board.x + 4, L.board.y]);
    L.crates.forEach(function (c) { out.push([c[0] - 6, c[1] - 8, c[0] + 6, c[1]]); });
    return out;
  }
  function overlap(a, b, m) { return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m; }

  G.CityScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CityScene() { Phaser.Scene.call(this, { key: 'city' }); },

    create: function () {
      var self = this, C = this.cls = G.classDef(G.BAL, G.cls);
      G.screen = 'city'; G.city = this; G.gameScene = null; G.hud = null; G.paused = false; G.testRoom = false; G.daily = null;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : 1;
      this.gear = G.gearOf(G.save, G.cls);
      var L = this.lay = pickLayout();
      this.solids = solids(L); this.labels = []; this.world = [];
      this.controls = new G.Controls(this);
      this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.px = L.start.x; this.py = L.start.y; this.face = 1; this.moving = false; this.frame = 0; this.cam = { x: L.start.x, y: L.start.y };
      this.entering = false; this.near = null; this.out = { mx: 0, my: 0, dodge: false, pulse: false };
      this.cameras.main.setZoom(G.view.S);
      this.follow(true);                                // the camera first: labels are clamped to what it shows
      this.buildWorld();
      this.player = this.add.image(0, 0, 'atlas', C.sprite.frames + '_0').setOrigin(0.42, 1);
      this.shadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100);
      this.tag = UI.text(this, 0, 0, G.t('city.talk'), 'ui_warn').setDepth(7500).setVisible(false);
      this.cameras.main.setBackgroundColor(UI.hex('void'));
      this.applyView();
      this.game.events.on('viewchange', this.applyView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.applyView, self); if (G.city === self) G.city = null; });
      this.scene.launch('cityhud'); this.scene.bringToTop('cityhud');
      this.cameras.main.fadeIn(250, 7, 6, 11);
      G.ready = true;
    },

    // a new screen size, zoom or language. A rotation that changes the layout rebuilds the world; the hero stays at the stall
    // they were at, or goes back to the middle of the plaza.
    applyView: function () {
      var L = pickLayout();
      this.cameras.main.setZoom(G.view.S);
      if (L !== this.lay) {
        var at = this.near && this.near.s.id;
        this.world.forEach(function (o) { o.destroy(); });
        this.world = []; this.labels = []; this.near = null;
        this.lay = L; this.solids = solids(L);
        this.px = L.start.x; this.py = L.start.y;
        this.follow(true);
        this.buildWorld();
        var o = at === 'plot' ? this.plotOwner : at === 'daily' ? this.boardOwner : this.spots[at];
        if (o) { this.px = o.front.x; this.py = o.front.y + 6; }
      }
      this.relabel(); this.follow(true);
    },

    // ---------------------------------------------------------------- the world
    buildWorld: function () {
      var self = this, L = this.lay, x, y, W = this.world;
      var put = function (px, py, frame) { var o = self.add.image(px, py, 'atlas', frame); W.push(o); return o; };
      for (y = 0; y < L.rows; y++) for (x = 0; x < L.cols; x++) {
        var wall = x === 0 || y <= 1 || x === L.cols - 1 || y === L.rows - 1;
        var path = !wall && L.path(x, y);
        var h = hash(x, y), f = wall ? 'c_wall' : path ? 'c_path' : 'c_floor' + (h % 8 === 0 ? 3 : h % 3);
        put(x * T, y * T, f).setOrigin(0, 0).setDepth(-1000);
      }
      this.spots = {};
      this.rescued = !!(this.gear.city && this.gear.city.montoto);
      L.spots.forEach(function (s) {
        var empty = s.id === 'montoto' && !self.rescued, o = { s: s, empty: empty, front: { x: s.x, y: s.y + 14 } };
        o.stall = put(s.x, s.y, empty ? 'stall_empty' : s.frame).setOrigin(0.5, 1).setDepth(s.y);
        o.label = self.label(empty ? 'city.emptyStall' : s.label, empty ? 'ui_dim' : s.color, s.x, s.y - 52);
        if (!empty) {
          o.npc = put(s.x, s.y + 12, s.npc + '_0').setOrigin(0.5, 1).setDepth(s.y + 12);
          o.shadow = put(s.x, s.y + 11, 'shadow_s').setDepth(-100);
        }
        o.stall.setInteractive({ useHandCursor: true });
        if (o.npc) o.npc.setInteractive({ useHandCursor: true });
        var tap = function () { self.tap(o); };
        o.stall.on('pointerdown', tap); if (o.npc) o.npc.on('pointerdown', tap);
        self.spots[s.id] = o;
      });
      // the Mage quarter: nothing built yet
      put(L.plot.x, L.plot.y, 'plot_fence').setOrigin(0.5, 1).setDepth(L.plot.y);
      var plotLabel = this.label('city.mageQuarter', 'ui_dim', L.plot.x, L.plot.y - L.plot.h - 11);
      this.sign = put(L.sign.x, L.sign.y, 'c_sign').setOrigin(0.5, 1).setDepth(L.sign.y).setInteractive({ useHandCursor: true });
      this.sign.on('pointerdown', function () { self.say(G.t('city.mageSign'), 'ui_dim'); });
      this.plotOwner = { s: { id: 'plot' }, front: { x: L.sign.x - 6, y: L.sign.y + 6 }, label: plotLabel };
      L.crates.forEach(function (c) { put(c[0], c[1], 'c_crate').setOrigin(0.5, 1).setDepth(c[1]); });
      // the daily challenge board: a sign beside the portal (READ opens today's run)
      this.board = put(L.board.x, L.board.y, 'c_sign').setOrigin(0.5, 1).setDepth(L.board.y).setInteractive({ useHandCursor: true });
      this.board.on('pointerdown', function () { self.tap(self.boardOwner); });
      this.boardOwner = { s: { id: 'daily' }, front: { x: L.board.x, y: L.board.y + 8 }, label: this.label('city.daily', 'gold', L.board.x, L.board.y - 22) };
      // the portal
      this.portal = put(L.portal.x, L.portal.y, 'portal_0').setOrigin(0.5, 1).setDepth(L.portal.y - 20);
      put(L.portal.x, L.portal.y - 16, 'glow').setDepth(-640).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('rg2')).setAlpha(0.25);
      this.label('city.rift', 'ui_good', L.portal.x, L.portal.y - 58);
    },

    say: function (text, color) { if (G.cityHud) G.cityHud.say(text, color); },

    // a world label centred on cx: kept fully inside the visible part of the city (clamped to the camera each frame), so a narrow screen never cuts one
    label: function (key, color, cx, y) {
      var t = UI.text(this, 0, 0, G.t(key), color).setDepth(6000), b = { t: t, cx: cx, y: y, key: key, box: { x: 0, y: 0, w: 0, h: 0 } };
      this.world.push(t);
      this.labels.push(b);
      this.placeLabels();
      return b;
    },
    relabel: function () {      // the language changed: world labels and the prompt get the new text
      (this.labels || []).forEach(function (b) { b.t.setText(G.t(b.key)); });
      if (this.tag) this.tag.setText(G.t('city.talk'));
      this.placeLabels();
    },
    // the box a text really covers: an accented capital rises 2 px above its line
    box: function (t, x, y) { return { x: x, y: y - 2, w: t.width, h: 11 }; },
    placeLabels: function () {
      var wv = this.cameras.main.worldView, l = wv.x + 3, r = wv.x + wv.width - 3, self = this;
      var placed = [];
      (this.labels || []).forEach(function (b) {
        var w = b.t.width, x = Math.round(Math.max(l, Math.min(r - w, b.cx - w / 2))), y = b.y, k;
        // a label pushed in from the edge can land on its neighbour (a zoomed-in screen): lift it a line until it is clear
        for (k = 0; k < placed.length; k++) if (overlap(self.box(b.t, x, y), placed[k], 3)) { y -= LINE; k = -1; }
        b.box = self.box(b.t, x, y);
        placed.push(b.box);
        b.t.setPosition(x, y);
      });
      this.placeTag();
    },
    // The prompt (TALK / LOOK / READ) of the thing in reach sits one line above that thing's own label, centred on it, and is
    // lifted further while it touches any label: a prompt and a label never share pixels, in any language or screen size.
    placeTag: function () {
      var o = this.near, tag = this.tag;
      if (!tag || !o || !tag.visible) return;
      var wv = this.cameras.main.worldView, w = tag.width, lb = o.label.box, plot = o.s.id === 'plot';
      // a stall: above its label. The sign: above the sign itself (the Mage quarter label belongs to the plot beside it)
      var cx = plot ? this.lay.sign.x : lb.x + lb.w / 2, y = plot ? this.lay.sign.y - 28 : lb.y + 2 - LINE, n = 0;
      var x = Math.round(Math.max(wv.x + 3, Math.min(wv.x + wv.width - 3 - w, cx - w / 2)));
      for (var k = 0; k < this.labels.length && n < 40; k++) if (overlap(this.box(tag, x, y - 1), this.labels[k].box, 2)) { y -= 2; k = -1; n++; }
      tag.setPosition(x, Math.round(y) - ((this.frame >> 4) & 1));
      this.tagBox = this.box(tag, x, y - 1);
    },

    // a tap on a stall or its owner: talk if the hero is in reach
    tap: function (o) {
      if (G.paused || this.entering) return;
      if (this.inReach(o)) this.talk(o); else this.say(G.t('city.closer'), 'ui_dim');
    },
    inReach: function (o) { var dx = this.px - o.front.x, dy = this.py - o.front.y; return dx * dx + dy * dy <= REACH * REACH; },
    nearest: function () {
      var best = null, bd = 1e9, self = this;
      Object.keys(this.spots).forEach(function (k) {
        var o = self.spots[k], dx = self.px - o.front.x, dy = self.py - o.front.y, d = dx * dx + dy * dy;
        if (d <= REACH * REACH && d < bd) { bd = d; best = o; }
      });
      var po = this.plotOwner, dx2 = this.px - po.front.x, dy2 = this.py - po.front.y;
      if (!best && dx2 * dx2 + dy2 * dy2 <= 28 * 28) best = po;
      var bo = this.boardOwner, dx3 = this.px - bo.front.x, dy3 = this.py - bo.front.y;
      if (!best && dx3 * dx3 + dy3 * dy3 <= 24 * 24) best = bo;
      return best;
    },
    talk: function (o) {
      var hud = G.cityHud;
      if (!hud || G.paused) return;
      var id = o.s.id;
      hud.dropStick();
      if (id === 'smith') G.Panels.openShop(hud, false, 'smith');
      else if (id === 'trainer') G.Panels.openShop(hud, false, 'trainer');
      else if (id === 'daily') G.Panels.openDaily(hud);
      else if (id === 'montoto') {
        if (o.empty) this.say(G.montotoText('emptyStall'), 'ui_warn');
        else G.Panels.openMontoto(hud, false);
      } else this.say(G.t('city.mageSign'), 'ui_dim');
    },
    // the label and what the button says for the thing in reach
    nearLabel: function (o) { return !o ? null : G.t(o.s.id === 'plot' || o.s.id === 'daily' ? 'city.read' : o.empty ? 'city.look' : 'city.talk'); },

    // ---------------------------------------------------------------- movement
    blocked: function (x, y) {
      var l = x - 4, r = x + 4, t = y - 5, b = y, i, W = this.lay.walk;
      if (l < W[0] || r > W[2] || t < W[1] - 5 || b > W[3]) return true;
      for (i = 0; i < this.solids.length; i++) { var s = this.solids[i]; if (r > s[0] && l < s[2] && b > s[1] && t < s[3]) return true; }
      return false;
    },
    move: function (dx, dy) {
      if (!this.blocked(this.px + dx, this.py)) this.px += dx;
      if (!this.blocked(this.px, this.py + dy)) this.py += dy;
    },
    follow: function (snap) {
      var V = G.view, cam = this.cameras.main, MW = this.lay.w, MH = this.lay.h;
      if (!this.cam) return;
      if (snap) { this.cam.x = this.px; this.cam.y = this.py - 8; } else { this.cam.x += (this.px - this.cam.x) * 0.14; this.cam.y += (this.py - 8 - this.cam.y) * 0.14; }
      // the overlay covers the top strip: a city that fits sits below it, a bigger one may scroll that far above the map
      var cx = MW <= V.W ? MW / 2 : Math.max(V.W / 2, Math.min(MW - V.W / 2, this.cam.x));
      var cy = MH + TOP <= V.H ? (MH - TOP) / 2 : Math.max(V.H / 2 - TOP, Math.min(MH - V.H / 2, this.cam.y));
      cam.centerOn(Math.round(cx), Math.round(cy));
      if (this.labels) this.placeLabels();
    },

    update: function (time, delta) {
      var o = this.out, C = this.cls, dt = Math.min(delta, 250) / 1000;     // up to 250 ms, moved in small steps so a slow frame never tunnels through a wall
      this.controls.read(o);
      var enter = Phaser.Input.Keyboard.JustDown(this.keyEnter);
      this.frame++;
      if (!G.paused && !this.entering) {
        var mx = o.mx, my = o.my, l = Math.sqrt(mx * mx + my * my);
        this.moving = l > 0.05;
        if (this.moving) {
          if (l > 1) { mx /= l; my /= l; }
          for (var n = Math.max(1, Math.ceil(dt / 0.02)), sp = C.base.speed * dt / n; n > 0; n--) this.move(mx * sp, my * sp);
          if (mx) this.face = mx > 0 ? 1 : -1;
        }
        this.near = this.nearest();
        if (this.near && this.near.s.id !== 'plot') G.Hints.on('city.near.' + this.near.s.id, !!this.near.empty);
        if (Math.abs(this.px - this.lay.portal.x) <= 36 && Math.abs(this.py - this.lay.portal.y) <= 40) G.Hints.on('city.near.portal');
        if ((o.dodge || o.pulse || enter) && this.near) this.talk(this.near);
        // the portal: walking into it starts a run
        var P = this.lay.portal;
        if (Math.abs(this.px - P.x) <= P.w / 2 && this.py >= P.y - P.h && this.py <= P.y) this.enterRift();
      } else if (G.paused) this.moving = false;
      var walk = this.moving ? ((this.frame >> 3) & 1) : 0;
      this.player.setFrame(C.sprite.frames + '_' + walk).setFlipX(this.face < 0).setOrigin(this.face < 0 ? 0.58 : 0.42, 1).setPosition(Math.round(this.px), Math.round(this.py)).setDepth(this.py);
      this.shadow.setPosition(Math.round(this.px), Math.round(this.py) - 1);
      var self = this;
      Object.keys(this.spots).forEach(function (k) {
        var s = self.spots[k];
        if (s.npc) s.npc.setFrame(s.s.npc + '_' + (((self.frame >> 4) + s.s.x) & 1));
      });
      this.portal.setFrame('portal_' + ((this.frame >> 3) % 3));
      var nl = this.nearLabel(this.near);
      this.tag.setVisible(!!nl && !G.paused);
      if (nl && this.near) this.tag.setText(nl);
      this.follow(false);                               // also places the labels and, above them, the prompt
    },

    enterRift: function () {
      if (this.entering) return;
      this.entering = true;
      var self = this;
      if (G.cityHud) G.cityHud.dropStick();
      this.cameras.main.fadeOut(220, 7, 6, 11);
      this.cameras.main.once('camerafadeoutcomplete', function () {
        G.testRoom = false; G.storeSave(G.save);
        self.scene.stop('cityhud'); self.scene.start('game');
      });
    },

    // QA: where things are, in world px, plus the camera, so a test can check what is on screen and what overlaps
    snapshot: function () {
      var spots = {}, L = this.lay, wv = this.cameras.main.worldView;
      for (var k in this.spots) spots[k] = { x: this.spots[k].front.x, y: this.spots[k].front.y, empty: !!this.spots[k].empty, sx: this.spots[k].s.x, sy: this.spots[k].s.y };
      return { x: Math.round(this.px), y: Math.round(this.py), near: this.near ? this.near.s.id : null, rescued: this.rescued, entering: this.entering, spots: spots,
        portal: { x: L.portal.x, y: L.portal.y }, start: L.start, sign: { x: this.plotOwner.front.x, y: this.plotOwner.front.y }, board: { x: this.boardOwner.front.x, y: this.boardOwner.front.y }, layout: L.id, map: { w: L.w, h: L.h },
        view: { x: wv.x, y: wv.y, w: wv.width, h: wv.height },
        labels: this.labels.map(function (b) { return { key: b.key, x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h }; }),
        tag: this.tag.visible && this.tagBox ? { text: this.tag.text, x: this.tagBox.x, y: this.tagBox.y, w: this.tagBox.w, h: this.tagBox.h } : null };
    }
  });

  // ---------------------------------------------------------------- the overlay
  G.CityHudScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CityHudScene() { Phaser.Scene.call(this, { key: 'cityhud' }); },
    create: function () {
      var self = this;
      G.cityHud = this; this.L = null; this.stickId = null; this.toastT = 0; this.shown = {};
      this.build();
      this.game.events.on('viewchange', this.onView, this);
      var kb = this.input.keyboard;
      kb.on('keydown-I', function () { self.toggleInventory(); });
      kb.on('keydown-TAB', function (e) { e.preventDefault(); self.toggleInventory(); });
      kb.on('keydown-ESC', function () { if (G.Panels.isOpen()) G.Panels.close(); else G.Panels.openSettings(self); });
      // touch: a floating stick on the left 60 % of the screen (the same as in a run)
      this.input.on('pointerdown', function (p, over) {
        if (p.wasTouch && !G.touch) { G.touch = true; self.build(); }      // the overlay again, with finger-sized hit boxes
        if (!G.touch || over.length || G.paused || self.stickId != null) return;
        var S = G.view.S;
        if (p.x / S > G.view.W * 0.6) return;
        self.stickId = p.id; self.stickX = p.x / S; self.stickY = p.y / S;
        self.stickBase.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
        self.stickKnob.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
      });
      this.input.on('pointermove', function (p) {
        if (p.id !== self.stickId || !G.city) return;
        var S = G.view.S, dx = p.x / S - self.stickX, dy = p.y / S - self.stickY, l = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(l, 18);
        self.stickKnob.setPosition(Math.round(self.stickX + dx / l * m), Math.round(self.stickY + dy / l * m));
        var v = G.city.controls.virtual;
        if (l < 5) { v.mx = 0; v.my = 0; } else { v.mx = dx / l; v.my = dy / l; }
      });
      var release = function (p) { if (p.id === self.stickId) self.dropStick(); };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.onView, self); G.cityHud = null; G.Panels.close(true); G.paused = false; });
    },
    dropStick: function () {
      this.stickId = null;
      if (this.stickBase) { this.stickBase.setVisible(false); this.stickKnob.setVisible(false); }
      if (G.city) { G.city.controls.virtual.mx = 0; G.city.controls.virtual.my = 0; }
    },
    onView: function () { this.build(); G.Panels.relayout(this); },
    toggleInventory: function () {
      if (G.Panels.isOpen()) { G.Panels.close(); return; }
      this.dropStick();
      G.Panels.openInventory(this);
    },
    say: function (text, color) {
      this.toast.setText(text).setTint(UI.hex(color || 'ui_text')).setVisible(true).setAlpha(1).setMaxWidth(G.view.W - 16);
      UI.centerX(this.toast, G.view.W / 2);
      this.toastT = 160;
    },
    build: function () {
      var self = this, V = G.view, X = UI.PAD, Y = UI.PAD, g = G.gearOf(G.save, G.cls);
      UI.camera(this);
      if (this.L) this.L.destroy();
      var L = this.L = UI.layer(this, 100);
      var vg = this.add.image(0, 0, UI.vignette(this)).setOrigin(0, 0);
      vg._dz = -50; L.add(vg);
      // class, gold and scrolls (top-left)
      L.panel(X, Y, 96, 27, 'plate');
      L.text(X + 5, Y + 4, G.classLabel(G.cls).toUpperCase(), 'ui_warn');
      L.image(X + 8, Y + 19, 'i_gold');
      this.goldText = L.text(X + 15, Y + 16, '', 'gold');
      L.image(X + 56, Y + 19, 'i_scroll');
      this.scrollText = L.text(X + 63, Y + 16, '', 'ui_text');
      // buttons (top-right): inventory, settings, title
      L.button(V.W - X - 26, Y, 26, 26, '', function () { self.toggleInventory(); }, { icon: 'i_bag', name: 'inv' });
      // settings: a gear icon, so no word has to fit ("AJUS" was cut in Spanish)
      L.button(V.W - X - 26, Y + 29, 26, 20, '', function () { if (!G.Panels.isOpen()) { self.dropStick(); G.Panels.openSettings(self); } }, { icon: 'i_gear', name: 'city_set' });
      L.button(V.W - X - 26, Y + 52, 26, 20, G.t('city.end'), function () { if (!G.Panels.isOpen()) { G.Panels.close(true); self.scene.stop('city'); self.scene.stop('cityhud'); self.scene.start('title'); } }, { name: 'city_title' });
      // the talk button: shown when a stall is in reach (a tap on the stall does the same)
      // wide screens: bottom right, under the thumb and off the portal (the city fills the screen); tall ones: centred under the city
      this.talkBtn = L.button(V.W >= 300 ? V.W - X - 70 : Math.round(V.W / 2 - 35), V.H - 30, 70, 22, G.t('city.talk'), function () { if (G.city && G.city.near && !G.paused) G.city.talk(G.city.near); }, { name: 'city_talk', color: 'ui_warn' });
      this.talkBtn.setVisible(false);
      this.toast = L.text(0, V.H - 44, '').setVisible(false);
      this.toast._dz = 4; this.toast.setDepth(L.depth + 4);
      this.stickBase = L.image(0, 0, 'stick_base').setVisible(false);
      this.stickKnob = L.image(0, 0, 'stick_knob', 3).setVisible(false);
      this.stickId = null; this.shown = {};
      this.refresh(g);
      G.Hints.attach(this); G.Hints.on('city.enter');
    },
    refresh: function (g) {
      this.goldText.setText('' + (g.gold | 0)); this.scrollText.setText('x' + (g.scrolls | 0));
    },
    update: function () {
      var g = G.gearOf(G.save, G.cls), k = (g.gold | 0) + ':' + (g.scrolls | 0);
      if (this.shown.k !== k) { this.shown.k = k; this.refresh(g); }
      var c = G.city, nl = c && !G.paused && !c.entering ? c.nearLabel(c.near) : null;
      if (nl !== this.shown.nl) { this.shown.nl = nl; if (nl) this.talkBtn.setLabel(nl); this.talkBtn.setVisible(!!nl); }
      G.Hints.tick(this);
      if (this.toastT > 0 && --this.toastT <= 0) this.toast.setVisible(false);
      else if (this.toastT > 0 && this.toastT < 30) this.toast.setAlpha(this.toastT / 30);
    }
  });
})(globalThis.G = globalThis.G || {});
