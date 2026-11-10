// Draws a generated room: tilemap (floor slabs, wall tops and faces), shadows, decals,
// torches with additive light, and the fissures (per-pixel textures redrawn when they change).
(function (G) {
  var UI = G.UI, T = 16, fissSeq = 0;

  G.RoomView = function (scene, room) {
    var W = room.w, H = room.h, ground = [], shade = [], x, y, i;
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
          idx = (y % 8) * 8 + (x % 8);
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
    this.map2 = scene.make.tilemap({ data: shade, tileWidth: T, tileHeight: T });
    this.layer2 = this.map2.createLayer(0, this.map2.addTilesetImage('tiles', 'tiles', T, T, 0, 0), 0, 0).setDepth(-990);
    this.items = [];
    for (i = 0; i < room.decals.length; i++) {
      var d = room.decals[i];
      this.items.push(scene.add.image(d.x, d.y, 'atlas', 'decal_' + d.k).setDepth(-900));
    }
    this.torches = [];
    for (i = 0; i < room.torches.length; i++) {
      var t = room.torches[i];
      var img = scene.add.image(t.x, t.y, 'atlas', 'torch_0').setDepth(-600);
      var glow = scene.add.image(t.x, t.y + 6, 'atlas', 'glow').setDepth(-650).setBlendMode(Phaser.BlendModes.ADD).setTint(UI.hex('em2')).setAlpha(0.4);
      this.torches.push({ img: img, glow: glow }); this.items.push(img, glow);
    }
    this.fissures = room.fissures.map(function (f) { return new FissureView(scene, f); });
  };
  G.RoomView.prototype.tick = function (frame, simFissures, simTick) {
    var i;
    for (i = 0; i < this.torches.length; i++) {
      var t = this.torches[i], k = ((frame >> 3) + i * 2) % 3;
      t.img.setFrame('torch_' + k);
      t.glow.setAlpha(0.36 + ((frame >> 2) + i * 3) % 4 * 0.025);
    }
    if (simFissures) for (i = 0; i < this.fissures.length; i++) this.fissures[i].update(simFissures[i], simTick);
  };
  G.RoomView.prototype.destroy = function () {
    this.items.forEach(function (o) { o.destroy(); });
    this.fissures.forEach(function (f) { f.destroy(); });
    this.layer.destroy(); this.map.destroy(); this.layer2.destroy(); this.map2.destroy();
  };

  // ------------------------------------------------------------------ fissure
  // Open: green rift light inside an ember-hot rim. Sealed: a dark scar with an orange edge
  // that cools but never fully fades. Dormant: a hairline crack you can spot while exploring.
  function FissureView(scene, f) {
    var cells = f.cells, n = cells.length, i, minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (i = 0; i < n; i++) {
      minX = Math.min(minX, cells[i].x); maxX = Math.max(maxX, cells[i].x);
      minY = Math.min(minY, cells[i].y); maxY = Math.max(maxY, cells[i].y);
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
    this.hash = cells.map(function (cl) { return (((cl.x * 73856093) ^ (cl.y * 19349663)) >>> 0) % 64; });
    this.key = 'fiss' + (fissSeq++);
    this.scene = scene; this.big = f.big;
    this.tex = scene.textures.createCanvas(this.key, Math.max(1, this.w), Math.max(1, this.h));
    this.ctx = this.tex.getContext();
    this.img = this.ctx.createImageData(Math.max(1, this.w), Math.max(1, this.h));
    this.sprite = scene.add.image(f.x + minX, f.y + minY, this.key).setOrigin(0, 0).setDepth(-800);
    this.glow = scene.add.image(f.x, f.y, 'atlas', 'glow').setDepth(-790).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.glow2 = f.big ? scene.add.image(f.x, f.y, 'atlas', 'glow').setDepth(-789).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0) : null;
    this.last = '';
    this.C = {};
    var self = this;
    ['f0', 'outline', 'scar', 'rg0', 'rg1', 'rg2', 'rg3', 'rg4', 'em0', 'em1', 'em2', 'em3', 'em4'].forEach(function (kk) { self.C[kk] = UI.rgb(kk); });
  }
  FissureView.prototype.update = function (f, tick) {
    var st = f.state, cooling = st === 'scar' ? Math.min(1, (tick - (f.scarTick || tick)) / 480) : 0, sh = tick >> 3;
    var key = st + '|' + (st === 'open' ? sh : Math.round(f.reveal * 80)) + '|' + Math.round(cooling * 24);
    // light
    var a = 0, tint = 'rg2';
    if (st === 'opening' || st === 'open') a = 0.5 * f.reveal + (st === 'open' ? ((tick >> 2) % 5) * 0.012 : 0);
    else if (st === 'closing') { a = 0.5; tint = f.reveal > 0.5 ? 'rg2' : 'em2'; }
    else if (st === 'scar') { a = 0.34 - cooling * 0.2; tint = 'em2'; }
    this.glow.setAlpha(a).setTint(UI.hex(tint));
    if (this.glow2) this.glow2.setAlpha(a * 0.7).setTint(UI.hex(tint));
    if (key === this.last) return;
    this.last = key;
    var cells = this.cells, n = cells.length, d = this.img.data, C = this.C, w = this.w, ox = this.ox, oy = this.oy, i;
    d.fill(0);
    var moving = st === 'opening' || st === 'closing';
    for (i = 0; i < n; i++) {
      var c = cells[i], h = this.hash[i], dep = this.depth[i], col = null;
      var open = st === 'open' || (moving && c.o <= f.reveal);
      if (open) {
        if (moving && f.reveal - c.o < 0.07) col = c.core ? C.rg4 : C.em4;            // the travelling front
        else if (!c.core) col = (h + sh) % 13 === 0 ? C.em4 : (h % 5 === 0 ? C.em3 : (h % 3 === 0 ? C.em1 : C.em2));
        else if (dep <= 1) col = C.rg0;
        else if (dep === 2) col = h % 4 === 0 ? C.rg2 : C.rg1;
        else if (dep === 3) col = (h + sh) % 9 === 0 ? C.rg3 : C.rg2;
        else col = (h + sh) % 6 === 0 ? C.rg4 : C.rg3;
      } else if (st === 'scar' || st === 'closing') {
        // sealed: dark scar, orange edge. Fresh edges are white-hot, then cool to a steady ember.
        var hot = st === 'closing' ? 1 : 1 - cooling;
        if (c.core) col = h % 9 === 0 && hot > 0.4 ? C.em1 : (dep >= 3 ? C.outline : C.scar);
        else col = h < hot * 40 ? (h % 2 ? C.em4 : C.em3) : (h % 4 === 0 ? C.em2 : (h % 4 === 3 ? C.em0 : C.em1));
      } else if (c.core && dep >= 2) {
        col = dep >= 4 ? C.outline : C.f0;                                            // dormant hairline
      }
      if (!col) continue;
      var p = ((c.y - oy) * w + (c.x - ox)) * 4;
      d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  };
  FissureView.prototype.destroy = function () {
    this.sprite.destroy(); this.glow.destroy();
    if (this.glow2) this.glow2.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  };
  G.FissureView = FissureView;
})(globalThis.G = globalThis.G || {});
