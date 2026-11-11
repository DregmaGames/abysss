// Deterministic RNG. Every random decision in the sim goes through one of these streams.
(function (G) {
  G.hash32 = function (a, b) {
    var h = (a ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ ((b + 0x7f4a7c15) >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };

  function RNG(seed) { this.s = seed >>> 0; }
  RNG.prototype.next = function () {           // mulberry32
    var t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.weighted = function (weights) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var r = this.next() * sum;
    for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  };
  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  G.RNG = RNG;

  // Deterministic math. Math.sin/cos/atan2/pow/exp/log are not exact in IEEE 754, so each JS engine
  // (Node, Chrome, Firefox, Safari) may return a different last bit, and a run drifts apart after a
  // few minutes. These use only + - * / and Math.sqrt, which every engine computes bit-identically.
  // The sim, the map generator and the bot must use G.M instead of Math for these functions.
  var PI = 3.141592653589793, TAU = 6.283185307179586, HALF_PI = 1.5707963267948966, QPI = 0.7853981633974483;
  function sinPoly(x) {            // |x| <= pi/4
    var z = x * x;
    return x * (1 + z * (-1 / 6 + z * (1 / 120 + z * (-1 / 5040 + z * (1 / 362880 + z * (-1 / 39916800 + z * (1 / 6227020800 + z * (-1 / 1307674368000))))))));
  }
  function cosPoly(x) {            // |x| <= pi/4
    var z = x * x;
    return 1 + z * (-1 / 2 + z * (1 / 24 + z * (-1 / 720 + z * (1 / 40320 + z * (-1 / 3628800 + z * (1 / 479001600 + z * (-1 / 87178291200 + z * (1 / 20922789888000))))))));
  }
  function quadrant(x) {           // x = q * pi/2 + r, |r| <= pi/4
    x = x - TAU * Math.round(x / TAU);
    var q = Math.round(x / HALF_PI);
    return [((q % 4) + 4) % 4, x - q * HALF_PI];
  }
  function sin(x) {
    var a = quadrant(x), r = a[1];
    switch (a[0]) { case 0: return sinPoly(r); case 1: return cosPoly(r); case 2: return -sinPoly(r); default: return -cosPoly(r); }
  }
  function cos(x) {
    var a = quadrant(x), r = a[1];
    switch (a[0]) { case 0: return cosPoly(r); case 1: return -sinPoly(r); case 2: return -cosPoly(r); default: return sinPoly(r); }
  }
  function atanSmall(x) {          // |x| <= tan(pi/16): series converges in a few terms
    var z = x * x, s = 0, k;
    for (k = 23; k >= 1; k -= 2) s = 1 / k - z * s;
    return x * s;
  }
  function atan(x) {
    var neg = x < 0, inv = false, off = 0, r;
    if (neg) x = -x;
    if (x > 1) { x = 1 / x; inv = true; }
    if (x > 0.41421356237309503) { x = (x - 1) / (x + 1); off = QPI; }               // atan(x) = pi/4 + atan((x-1)/(x+1))
    if (x > 0.198912367379658 || x < -0.198912367379658) {                            // halve once more: tan(pi/16)
      var t = x / (1 + Math.sqrt(1 + x * x));                                          // atan(x) = 2 atan(x / (1 + sqrt(1 + x^2)))
      r = 2 * atanSmall(t);
    } else r = atanSmall(x);
    r += off;
    if (inv) r = HALF_PI - r;
    return neg ? -r : r;
  }
  function atan2(y, x) {
    if (x > 0) return atan(y / x);
    if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
    return y > 0 ? HALF_PI : (y < 0 ? -HALF_PI : 0);
  }
  var LN2 = 0.6931471805599453;
  function log(x) {
    if (!(x > 0)) return x === 0 ? -Infinity : NaN;
    var e = 0;
    while (x >= 2) { x /= 2; e++; }                 // exact: powers of two only change the exponent
    while (x < 1) { x *= 2; e--; }
    if (x > 1.4142135623730951) { x /= 2; e++; }
    var z = (x - 1) / (x + 1), z2 = z * z, s = 0, k;  // log(x) = 2 atanh(z), |z| < 0.172
    for (k = 25; k >= 1; k -= 2) s = 1 / k + z2 * s;
    return e * LN2 + 2 * z * s;
  }
  function exp(x) {
    if (x > 709) return Infinity;
    if (x < -745) return 0;
    var k = Math.round(x / LN2), r = x - k * LN2, s = 1, i;
    for (i = 17; i >= 1; i--) s = 1 + r * s / i;
    while (k > 0) { s *= 2; k--; }
    while (k < 0) { s /= 2; k++; }
    return s;
  }
  function pow(a, b) {
    if (b === 0) return 1;
    if (b === Math.floor(b) && Math.abs(b) <= 64) {   // integer powers: repeated multiplication
      var n = Math.abs(b), r = 1, base = a;
      while (n) { if (n & 1) r *= base; base *= base; n >>= 1; }
      return b < 0 ? 1 / r : r;
    }
    if (a === 0) return 0;
    if (a < 0) return NaN;
    return exp(b * log(a));
  }
  G.M = { sin: sin, cos: cos, atan: atan, atan2: atan2, log: log, exp: exp, pow: pow, PI: PI, TAU: TAU };
})(globalThis.G = globalThis.G || {});
