// The city: the walkable town between runs, drawn at the game's one pixel size (step 8; a real town since step big city).
// Title -> class -> city. A walled town of 56 x 32 tiles (896 x 512 art px: it fills a desktop window at the far default
// scale). The hero arrives on the plaza in front of the portal ("La Brecha": walking into it starts a run). The market row
// is either side of the portal: Don Montoto (stories, identifies the kept bag for free; an empty stall until he is rescued
// in room 5 of a run), the Blacksmith (buy, sell, upgrade, scrolls), the Trainer (permanent ranks) and a vacant pitch.
// North of the row: the Mage quarter and the Neutral quarter, fenced empty lots with a sign each (room for the keepers to
// come), and the road to the gate. South: the notice board (the daily challenge), the fountain, gardens, houses for the
// neighbours rescued later, the lower street, a grove and the graveyard. Everything is placed by the CITY table below.
// CityScene is the world (the camera follows the hero when the town is bigger than the screen, and the town is centred
// when it is smaller); CityHudScene is the overlay: gold, buttons, the touch stick, panels.
(function (G) {
  var UI = G.UI, T = 16;
  // the portal's look: glow alpha (far, + near), glow growth near, vortex turn (rad/s far, + near), sparks a second near,
  // burst a second while going in, the ring they start on (px from the centre), how long the hero takes to be pulled in (s)
  var PORTAL = { glow: [0.25, 0.4], grow: 0.35, spin: [1.2, 3.5], sparks: 26, burst: 90, r: [10, 20], absorb: 0.6, oval: [20, 34] };      // oval: the vortex's size in town px (the arch's opening)
  var REACH = 26;                                     // px from the front of a stall to talk to its owner
  var FRONT = 26;                                     // px from a stall's counter to that front: the keeper stands between the two
  var LINE = 12;                                      // px from a label to the prompt above it (a text line is 7 px, 9 with an accent)
  var APRON = 4;                                      // rampart tiles drawn round the town: a screen bigger than the town shows wall, not the void
  var LOOK = { up: 8, upShort: 24, short: 240 };      // the camera looks a little above the hero; more on a short screen (a phone), so
                                                      // the stall labels above him clear the overlay's top strip

  function row(frame, x0, n, dx, y, skip) { var out = []; for (var i = 0; i < n; i++) if (!skip || skip.indexOf(i) < 0) out.push([frame, x0 + i * dx, y]); return out; }

  // ------------------------------------------------------------------------------------------------ the town, one table
  // Tiles for the ground and the walls ([x, y, w, h] in tiles), px for everything that stands on it. A thing's (x, y) is the
  // bottom centre of its sprite. The places used every visit are within 3 s on foot of `start` (the hero walks 74-78 px/s):
  // portal 36 px, Blacksmith and Trainer 102 px, notice board 82 px, Don Montoto 201 px. The far corners are lots and dressing.
  var CITY = {
    id: 'town', cols: 56, rows: 32,
    wallRows: 3,                                      // the north wall: two rows of wall top and the face
    // wall blocks inside the outer wall: corner towers, the two towers of the gate, buttresses
    blocks: [[1, 3, 2, 2], [53, 3, 2, 2], [24, 3, 2, 1], [30, 3, 2, 1], [9, 3, 1, 1], [17, 3, 1, 1], [38, 3, 1, 1], [46, 3, 1, 1]],
    // the ground: cobbles everywhere, then the paved roads (gate road, market street, the walk south, lower street),
    // the plaza and the garden beds on top
    road: [[26, 3, 4, 10], [1, 13, 54, 3], [27, 22, 2, 3], [3, 25, 50, 2]],
    plaza: [[22, 13, 12, 9]],
    garden: [[3, 17, 8, 4], [13, 17, 7, 4], [36, 17, 7, 4], [45, 17, 8, 4], [2, 28, 13, 3], [41, 28, 13, 3]],
    torches: [[5, 2], [13, 2], [21, 2], [34, 2], [42, 2], [50, 2], [25, 3], [30, 3]],      // on wall faces, [tile x, tile y]: the rooms' torch and its light
    start: { x: 448, y: 242 },                        // where the hero arrives: the plaza, in front of the portal
    portal: { x: 448, y: 206, w: 18, h: 14, cy: 21 }, // walking into it (from the front) starts a run; cy: the vortex centre above its foot
    stalls: [{ id: 'montoto', x: 248, y: 208 }, { id: 'smith', x: 348, y: 208 }, { id: 'trainer', x: 548, y: 208 }],
    board: { x: 388, y: 296 },                        // the notice board: the daily challenge
    // empty lots with a sign: nothing is built there yet. `at`: where the quarter's name is written
    quarters: [
      { id: 'plot', label: 'city.mageQuarter', say: 'city.mageSign', at: { x: 148, y: 76 }, sign: { x: 236, y: 128 }, lots: [[112, 124], [184, 124]] },
      { id: 'neutral', label: 'city.neutralQuarter', say: 'city.neutralSign', at: { x: 748, y: 76 }, sign: { x: 660, y: 128 }, lots: [[712, 124], [784, 124], [648, 206]] }
    ],
    // dressing: [frame, x, y, flip]. What each frame is (solid part, frames, light) is in PROP below
    props: [
      // the north wall and the road from the gate
      ['c_gate', 448, 48], ['wall_banner', 376, 41], ['wall_banner', 520, 41], ['wall_moss', 56, 38], ['wall_chain', 312, 41], ['wall_moss', 584, 38],
      ['wall_chain', 776, 41], ['wall_moss', 840, 38], ['wall_moss', 168, 38],
      ['c_banner_town', 408, 110], ['c_banner_town', 488, 110, 1],
      // the plaza: the portal's dais and its fires, the fountain
      ['c_dais', 448, 210], ['c_brazier', 414, 198], ['c_brazier', 482, 198], ['c_banner_rift', 406, 170], ['c_banner_rift', 490, 170, 1],
      ['c_fountain', 448, 326], ['c_planter', 368, 349], ['c_planter', 528, 349], ['c_planter', 512, 296], ['c_brazier', 400, 349], ['c_brazier', 496, 349],
      // the market street: lamps on its south side, stock at both ends of the row
      ['c_lamp', 100, 263], ['c_lamp', 200, 263], ['c_lamp', 304, 263], ['c_lamp', 592, 263, 1], ['c_lamp', 696, 263, 1], ['c_lamp', 796, 263, 1],
      ['c_barrel', 134, 204], ['c_barrel', 148, 207], ['c_crate', 166, 206], ['c_crate', 181, 207], ['c_crate', 173, 194],
      ['c_crate', 740, 205], ['c_crate', 756, 207], ['c_crate', 748, 193], ['c_barrel', 774, 206], ['c_tree', 58, 204], ['c_tree', 838, 204, 1],
      // the Mage quarter (north-west) and the Neutral quarter (north-east): banners in their colours, the Trainer's dummies
      ['c_banner_mage', 72, 126], ['c_banner_mage', 148, 126], ['c_tree', 300, 122], ['c_bush', 272, 150], ['c_tree_dead', 60, 116],
      ['c_banner_neutral', 748, 126], ['c_banner_neutral', 826, 126, 1], ['dummy_0', 596, 132], ['dummy_0', 620, 146], ['c_bush', 572, 108],
      // gardens between the street and the houses
      ['c_tree', 76, 318], ['c_tree', 140, 304, 1], ['c_bush', 108, 328], ['c_bush', 62, 292], ['c_tree', 236, 312], ['c_tree_dead', 292, 308], ['c_bush', 264, 326],
      ['c_tree', 604, 306], ['c_tree', 660, 318, 1], ['c_bush', 632, 328], ['c_tree', 752, 314], ['c_tree', 820, 302, 1], ['c_bush', 786, 328], ['c_bush', 836, 290],
      // houses along the lower street: boarded up until their neighbours are rescued
      ['c_house_a', 80, 400], ['c_house_b', 192, 400], ['c_house_a', 304, 400, 1], ['c_house_b', 592, 400], ['c_house_a', 704, 400], ['c_house_b', 816, 400, 1],
      ['c_lamp', 138, 399], ['c_lamp', 250, 399], ['c_lamp', 646, 399, 1], ['c_lamp', 758, 399, 1], ['c_barrel', 348, 400], ['c_crate', 548, 400],
      // the south: a grove, the way to the graveyard
      ['c_tree', 56, 486], ['c_tree', 104, 476, 1], ['c_tree_dead', 152, 488], ['c_tree', 200, 480], ['c_bush', 80, 493], ['c_bush', 228, 491],
      ['c_tree', 392, 486], ['c_tree', 504, 486, 1], ['c_planter', 448, 493], ['c_barrel', 300, 491], ['c_barrel', 314, 493], ['c_crate', 600, 491],
      ['c_grave_0', 676, 474], ['c_grave_1', 700, 476], ['c_grave_0', 724, 474], ['c_grave_0', 790, 474], ['c_grave_1', 814, 476], ['c_grave_0', 838, 474],
      ['c_grave_1', 688, 492], ['c_grave_0', 712, 492], ['c_grave_0', 802, 492], ['c_grave_1', 826, 492], ['prop_candles', 757, 490], ['c_tree_dead', 852, 468]
    ].concat(row('c_fence', 664, 13, 16, 455, [5]))
  };
  // who keeps a stall
  var KEEPER = {
    smith: { frame: 'stall_smith', npc: 'npc_smith', label: 'city.smith', color: 'ui_warn' },
    trainer: { frame: 'stall_trainer', npc: 'npc_trainer', label: 'city.trainer', color: 'ui_good' },
    montoto: { frame: 'stall_montoto', npc: 'npc_montoto', label: 'mon.name', color: 'tome2' }
  };
  // What a prop is. box: its solid part round the anchor, [left, up, right] in px (none: the hero walks over or behind it);
  // frames + rate: an animation (<frame>_<n>, a new frame every `rate` x 8 ticks); light: [glow frame, tint, alpha, dx, dy];
  // o: origin, z: a fixed depth (flat on the ground or on a wall) instead of its y; mark: a landmark that no label may cover.
  var PROP = {
    c_gate: { z: -600, mark: 1 },
    wall_banner: { o: [0.5, 0.5], z: -610 }, wall_moss: { o: [0.5, 0.5], z: -610 }, wall_chain: { o: [0.5, 0.5], z: -610 },
    c_dais: { o: [0.5, 0.44], z: -950 },
    c_brazier: { box: [-4, 4, 4], frames: 3, rate: 1, light: ['glow', 'em2', 0.4, 0, -10] },
    c_lamp: { box: [-5, 3, -1], light: ['glow', 'em3', 0.3, 3, -18] },
    c_fountain: { box: [-19, 20, 19], frames: 2, rate: 3, mark: 1 },
    c_planter: { box: [-11, 7, 11] }, c_bush: { box: [-6, 4, 6] },
    c_tree: { box: [-3, 5, 3] }, c_tree_dead: { box: [-4, 4, 2] },
    c_barrel: { box: [-5, 6, 5] }, c_crate: { box: [-6, 8, 6] },
    c_house_a: { box: [-32, 26, 32] }, c_house_b: { box: [-32, 26, 32] },
    c_banner_town: { box: [-6, 3, -2], frames: 2, rate: 5 }, c_banner_rift: { box: [-6, 3, -2], frames: 2, rate: 5 },
    c_banner_mage: { box: [-6, 3, -2], frames: 2, rate: 5 }, c_banner_neutral: { box: [-6, 3, -2], frames: 2, rate: 5 },
    dummy_0: { box: [-5, 5, 5] },
    c_grave_0: { box: [-4, 4, 4] }, c_grave_1: { box: [-3, 3, 3] }, c_fence: { box: [-8, 3, 8] },
    prop_candles: { frames: 2, rate: 2, light: ['glow_s', 'em3', 0.35, 0, -6] }
  };

  // the table worked out once: sizes in px, the wall grid, the ground tile under every cell, the solid boxes
  (function (L) {
    var x, y, W = L.cols, H = L.rows, wall = new Uint8Array(W * H), ground = new Uint8Array(W * H);
    L.w = W * T; L.h = H * T;
    function fill(g, r, v) { for (var j = r[1]; j < r[1] + r[3]; j++) for (var i = r[0]; i < r[0] + r[2]; i++) g[j * W + i] = typeof v === 'function' ? v(i - r[0], j - r[1], r) : v; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) wall[y * W + x] = x === 0 || x === W - 1 || y < L.wallRows || y === H - 1 ? 1 : 0;
    L.blocks.forEach(function (b) { fill(wall, b, 1); });
    L.road.forEach(function (r) { fill(ground, r, 1); });
    L.plaza.forEach(function (r) { fill(ground, r, 2); });
    // a garden bed is a nine-slice: 3 + row * 3 + column (0 edge, 1 middle, 2 edge)
    L.garden.forEach(function (r) { fill(ground, r, function (i, j, q) { return 3 + (j === 0 ? 0 : j === q[3] - 1 ? 2 : 1) * 3 + (i === 0 ? 0 : i === q[2] - 1 ? 2 : 1); }); });
    L.wallAt = function (tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : wall[ty * W + tx]; };
    L.groundAt = function (tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 0 : ground[ty * W + tx]; };
    L.stalls.forEach(function (s) { var k = KEEPER[s.id]; s.frame = k.frame; s.npc = k.npc; s.label = k.label; s.color = k.color; });
    // solid boxes [x0, y0, x1, y1]: a stall (the hero walks behind it, not through it), a lot, signs, the board, the back of
    // the portal's arch (so it is entered from the plaza, never from behind), and the props that have a box
    var S = L.solids = [], P = L.portal;
    L.stalls.forEach(function (s) { S.push([s.x - 24, s.y - 38, s.x + 24, s.y]); });
    L.keeperBox = function (s) { return [s.x - 7, s.y + 4, s.x + 7, s.y + 13]; };      // a keeper is solid too: the hero talks to him, he does not stand on him
    L.quarters.forEach(function (q) {
      q.lots.forEach(function (c) { S.push([c[0] - 24, c[1] - 32, c[0] + 24, c[1]]); });
      S.push([q.sign.x - 4, q.sign.y - 5, q.sign.x + 4, q.sign.y]);
    });
    S.push([L.board.x - 12, L.board.y - 5, L.board.x + 12, L.board.y]);
    S.push([P.x - 17, P.y - 30, P.x + 17, P.y - 9]);
    S.push([P.x - 34, P.y - 10, P.x - 10, P.y - 2], [P.x + 10, P.y - 10, P.x + 34, P.y - 2]);      // the arch's legs and broken pillars
    L.props.forEach(function (p) {
      var d = PROP[p[0]], b = d && d.box;
      if (b) S.push(p[3] ? [p[1] - b[2], p[2] - b[1], p[1] - b[0], p[2]] : [p[1] + b[0], p[2] - b[1], p[1] + b[2], p[2]]);
    });
  })(CITY);
  G.CITY = CITY;

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
  function overlap(a, b, m) { return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m; }
  // the tile of tiles.png for a ground cell (tools/pixelart.py tiles(): cobbles 104.., road 120.., plaza 124.., garden 128..)
  function groundTile(k, x, y) {
    var mx = ((x % 4) + 4) % 4, my = ((y % 4) + 4) % 4;
    if (k === 0) return 104 + my * 4 + mx;
    if (k === 1) return 120 + (my & 1) * 2 + (mx & 1);
    if (k === 2) return 124 + (my & 1) * 2 + (mx & 1);
    if (k === 7) { var h = hash(x, y) % 5; return h < 2 ? 132 : 135 + h; }      // the middle of a bed: four kinds of grass
    return 125 + k;
  }

  G.CityScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CityScene() { Phaser.Scene.call(this, { key: 'city' }); },

    create: function () {
      var self = this, C = this.cls = G.classDef(G.BAL, G.cls);
      G.screen = 'city'; G.city = this; G.gameScene = null; G.hud = null; G.paused = false; G.testRoom = false; G.tutorial = false; G.daily = null;
      if (G.runSeed == null) G.runSeed = G.params.has('seed') ? (parseInt(G.params.get('seed'), 10) >>> 0) : 1;
      this.gear = G.gearOf(G.save, G.cls);
      var L = this.lay = CITY;
      this.solids = L.solids.slice(); this.labels = []; this.world = [];
      this.controls = new G.Controls(this);
      this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.px = L.start.x; this.py = L.start.y; this.face = 1; this.moving = false; this.frame = 0; this.cam = { x: L.start.x, y: L.start.y };
      this.entering = false; this.near = null; this.out = { mx: 0, my: 0, dodge: false, pulse: false };
      this.cameras.main.setZoom(this.zoom());
      this.buildWorld();
      this.player = this.add.image(0, 0, 'atlas', C.sprite.frames + '_0').setOrigin(0.42, 1);
      this.shadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100);
      this.prig = new G.Rig(this, this.player, C.id);      // the HD hero, as in a room: walk frames and the motion rig (a class without a sheet stays chunky)
      this.tag = UI.text(this, 0, 0, G.t('city.talk'), 'ui_warn').setDepth(7500).setVisible(false);
      this.cameras.main.setBackgroundColor(UI.hex('void'));
      this.applyView();
      this.game.events.on('viewchange', this.applyView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.applyView, self); if (G.city === self) G.city = null; });
      this.scene.launch('cityhud'); this.scene.bringToTop('cityhud');
      this.cameras.main.fadeIn(250, 7, 6, 11);
      G.ready = true;
    },

    // a new screen size, zoom or language: the town is the same on every screen, only the camera and the texts change
    applyView: function () {
      this.cameras.main.setZoom(this.zoom());
      this.relabel(); this.follow(true);
    },

    // ---------------------------------------------------------------- the world
    buildWorld: function () {
      var self = this, L = this.lay, x, y, W = this.world, A = APRON, wall = L.wallAt;
      var put = function (px, py, frame) {
        var o = self.add.image(px, py, 'atlas', frame); W.push(o);
        // the stalls and the dummies have HD art (Grok, the chosen style): drawn from the HD atlas when the art mode is HD
        if (/^(stall_|dummy_)/.test(frame) && G.HD.frame(self, frame)) G.HD.show(o, frame, 0.5, 0.5);
        return o;
      };
      var glow = function (px, py, frame, tint, alpha) { return put(px, py, frame).setDepth(-650).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex(tint)).setAlpha(alpha); };
      this.marks = []; this.lights = []; this.anims2 = [];
      // ground and walls: two tile layers, as in a room (the rooms' wall tops, faces and shadows; the town's own ground),
      // with a rampart of wall top all round
      var ground = [], shade = [];
      for (y = -A; y < L.rows + A; y++) {
        var grow = [], srow = [];
        for (x = -A; x < L.cols + A; x++) {
          var idx, sh = -1;
          if (wall(x, y)) {
            var n = wall(x, y - 1), e = wall(x + 1, y), s = wall(x, y + 1), w = wall(x - 1, y);
            idx = !s ? 80 + (e ? 1 : 0) + (w ? 2 : 0) + (n ? 4 : 0) + (((x * 7 + y * 13) >> 1) & 1) * 8 : 64 + (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0);
          } else {
            idx = groundTile(L.groundAt(x, y), x, y);
            if (wall(x, y - 1)) sh = !wall(x - 1, y - 1) ? 97 : (!wall(x + 1, y - 1) ? 98 : 96);
            else if (wall(x - 1, y)) sh = 99;
          }
          grow.push(idx); srow.push(sh);
        }
        ground.push(grow); shade.push(srow);
      }
      var map = this.make.tilemap({ data: ground, tileWidth: T, tileHeight: T }), map2 = this.make.tilemap({ data: shade, tileWidth: T, tileHeight: T });
      W.push(map.createLayer(0, map.addTilesetImage('tiles', 'tiles', T, T, 0, 0), -A * T, -A * T).setDepth(-1000));
      W.push(map2.createLayer(0, map2.addTilesetImage('tiles', 'tiles', T, T, 0, 0), -A * T, -A * T).setDepth(-990));
      // wall torches: the sprite and the light of a room's torches (src/view/room.js)
      L.torches.forEach(function (t) {
        var tx = t[0] * T + 8, ty = t[1] * T + 8;
        self.lights.push({ img: put(tx, ty, 'torch_0').setDepth(-600), frames: 'torch_', n: 3, rate: 1, glow: glow(tx, ty + 6, 'glow', 'em2', 0.4), a: 0.36 });
      });
      // dressing
      L.props.forEach(function (p, i) {
        var d = PROP[p[0]] || {}, o = d.o || [0.5, 1];
        var im = put(p[1], p[2], d.frames ? p[0] + '_0' : p[0]).setOrigin(p[3] ? 1 - o[0] : o[0], o[1]).setFlipX(!!p[3]).setDepth(d.z != null ? d.z : p[2]);
        if (d.mark) self.marks.push({ name: p[0], o: im });
        if (d.light) self.lights.push({ img: d.frames ? im : null, frames: p[0] + '_', n: d.frames, rate: d.rate, glow: glow(p[1] + (p[3] ? -d.light[3] : d.light[3]), p[2] + d.light[4], d.light[0], d.light[1], d.light[2]), a: d.light[2] - 0.04, k: i });
        else if (d.frames) self.anims2.push({ img: im, frames: p[0] + '_', n: d.frames, rate: d.rate, k: i });
      });
      // the stalls and their keepers
      this.spots = {}; this.talkers = [];
      this.rescued = !!(this.gear.city && this.gear.city.montoto);
      L.stalls.forEach(function (s) {
        var empty = s.id === 'montoto' && !self.rescued, o = { s: s, empty: empty, front: { x: s.x, y: s.y + FRONT }, reach: REACH };
        o.stall = put(s.x, s.y, empty ? 'stall_empty' : s.frame).setOrigin(0.5, 1).setDepth(s.y);
        o.label = self.label(empty ? 'city.emptyStall' : s.label, empty ? 'ui_dim' : s.color, s.x, s.y - 52);
        self.marks.push({ name: s.id, o: o.stall });
        if (!empty) {
          o.npc = put(s.x, s.y + 12, s.npc + '_0').setOrigin(0.5, 1).setDepth(s.y + 12);
          o.shadow = put(s.x, s.y + 11, 'shadow_s').setDepth(-100);
          if (G.ANIM.ent[s.npc]) { o.rig = new G.Rig(self, o.npc, s.npc); W.push(o.rig.shadow); }     // HD art (Don Montoto): breathing, soft shadow
          self.marks.push({ name: s.id + '_keeper', o: o.npc });
          self.solids.push(L.keeperBox(s));
        }
        o.stall.setInteractive({ useHandCursor: true });
        if (o.npc) o.npc.setInteractive({ useHandCursor: true });
        var tap = function () { self.tap(o); };
        o.stall.on('pointerdown', tap); if (o.npc) o.npc.on('pointerdown', tap);
        self.spots[s.id] = o; self.talkers.push(o);
      });
      // the quarters: fenced lots, nothing built yet, and a sign to read
      this.signs = {};
      L.quarters.forEach(function (q) {
        q.lots.forEach(function (c) { self.marks.push({ name: q.id + '_lot', o: put(c[0], c[1], 'plot_fence').setOrigin(0.5, 1).setDepth(c[1]) }); });
        var o = { s: { id: q.id }, sign: q.sign, say: q.say, front: { x: q.sign.x, y: q.sign.y + 6 }, reach: 28, label: self.label(q.label, 'ui_dim', q.at.x, q.at.y) };
        o.img = put(q.sign.x, q.sign.y, 'c_sign').setOrigin(0.5, 1).setDepth(q.sign.y).setInteractive({ useHandCursor: true });
        o.img.on('pointerdown', function () { self.tap(o); });
        self.marks.push({ name: q.id + '_sign', o: o.img });
        self.signs[q.id] = o; self.talkers.push(o);
      });
      // the notice board of the daily challenge (READ opens today's run)
      this.board = put(L.board.x, L.board.y, 'c_board').setOrigin(0.5, 1).setDepth(L.board.y).setInteractive({ useHandCursor: true });
      this.board.on('pointerdown', function () { self.tap(self.boardOwner); });
      this.boardOwner = { s: { id: 'daily' }, front: { x: L.board.x, y: L.board.y + 8 }, reach: 24, label: this.label('city.daily', 'gold', L.board.x, L.board.y - 40) };
      this.marks.push({ name: 'board', o: this.board });
      this.talkers.push(this.boardOwner);
      // the portal
      this.portal = put(L.portal.x, L.portal.y, 'portal_0').setOrigin(0.5, 1).setDepth(L.portal.y - 20);
      this.portalGlow = glow(L.portal.x, L.portal.y - L.portal.cy, 'glow', 'rg2', 0.25).setDepth(-640);
      // the HD portal (Grok, two pieces): the stone arch, and the vortex drawn glowing inside it and turned by code
      this.portalArch = G.HD.frame(this, 'portal_arch') ? G.HD.show(put(L.portal.x, L.portal.y, 'portal_0'), 'portal_arch', 0.5, 1) : null;
      if (this.portalArch) { this.portalArch.setDepth(L.portal.y - 19); this.portal.setVisible(false); }
      this.swirl = null;
      if (G.HD.frame(this, 'portal_swirl')) {
        // the round vortex turns inside a box stretched to the opening (an oval that stays an oval while it turns)
        this.swirl = G.HD.show(this.add.image(0, 0, 'atlas', 'portal_0'), 'portal_swirl', 0.5, 0.5).setBlendMode(Phaser.BlendModes.ADD);
        var sw = this.swirl.frame.width;
        this.swirlBox = this.add.container(L.portal.x, L.portal.y - L.portal.cy, [this.swirl]).setDepth(L.portal.y - 20).setScale(PORTAL.oval[0] / (sw / 2), PORTAL.oval[1] / (sw / 2));
        W.push(this.swirlBox); this.swirlK = this.swirl.scaleX; this.portal.setVisible(false);
      }
      // sparks drawn into the vortex while the hero is near (and a burst when he goes in)
      this.pk = 0; this.sparks = [];
      for (var si = 0; si < 36; si++) this.sparks.push({ img: put(0, 0, 'px').setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex(si % 3 ? 'rg3' : 'ui_good')).setDepth(L.portal.y - 18).setVisible(false), t: 0, life: 0 });
      this.portalLabel = this.label('city.rift', 'ui_good', L.portal.x, L.portal.y - 58);
      this.marks.push({ name: 'portal', o: this.portal });
    },

    say: function (text, color) { if (G.cityHud) G.cityHud.say(text, color); },

    // A world label centred on cx. Labels are fixed to the town (the table places them so that none covers another label or a
    // landmark, whatever the screen: node qa/city.js checks it in both languages); only the prompt follows the screen.
    label: function (key, color, cx, y) {
      var t = UI.text(this, 0, 0, G.t(key), color).setDepth(6000), b = { t: t, cx: cx, y: y, key: key, box: { x: 0, y: 0, w: 0, h: 0 } };
      this.world.push(t);
      this.labels.push(b);
      this.placeLabel(b);
      return b;
    },
    // where an arrow points to show a stall or the portal: just above its label (the tutorial's city steps)
    pointAt: function (id) {
      var b = id === 'portal' ? this.portalLabel : this.spots[id] && this.spots[id].label;
      return b ? { world: true, x: b.cx, y: b.box.y - 6 } : null;
    },
    relabel: function () {      // the language changed: world labels and the prompt get the new text
      var self = this;
      (this.labels || []).forEach(function (b) { b.t.setText(G.t(b.key)); self.placeLabel(b); });
      if (this.tag) this.tag.setText(G.t('city.talk'));
      this.placeTag();
    },
    // the box a text really covers: an accented capital rises 2 px above its line
    box: function (t, x, y) { return { x: x, y: y - 2, w: t.width, h: 11 }; },
    placeLabel: function (b) {
      var w = b.t.width, x = Math.round(Math.max(3, Math.min(this.lay.w - 3 - w, b.cx - w / 2)));
      b.box = this.box(b.t, x, b.y);
      b.t.setPosition(x, b.y);
    },
    // The prompt (TALK / LOOK / READ) of the thing in reach sits one line above that thing's own label, centred on it, kept
    // on screen, and is lifted further while it touches any label: a prompt and a label never share pixels.
    placeTag: function () {
      var o = this.near, tag = this.tag;
      if (!tag || !o || !tag.visible) return;
      var wv = this.cameras.main.worldView, w = tag.width, lb = o.label.box;
      // a stall or the board: above its label. A sign: above the sign itself (the quarter's name is written over its lots)
      var cx = o.sign ? o.sign.x : lb.x + lb.w / 2, y = o.sign ? o.sign.y - 36 : lb.y + 2 - LINE, n = 0;
      var x = Math.round(Math.max(wv.x + 3, Math.min(wv.x + wv.width - 3 - w, cx - w / 2)));
      for (var k = 0; k < this.labels.length && n < 40; k++) if (overlap(this.box(tag, x, y - 1), this.labels[k].box, 2)) { y -= 2; k = -1; n++; }
      tag.setPosition(x, Math.round(y) - ((this.frame >> 4) & 1));
      this.tagBox = this.box(tag, x, y - 1);
    },

    // a tap on a stall, its owner, a sign or the board: talk if the hero is in reach
    tap: function (o) {
      if (G.paused || this.entering) return;
      if (this.inReach(o)) this.talk(o); else this.say(G.t('city.closer'), 'ui_dim');
    },
    inReach: function (o) { var dx = this.px - o.front.x, dy = this.py - o.front.y; return dx * dx + dy * dy <= o.reach * o.reach; },
    nearest: function () {
      var best = null, bd = 1e9, px = this.px, py = this.py;
      this.talkers.forEach(function (o) {
        var dx = px - o.front.x, dy = py - o.front.y, d = dx * dx + dy * dy;
        if (d <= o.reach * o.reach && d < bd) { bd = d; best = o; }
      });
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
      } else this.say(G.t(o.say), 'ui_dim');
    },
    // the label and what the button says for the thing in reach
    nearLabel: function (o) { return !o ? null : G.t(o.sign || o.s.id === 'daily' ? 'city.read' : o.empty ? 'city.look' : 'city.talk'); },

    // ---------------------------------------------------------------- movement
    // the hero's feet: a box 8 x 5 px. Walls are tiles, everything else is a box of the table
    blocked: function (x, y) {
      var l = x - 4, r = x + 4, t = y - 5, b = y, i, L = this.lay, tx, ty;
      for (ty = Math.floor(t / T); ty <= Math.floor((b - 0.001) / T); ty++) for (tx = Math.floor(l / T); tx <= Math.floor((r - 0.001) / T); tx++) if (L.wallAt(tx, ty)) return true;
      for (i = 0; i < this.solids.length; i++) { var s = this.solids[i]; if (r > s[0] && l < s[2] && b > s[1] && t < s[3]) return true; }
      return false;
    },
    move: function (dx, dy) {
      if (!this.blocked(this.px + dx, this.py)) this.px += dx;
      if (!this.blocked(this.px, this.py + dy)) this.py += dy;
    },
    // the camera: on the hero (a little above him), kept inside the town; a screen bigger than the town shows it centred
    // the camera zoom: the pixel scale S x BAL.tune.city (DBG > SIZES; a test tool, fractional: the town's art pixels may come out
    // uneven). The town's layout is the same, only how much of it fits on the screen changes.
    zoom: function () { return G.view.S * G.tuneOf(G.BAL, 'city'); },
    follow: function (snap) {
      var kc = G.view.S / this.zoom(), V = { W: G.view.W * kc, H: G.view.H * kc };      // the world the camera shows, in town px
      var cam = this.cameras.main, MW = this.lay.w, MH = this.lay.h, up = G.view.H < LOOK.short ? LOOK.upShort : LOOK.up;
      if (!this.cam) return;
      if (snap) { this.cam.x = this.px; this.cam.y = this.py - up; } else { this.cam.x += (this.px - this.cam.x) * 0.14; this.cam.y += (this.py - up - this.cam.y) * 0.14; }
      var cx = MW <= V.W ? MW / 2 : Math.max(V.W / 2, Math.min(MW - V.W / 2, this.cam.x));
      var cy = MH <= V.H ? MH / 2 : Math.max(V.H / 2, Math.min(MH - V.H / 2, this.cam.y));
      cam.centerOn(Math.round(cx), Math.round(cy));
      this.placeTag();
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
        if (this.near && !this.near.sign) G.Hints.on('city.near.' + this.near.s.id, !!this.near.empty);
        if ((o.dodge || o.pulse || enter) && this.near) this.talk(this.near);
        // the portal: walking into it starts a run
        var P = this.lay.portal;
        if (Math.abs(this.px - P.x) <= P.w / 2 && this.py >= P.y - P.h && this.py <= P.y) this.enterRift();
      } else if (G.paused) this.moving = false;
      // the hero: HD frames and the motion rig when the class has a sheet and the art mode is HD, else the chunky sprite
      var hx = Math.round(this.px), hy = Math.round(this.py);
      var ceq = G.gearOf(G.save, G.cls).equipped;
      this.prig.ent = G.HD.heroEnt(C.id, ceq);
      var kH = G.tuneOf(G.BAL, 'hero');
      if (this.entering) {
        // pulled into the vortex: to its foot, shrinking, spinning (the facing flips faster and faster)
        var Pa = this.lay.portal, ab = this.absorb, u = Math.min(1, (ab.t += G.paused ? 0 : dt) / ab.dur), e = u * u * (3 - 2 * u);
        this.px = ab.x + (Pa.x - ab.x) * e; this.py = ab.y + (Pa.y - 6 - ab.y) * e;
        this.face = ((ab.t * (6 + 22 * u)) | 0) % 2 ? 1 : -1;
        hx = Math.round(this.px); hy = Math.round(this.py);
        kH *= Math.max(0.05, 1 - 0.95 * e);
      }
      var hd = this.prig.update(G.paused ? 0 : dt, { x: hx, y: hy, ground: hy - 1, face: this.face, tx: null, state: 'walk', speed: C.base.speed, depth: this.py, k: kH,
        glow: G.HD.glowOf(ceq.weapon), weapon: G.HD.heroWeapon(this.prig.ent, C, ceq), trim: G.HD.trimColor(ceq), helm: G.HD.heroHelm(C.id, ceq), shield: G.HD.heroShield(ceq) });
      if (!hd) {
        if (this.player.isHD || this.player.texture.key !== 'atlas') G.HD.chunky(this.player, C.sprite.frames + '_0');
        var walk = this.moving ? ((this.frame >> 3) & 1) : 0;
        this.player.setFrame(C.sprite.frames + '_' + walk).setFlipX(this.face < 0).setOrigin(this.face < 0 ? 0.58 : 0.42, 1).setPosition(hx, hy).setDepth(this.py);
        G.HD.tuneChunky(this.player, kH);
      }
      this.shadow.setPosition(hx, hy - 1).setVisible(!hd).setScale(kH);
      var self = this, f = this.frame, i;
      Object.keys(this.spots).forEach(function (k) {
        var s = self.spots[k];
        if (s.rig && s.rig.update(G.paused ? 0 : dt, { x: s.s.x, y: s.s.y + 12, ground: s.s.y + 11, face: 1, tx: null, state: self.near === s && G.ANIM.ent[s.s.npc].talk ? 'talk' : 'idle', depth: s.s.y + 12 })) s.shadow.setVisible(false);
        else if (s.npc) {
          if (s.npc.isHD || s.npc.texture.key !== 'atlas') { G.HD.chunky(s.npc, s.s.npc + '_0'); s.npc.setOrigin(0.5, 1).setPosition(s.s.x, s.s.y + 12); }
          s.npc.setFrame(s.s.npc + '_' + (((f >> 4) + s.s.x) & 1));
          s.shadow.setVisible(true);
        }
      });
      // fires flicker like a room's torches; water, banners and candles move slowly
      for (i = 0; i < this.lights.length; i++) {
        var li = this.lights[i];
        if (li.img) li.img.setFrame(li.frames + (((f >> 3) / li.rate + i * 2) | 0) % li.n);
        li.glow.setAlpha(li.a + ((f >> 2) + i * 3) % 4 * 0.025);
      }
      for (i = 0; i < this.anims2.length; i++) { var an = this.anims2[i]; an.img.setFrame(an.frames + (((f >> 3) / an.rate + an.k) | 0) % an.n); }
      this.updatePortal(dt, time);
      var nl = this.nearLabel(this.near);
      this.tag.setVisible(!!nl && !G.paused);
      if (nl && this.near) this.tag.setText(nl);
      this.follow(false);                               // also places the prompt
    },

    // the portal: the vortex turns (faster and brighter as the hero comes near: pk 0..1), sparks are drawn into it
    updatePortal: function (dt, time) {
      var P = this.lay.portal, cx = P.x, cy = P.y - P.cy, f = this.frame;
      var dx = this.px - cx, dy = this.py - P.y, d = Math.sqrt(dx * dx + dy * dy);
      var want = this.entering ? 1 : Math.max(0, Math.min(1, 1 - (d - 24) / 72));
      if (!G.paused) this.pk += (want - this.pk) * Math.min(1, dt * 4);
      var pk = this.pk, B = PORTAL;
      if (this.portal.visible) this.portal.setFrame('portal_' + ((f >> (pk > 0.5 ? 2 : 3)) % 3));
      this.portalGlow.setAlpha(B.glow[0] + B.glow[1] * pk + Math.sin(time / 300) * 0.04).setScale(1 + B.grow * pk);
      if (this.swirl) {
        if (!G.paused) this.swirl.rotation -= dt * (B.spin[0] + B.spin[1] * pk);
        this.swirl.setScale(this.swirlK * (1 + 0.08 * pk + 0.03 * Math.sin(time / 260)));
      }
      if (G.paused) return;
      var rate = B.sparks * pk + (this.entering ? B.burst : 0);
      this.sparkAcc = (this.sparkAcc || 0) + rate * dt;
      for (var i = 0; i < this.sparks.length; i++) {
        var s = this.sparks[i];
        if (s.life <= 0 && this.sparkAcc >= 1) { this.sparkAcc--; s.t = 0; s.life = 0.5 + Math.random() * 0.5; s.a = Math.random() * Math.PI * 2; s.r = B.r[0] + Math.random() * (B.r[1] - B.r[0]); }
        if (s.life <= 0) { s.img.setVisible(false); continue; }
        s.t += dt; var u = s.t / s.life;
        if (u >= 1) { s.life = 0; s.img.setVisible(false); continue; }
        var a = s.a + u * 2.2, r = s.r * (1 - u);
        s.img.setVisible(true).setPosition(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * PORTAL.oval[1] / PORTAL.oval[0])).setAlpha(Math.min(1, (1 - u) * 2)).setScale(u < 0.3 ? 2 : 1);
      }
      this.sparkAcc = Math.min(this.sparkAcc, 3);
    },

    enterRift: function () {
      if (this.entering) return;
      this.entering = true;
      this.absorb = { x: this.px, y: this.py, t: 0, dur: PORTAL.absorb };
      this.tag.setVisible(false);
      G.Tut.did('city');      // walking into the portal is the last step of the city's tutorial (and ends it, if the player went straight there)
      var self = this;
      if (G.cityHud) G.cityHud.dropStick();
      // the hero is pulled in (update), a green flash as he vanishes, then the fade
      var cam = this.cameras.main;
      this.time.delayedCall(PORTAL.absorb * 900, function () { cam.flash(160, 168, 240, 64); });
      this.time.delayedCall(PORTAL.absorb * 1000, function () { cam.fadeOut(240, 7, 6, 11); });
      cam.once('camerafadeoutcomplete', function () {
        G.testRoom = false; G.storeSave(G.save);
        self.scene.stop('cityhud'); self.scene.start('game');
      });
    },

    // QA: where things are, in world px, plus the camera, so a test can check what is on screen and what overlaps.
    // things: the boxes of the landmarks (stalls, keepers, lots, signs, the board, the portal, the fountain, the gate)
    snapshot: function () {
      var spots = {}, signs = {}, L = this.lay, wv = this.cameras.main.worldView, k;
      for (k in this.spots) spots[k] = { x: this.spots[k].front.x, y: this.spots[k].front.y, empty: !!this.spots[k].empty, sx: this.spots[k].s.x, sy: this.spots[k].s.y };
      for (k in this.signs) signs[k] = { x: this.signs[k].front.x, y: this.signs[k].front.y };
      return { x: Math.round(this.px), y: Math.round(this.py), near: this.near ? this.near.s.id : null, rescued: this.rescued, entering: this.entering, spots: spots,
        portal: { x: L.portal.x, y: L.portal.y, w: L.portal.w, h: L.portal.h }, start: L.start, sign: signs.plot, signs: signs, board: { x: this.boardOwner.front.x, y: this.boardOwner.front.y }, layout: L.id, map: { w: L.w, h: L.h },
        view: { x: wv.x, y: wv.y, w: wv.width, h: wv.height }, heroHD: !!this.player.isHD, heroFrame: this.player.frame.name,
        labels: this.labels.map(function (b) { return { key: b.key, x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h }; }),
        things: this.marks.map(function (m) { var r = m.o.getBounds(); return { name: m.name, x: r.x, y: r.y, w: r.width, h: r.height }; }),
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
      kb.on('keydown-F2', function (e) {      // size tuning in the town (the city's zoom applies at once); ?debug=0 turns it off
        if (e && e.preventDefault) e.preventDefault();
        if (G.params.get('debug') === '0') return;
        if (G.Panels.current === 'sizes') G.Panels.close(); else if (!G.Panels.isOpen()) { self.dropStick(); G.Panels.openSizes(self); }
      });
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
      L.button(V.W - X - 26, Y + 52, 26, 20, G.t('city.end'), function () { if (!G.Panels.isOpen()) { G.Panels.close(true); self.scene.stop('city'); self.scene.stop('cityhud'); self.scene.start('menu'); } }, { name: 'city_title' });
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
      G.Hints.attach(this); G.Tut.attach(this);
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
      G.Tut.tick(this);
      if (this.toastT > 0 && --this.toastT <= 0) this.toast.setVisible(false);
      else if (this.toastT > 0 && this.toastT < 30) this.toast.setAlpha(this.toastT / 30);
    }
  });
})(globalThis.G = globalThis.G || {});
