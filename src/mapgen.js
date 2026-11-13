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
  // `P` (optional): { r, arms: [lo, hi], armLen: [lo, hi] } sizes the super fissure's pit (default: the small pit of the
  // tutorial room); { fork, forkLen: [lo, hi], third: [chance, lo, hi] } for a normal crack: fork chance per px of arm, px a fork off an arm may run, and a third arm at about
  // a right angle, `lo`..`hi` x the arm length (BAL.fissure).
  var KO = 2048, KW = 4096;      // a crack px (x, y) relative to its centre is the number (y + KO) * KW + x + KO
  var LOOK = 9, TURNS = [0.6, 1.0, 1.4], MAXTURN = 1.5;      // px an arm looks ahead; the turns it tries (rad, either side); how far it may end up from its first heading
  function genFissure(rng, big, len, oneArm, ang0, ok, P) {
    P = P || {};
    var core = new Map(), maxO = 0, forkP = P.fork || (big ? 0.08 : 0.07), wk = P.wk || 1;      // wk: x the arm widths (BAL.tune.fissures)
    function stamp(x, y, w, o) {
      var h = Math.floor(w / 2);
      for (var dy = -h; dy <= h; dy++) for (var dx = -h; dx <= h; dx++) {
        if (w > 2 && Math.abs(dx) === h && Math.abs(dy) === h) continue;
        var k = (Math.round(y) + dy + KO) * KW + Math.round(x) + dx + KO, v = core.get(k);
        if (v === undefined || v > o) core.set(k, o);
      }
      if (o > maxO) maxO = o;
    }
    function walk(x, y, a, len, w0, o0, depth) {
      var base = a, first = a, pts = [], forks = [], k, n, bends = ok && P.bend && !depth ? P.bend : 0, j;
      for (k = 0; k < len; k++) {                      // pass 1: the path, until it ends or is stopped
        if (ok && !ok(x, y)) break;
        pts.push(x, y);
        var t = k / len;
        a += rng.range(-0.6, 0.6);
        if (a > base + 0.8) a = base + 0.8;
        if (a < base - 0.8) a = base - 0.8;
        // something in the way a few px ahead (a pillar, a wall, a reserved zone): the arm turns to run past it instead of ending there,
        // at most P.bend times; with no free side it goes on and ends in a point as before
        if (bends > 0 && !ok(x + G.M.cos(a) * LOOK, y + G.M.sin(a) * 0.8 * LOOK)) {
          var sgn = rng.chance(0.5) ? 1 : -1;
          for (j = 0; j < TURNS.length * 2; j++) {
            var a2 = base + TURNS[j >> 1] * (j % 2 ? -sgn : sgn), c2 = G.M.cos(a2), s2 = G.M.sin(a2) * 0.8;
            if (Math.abs(a2 - first) > MAXTURN) continue;      // it winds past things but keeps its heading: no curling up in a pocket
            if (ok(x + c2 * LOOK, y + s2 * LOOK) && ok(x + c2 * LOOK * 2, y + s2 * LOOK * 2) && ok(x + c2 * LOOK * 3, y + s2 * LOOK * 3)) { a = base = a2; bends--; break; }
          }
        }
        x += G.M.cos(a); y += G.M.sin(a) * 0.8;
        if (depth < 2 && t > 0.2 && t < 0.75 && rng.chance(forkP)) {
          forks.push([k, x, y, a + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.2)]);
        }
      }
      n = pts.length / 2;
      for (var f = 0, q = 0; q < n; q++) {             // pass 2: stamp it, tapering over its real length
        var w = Math.max(1, Math.round(w0 * (1 - q / n * 0.9)));
        stamp(pts[q * 2], pts[q * 2 + 1], w, o0 + q);
        for (; f < forks.length && forks[f][0] === q; f++) {
          var fl = Math.round((n - q) * 0.6);
          if (P.forkLen && !depth) fl = Math.min(fl, rng.int(P.forkLen[0], P.forkLen[1]));      // twigs, not more long arms
          walk(forks[f][1], forks[f][2], forks[f][3], fl, Math.max(1, w - 1), o0 + q, depth + 1);
        }
      }
    }
    var i, ang;
    if (big) {
      var R = P.r || 13, pa = P.arms || [6, 7], pl = P.armLen || [34, 50], arms = rng.int(pa[0], pa[1]), a0 = rng.range(0, 6.283);
      for (var py = -R; py <= R; py++) for (var px = -R - 2; px <= R + 2; px++) {      // the pit
        var d = Math.sqrt(px * px * 0.72 + py * py * 1.25) + G.M.sin(G.M.atan2(py, px) * 5 + a0) * 1.2;
        if (d <= R) stamp(px, py, 1, d * 0.8);
      }
      for (i = 0; i < arms; i++) {
        ang = a0 + i / arms * 6.283 + rng.range(-0.25, 0.25);
        walk(G.M.cos(ang) * (R - 3), G.M.sin(ang) * (R - 3) * 0.8, ang, rng.int(pl[0], pl[1]), sc(6, wk), R * 0.8, 1);
      }
    } else if (oneArm) {
      walk(0, 0, ang0, len, sc(6, wk), 0, 0);
    } else {
      ang = rng.range(0, Math.PI);
      if (ok && P.aim) {      // of P.aim headings, the one with the most free floor along both arms: cracks run where the room is open
        var bestA = ang, bestRun = -1, q, run, st;
        for (q = 0; q < P.aim; q++) {
          var ta = ang + q * Math.PI / P.aim, tc = G.M.cos(ta), ts = G.M.sin(ta) * 0.8;
          for (run = 0, st = 4; st <= len && ok(tc * st, ts * st); st += 4) run++;
          for (st = 4; st <= len && ok(-tc * st, -ts * st); st += 4) run++;
          if (run > bestRun) { bestRun = run; bestA = ta; }
        }
        ang = bestA;
      }
      walk(0, 0, ang, len, sc(7, wk), 0, 0);
      walk(0, 0, ang + Math.PI + rng.range(-0.3, 0.3), len - rng.int(0, 8), sc(7, wk), 0, 0);
      if (P.third && rng.chance(P.third[0])) {      // a third arm: the crack reaches across more of the room without being one more crack
        walk(0, 0, ang + (rng.chance(0.5) ? 1 : -1) * Math.PI / 2 + rng.range(-0.4, 0.4), Math.round(len * rng.range(P.third[1], P.third[2])), sc(6, wk), 0, 0);
      }
    }
    var cells = [], edge = new Map();
    core.forEach(function (o, k) { cells.push({ x: k % KW - KO, y: Math.floor(k / KW) - KO, o: o / maxO, core: true }); });
    for (i = 0; i < cells.length; i++) {
      var c = cells[i];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var ek = (c.y + dy + KO) * KW + c.x + dx + KO, ev;
        if (core.has(ek)) continue;
        ev = edge.get(ek);
        if (ev === undefined || ev > c.o) edge.set(ek, c.o);
      }
    }
    edge.forEach(function (o, k) { cells.push({ x: k % KW - KO, y: Math.floor(k / KW) - KO, o: o, core: false }); });
    cells.sort(function (a, b) { return a.o - b.o || a.y - b.y || a.x - b.x; });
    return cells;
  }

  G.genFissure = genFissure;      // the tutorial room (src/sim/tutorial.js) draws its super fissure with it

  // A size multiplier of BAL.tune (step size panel): 1 when the block or the key is missing, clamped to its range, rounded to 0.01
  // (so 0.1 steps added in floating point give the same rooms as the typed value).
  G.tuneOf = function (B, key) {
    var t = B && B.tune, v = t && typeof t[key] === 'number' && isFinite(t[key]) ? t[key] : 1, rg = t && t.range && t.range[key];
    if (rg) v = Math.max(rg[0], Math.min(rg[1], v));
    return Math.round(v * 100) / 100;
  };
  function sc(n, k, lo) { return k === 1 ? n : Math.max(lo || 1, Math.round(n * k)); }      // n tiles or px x a multiplier, at least lo
  G.tuneScale = sc;

  // `mod`: optional door modifier id (BAL.doors.mods): crackLen and extraCracks change the cracks only; the walls are the same
  G.genRoom = function (runSeed, index, B, mod) {
    var seed = G.hash32(runSeed >>> 0, index * 7919 + 13);
    var rng = new G.RNG(seed);
    var boss = index === B.run.rooms - 1;
    var R = B.room, RV = R.reserve;
    // size tuning (BAL.tune; 1 = untouched: every number and every rng call is what it was): kR x the room and its outline's
    // corners and buttresses, kO x the pillars and wall blocks, kF x the cracks and the super fissure. Whole tiles / px.
    var kR = G.tuneOf(B, 'room'), kO = G.tuneOf(B, 'obstacles'), kF = G.tuneOf(B, 'fissures');
    function ri(a, b) { return rng.int(a, Math.max(a, b)); }      // a range a tuned size may have closed up: its low end
    var W = boss ? sc(R.boss.w, kR) : rng.int(sc(R.w[0], kR), sc(R.w[1], kR)), H = boss ? sc(R.boss.h, kR) : rng.int(sc(R.h[0], kR), sc(R.h[1], kR));
    var tiles = new Uint8Array(W * H), x, y, i;
    function at(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 1 : tiles[ty * W + tx]; }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y < 2 || y === H - 1) tiles[y * W + x] = 1;
    }
    var sm = Math.min(sc(R.startMargin, kR), (W >> 1) - 4);      // with the room (its cut corners grow too); never past the middle
    var sx = rng.int(sm, W - 1 - sm), sy = H - 3;
    var ex = rng.int(sm, W - 1 - sm);
    var cx = Math.floor(W / 2), cy = Math.floor(H / 2) + 1;
    var chest = { tx: ex, ty: 4 };
    // tiles that never become wall: round the start (the merchant and the cage stand there), under the exit (the chest), round the super fissure
    function reserved(tx, ty) {
      if (Math.abs(tx - sx) <= RV.start && Math.abs(ty - sy) <= RV.start) return true;
      if (Math.abs(tx - ex) <= RV.exitW && ty <= RV.exitH) return true;
      if (Math.abs(tx - cx) <= RV.centreW && Math.abs(ty - cy) <= RV.centreH) return true;
      return false;
    }
    function fill(bx, by, bw, bh) {
      for (var yy = by; yy < by + bh; yy++) for (var xx = bx; xx < bx + bw; xx++) {
        if (xx > 0 && yy > 1 && xx < W - 1 && yy < H - 1 && !reserved(xx, yy)) tiles[yy * W + xx] = 1;
      }
    }
    // irregular outline: cut corners (some in two steps) and buttresses along the walls
    var cw, ch, CN = R.corner, k0;
    for (k0 = 0; k0 < 4; k0++) {
      if (!rng.chance(CN.chance)) continue;
      cw = rng.int(sc(CN.w[0], kR), sc(CN.w[1], kR)); ch = rng.int(sc(CN.h[0], kR), sc(CN.h[1], kR));
      var left = k0 % 2 === 0, top = k0 < 2, c2 = rng.chance(CN.step) ? Math.max(2, cw >> 1) : 0, h2 = c2 ? ch + rng.int(1, 3) : 0;
      fill(left ? 1 : W - 1 - cw, top ? 2 : H - 1 - ch, cw, ch);
      if (c2) fill(left ? 1 : W - 1 - c2, top ? 2 : H - 1 - h2, c2, h2);
    }
    var bumps = boss ? R.bossBumps : rng.int(R.bumps[0], R.bumps[1]);
    for (i = 0; i < bumps; i++) {
      var side = rng.int(0, 3), bl = rng.int(sc(R.bumpLen[0], kR), sc(R.bumpLen[1], kR)), bd = rng.int(R.bumpDepth[0], R.bumpDepth[1]);
      if (side === 0) fill(ri(8, W - 9 - bl), 2, bl, bd);
      else if (side === 1) fill(ri(8, W - 9 - bl), H - 1 - bd, bl, bd);
      else if (side === 2) fill(1, ri(6, H - 7 - bl), bd, bl);
      else fill(W - 1 - bd, ri(6, H - 7 - bl), bd, bl);
    }
    // pillars and wall blocks inside the room (always at least 2 tall, so they show a top and a face). Kinds: pillar (2-3 square),
    // wide wall, tall wall, big block, and an L (a wide and a tall wall sharing a corner). Every block keeps `blockGap` free tiles round it.
    var blocks = [];
    if (boss) {
      var px0 = [sc(9, kR), sc(18, kR), W - sc(20, kR), W - sc(11, kR)], pr = sc(2, kO, 2), py0 = sc(7, kR, 4), py1 = H - sc(10, kR, 6);
      for (i = 0; i < px0.length; i++) blocks.push([px0[i], py0, pr, pr], [px0[i], py1, pr, pr]);
    } else {
      var n = rng.int(R.blocks[0], R.blocks[1]), tries = 0, BK = R.blockKinds, gp = R.blockGap;
      while (blocks.length < n && tries++ < 600) {
        var kd = rng.weighted([BK.pillar, BK.wide, BK.tall, BK.big, BK.ell]), bw, bh, ell = 0;
        if (kd === 0) { bw = rng.int(2, 3); bh = rng.int(2, 3); }
        else if (kd === 1) { bw = rng.int(4, 7); bh = 2; }
        else if (kd === 2) { bw = 2; bh = rng.int(4, 6); }
        else if (kd === 3) { bw = rng.int(4, 5); bh = rng.int(3, 4); }
        else { bw = rng.int(4, 6); bh = rng.int(4, 5); ell = rng.int(1, 4); }
        if (kO !== 1) { bw = sc(bw, kO, ell ? 4 : 2); bh = sc(bh, kO, ell ? 4 : 2); }      // the L keeps room for its two 2-thick bars
        var bx = ri(4, W - 5 - bw), by = ri(5, H - 5 - bh), ok = true;
        for (y = by - gp; y < by + bh + gp && ok; y++) for (x = bx - gp; x < bx + bw + gp && ok; x++) {
          if (reserved(x, y) || at(x, y)) ok = false;
        }
        if (!ok) continue;
        blocks.push([bx, by, bw, bh]);
        if (!ell) fill(bx, by, bw, bh);
        else {      // the L: a horizontal bar on the top or bottom row pair, a vertical bar on the left or right column pair
          var th = kO === 1 ? 2 : sc(2, kO, 2);      // the bars' thickness
          fill(bx, ell <= 2 ? by : by + bh - th, bw, th);
          fill(ell % 2 ? bx : bx + bw - th, by, th, bh);
        }
      }
    }
    if (boss) for (i = 0; i < blocks.length; i++) fill(blocks[i][0], blocks[i][1], blocks[i][2], blocks[i][3]);
    // a buttress clipped by a reserved zone can be left one tile wide: such a sliver (floor on both sides) goes back to floor
    for (y = 2; y < H - 1; y++) for (x = 1; x < W - 1; x++) if (at(x, y) && !at(x - 1, y) && !at(x + 1, y)) tiles[y * W + x] = 0;
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
    var cand = [], ST = kR === 1 ? R.site : { start: R.site.start, exit: R.site.exit, centre: [sc(R.site.centre[0], kR), sc(R.site.centre[1], kR)] };      // the centre's keep-out grows and shrinks with the room
    for (y = 4; y < H - 3; y++) for (x = 3; x < W - 3; x++) {
      var clear = true;
      for (var dy = -1; dy <= 1 && clear; dy++) for (var dx = -2; dx <= 2 && clear; dx++) if (at(x + dx, y + dy)) clear = false;
      if (!clear) continue;
      if (Math.abs(x - sx) <= ST.start[0] && Math.abs(y - sy) <= ST.start[1]) continue;
      if (Math.abs(x - ex) <= ST.exit[0] && y <= ST.exit[1]) continue;
      if (Math.abs(x - cx) <= ST.centre[0] && Math.abs(y - cy) <= ST.centre[1]) continue;
      cand.push([x, y]);
    }
    rng.shuffle(cand);
    // open sites first (no wall within 3 tiles), keeping the shuffled order inside each group
    var openC = [], tightC = [];
    for (i = 0; i < cand.length; i++) {
      var op = true;
      for (dy = -3; dy <= 3 && op; dy++) for (dx = -3; dx <= 3 && op; dx++) if (at(cand[i][0] + dx, cand[i][1] + dy)) op = false;
      (op ? openC : tightC).push(cand[i]);
    }
    cand = openC.concat(tightC);
    // The crack network: `count` long cracks, closer together than single fissures used to be.
    // Some branch off an earlier crack: joined cracks form a cluster that shares one kill meter.
    var F = B.fissure, dm = (mod && B.doors.mods[mod]) || {}, want = F.count[index] + (dm.extraCracks || 0), fissures = [];
    var cLo = Math.round(F.crackLen[0] * (dm.crackLen || 1)), cHi = Math.round(F.crackLen[1] * (dm.crackLen || 1));
    if (kF !== 1) { cLo = Math.round(cLo * kF); cHi = Math.round(cHi * kF); }
    var SP = kF === 1 ? F.superPit : { r: sc(F.superPit.r, kF), arms: F.superPit.arms, armLen: [sc(F.superPit.armLen[0], kF), sc(F.superPit.armLen[1], kF)], keep: sc(F.superPit.keep, kF), wk: kF };
    var minCells = sc(F.minCells, kF);
    var sxp = sx * T + 8, syp = sy * T + 8, exp_ = ex * T + 8, cxp = cx * T + 8, cyp = cy * T + 8;
    function zone(px, py, m) {                     // reserved areas, grown by a margin of m px
      if (Math.abs(px - sxp) <= 40 + m && Math.abs(py - syp) <= 34 + m) return true;   // start
      if (Math.abs(px - exp_) <= 30 + m && py <= 8 * T + m) return true;               // chest and exit
      var qx = px - cxp, qy = py - cyp;
      return qx * qx + qy * qy < (SP.keep + m) * (SP.keep + m);        // super fissure pit
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
    var SECT = [0, 5, 2, 3, 1, 4], flipX = rng.chance(0.5), flipY = rng.chance(0.5), nSite = 0;
    var gap = sc(F.siteGap, kR, 4), ci = 0, tries = 0, CP = { fork: F.fork, forkLen: kF === 1 ? F.forkLen : [sc(F.forkLen[0], kF), sc(F.forkLen[1], kF)], third: F.thirdArm, bend: F.bend, aim: F.aim, wk: kF };
    while (fissures.length < want && tries++ < 200) {
      var made = null, k2;
      if (fissures.length >= Math.ceil(want * F.siteShare) && rng.chance(F.joinChance)) {      // the first cracks are always separate centres
        // branch: start on a mid-length core cell of an earlier crack, head away from its centre
        var par = fissures[rng.int(0, fissures.length - 1)], mids = [];
        for (k2 = 0; k2 < par.cells.length; k2++) {
          var pc = par.cells[k2];
          if (pc.core && pc.o > 0.35 && pc.o < 0.8 && siteFree(par.x + pc.x, par.y + pc.y)) mids.push(pc);
        }
        if (mids.length) {
          var m0 = mids[rng.int(0, mids.length - 1)], away = G.M.atan2(m0.y, m0.x) + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.3);
          var bxp = par.x + m0.x, byp = par.y + m0.y;
          made = { x: bxp, y: byp, cl: par.cl, cells: place(bxp, byp, genFissure(rng, false, rng.int(cLo, cHi), true, away, clearOf(bxp, byp), CP)) };
        }
      }
      if (!made) {
        // a new crack centre. The room is cut into 3 x 2 sectors and each new crack goes to the next sector of a diagonal order
        // (mirrored at random), so the network spreads over the whole room; inside the sector: the first candidate (shuffled; the
        // open ones, 3 tiles from any wall, come first) at least `gap` tiles from every other centre. No candidate there: any sector.
        for (var pass = 0; pass < 2 && !made; pass++) {
          var sec = SECT[nSite % 6], scx = flipX ? 2 - sec % 3 : sec % 3, scy = flipY ? 1 - (sec / 3 | 0) : sec / 3 | 0;
          for (ci = 0; ci < cand.length && !made; ci++) {
            var cd0 = cand[ci], fx = cd0[0] * T + 8, fy = cd0[1] * T + 8, far = true;
            if (cd0[2]) continue;
            if (!pass && (Math.min(2, Math.floor(cd0[0] * 3 / W)) !== scx || Math.min(1, Math.floor((cd0[1] - 2) * 2 / (H - 3))) !== scy)) continue;
            for (k2 = 0; k2 < fissures.length; k2++) if (Math.abs(fissures[k2].x - fx) + Math.abs(fissures[k2].y - fy) < gap * T) far = false;
            if (!far || !siteFree(fx, fy)) continue;
            cd0[2] = 1;
            made = { x: fx, y: fy, cl: -1, cells: place(fx, fy, genFissure(rng, false, rng.int(cLo, cHi), false, 0, clearOf(fx, fy), CP)) };
          }
        }
        nSite++;
        if (!made) { if (gap > 3) { gap--; continue; } break; }
      }
      if (made.cells.length < minCells) continue;             // stopped or clipped to a stub: try again
      if (made.cl < 0) made.cl = fissures.length;
      made.big = false;
      for (k2 = 0; k2 < made.cells.length; k2++) made.cells[k2].seg = Math.min(F.segments - 1, Math.floor(made.cells[k2].o * F.segments));
      fissures.push(made);
    }
    var bx2 = cx * T + 8, by2 = cy * T + 8;
    var pit = genFissure(rng, true, 0, false, 0, null, SP).filter(function (c) { return !at(Math.floor((bx2 + c.x) / T), Math.floor((by2 + c.y) / T)); });
    fissures.push({ x: bx2, y: by2, big: true, cl: -1, cells: pit });

    // dressing: floor decals, wall torches on south-facing wall faces
    var decals = [], torches = [];
    for (y = 2; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      if (!at(x, y) && rng.chance(R.decals) && !(x === chest.tx && y === chest.ty)) {
        decals.push({ x: x * T + rng.int(3, 12), y: y * T + rng.int(4, 12), k: rng.int(0, 5) });
      }
    }
    var lastT = -9;
    for (y = 1; y < H - 2; y++) {
      lastT = -9;
      for (x = 1; x < W - 1; x++) {
        if (!at(x, y) || at(x, y + 1)) continue;
        if (y === 1 && Math.abs(x - ex) <= 1) continue;
        if (x - lastT >= R.torchGap && rng.chance(y === 1 ? R.torchTop : R.torchIn)) { torches.push({ x: x * T + 8, y: y * T + 8 }); lastT = x; }
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
