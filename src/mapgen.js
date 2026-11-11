// Room generation. Pure function of (runSeed, roomIndex): same seed = same map.
(function (G) {
  var T = 16;

  // A fissure is a crack: a set of art pixels relative to its centre, each with an
  // "order" 0..1 (distance along the crack) used to animate it expanding and closing.
  // The super fissure is a pit with cracks radiating from it.
  // Normal cracks: two arms from the centre (or one arm when it branches off another crack), each
  // `len` px long. Every cell gets a segment index (band of `order`): the crack goes dark band by band.
  // `ok(x, y)` (optional, crack-local px): false where no crack may run. An arm that reaches such a
  // place ends there and tapers to a point, instead of being cut off along the zone's edge.
  function genFissure(rng, big, len, oneArm, ang0, ok) {
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
      var base = a, pts = [], forks = [], k, n;
      for (k = 0; k < len; k++) {                      // pass 1: the path, until it ends or is stopped
        if (ok && !ok(x, y)) break;
        pts.push(x, y);
        var t = k / len;
        a += rng.range(-0.6, 0.6);
        if (a > base + 0.8) a = base + 0.8;
        if (a < base - 0.8) a = base - 0.8;
        x += G.M.cos(a); y += G.M.sin(a) * 0.8;
        if (depth < 2 && t > 0.2 && t < 0.75 && rng.chance(big ? 0.08 : 0.07)) {
          forks.push([k, x, y, a + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.2)]);
        }
      }
      n = pts.length / 2;
      for (var f = 0, q = 0; q < n; q++) {             // pass 2: stamp it, tapering over its real length
        var w = Math.max(1, Math.round(w0 * (1 - q / n * 0.9)));
        stamp(pts[q * 2], pts[q * 2 + 1], w, o0 + q);
        for (; f < forks.length && forks[f][0] === q; f++) {
          walk(forks[f][1], forks[f][2], forks[f][3], Math.round((n - q) * 0.6), Math.max(1, w - 1), o0 + q, depth + 1);
        }
      }
    }
    var i, ang;
    if (big) {
      var R = 13, arms = rng.int(6, 7), a0 = rng.range(0, 6.283);
      for (var py = -R; py <= R; py++) for (var px = -R - 2; px <= R + 2; px++) {      // the pit
        var d = Math.sqrt(px * px * 0.72 + py * py * 1.25) + G.M.sin(G.M.atan2(py, px) * 5 + a0) * 1.2;
        if (d <= R) stamp(px, py, 1, d * 0.8);
      }
      for (i = 0; i < arms; i++) {
        ang = a0 + i / arms * 6.283 + rng.range(-0.25, 0.25);
        walk(G.M.cos(ang) * (R - 3), G.M.sin(ang) * (R - 3) * 0.8, ang, rng.int(34, 50), 6, R * 0.8, 1);
      }
    } else if (oneArm) {
      walk(0, 0, ang0, len, 6, 0, 0);
    } else {
      ang = rng.range(0, Math.PI);
      walk(0, 0, ang, len, 7, 0, 0);
      walk(0, 0, ang + Math.PI + rng.range(-0.3, 0.3), len - rng.int(0, 8), 7, 0, 0);
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
    // The crack network: `count` long cracks, closer together than single fissures used to be.
    // Some branch off an earlier crack: joined cracks form a cluster that shares one kill meter.
    var F = B.fissure, want = F.count[index], fissures = [];
    var sxp = sx * T + 8, syp = sy * T + 8, exp_ = ex * T + 8, cxp = cx * T + 8, cyp = cy * T + 8;
    function zone(px, py, m) {                     // reserved areas, grown by a margin of m px
      if (Math.abs(px - sxp) <= 40 + m && Math.abs(py - syp) <= 34 + m) return true;   // start
      if (Math.abs(px - exp_) <= 30 + m && py <= 8 * T + m) return true;               // chest and exit
      var qx = px - cxp, qy = py - cyp;
      return qx * qx + qy * qy < (30 + m) * (30 + m);                                  // super fissure pit
    }
    function keepOut(px, py) {                     // art pixels that never hold a crack
      return at(Math.floor(px / T), Math.floor(py / T)) || zone(px, py, 0);
    }
    // cracks stop 6 px short of a reserved area (their half-width plus the rim) and 3 px short of a
    // wall or pillar, so an arm ends in a point there and nothing is cut along a straight edge
    function wallNear(px, py, m) {
      return at(Math.floor((px - m) / T), Math.floor((py - m) / T)) || at(Math.floor((px + m) / T), Math.floor((py - m) / T)) ||
        at(Math.floor((px - m) / T), Math.floor((py + m) / T)) || at(Math.floor((px + m) / T), Math.floor((py + m) / T));
    }
    function clearOf(ox, oy) { return function (lx, ly) { return !zone(ox + lx, oy + ly, 6) && !wallNear(ox + lx, oy + ly, 3); }; }
    function place(fx, fy, cells) {
      var out = [];
      for (var c = 0; c < cells.length; c++) if (!keepOut(fx + cells[c].x, fy + cells[c].y)) out.push(cells[c]);
      return out;
    }
    function siteFree(px, py) {
      var tx = Math.floor(px / T), ty = Math.floor(py / T);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (at(tx + ox, ty + oy)) return false;
      return !keepOut(px, py);
    }
    var gap = F.siteGap, ci = 0, tries = 0;
    while (fissures.length < want && tries++ < 200) {
      var made = null, k2;
      if (fissures.length && rng.chance(F.joinChance)) {
        // branch: start on a mid-length core cell of an earlier crack, head away from its centre
        var par = fissures[rng.int(0, fissures.length - 1)], mids = [];
        for (k2 = 0; k2 < par.cells.length; k2++) {
          var pc = par.cells[k2];
          if (pc.core && pc.o > 0.35 && pc.o < 0.8 && siteFree(par.x + pc.x, par.y + pc.y)) mids.push(pc);
        }
        if (mids.length) {
          var m0 = mids[rng.int(0, mids.length - 1)], away = G.M.atan2(m0.y, m0.x) + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.3);
          var bxp = par.x + m0.x, byp = par.y + m0.y;
          made = { x: bxp, y: byp, cl: par.cl, cells: place(bxp, byp, genFissure(rng, false, rng.int(F.crackLen[0], F.crackLen[1]), true, away, clearOf(bxp, byp))) };
        }
      }
      if (!made) {
        for (; ci < cand.length && !made; ci++) {
          var fx = cand[ci][0] * T + 8, fy = cand[ci][1] * T + 8, far = true;
          for (k2 = 0; k2 < fissures.length; k2++) if (Math.abs(fissures[k2].x - fx) + Math.abs(fissures[k2].y - fy) < gap * T) far = false;
          if (far && siteFree(fx, fy)) made = { x: fx, y: fy, cl: -1, cells: place(fx, fy, genFissure(rng, false, rng.int(F.crackLen[0], F.crackLen[1]), false, 0, clearOf(fx, fy))) };
        }
        if (!made) { if (gap > 3) { gap--; ci = 0; continue; } break; }
      }
      if (made.cells.length < 12) continue;                     // clipped to almost nothing: try again
      if (made.cl < 0) made.cl = fissures.length;
      made.big = false;
      for (k2 = 0; k2 < made.cells.length; k2++) made.cells[k2].seg = Math.min(F.segments - 1, Math.floor(made.cells[k2].o * F.segments));
      fissures.push(made);
    }
    var bx2 = cx * T + 8, by2 = cy * T + 8;
    var pit = genFissure(rng, true).filter(function (c) { return !at(Math.floor((bx2 + c.x) / T), Math.floor((by2 + c.y) / T)); });
    fissures.push({ x: bx2, y: by2, big: true, cl: -1, cells: pit });

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
