// Draws a generated room: tilemap (floor slabs, wall tops and faces), shadows, decals,
// torches with additive light, and the fissures (per-pixel textures redrawn when they change).
(function (G) {
  var UI = G.UI, T = 16, fissSeq = 0;
  var FLASH_T = 24, FLASH_R = 18;        // bump flare: sim ticks, px radius
  var ARM_GLOW = 52;                     // px between the lights along a crack's arms
  // Lava (the user, 2026-11-13: "que se note que haya lava, fuego"): an open crack is molten rock that flows, with flames and
  // embers rising from it; its lip is a dark crust glowing red. Sealed, it is a black crust that cools (no flames).
  // flow: noise px moved per sim tick (two layers, x/y); ramp: black -> white-hot; bands: where (0 wall .. 1 middle)
  // red, red-orange and orange start; heat: the middle's ramp index = heat[0] + noise x heat[1];
  // flames: open core px per flame a second, cap per crack, life (ticks), rise (px/tick); embers: share of the flames.
  var LAVA = { flow: [0.05, 0.02, -0.035, 0.03], ramp: ['#170507', '#4a0e08', '#962210', '#d23c10', '#f26818', '#ff9a26', '#ffc84a', '#fff0a8'],
    bands: [0.3, 0.55, 0.75], heat: [3.6, 2.9], crust: 0.3, every: 3, flames: 9, cap: 80, capBig: 140, life: [28, 56], rise: [0.25, 0.55], embers: 0.25, glow: 'em2',
    // heat on the floor round the crack (R px, peak alpha), the pulse running along it (waves over the crack, speed, strength),
    // bubbles a second per middle px, smoke: share of the flames, its colour and alpha
    heatR: 5, heatA: 0.5, wave: [26, 0.045, 0.9], bubbles: 1 / 160, smoke: 0.16, smokeCol: 0x2a2228, smokeA: 0.4 };
  // a smooth value-noise table, 128 x 128, wrapping (view only: Math-free hash, same every run)
  var NZ = (function () {
    var N = 128, a = new Float32Array(N * N), b = new Float32Array(N * N), i, x, y, k;
    for (i = 0; i < N * N; i++) { var h = (i * 2654435761) >>> 0; h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; a[i] = (h & 1023) / 1023; }
    for (k = 0; k < 3; k++) {      // three box blurs, 5 px wide, wrapping
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var sm = 0; for (i = -2; i <= 2; i++) sm += a[y * N + ((x + i + N) & (N - 1))]; b[y * N + x] = sm / 5; }
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var sv = 0; for (i = -2; i <= 2; i++) sv += b[(((y + i + N) & (N - 1)) * N) + x]; a[y * N + x] = sv / 5; }
    }
    var lo = 1, hi = 0; for (i = 0; i < N * N; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    for (i = 0; i < N * N; i++) a[i] = (a[i] - lo) / (hi - lo);
    return a;
  })();
  var RAMP = null;
  // HD fissure (the user's reference, 2026-11-13: lumpy rock lip, a red seam, the far wall dripping into the pit, lava below,
  // sparkles; drawn at the HD art's density so it is not chunky). S: sub px per room px; pad: room px of lip outside the crack;
  // edge / pit: where the smoothed field (outside -1, crack 0.5, pit 1) starts the crack and the pit; pitMid: the crack px whose
  // FissureView.mid is at least this are pit; lump: share of the lip px past the crack that are rock lumps; drip: the far wall's
  // longest drip (sub px) and its share of the pit's height; rock: the lip's colours dark -> light; seam: the red line.
  var HDF = { S: 2, pad: 3, edge: -0.25, pit: 0.8, pitMid: 0.42, lump: [0.36, 0.09, 4], drip: [9, 0.6], spark: 41,
    rock: ['#0b0807', '#251a15', '#3b2b22', '#564131', '#735845'], seam: ['#c41a08', '#ff3a10', '#ff6a1c', '#ffa030'], wallTip: [170, 40, 14] };
  var HEX = function (hx) { var v = parseInt(hx.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  // the user (2026-11-13): a black crack, a little red going in, orange in the middle where the lava / fire is.
  // m: 0 at the wall .. 1 in the middle (FissureView.mid). The middle flows (noise) with hot yellow streaks.
  function lavaCol(c, h, m, tick) { return lavaColXY(c.x * 2, c.y * 2, c.o || 0, h, m, tick); }
  function lavaColXY(x, y, o, h, m, tick) {
    if (!RAMP) RAMP = LAVA.ramp.map(function (hx) { var v = parseInt(hx.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; });
    var F = LAVA.flow;
    var n1 = NZ[(((y + tick * F[1]) | 0) & 127) * 128 + (((x + tick * F[0]) | 0) & 127)];
    var n2 = NZ[((((y * 3 >> 1) + 61 + tick * F[3]) | 0) & 127) * 128 + ((((x * 3 >> 1) + 17 + tick * F[2]) | 0) & 127)];
    var v = n1 * 0.55 + n2 * 0.45; v = v * v * (3 - 2 * v);
    var B = LAVA.bands, wv = Math.sin(o * LAVA.wave[0] - tick * LAVA.wave[1]);      // a pulse running along the crack
    if (wv > 0.75 && m >= B[0]) m += 0.25;
    if (m < B[0]) return v > 0.8 ? RAMP[2] : (h % 6 === 0 ? RAMP[1] : RAMP[0]);           // the black wall, a red glint
    if (m < B[1]) return v > 0.6 ? RAMP[3] : RAMP[2];                                     // red, going in
    if (m < B[2]) return v > 0.55 ? RAMP[4] : RAMP[3];                                    // red-orange
    return RAMP[Math.max(4, Math.min(RAMP.length - 1, Math.round(LAVA.heat[0] + v * LAVA.heat[1] + (h & 3) * 0.08 + Math.max(0, wv) * LAVA.wave[2])))];   // the middle: orange lava, yellow streaks
  }
  function rimCol(h, tick) { if (!RAMP) lavaCol({ x: 0, y: 0 }, 0, 0, 0); return (h + (tick >> 4)) % 17 === 0 ? RAMP[1] : RAMP[0]; }

  G.RoomView = function (scene, room) {
    var W = room.w, H = room.h, ground = [], shade = [], x, y, i;
    // HD art pilot: the floor is one tiled texture at double density (assets/hd_floor.png, tools/hd_atlas.py floor) under
    // the tile layer, whose floor cells are left empty; walls, wall faces and the shadow overlays stay chunky
    var hdFloor = G.hdMode && G.hdStyle !== 'lo' && scene.textures.exists('hd_floor');
    function wall(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : room.tiles[ty * W + tx]; }
    for (y = 0; y < H; y++) {
      var row = [], srow = [];
      for (x = 0; x < W; x++) {
        var idx, sh = -1;
        if (wall(x, y)) {
          var n = wall(x, y - 1), e = wall(x + 1, y), s = wall(x, y + 1), w = wall(x - 1, y);
          if (!s && y + 1 < H) idx = 80 + (e ? 1 : 0) + (w ? 2 : 0) + (n ? 4 : 0) + (((x * 7 + y * 13) >> 1) & 1) * 8;
          else idx = 64 + (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0);
        } else {
          idx = hdFloor ? -1 : (y % 8) * 8 + (x % 8);
          if (wall(x, y - 1)) sh = !wall(x - 1, y - 1) ? 97 : (!wall(x + 1, y - 1) ? 98 : 96);
          else if (wall(x - 1, y)) sh = 99;
        }
        row.push(idx); srow.push(sh);
      }
      ground.push(row); shade.push(srow);
    }
    this.scene = scene;
    this.map = scene.make.tilemap({ data: ground, tileWidth: T, tileHeight: T });
    this.layer = this.map.createLayer(0, this.map.addTilesetImage('tiles', 'tiles', T, T, 0, 0), 0, 0).setDepth(-1000);
    this.floor = hdFloor ? scene.add.tileSprite(0, 0, W * T * G.HD.density, H * T * G.HD.density, 'hd_floor').setOrigin(0, 0).setScale(1 / G.HD.density).setDepth(-1001) : null;
    this.map2 = scene.make.tilemap({ data: shade, tileWidth: T, tileHeight: T });
    this.layer2 = this.map2.createLayer(0, this.map2.addTilesetImage('tiles', 'tiles', T, T, 0, 0), 0, 0).setDepth(-990);
    this.items = [];
    for (i = 0; i < room.decals.length; i++) {
      var d = room.decals[i];
      this.items.push(scene.add.image(d.x, d.y, 'atlas', 'decal_' + d.k).setDepth(-900));
    }
    this.torches = [];
    var torchAt = {};
    for (i = 0; i < room.torches.length; i++) {
      var t = room.torches[i];
      var img = scene.add.image(t.x, t.y, 'atlas', 'torch_0').setDepth(-600);
      var glow = scene.add.image(t.x, t.y + 6, 'atlas', 'glow').setDepth(-650).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em2')).setAlpha(0.4);
      this.torches.push({ img: img, glow: glow }); this.items.push(img, glow);
      torchAt[((t.y - 8) / T) * W + (t.x - 8) / T] = 1;
    }
    this.candles = [];
    this.dress(scene, room, wall, torchAt);
    this.fissures = room.fissures.map(function (f) { return new FissureView(scene, f); });
  };
  // Props (step 9): bones, skulls, rubble, grates, puddles, candles on the floor; cobwebs in inner corners;
  // chains, banners and moss on wall faces. View only: picked by a hash of seed, room and tile, never by the
  // sim's rng, so the sim and the bot are unchanged. Never on a fissure, the start, the exit or the chest.
  var FLOOR_PROPS = ['prop_bones', 'prop_rubble', 'prop_skull', 'prop_grate', 'prop_puddle', 'prop_bones', 'prop_rubble', 'prop_candles'];
  var WALL_PROPS = ['wall_chain', 'wall_banner', 'wall_moss', 'wall_chain', 'wall_moss'];
  var FLAT = { prop_grate: 1, prop_puddle: 1, prop_bones: 1 };
  G.RoomView.prototype.dress = function (scene, room, wall, torchAt) {
    var W = room.w, H = room.h, busy = {}, x, y, i, j, self = this;
    room.fissures.forEach(function (f) {
      f.cells.forEach(function (c) { busy[Math.floor((f.y + c.y) / T) * W + Math.floor((f.x + c.x) / T)] = 1; });
    });
    function keep(px, py, r) { for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) busy[(Math.floor(py / T) + yy) * W + Math.floor(px / T) + xx] = 1; }
    keep(room.start.x, room.start.y, 2); keep(room.exit.x, room.exit.y, 1); keep(room.chest.x, room.chest.y, 1);
    function put(px, py, frame, depth, flip) {
      var im = scene.add.image(px, py, 'atlas', frame).setDepth(depth).setFlipX(!!flip);
      self.items.push(im); return im;
    }
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      var h = G.hash32(room.seed ^ (x * 7349 + y * 131), room.index * 977 + y * 31 + x), r = h % 1000, k = (h >>> 10);
      if (wall(x, y)) {
        // south-facing wall face without a torch
        if (!wall(x, y + 1) && !torchAt[y * W + x] && r < 250) put(x * T + 8, y * T + 9, WALL_PROPS[k % WALL_PROPS.length], -610);
        continue;
      }
      if (busy[y * W + x]) continue;
      if (wall(x, y - 1) && wall(x - 1, y) && r < 600) { put(x * T + 6, y * T + 6, 'prop_web', -880); continue; }
      if (wall(x, y - 1) && wall(x + 1, y) && r < 600) { put(x * T + 10, y * T + 6, 'prop_web', -880, true); continue; }
      if (r >= 32) continue;
      var fr = FLOOR_PROPS[k % FLOOR_PROPS.length], px = x * T + 4 + (k >> 4) % 8, py = y * T + 5 + (k >> 8) % 7;
      if (fr === 'prop_candles') {
        var c = put(px, py, 'prop_candles_0', py + 3);
        c.glow = scene.add.image(px, py - 2, 'atlas', 'glow_s').setDepth(-640).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em3')).setAlpha(0.35);
        self.items.push(c.glow); self.candles.push(c);
      } else put(px, py, fr, FLAT[fr] ? -890 : py + 2, (k >> 12) & 1);
    }
  };
  G.RoomView.prototype.tick = function (frame, simFissures, simTick) {
    var i;
    for (i = 0; i < this.candles.length; i++) this.candles[i].setFrame('prop_candles_' + (((frame >> 4) + i) & 1));
    for (i = 0; i < this.torches.length; i++) {
      var t = this.torches[i], k = ((frame >> 3) + i * 2) % 3;
      t.img.setFrame('torch_' + k);
      t.glow.setAlpha(0.36 + ((frame >> 2) + i * 3) % 4 * 0.025);
    }
    if (simFissures) for (i = 0; i < this.fissures.length; i++) this.fissures[i].update(simFissures[i], simTick);
  };
  G.RoomView.prototype.bump = function (x, y, tick) {
    for (var i = 0; i < this.fissures.length; i++) this.fissures[i].bump(x, y, tick);
  };
  G.RoomView.prototype.destroy = function () {
    this.items.forEach(function (o) { o.destroy(); });
    this.fissures.forEach(function (f) { f.destroy(); });
    if (this.floor) this.floor.destroy();
    this.layer.destroy(); this.map.destroy(); this.layer2.destroy(); this.map2.destroy();
  };

  // ------------------------------------------------------------------ fissure
  // Open: green rift light inside an ember-hot rim. Sealed: a dark scar with an orange edge
  // that cools but never fully fades. Dormant (super fissure only): a hairline crack.
  function FissureView(scene, f) {
    var cells = f.cells, n = cells.length, i, minX = 0, minY = 0, maxX = 0, maxY = 0;
    // barrier edge: a 1 px dark halo just outside the ember rim, drawn while a segment is open,
    // so the line the mage cannot walk over reads against any floor
    var seen = {}, halo = [];
    for (i = 0; i < n; i++) seen[cells[i].x + ',' + cells[i].y] = 1;
    for (i = 0; i < n; i++) {
      if (cells[i].core) continue;
      for (var hy = -1; hy <= 1; hy++) for (var hx = -1; hx <= 1; hx++) {
        var kk0 = (cells[i].x + hx) + ',' + (cells[i].y + hy);
        if (seen[kk0]) continue;
        seen[kk0] = 1;
        halo.push({ x: cells[i].x + hx, y: cells[i].y + hy, o: cells[i].o, seg: cells[i].seg });
      }
    }
    this.halo = halo;
    for (i = 0; i < n + halo.length; i++) {
      var cc0 = i < n ? cells[i] : halo[i - n];
      minX = Math.min(minX, cc0.x); maxX = Math.max(maxX, cc0.x);
      minY = Math.min(minY, cc0.y); maxY = Math.max(maxY, cc0.y);
    }
    this.w = maxX - minX + 1; this.h = maxY - minY + 1; this.ox = minX; this.oy = minY;
    // depth of each core cell = steps to the nearest rim cell (drives the inner colour bands)
    var w = this.w, grid = new Int16Array(w * this.h).fill(-1), q = [], head = 0;
    for (i = 0; i < n; i++) {
      var gi = (cells[i].y - minY) * w + (cells[i].x - minX);
      if (cells[i].core) grid[gi] = 99; else { grid[gi] = 0; q.push(gi); }
    }
    while (head < q.length) {
      var c = q[head++], cx = c % w, dd = grid[c] + 1, nb = [cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, c - w, c + w];
      for (var k = 0; k < 4; k++) {
        var ni = nb[k];
        if (ni >= 0 && ni < grid.length && grid[ni] > dd) { grid[ni] = dd; q.push(ni); }
      }
    }
    this.cells = cells;
    this.depth = cells.map(function (cl) { return grid[(cl.y - minY) * w + (cl.x - minX)]; });
    // how deep a px sits in its own part of the crack: depth / the deepest px within 3 px (0 = the black wall, 1 = the middle),
    // so a thin arm has its own orange middle line like the wide parts
    var hh = this.h;
    this.mid = cells.map(function (cl, ci) {
      var gx = cl.x - minX, gy = cl.y - minY, m = 1;
      for (var yy = Math.max(0, gy - 3); yy <= Math.min(hh - 1, gy + 3); yy++) for (var xx = Math.max(0, gx - 3); xx <= Math.min(w - 1, gx + 3); xx++) { var g = grid[yy * w + xx]; if (g > m && g < 99) m = g; }
      return Math.min(1, grid[gy * w + gx] / m);
    });
    this.hash = cells.map(function (cl) { return (((cl.x * 73856093) ^ (cl.y * 19349663)) >>> 0) % 64; });
    this.key = 'fiss' + (fissSeq++);
    this.scene = scene; this.big = f.big; this.fx0 = f.x; this.fy0 = f.y;
    this.flash = null;                   // { x, y, tick }: where the mage last bumped into this crack
    this.tex = scene.textures.createCanvas(this.key, Math.max(1, this.w), Math.max(1, this.h));
    this.ctx = this.tex.getContext();
    this.img = this.ctx.createImageData(Math.max(1, this.w), Math.max(1, this.h));
    this.sprite = scene.add.image(f.x + minX, f.y + minY, this.key).setOrigin(0, 0).setDepth(-800);
    // the heat on the floor: px up to LAVA.heatR from the crack (8-neighbour distance), each tied to the nearest crack px's
    // segment and order, drawn orange (ADD) under the crack while that part is open
    var R = LAVA.heatR, hw = this.w + 2 * R, hh2 = this.h + 2 * R, dist = new Int8Array(hw * hh2).fill(99), hseg = new Int16Array(hw * hh2), ho = new Float32Array(hw * hh2), hsx = new Int16Array(hw * hh2), hsy = new Int16Array(hw * hh2), hq = [], hh0 = 0;
    for (i = 0; i < n + halo.length; i++) {
      var hc0 = i < n ? cells[i] : halo[i - n], hi0 = (hc0.y - minY + R) * hw + (hc0.x - minX + R);
      if (dist[hi0] === 0) continue;
      dist[hi0] = 0; hseg[hi0] = hc0.seg | 0; ho[hi0] = hc0.o || 0; hsx[hi0] = hi0 % hw; hsy[hi0] = (hi0 / hw) | 0; hq.push(hi0);
    }
    while (hh0 < hq.length) {
      var hc1 = hq[hh0++], hx1 = hc1 % hw, hy1 = (hc1 / hw) | 0, hd1 = dist[hc1] + 1;
      if (hd1 > R) continue;
      for (var dy1 = -1; dy1 <= 1; dy1++) for (var dx1 = -1; dx1 <= 1; dx1++) {
        var nx1 = hx1 + dx1, ny1 = hy1 + dy1;
        if (nx1 < 0 || ny1 < 0 || nx1 >= hw || ny1 >= hh2) continue;
        var ni1 = ny1 * hw + nx1;
        if (dist[ni1] > hd1) { dist[ni1] = hd1; hseg[ni1] = hseg[hc1]; ho[ni1] = ho[hc1]; hsx[ni1] = hsx[hc1]; hsy[ni1] = hsy[hc1]; hq.push(ni1); }
      }
    }
    this.heatCells = [];
    for (i = 0; i < hw * hh2; i++) if (dist[i] >= 1 && dist[i] <= R) { var de = Math.hypot(i % hw - hsx[i], ((i / hw) | 0) - hsy[i]); if (de <= R) this.heatCells.push({ p: i * 4, d: de, seg: hseg[i], o: ho[i] }); }      // round, not square
    this.heatKey = this.key + 'h';
    this.heatTex = scene.textures.createCanvas(this.heatKey, hw, hh2);
    this.heatCtx = this.heatTex.getContext(); this.heatImg = this.heatCtx.createImageData(hw, hh2);
    this.heatSprite = scene.add.image(f.x + minX - R, f.y + minY - R, this.heatKey).setOrigin(0, 0).setDepth(-805).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = scene.add.image(f.x, f.y, 'atlas', 'glow').setDepth(-790).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.glow2 = f.big ? scene.add.image(f.x, f.y, 'atlas', 'glow').setDepth(-789).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0) : null;
    // long cracks (step big rooms): one light in the middle no longer reaches the arms, so smaller lights sit along them,
    // ARM_GLOW px apart, each tied to the segment (band) of the crack px under it: it goes out with that band
    this.armGlows = [];
    if (!f.big) {
      for (i = 0; i < n; i++) {
        var gc = cells[i], far = gc.core && this.depth[i] >= 2 && gc.x * gc.x + gc.y * gc.y >= ARM_GLOW * ARM_GLOW;
        for (var g0 = 0; far && g0 < this.armGlows.length; g0++) {
          var ag = this.armGlows[g0];
          if ((ag.lx - gc.x) * (ag.lx - gc.x) + (ag.ly - gc.y) * (ag.ly - gc.y) < ARM_GLOW * ARM_GLOW) far = false;
        }
        if (!far) continue;
        var gi2 = scene.add.image(f.x + gc.x, f.y + gc.y, 'atlas', 'glow').setDepth(-790).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.6);
        this.armGlows.push({ img: gi2, lx: gc.x, ly: gc.y, seg: gc.seg | 0, o: gc.o });
      }
    }
    // a big crack is a big texture to upload: its shimmer and its opening are redrawn half as often
    this.slow = this.w * this.h > 60000;
    this.last = '';
    this.C = {};
    var self = this;
    ['f0', 'outline', 'scar', 'rg0', 'rg1', 'rg2', 'rg3', 'rg4', 'em0', 'em1', 'em2', 'em3', 'em4'].forEach(function (kk) { self.C[kk] = UI.rgb(kk); });
    this.heatTex.setFilter(Phaser.Textures.FilterMode.LINEAR);      // the heat on the floor is soft light, not px
    this.hd = !!(G.hdMode && G.hdStyle !== 'lo');
    if (this.hd) this.buildHD(scene, f);
  }

  // ---- the HD fissure: built once (shape, distances, the rock's colours), painted per state (paintHD)
  FissureView.prototype.buildHD = function (scene, f) {
    var S = HDF.S, PC = HDF.pad, cells = this.cells, n = cells.length, ox = this.ox, oy = this.oy, i, x, y, k;
    var CW = this.w + 2 * PC, CH = this.h + 2 * PC, val = new Float32Array(CW * CH).fill(-1), cidx = new Int32Array(CW * CH).fill(-1);
    for (i = 0; i < n; i++) { var c = cells[i], gi = (c.y - oy + PC) * CW + (c.x - ox + PC); val[gi] = c.core && this.mid[i] >= HDF.pitMid ? 1 : 0.5; cidx[gi] = i; }
    var W2 = CW * S, H2 = CH * S, N2 = W2 * H2, crack = new Uint8Array(N2), pit = new Uint8Array(N2), own = new Int32Array(N2).fill(-1);
    function get(cx, cy) { return cx < 0 || cy < 0 || cx >= CW || cy >= CH ? -1 : val[cy * CW + cx]; }
    function gid(cx, cy) { return cx < 0 || cy < 0 || cx >= CW || cy >= CH ? -1 : cidx[cy * CW + cx]; }
    for (y = 0; y < H2; y++) for (x = 0; x < W2; x++) {
      var fx = (x + 0.5) / S - 0.5, fy = (y + 0.5) / S - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      var v = (get(x0, y0) * (1 - tx) + get(x0 + 1, y0) * tx) * (1 - ty) + (get(x0, y0 + 1) * (1 - tx) + get(x0 + 1, y0 + 1) * tx) * ty;
      if (v <= HDF.edge) continue;
      k = y * W2 + x; crack[k] = 1; if (v > HDF.pit) pit[k] = 1;
      var best = -1, bw = -1, cand = [[x0, y0, (1 - tx) * (1 - ty)], [x0 + 1, y0, tx * (1 - ty)], [x0, y0 + 1, (1 - tx) * ty], [x0 + 1, y0 + 1, tx * ty]];
      for (var q = 0; q < 4; q++) { var id = gid(cand[q][0], cand[q][1]); if (id >= 0 && cand[q][2] > bw) { bw = cand[q][2]; best = id; } }
      own[k] = best;
    }
    // distances (8-neighbour steps): inside the pit to its edge; outside the pit to it; outside the crack to it (and its owner)
    function bfs(isSrc, limit, carry) {
      var D = new Int16Array(N2).fill(999), Q = new Int32Array(N2), qh = 0, qt = 0, j;
      for (j = 0; j < N2; j++) if (isSrc(j)) { D[j] = 0; Q[qt++] = j; }
      while (qh < qt) {
        var cur = Q[qh++], cx = cur % W2, cy = (cur / W2) | 0, nd = D[cur] + 1;
        if (nd > limit) continue;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) continue;
          var nk = ny * W2 + nx; if (D[nk] > nd) { D[nk] = nd; if (carry && carry[nk] < 0) carry[nk] = carry[cur]; Q[qt++] = nk; }
        }
      }
      return D;
    }
    var dIn = bfs(function (j) { return !pit[j]; }, 60), dOut = bfs(function (j) { return pit[j]; }, 40), dCr = bfs(function (j) { return crack[j]; }, HDF.lump[2], own);
    // the pit's vertical span: px of pit above (dUp) and below in the same column; and its horizontal span
    var up = new Int16Array(N2), dn = new Int16Array(N2), lf = new Int16Array(N2), rt = new Int16Array(N2);
    for (x = 0; x < W2; x++) { for (y = 0; y < H2; y++) { k = y * W2 + x; up[k] = pit[k] ? (y > 0 && pit[k - W2] ? up[k - W2] + 1 : 0) : 0; }
      for (y = H2 - 1; y >= 0; y--) { k = y * W2 + x; dn[k] = pit[k] ? (y < H2 - 1 && pit[k + W2] ? dn[k + W2] + 1 : 0) : 0; } }
    for (y = 0; y < H2; y++) { for (x = 0; x < W2; x++) { k = y * W2 + x; lf[k] = pit[k] ? (x > 0 && pit[k - 1] ? lf[k - 1] + 1 : 0) : 0; }
      for (x = W2 - 1; x >= 0; x--) { k = y * W2 + x; rt[k] = pit[k] ? (x < W2 - 1 && pit[k + 1] ? rt[k + 1] + 1 : 0) : 0; } }
    var ROCK = HDF.rock.map(HEX), wx = (this.fx0 + ox) * S, wy = (this.fy0 + oy) * S;      // noise in room sub px: cracks side by side do not repeat
    function nzA(ax, ay) { return NZ[(((ay * 3) >> 1) & 127) * 128 + (((ax * 3) >> 1) & 127)]; }
    function rock(ax, ay) {
      var v = nzA(ax, ay), d = v - nzA(ax - 1, ay - 1), lev = v > 0.66 ? 3 : v > 0.48 ? 2 : v > 0.3 ? 1 : 0;
      return ROCK[Math.max(0, Math.min(4, lev + (d > 0.025 ? 1 : d < -0.025 ? -1 : 0)))];
    }
    var solid = new Uint8Array(N2);      // crack or rock lump: the lip's outer edge is where solid ends
    for (k = 0; k < N2; k++) solid[k] = crack[k] || (dCr[k] <= HDF.lump[2] && nzA(k % W2 + wx + 40, ((k / W2) | 0) + wy + 40) > HDF.lump[0] + dCr[k] * HDF.lump[1]) ? 1 : 0;
    var LP = [], LC = [], LK = [], LA = [], LR = [], LG = [], LB = [], LH = [], LX = [], LY = [];
    for (k = 0; k < N2; k++) {
      var kind = -1, a = 0, x1 = k % W2, y1 = (k / W2) | 0, ax = x1 + wx, ay = y1 + wy, oc = own[k];
      if (pit[k]) {
        var cs = up[k] + dn[k] + 1, rs = lf[k] + rt[k] + 1, span = Math.min(cs, rs);
        var wl = Math.min(cs * HDF.drip[1], 1.5 + NZ[((ax * 5) & 127) + 37 * 128] * HDF.drip[0] * (0.6 + 0.8 * NZ[((ax * 11) & 127) + 91 * 128]));
        if (cs >= 4 && up[k] < wl) { kind = 2; a = up[k] / Math.max(1, wl); }
        else { kind = 3; a = Math.min(1, dIn[k] / Math.max(1, span / 2)); }
      } else if (crack[k]) kind = dOut[k] <= 1 ? 1 : 0;
      else if (solid[k]) kind = 0;      // rock lumps spilling past the crack
      if (kind < 0 || oc < 0) continue;
      var rc = rock(ax, ay);
      if (kind === 0) {
        // the lip's outer edge: 1 px of the darkest rock
        var outer = (x1 === 0 || !solid[k - 1]) || (x1 === W2 - 1 || !solid[k + 1]) || (y1 === 0 || !solid[k - W2]) || (y1 === H2 - 1 || !solid[k + W2]);
        if (outer) rc = ROCK[0];
      }
      LP.push(k * 4); LC.push(oc); LK.push(kind); LA.push(a); LR.push(rc[0]); LG.push(rc[1]); LB.push(rc[2]); LH.push((((ax * 73856093) ^ (ay * 19349663)) >>> 0) % 997); LX.push(ax); LY.push(ay);
    }
    this.H = { W: W2, Hh: H2, n: LP.length, P: Int32Array.from(LP), C: Int32Array.from(LC), K: Uint8Array.from(LK), A: Float32Array.from(LA),
      R: Uint8Array.from(LR), G: Uint8Array.from(LG), B: Uint8Array.from(LB), h: Int16Array.from(LH), X: Int32Array.from(LX), Y: Int32Array.from(LY), st: new Uint8Array(n), hot: new Float32Array(n) };
    this.hdKey = this.key + 'x';
    this.hdTex = scene.textures.createCanvas(this.hdKey, W2, H2);
    this.hdCtx = this.hdTex.getContext(); this.hdImg = this.hdCtx.createImageData(W2, H2);
    this.hdSprite = scene.add.image(this.fx0 + ox - PC, this.fy0 + oy - PC, this.hdKey).setOrigin(0, 0).setScale(1 / S).setDepth(-800);
    this.sprite.setVisible(false);
  };
  // paint the HD fissure: `state(i)` per crack px: 0 dormant / hidden, 1 open, 2 the opening's travelling front, 3 sealed
  // (hot(i) 1 -> 0 as it cools); fl: the bump flare { x, y (room px from the crack origin), r2 } or null
  FissureView.prototype.paintHD = function (state, hot, lt, fl) {
    var H = this.H, d = this.hdImg.data, n = this.cells.length, i, SE = HDF.seam.map(HEX), TIP = HDF.wallTip, S = HDF.S;
    if (!RAMP) lavaCol({ x: 0, y: 0 }, 0, 0, 0);
    for (i = 0; i < n; i++) { H.st[i] = state(i); H.hot[i] = H.st[i] === 3 ? hot(i) : 0; }
    d.fill(0);
    var fx0 = this.fx0 * S, fy0 = this.fy0 * S;
    for (i = 0; i < H.n; i++) {
      var ci = H.C[i], st = H.st[ci], kd = H.K[i], p = H.P[i], h = H.h[i], r = H.R[i], g = H.G[i], b = H.B[i], col = null;
      if (st === 0) {                                  // dormant: a thin dark line in the pit's middle only
        if (kd === 3 && H.A[i] > 0.45) { r = 13; g = 11; b = 16; } else continue;
      } else if (st === 2) {                           // the front of an opening: white-hot
        col = kd >= 2 ? RAMP[7] : kd === 1 ? RAMP[6] : null;
      } else if (st === 1) {
        if (kd === 1) {
          col = SE[(h + (lt >> 3)) % 7 === 0 ? 3 : h % 3 === 0 ? 0 : (h + (lt >> 4)) % 5 === 0 ? 2 : 1];
          if (fl) { var ddx = H.X[i] - fx0 - fl.x * S, ddy = H.Y[i] - fy0 - fl.y * S; if (ddx * ddx + ddy * ddy < fl.r2 * S * S) col = RAMP[7]; }
        } else if (kd === 2) {                         // the far wall: shaded rock, lit red toward its tip
          var t = H.A[i] * H.A[i], sh = h % 5 === 0 ? 1.15 : 0.75;
          r = r * sh * (1 - t) + TIP[0] * t; g = g * sh * (1 - t) + TIP[1] * t; b = b * sh * (1 - t) + TIP[2] * t;
        } else if (kd === 3) {
          col = (h * 7 + (lt >> 2)) % HDF.spark === 0 && H.A[i] > 0.3 ? RAMP[7] : lavaColXY(H.X[i], H.Y[i], this.cells[ci].o || 0, h & 63, 0.3 + 0.7 * H.A[i], lt);
        }
      } else if (st === 3) {                           // sealed: the pit fills with dark rock; the seam and a few specks cool
        var hk = H.hot[ci];
        if (kd >= 2) { r *= 0.55; g *= 0.5; b *= 0.5; if (hk > 0.3 && h % 23 === 0) col = SE[0]; }
        else if (kd === 1) { r = r + (SE[0][0] - r) * hk; g = g + (SE[0][1] - g) * hk; b = b + (SE[0][2] - b) * hk; }
      }
      if (col) { r = col[0]; g = col[1]; b = col[2]; }
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
    this.hdCtx.putImageData(this.hdImg, 0, 0);
    this.hdTex.refresh();
  };
  // a crack of the network: each segment is open (rift light) or dark (a scar that cools)
  FissureView.prototype.updateNet = function (f, tick) {
    var st = f.state, sh = this.slow ? (tick >> 4) : (tick >> 3), s, cool = [], minCool = 1, opening = st === 'opening';
    var fl = this.flash, flA = fl ? 1 - (tick - fl.tick) / FLASH_T : 0;
    if (flA <= 0) { flA = 0; this.flash = fl = null; }
    var lt = Math.floor(tick / (this.slow ? LAVA.every * 2 : LAVA.every)) * (this.slow ? LAVA.every * 2 : LAVA.every);      // lava redraw step
    var key = st + '|' + (opening ? Math.round(f.reveal * (this.slow ? 30 : 80)) : (f.litN ? lt : 0)) + '|' + Math.round(flA * 12);
    for (s = 0; s < f.nSeg; s++) {
      var cv = f.dark[s] ? Math.min(1, (tick - f.darkTick[s]) / 480) : -1;
      cool.push(cv);
      if (cv >= 0 && cv < minCool) minCool = cv;
      key += '|' + (cv < 0 ? 'L' : Math.round(cv * 24));
    }
    var litFrac = f.litN / f.nSeg, a, tint;
    if (f.litN) { a = 0.45 * (opening ? f.reveal : 1) * (0.35 + 0.65 * litFrac) + Math.sin(tick / 9) * 0.03 + ((tick >> 2) % 5) * 0.01; tint = LAVA.glow; }
    else { a = 0.34 - minCool * 0.2; tint = 'em2'; }
    this.glow.setAlpha(a).setTint(UI.hex(tint));
    for (s = 0; s < this.armGlows.length; s++) {
      var ag = this.armGlows[s], cg = cool[ag.seg];
      if (cg === undefined) ag.img.setAlpha(0);      // the title backdrop draws rooms without sim state
      else if (cg < 0) ag.img.setAlpha(opening && ag.o > f.reveal ? 0 : 0.46 + Math.sin(tick / 11 + s) * 0.04).setTint(UI.hex(LAVA.glow));
      else ag.img.setAlpha(Math.max(0, 0.22 - cg * 0.22)).setTint(UI.hex('em1'));
    }
    // flames and embers from the open (revealed) molten px
    this.fire(f, tick, function (c) { var cs2 = cool[c.seg]; return cs2 < 0 && (!opening || c.o <= f.reveal); });
    if (key === this.last) return;
    this.last = key;
    if (this.hd) {
      var fcells = this.cells;
      this.drawHeat(function (hc) { var cs3 = cool[hc.seg]; return cs3 === undefined ? 0 : cs3 < 0 ? (opening && hc.o > f.reveal ? 0 : 1) : 0.35 * (1 - cs3); }, lt);
      this.paintHD(function (ci) {
        var c = fcells[ci], cs = cool[c.seg];
        if (cs === undefined) return 0;
        if (cs < 0) return opening && c.o > f.reveal ? 0 : (opening && f.reveal - c.o < 0.07 ? 2 : 1);
        return 3;
      }, function (ci) { return 1 - cool[fcells[ci].seg]; }, lt, fl ? { x: fl.x, y: fl.y, r2: FLASH_R * FLASH_R * flA } : null);
      return;
    }
    var cells = this.cells, n = cells.length, d = this.img.data, C = this.C, w = this.w, ox = this.ox, oy = this.oy, i;
    d.fill(0);
    var flR2 = fl ? FLASH_R * FLASH_R * flA : 0, flx = fl ? fl.x : 0, fly = fl ? fl.y : 0, halo = this.halo;
    for (i = 0; i < halo.length; i++) {
      var hc = halo[i];
      if (!(cool[hc.seg] < 0) || (opening && hc.o > f.reveal)) continue;
      var hd = (hc.x - flx) * (hc.x - flx) + (hc.y - fly) * (hc.y - fly), hcol = fl && hd < flR2 ? C.em3 : C.outline;
      var hp = ((hc.y - oy) * w + (hc.x - ox)) * 4;
      d[hp] = hcol[0]; d[hp + 1] = hcol[1]; d[hp + 2] = hcol[2]; d[hp + 3] = 255;
    }
    for (i = 0; i < n; i++) {
      var c = cells[i], h = this.hash[i], dep = this.depth[i], col = null, cs = cool[c.seg];
      if (cs < 0 && (!opening || c.o <= f.reveal)) {
        if (opening && f.reveal - c.o < 0.07) col = c.core ? C.rg4 : C.em4;
        else if (fl && !c.core && (c.x - flx) * (c.x - flx) + (c.y - fly) * (c.y - fly) < flR2) col = h % 3 ? C.rg4 : C.em4;   // bumped: the lip flares
        else if (!c.core) col = rimCol(h, tick);                                     // the lip: crust glowing red
        else col = lavaCol(c, h, this.mid[i], lt);                                           // molten rock, flowing
      } else if (cs >= 0) {
        var hot = 1 - cs;
        if (c.core) col = h % 9 === 0 && hot > 0.4 ? C.em1 : (dep >= 3 ? C.outline : C.scar);
        else col = h < hot * 24 ? (h % 2 ? C.em2 : C.em1) : (h % 4 === 0 ? C.em1 : C.em0);      // the crust's edge: red, cooling (no yellow: that is lava)
      } else if (c.core && dep >= 2) col = dep >= 4 ? C.outline : C.f0;
      if (!col) continue;
      var p = ((c.y - oy) * w + (c.x - ox)) * 4;
      d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    }
    this.drawHeat(function (hc) { var cs3 = cool[hc.seg]; return cs3 === undefined ? 0 : cs3 < 0 ? (opening && hc.o > f.reveal ? 0 : 1) : 0.35 * (1 - cs3); }, lt);
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  };

  // the mage pushed into this crack at room pixel (x, y): flare the lip around that point
  FissureView.prototype.bump = function (x, y, tick) {
    var lx = x - this.fx0, ly = y - this.fy0, m = FLASH_R;
    if (this.big || lx < this.ox - m || ly < this.oy - m || lx > this.ox + this.w + m || ly > this.oy + this.h + m) return false;
    this.flash = { x: lx, y: ly, tick: tick };
    return true;
  };
  FissureView.prototype.update = function (f, tick) {
    if (!f.big) { this.updateNet(f, tick); return; }
    var st = f.state, cooling = st === 'scar' ? Math.min(1, (tick - (f.scarTick || tick)) / 480) : 0, sh = tick >> 3;
    var lt = Math.floor(tick / (LAVA.every * 2)) * LAVA.every * 2;
    var key = st + '|' + (st === 'open' ? lt : Math.round(f.reveal * 80)) + '|' + Math.round(cooling * 24);
    // light
    var a = 0, tint = LAVA.glow;
    if (st === 'opening' || st === 'open') a = 0.55 * f.reveal + (st === 'open' ? Math.sin(tick / 9) * 0.03 : 0);
    else if (st === 'closing') { a = 0.5; tint = f.reveal > 0.5 ? LAVA.glow : 'em1'; }
    else if (st === 'scar') { a = 0.34 - cooling * 0.2; tint = 'em2'; }
    this.glow.setAlpha(a).setTint(UI.hex(tint));
    if (this.glow2) this.glow2.setAlpha(a * 0.7).setTint(UI.hex(tint));
    var moving0 = st === 'opening' || st === 'closing';
    this.fire(f, tick, function (c) { return st === 'open' || (moving0 && st === 'opening' && c.o <= f.reveal); });
    if (key === this.last) return;
    this.last = key;
    if (this.hd) {
      var bcells = this.cells, moving1 = st === 'opening' || st === 'closing';
      this.drawHeat(function (hc) { return st === 'open' ? 1 : st === 'opening' ? (hc.o <= f.reveal ? 1 : 0) : st === 'closing' ? 0.8 : st === 'scar' ? 0.35 * (1 - cooling) : 0; }, lt);
      this.paintHD(function (ci) {
        var c = bcells[ci], open = st === 'open' || (moving1 && c.o <= f.reveal);
        if (open) return moving1 && f.reveal - c.o < 0.07 ? 2 : 1;
        return st === 'scar' || st === 'closing' ? 3 : 0;
      }, function () { return st === 'closing' ? 1 : 1 - cooling; }, lt, null);
      return;
    }
    var cells = this.cells, n = cells.length, d = this.img.data, C = this.C, w = this.w, ox = this.ox, oy = this.oy, i;
    d.fill(0);
    var moving = st === 'opening' || st === 'closing';
    for (i = 0; i < n; i++) {
      var c = cells[i], h = this.hash[i], dep = this.depth[i], col = null;
      var open = st === 'open' || (moving && c.o <= f.reveal);
      if (open) {
        if (moving && f.reveal - c.o < 0.07) col = c.core ? C.rg4 : C.em4;            // the travelling front
        else if (!c.core) col = rimCol(h, tick);
        else col = lavaCol(c, h, this.mid[i], lt);
      } else if (st === 'scar' || st === 'closing') {
        // sealed: dark scar, orange edge. Fresh edges are white-hot, then cool to a steady ember.
        var hot = st === 'closing' ? 1 : 1 - cooling;
        if (c.core) col = h % 9 === 0 && hot > 0.4 ? C.em1 : (dep >= 3 ? C.outline : C.scar);
        else col = h < hot * 24 ? (h % 2 ? C.em2 : C.em1) : (h % 4 === 0 ? C.em1 : C.em0);      // the crust's edge: red, cooling (no yellow: that is lava)
      } else if (c.core && dep >= 2) {
        col = dep >= 4 ? C.outline : C.f0;                                            // dormant hairline
      }
      if (!col) continue;
      var p = ((c.y - oy) * w + (c.x - ox)) * 4;
      d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    }
    this.drawHeat(function (hc) { return st === 'open' ? 1 : st === 'opening' ? (hc.o <= f.reveal ? 1 : 0) : st === 'closing' ? 0.8 : st === 'scar' ? 0.35 * (1 - cooling) : 0; }, lt);
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  };
  // the heat on the floor: `hot(cell)` = 0..1 for the crack part it belongs to (open 1, cooling less, closed 0)
  FissureView.prototype.drawHeat = function (hot, tick) {
    var H = this.heatCells, d = this.heatImg.data, R = LAVA.heatR, col = UI.rgb(LAVA.glow), i;
    d.fill(0);
    for (i = 0; i < H.length; i++) {
      var hc = H[i], k = hot(hc);
      if (k <= 0) continue;
      var a = (1 - hc.d / (R + 1)) * (1 - hc.d / (R + 1)) * LAVA.heatA * k * (0.8 + 0.2 * Math.sin(hc.o * LAVA.wave[0] - tick * LAVA.wave[1]));
      d[hc.p] = col[0]; d[hc.p + 1] = col[1]; d[hc.p + 2] = col[2]; d[hc.p + 3] = Math.round(255 * Math.min(1, a));
    }
    this.heatCtx.putImageData(this.heatImg, 0, 0);
    this.heatTex.refresh();
  };
  // flames (2 px, rising, yellow -> red) and embers (1 px, drifting higher) from random open molten px; `isOpen(cell)`
  FissureView.prototype.fire = function (f, tick, isOpen) {
    var dt = this.lastTick == null ? 1 : Math.max(0, Math.min(6, tick - this.lastTick)), i;
    if (!RAMP) lavaCol({ x: 0, y: 0 }, 0, 0, 0);
    this.lastTick = tick;
    if (!this.cores) { this.cores = []; for (i = 0; i < this.cells.length; i++) if (this.cells[i].core && this.mid[i] >= LAVA.bands[2]) this.cores.push(i); this.parts = []; }      // flames rise from the orange middle
    var P = this.parts, cap = this.big ? LAVA.capBig : LAVA.cap;
    if (dt > 0 && this.cores.length) {
      this.fireAcc = (this.fireAcc || 0) + dt * this.cores.length / LAVA.flames / 60;
      for (var tries = 0; this.fireAcc >= 1 && tries < 8; tries++) {
        this.fireAcc--;
        var c = this.cells[this.cores[(Math.random() * this.cores.length) | 0]];
        if (!isOpen(c)) continue;
        var p = null;
        for (i = 0; i < P.length; i++) if (P[i].t >= P[i].life) { p = P[i]; break; }
        if (!p) { if (P.length >= cap) continue; p = { img: this.scene.add.image(0, 0, 'atlas', 'px').setBlendMode(Phaser.BlendModes.ADD).setDepth(-780) }; P.push(p); }
        var r0 = Math.random(), kind = r0 < LAVA.embers ? 'e' : r0 < LAVA.embers + LAVA.smoke ? 's' : 'f', ember = kind === 'e';
        p.kind = kind; p.x = this.fx0 + c.x; p.y = this.fy0 + c.y - (kind === 's' ? 4 : 0); p.t = 0; p.ember = ember; p.ph = Math.random() * 6.28;
        p.life = (LAVA.life[0] + Math.random() * (LAVA.life[1] - LAVA.life[0])) * (ember ? 2 : kind === 's' ? 2.6 : 1);
        p.vy = -(LAVA.rise[0] + Math.random() * (LAVA.rise[1] - LAVA.rise[0])) * (ember ? 1.3 : kind === 's' ? 0.55 : 1); p.vx = ember || kind === 's' ? (Math.random() - 0.5) * 0.3 : 0;
        p.img.setBlendMode(kind === 's' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setDepth(kind === 's' ? -775 : -780);
      }
      this.fireAcc = Math.min(this.fireAcc, 2);
      // bubbles: a bright px that swells and pops where the lava is (static)
      this.bubAcc = (this.bubAcc || 0) + dt * this.cores.length * LAVA.bubbles / 60;
      while (this.bubAcc >= 1) {
        this.bubAcc--;
        var cb = this.cells[this.cores[(Math.random() * this.cores.length) | 0]], pb = null;
        if (!isOpen(cb)) continue;
        for (i = 0; i < P.length; i++) if (P[i].t >= P[i].life) { pb = P[i]; break; }
        if (!pb) { if (P.length >= cap) break; pb = { img: this.scene.add.image(0, 0, 'atlas', 'px') }; P.push(pb); }
        pb.kind = 'b'; pb.x = this.fx0 + cb.x; pb.y = this.fy0 + cb.y; pb.t = 0; pb.life = 16; pb.vx = 0; pb.vy = 0; pb.ember = false; pb.ph = 0;
        pb.img.setBlendMode(Phaser.BlendModes.ADD).setDepth(-779);
      }
      this.bubAcc = Math.min(this.bubAcc, 2);
    }
    for (i = 0; i < P.length; i++) {
      var q = P[i];
      if (q.t >= q.life) { q.img.setVisible(false); continue; }
      q.t += dt; var u = q.t / q.life;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 's') {      // smoke: dark, grows, drifts and fades
        q.img.setVisible(true).setPosition(Math.round((q.x + Math.sin(q.ph + q.t * 0.05) * 1.5) * 2) / 2, Math.round(q.y * 2) / 2).setTint(LAVA.smokeCol).setScale(u < 0.4 ? 1 : 1.5).setAlpha(LAVA.smokeA * Math.min(1, u * 4) * (1 - u));
        continue;
      }
      if (q.kind === 'b') {      // bubble: 1 -> 3 px, white-yellow -> orange, gone
        var cbb = RAMP[u < 0.5 ? 7 : u < 0.8 ? 6 : 5];
        q.img.setVisible(true).setPosition(Math.round(q.x * 2) / 2, Math.round(q.y * 2) / 2).setTint((cbb[0] << 16) | (cbb[1] << 8) | cbb[2]).setScale(u < 0.3 ? 0.5 : u < 0.7 ? 1 : 1.5).setAlpha(u < 0.8 ? 1 : (1 - u) * 5);
        continue;
      }
      var col = RAMP[Math.max(1, Math.round((1 - u) * (RAMP.length - 1)))];
      q.img.setVisible(u < 1).setPosition(Math.round((q.x + (q.ember ? 0 : Math.sin(q.ph + q.t * 0.25) * 0.8)) * 2) / 2, Math.round(q.y * 2) / 2)
        .setTint((col[0] << 16) | (col[1] << 8) | col[2]).setScale(q.ember ? 0.5 : u < 0.3 ? 1.5 : u < 0.65 ? 1 : 0.5, q.ember ? 0.5 : u < 0.3 ? 3 : u < 0.65 ? 2 : 1).setAlpha(u < 0.7 ? 1 : (1 - u) / 0.3);
    }
  };
  FissureView.prototype.destroy = function () {
    if (this.parts) this.parts.forEach(function (p) { p.img.destroy(); });
    this.heatSprite.destroy(); if (this.scene.textures.exists(this.heatKey)) this.scene.textures.remove(this.heatKey);
    if (this.hdSprite) { this.hdSprite.destroy(); if (this.scene.textures.exists(this.hdKey)) this.scene.textures.remove(this.hdKey); }
    this.sprite.destroy(); this.glow.destroy();
    if (this.glow2) this.glow2.destroy();
    this.armGlows.forEach(function (g) { g.img.destroy(); });
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  };
  G.FissureView = FissureView;
})(globalThis.G = globalThis.G || {});
