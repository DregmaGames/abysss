// Room generation. Pure function of (runSeed, roomIndex): same seed = same map.
(function (G) {
  var T = 16;

  // A fissure is a crack: a set of art pixels relative to its centre, each with an
  // "order" 0..1 (distance along the crack) used to animate it expanding and closing.
  // The super fissure is a pit with cracks radiating from it.
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
        var w = Math.max(1, Math.round(w0 * (1 - t * 0.9)));
        stamp(x, y, w, o0 + i);
        a += rng.range(-0.6, 0.6);
        if (a > base + 0.8) a = base + 0.8;
        if (a < base - 0.8) a = base - 0.8;
        x += Math.cos(a); y += Math.sin(a) * 0.8;
        if (depth < 2 && t > 0.2 && t < 0.75 && rng.chance(big ? 0.1 : 0.09)) {
          walk(x, y, a + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.2), Math.round((len - i) * 0.6), Math.max(1, w - 1), o0 + i, depth + 1);
        }
      }
    }
    var i, ang;
    if (big) {
      var R = 9, arms = rng.int(5, 6), a0 = rng.range(0, 6.283);
      for (var py = -R; py <= R; py++) for (var px = -R - 2; px <= R + 2; px++) {      // the pit
        var d = Math.sqrt(px * px * 0.72 + py * py * 1.25) + Math.sin(Math.atan2(py, px) * 5 + a0) * 1.2;
        if (d <= R) stamp(px, py, 1, d * 0.8);
      }
      for (i = 0; i < arms; i++) {
        ang = a0 + i / arms * 6.283 + rng.range(-0.25, 0.25);
        walk(Math.cos(ang) * (R - 2), Math.sin(ang) * (R - 2) * 0.8, ang, rng.int(26, 38), 5, R * 0.8, 1);
      }
    } else {
      ang = rng.range(0, Math.PI);
      var len = rng.int(18, 26);
      walk(0, 0, ang, len, 5, 0, 0);
      walk(0, 0, ang + Math.PI + rng.range(-0.3, 0.3), len - rng.int(0, 5), 5, 0, 0);
    }
    var cells = [], k, p;
    for (k in core) { p = k.split(','); cells.push({ x: +p[0], y: +p[1], o: core[k] / maxO, core: true }); }
    var edge = {};
    for (i = 0; i < cells.length; i++) {
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
    var W = boss ? 34 : rng.int(30, 36), H = boss ? 24 : rng.int(20, 24);
    var tiles = new Uint8Array(W * H), x, y, i;
    function at(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : tiles[ty * W + tx]; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y < 2 || y === H - 1) tiles[y * W + x] = 1;
    }
    var sx = rng.int(9, W - 10), sy = H - 3;
    var ex = rng.int(9, W - 10);
    var cx = Math.floor(W / 2), cy = Math.floor(H / 2) + 1;
    var chest = { tx: ex, ty: 4 };
    function reserved(tx, ty) {
      if (Math.abs(tx - sx) <= 2 && Math.abs(ty - sy) <= 2) return true;
      if (Math.abs(tx - ex) <= 2 && ty <= 6) return true;
      if (Math.abs(tx - cx) <= 5 && Math.abs(ty - cy) <= 4) return true;
      return false;
    }
    function fill(bx, by, bw, bh) {
      for (var yy = by; yy < by + bh; yy++) for (var xx = bx; xx < bx + bw; xx++) {
        if (xx > 0 && yy > 1 && xx < W - 1 && yy < H - 1 && !reserved(xx, yy)) tiles[yy * W + xx] = 1;
      }
    }
    // irregular outline: cut corners and add buttresses along the walls
    var cw, ch;
    if (rng.chance(0.8)) { cw = rng.int(3, 7); ch = rng.int(2, 4); fill(1, 2, cw, ch); }
    if (rng.chance(0.8)) { cw = rng.int(3, 7); ch = rng.int(2, 4); fill(W - 1 - cw, 2, cw, ch); }
    if (rng.chance(0.8)) { cw = rng.int(3, 7); ch = rng.int(2, 4); fill(1, H - 1 - ch, cw, ch); }
    if (rng.chance(0.8)) { cw = rng.int(3, 7); ch = rng.int(2, 4); fill(W - 1 - cw, H - 1 - ch, cw, ch); }
    var bumps = boss ? 2 : rng.int(2, 5);
    for (i = 0; i < bumps; i++) {
      var side = rng.int(0, 3), bl = rng.int(2, 4), bd = rng.int(1, 2);
      if (side === 0) fill(rng.int(8, W - 12), 2, bl, bd);
      else if (side === 1) fill(rng.int(8, W - 12), H - 1 - bd, bl, bd);
      else if (side === 2) fill(1, rng.int(7, H - 10), bd, bl);
      else fill(W - 1 - bd, rng.int(7, H - 10), bd, bl);
    }
    // pillars and wall blocks inside the room (always at least 2 tall, so they show a top and a face)
    var blocks = [];
    if (boss) {
      blocks = [[7, 6, 2, 2], [W - 9, 6, 2, 2], [7, H - 8, 2, 2], [W - 9, H - 8, 2, 2]];
    } else {
      var n = rng.int(4, 8), tries = 0;
      while (blocks.length < n && tries++ < 300) {
        var bw = rng.int(2, 3), bh = rng.int(2, 3);
        if (rng.chance(0.2)) bw = rng.int(4, 5);
        var bx = rng.int(4, W - 5 - bw), by = rng.int(5, H - 5 - bh), ok = true;
        for (y = by - 2; y < by + bh + 2 && ok; y++) for (x = bx - 2; x < bx + bw + 2 && ok; x++) {
          if (reserved(x, y) || at(x, y)) ok = false;
        }
        if (ok) { blocks.push([bx, by, bw, bh]); fill(bx, by, bw, bh); }
      }
    }
    if (boss) for (i = 0; i < blocks.length; i++) fill(blocks[i][0], blocks[i][1], blocks[i][2], blocks[i][3]);
    // no corridor narrower than two tiles: a floor tile that is not part of any 2x2 floor block becomes wall
    var changed = true;
    while (changed) {
      changed = false;
      for (y = 2; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
        if (at(x, y)) continue;
        var open = false;
        for (var oy = -1; oy <= 0 && !open; oy++) for (var ox = -1; ox <= 0 && !open; ox++) {
          if (!at(x + ox, y + oy) && !at(x + ox + 1, y + oy) && !at(x + ox, y + oy + 1) && !at(x + ox + 1, y + oy + 1)) open = true;
        }
        if (!open) { tiles[y * W + x] = 1; changed = true; }
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

    // fissure sites: open floor, away from the start, the exit and the centre
    var cand = [];
    for (y = 4; y < H - 3; y++) for (x = 3; x < W - 3; x++) {
      var clear = true;
      for (var dy = -1; dy <= 1 && clear; dy++) for (var dx = -2; dx <= 2 && clear; dx++) if (at(x + dx, y + dy)) clear = false;
      if (!clear) continue;
      if (Math.abs(x - sx) <= 5 && Math.abs(y - sy) <= 4) continue;
      if (Math.abs(x - ex) <= 3 && y <= 7) continue;
      if (Math.abs(x - cx) <= 7 && Math.abs(y - cy) <= 5) continue;
      cand.push([x, y]);
    }
    rng.shuffle(cand);
    var want = B.fissure.count[index], sites = [], gap = 12;
    while (sites.length < want && gap >= 3) {
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

    // dressing: floor decals, wall torches on south-facing wall faces
    var decals = [], torches = [];
    for (y = 2; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      if (!at(x, y) && rng.chance(0.06) && !(x === chest.tx && y === chest.ty)) {
        decals.push({ x: x * T + rng.int(3, 12), y: y * T + rng.int(4, 12), k: rng.int(0, 5) });
      }
    }
    var lastT = -9;
    for (y = 1; y < H - 2; y++) {
      lastT = -9;
      for (x = 1; x < W - 1; x++) {
        if (!at(x, y) || at(x, y + 1)) continue;
        if (y === 1 && Math.abs(x - ex) <= 1) continue;
        if (x - lastT >= 5 && rng.chance(y === 1 ? 0.6 : 0.3)) { torches.push({ x: x * T + 8, y: y * T + 8 }); lastT = x; }
      }
    }

    var h = 2166136261;
    for (i = 0; i < W * H; i++) h = Math.imul(h ^ tiles[i], 16777619);
    for (i = 0; i < fissures.length; i++) h = Math.imul(h ^ (fissures[i].x * 31 + fissures[i].y * 17 + fissures[i].cells.length), 16777619);
    h = Math.imul(h ^ (ex * 131 + sx), 16777619) >>> 0;

    return {
      seed: seed, index: index, boss: boss, w: W, h: H, tiles: tiles,
      start: { x: sx * T + 8, y: sy * T + 8 },
      exit: { tx: ex, ty: 1, x: ex * T + 8, y: 2 * T + 3 },
      chest: { x: chest.tx * T + 8, y: chest.ty * T + 8 },
      fissures: fissures, decals: decals, torches: torches, hash: h
    };
  };
})(globalThis.G = globalThis.G || {});
