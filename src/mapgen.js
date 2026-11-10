// Room generation. Pure function of (runSeed, roomIndex): same seed = same map.
(function (G) {
  var T = 16;

  // A fissure is a crack: a set of art pixels relative to its centre, each with an
  // "order" 0..1 (distance along the crack) used to animate it opening and closing.
  function genFissure(rng, big) {
    var core = {}, maxO = 0;
    function stamp(x, y, w, o) {
      var h = Math.floor(w / 2);
      for (var dy = -h; dy <= h; dy++) for (var dx = -h; dx <= h; dx++) {
        if (w > 2 && Math.abs(dx) === h && Math.abs(dy) === h) continue;
        var k = (Math.round(x) + dx) + ',' + (Math.round(y) + dy);
        if (!(k in core) || core[k] > o) core[k] = o;
      }
      if (o > maxO) maxO = o;
    }
    function walk(x, y, a, len, w0, o0, depth) {
      var base = a;
      for (var i = 0; i < len; i++) {
        var t = i / len;
        var w = Math.max(1, Math.round(w0 * (1 - t)));
        stamp(x, y, w, o0 + i);
        a += rng.range(-0.55, 0.55);
        if (a > base + 0.9) a = base + 0.9;
        if (a < base - 0.9) a = base - 0.9;
        x += Math.cos(a); y += Math.sin(a) * 0.8;
        if (depth < 2 && t > 0.2 && t < 0.75 && rng.chance(big ? 0.16 : 0.11)) {
          walk(x, y, a + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.3), Math.round((len - i) * 0.6), Math.max(1, w - 1), o0 + i, depth + 1);
        }
      }
    }
    var ang = rng.range(0, Math.PI), len = big ? rng.int(26, 32) : rng.int(14, 18), w0 = big ? 6 : 4;
    walk(0, 0, ang, len, w0, 0, 0);
    walk(0, 0, ang + Math.PI, len, w0, 0, 0);
    var cells = [], k, p;
    for (k in core) { p = k.split(','); cells.push({ x: +p[0], y: +p[1], o: core[k] / maxO, core: true }); }
    var edge = {};
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        k = (c.x + dx) + ',' + (c.y + dy);
        if (k in core) continue;
        if (!(k in edge) || edge[k] > c.o) edge[k] = c.o;
      }
    }
    for (k in edge) { p = k.split(','); cells.push({ x: +p[0], y: +p[1], o: edge[k], core: false }); }
    cells.sort(function (a, b) { return a.o - b.o || a.y - b.y || a.x - b.x; });
    return cells;
  }

  G.genRoom = function (runSeed, index, B) {
    var seed = G.hash32(runSeed >>> 0, index * 7919 + 13);
    var rng = new G.RNG(seed);
    var boss = index === B.run.rooms - 1;
    var W = boss ? 26 : rng.int(24, 28), H = boss ? 17 : rng.int(15, 18);
    var tiles = new Uint8Array(W * H), x, y, i;
    function at(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : tiles[ty * W + tx]; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y < 2 || y === H - 1) tiles[y * W + x] = 1;
    }
    var sx = rng.int(4, W - 5), sy = H - 3;
    var ex = rng.int(4, W - 5);
    var cx = Math.floor(W / 2), cy = Math.floor(H / 2) + 1;
    var chest = { tx: ex, ty: 4 };
    function reserved(tx, ty) {
      if (Math.abs(tx - sx) <= 2 && Math.abs(ty - sy) <= 2) return true;
      if (Math.abs(tx - ex) <= 1 && ty <= 6) return true;
      if (Math.abs(tx - cx) <= 3 && Math.abs(ty - cy) <= 2) return true;
      return false;
    }
    var blocks = [];
    if (boss) {
      blocks = [[5, 5, 1, 1], [W - 6, 5, 1, 1], [5, H - 5, 1, 1], [W - 6, H - 5, 1, 1]];
    } else {
      var n = rng.int(4, 7), tries = 0;
      while (blocks.length < n && tries++ < 200) {
        var bw = rng.int(1, 3), bh = rng.int(1, 2);
        if (rng.chance(0.25)) { var t = bw; bw = bh; bh = t + 1; }
        var bx = rng.int(3, W - 4 - bw), by = rng.int(4, H - 4 - bh), ok = true;
        for (y = by - 1; y <= by + bh && ok; y++) for (x = bx - 1; x <= bx + bw && ok; x++) {
          if (reserved(x, y) || at(x, y)) ok = false;
        }
        if (ok) blocks.push([bx, by, bw, bh]);
      }
    }
    for (i = 0; i < blocks.length; i++) {
      for (y = 0; y < blocks[i][3]; y++) for (x = 0; x < blocks[i][2]; x++) {
        var px = blocks[i][0] + x, py = blocks[i][1] + y;
        if (!reserved(px, py)) tiles[py * W + px] = 1;
      }
    }
    // anything the player cannot reach becomes wall, so nothing can spawn out of reach
    var seen = new Uint8Array(W * H), q = [sy * W + sx];
    seen[q[0]] = 1;
    while (q.length) {
      var c = q.pop(), qx = c % W, qy = (c - qx) / W;
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var nx = qx + nb[i][0], ny = qy + nb[i][1], ni = ny * W + nx;
        if (!at(nx, ny) && !seen[ni]) { seen[ni] = 1; q.push(ni); }
      }
    }
    for (i = 0; i < W * H; i++) if (!seen[i]) tiles[i] = 1;

    // fissure sites
    var cand = [];
    for (y = 3; y < H - 2; y++) for (x = 2; x < W - 2; x++) {
      var clear = true;
      for (var dy = -1; dy <= 1 && clear; dy++) for (var dx = -1; dx <= 1 && clear; dx++) if (at(x + dx, y + dy)) clear = false;
      if (!clear) continue;
      if (Math.abs(x - sx) <= 4 && Math.abs(y - sy) <= 3) continue;
      if (Math.abs(x - ex) <= 2 && y <= 6) continue;
      if (Math.abs(x - cx) <= 4 && Math.abs(y - cy) <= 3) continue;
      cand.push([x, y]);
    }
    rng.shuffle(cand);
    var want = B.fissure.count[index], sites = [], gap = 5;
    while (sites.length < want && gap >= 2) {
      for (i = 0; i < cand.length && sites.length < want; i++) {
        var far = true;
        for (var s = 0; s < sites.length; s++) {
          if (Math.abs(sites[s][0] - cand[i][0]) + Math.abs(sites[s][1] - cand[i][1]) < gap) far = false;
        }
        if (far) sites.push(cand[i]);
      }
      gap--;
    }
    function clip(cells, fx, fy) {
      return cells.filter(function (c) { return !at(Math.floor((fx + c.x) / T), Math.floor((fy + c.y) / T)); });
    }
    var fissures = [];
    for (i = 0; i < sites.length; i++) {
      var fx = sites[i][0] * T + 8, fy = sites[i][1] * T + 8;
      fissures.push({ x: fx, y: fy, big: false, cells: clip(genFissure(rng, false), fx, fy) });
    }
    var bx2 = cx * T + 8, by2 = cy * T + 8;
    fissures.push({ x: bx2, y: by2, big: true, cells: clip(genFissure(rng, true), bx2, by2) });

    var cos = new Uint8Array(W * H), decals = [], torches = [];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      cos[y * W + x] = rng.int(0, 3);
      if (!at(x, y) && rng.chance(0.045) && !(x === chest.tx && y === chest.ty)) {
        decals.push({ x: x * T + rng.int(3, 12), y: y * T + rng.int(4, 12), k: rng.int(0, 3) });
      }
    }
    for (x = 2; x < W - 2; x++) if (x % 4 === 2 && Math.abs(x - ex) > 1) torches.push({ x: x * T + 8, y: T + 8 });

    var h = 2166136261;
    for (i = 0; i < W * H; i++) h = Math.imul(h ^ tiles[i], 16777619);
    for (i = 0; i < fissures.length; i++) h = Math.imul(h ^ (fissures[i].x * 31 + fissures[i].y * 17 + fissures[i].cells.length), 16777619);
    h = Math.imul(h ^ (ex * 131 + sx), 16777619) >>> 0;

    return {
      seed: seed, index: index, boss: boss, w: W, h: H, tiles: tiles, cos: cos,
      start: { x: sx * T + 8, y: sy * T + 8 },
      exit: { tx: ex, ty: 1, x: ex * T + 8, y: 2 * T + 3 },
      chest: { x: chest.tx * T + 8, y: chest.ty * T + 8 },
      fissures: fissures, decals: decals, torches: torches, hash: h
    };
  };
})(globalThis.G = globalThis.G || {});
