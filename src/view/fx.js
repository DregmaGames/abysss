// Feedback: particles, pixel rings, damage numbers, capped screen shake.
// Everything is drawn on the art-pixel grid (1x1 rects), never as smooth vector shapes.
(function (G) {
  var UI = G.UI, cache = {};

  // integer pixels of an ellipse outline, ordered clockwise from the top
  G.ellipsePixels = function (rx, ry) {
    var key = rx + 'x' + ry;
    if (cache[key]) return cache[key];
    var pts = [], seen = {}, n = Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 1.6) + 8;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i / n * Math.PI * 2;
      var x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry), k = x + ',' + y;
      if (!seen[k]) { seen[k] = 1; pts.push(x, y); }
    }
    return (cache[key] = pts);
  };

  function FX(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(9000);
    this.parts = []; this.rings = []; this.nums = []; this.pool = [];
    this.trauma = 0; this.sx = 0; this.sy = 0;
    this.quiet = false;       // set during fast-forward (bot runs): skip cosmetic spawns
  }
  FX.prototype.burst = function (x, y, color, n, speed, life) {
    if (this.quiet) return;
    var c = UI.hex(color);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, sp = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.6 + Math.random() * 0.4), max: life, c: c, s: Math.random() < 0.3 ? 2 : 1 });
    }
  };
  FX.prototype.spark = function (x, y, color, life) {
    if (this.quiet || this.parts.length > 600) return;
    this.parts.push({ x: x, y: y, vx: 0, vy: 0, life: life, max: life, c: UI.hex(color), s: 1 });
  };
  FX.prototype.ring = function (x, y, r0, r1, dur, color, squash) {
    if (this.quiet) return;
    this.rings.push({ x: Math.round(x), y: Math.round(y), r0: r0, r1: r1, t: 0, dur: dur, c: UI.hex(color), q: squash || 1 });
  };
  FX.prototype.number = function (x, y, text, color) {
    if (this.quiet) return;
    var t = this.pool.pop();
    if (!t) t = this.scene.add.bitmapText(0, 0, 'font', '').setDepth(9500);
    t.setText(text).setTint(UI.hex(color)).setVisible(true).setAlpha(1);
    t.x = Math.round(x - t.width / 2 + (Math.random() * 10 - 5)); t.y = Math.round(y - 10);
    this.nums.push({ t: t, life: 0.7, y: t.y });
    if (this.nums.length > 40) this.release(this.nums.shift());
  };
  FX.prototype.release = function (n) { n.t.setVisible(false); this.pool.push(n.t); };
  FX.prototype.shake = function (amount) { this.trauma = Math.min(1, this.trauma + amount); };

  FX.prototype.update = function (dt) {
    var g = this.g, i, p, B = G.BAL.fx;
    g.clear();
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      g.fillStyle(p.c, 1);
      g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    for (i = this.rings.length - 1; i >= 0; i--) {
      var r = this.rings[i];
      r.t += dt;
      if (r.t >= r.dur) { this.rings.splice(i, 1); continue; }
      var k = r.t / r.dur, rad = Math.round(r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)));
      var pts = G.ellipsePixels(rad, Math.max(1, Math.round(rad * r.q)));
      g.fillStyle(r.c, 1);
      for (var j = 0; j < pts.length; j += 2) {
        if (k > 0.6 && (j >> 1) % 2) continue;         // break up into a dotted ring as it fades
        g.fillRect(r.x + pts[j], r.y + pts[j + 1], 1, 1);
      }
    }
    for (i = this.nums.length - 1; i >= 0; i--) {
      var n = this.nums[i];
      n.life -= dt;
      if (n.life <= 0) { this.release(n); this.nums.splice(i, 1); continue; }
      n.y -= 22 * dt;
      n.t.y = Math.round(n.y);
      if (n.life < 0.2) n.t.setAlpha(n.life < 0.1 ? 0.35 : 0.7);
    }
    // screen shake: capped amplitude, scaled by the accessibility setting
    var set = G.save.settings.shake / 100;
    if (this.trauma > 0.001 && set > 0) {
      var amp = B.shakeCap * this.trauma * this.trauma * set;
      this.sx = Math.round((Math.random() * 2 - 1) * amp); this.sy = Math.round((Math.random() * 2 - 1) * amp);
      this.trauma = Math.max(0, this.trauma - dt * B.shakeDecay * 0.25);
    } else { this.sx = 0; this.sy = 0; this.trauma = 0; }
  };
  FX.prototype.clear = function () {
    this.parts.length = 0; this.rings.length = 0;
    while (this.nums.length) this.release(this.nums.pop());
  };
  G.FX = FX;
})(globalThis.G = globalThis.G || {});
