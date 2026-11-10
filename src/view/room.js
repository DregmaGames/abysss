// Draws a generated room: tilemap (auto-tiled walls), floor decals, wall torches.
(function (G) {
  G.RoomView = function (scene, room) {
    var W = room.w, H = room.h, data = [], x, y;
    function wall(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : room.tiles[ty * W + tx]; }
    for (y = 0; y < H; y++) {
      var row = [];
      for (x = 0; x < W; x++) {
        var idx;
        if (wall(x, y)) {
          var n = wall(x, y - 1), e = wall(x + 1, y), s = wall(x, y + 1), w = wall(x - 1, y);
          if (!s && y + 1 < H) idx = 32 + (n ? 1 : 0) + (e ? 2 : 0) + (w ? 4 : 0);
          else idx = 16 + (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0);
        } else {
          idx = (wall(x, y - 1) ? 4 : 0) + room.cos[y * W + x];
        }
        row.push(idx);
      }
      data.push(row);
    }
    this.map = scene.make.tilemap({ data: data, tileWidth: 16, tileHeight: 16 });
    var ts = this.map.addTilesetImage('tiles', 'tiles', 16, 16, 0, 0);
    this.layer = this.map.createLayer(0, ts, 0, 0).setDepth(-1000);
    this.items = [];
    var i;
    for (i = 0; i < room.decals.length; i++) {
      var d = room.decals[i];
      this.items.push(scene.add.image(d.x, d.y, 'atlas', 'decal_' + d.k).setDepth(-900).setAlpha(0.8));
    }
    this.torches = [];
    for (i = 0; i < room.torches.length; i++) {
      var t = scene.add.image(room.torches[i].x, room.torches[i].y, 'atlas', 'torch_0').setDepth(-800);
      this.torches.push(t); this.items.push(t);
    }
  };
  G.RoomView.prototype.tick = function (frame) {
    for (var i = 0; i < this.torches.length; i++) this.torches[i].setFrame(((frame >> 3) + i) % 2 ? 'torch_1' : 'torch_0');
  };
  G.RoomView.prototype.destroy = function () {
    this.items.forEach(function (o) { o.destroy(); });
    this.layer.destroy(); this.map.destroy();
  };
})(globalThis.G = globalThis.G || {});
