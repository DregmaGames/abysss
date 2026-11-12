// Audio: every sound and the music are made in code with the Web Audio API (oscillators, noise, filters, envelopes).
// No files. View only: the sim is never touched and Math.random is used here only for pitch variation and note choice.
//   G.audio.event(e, scene)   called by GameScene.playEvents for each sim event
//   G.audio.play(name, o)     one sound by name (UI actions use it too);  G.audio.ui('click' | 'back' | 'hover')
//   G.audio.stats             debug counters: { played, dropped, voicesMax, ctx, music, boss, ... }
// The AudioContext starts at the first tap / click / key (browsers refuse before). ?mute=1 turns it all off (QA).
(function (G) {
  var A = G.audio = {
    ctx: null, muted: false, started: false, mode: null, boss: false,
    stats: { played: 0, dropped: 0, early: 0, cooled: 0, voicesMax: 0, ctx: 'none', music: 'none', boss: false, byName: {} }
  };
  var CAP = 12, CAP_PRI = 18;          // simultaneous voices (priority sounds may go to CAP_PRI)
  var voices = [], last = {}, lastAny = 0, lastUi = 0;
  var rnd = Math.random;

  function vol(key, def) { var s = G.save && G.save.settings, v = s ? s[key] : def; return isFinite(v) && v >= 0 ? Math.min(100, v) / 100 : def / 100; }
  A.musicVol = function () { return vol('music', 50); };
  A.sfxVol = function () { return vol('sfx', 70); };

  // ---------------------------------------------------------------- start
  A.init = function () {
    A.muted = !!(G.params && G.params.get('mute') === '1');
    if (A.muted) { A.stats.ctx = 'muted'; return; }
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { A.stats.ctx = 'unsupported'; return; }
    var evs = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'keydown'];
    function go() {
      try { A.start(AC); } catch (err) { A.stats.ctx = 'error'; }
      if (A.ctx && A.ctx.state === 'running') evs.forEach(function (n) { window.removeEventListener(n, go, true); });
    }
    evs.forEach(function (n) { window.addEventListener(n, go, true, { passive: true }); });
    document.addEventListener('visibilitychange', function () {
      if (!A.ctx) return;
      if (document.hidden) A.ctx.suspend().catch(function () {}); else A.ctx.resume().catch(function () {});
    });
    setInterval(poll, 200);
  };

  A.start = function (AC) {
    if (!A.ctx) {
      var c = A.ctx = new AC({ latencyHint: 'interactive' });
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.18;
      A.master = c.createGain(); A.master.gain.value = 0.85;
      A.sfxBus = c.createGain(); A.musicBus = c.createGain();
      A.sfxBus.connect(comp); A.musicBus.connect(comp); comp.connect(A.master); A.master.connect(c.destination);
      // one second of white noise, shared by every noise sound
      var n = c.sampleRate, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      A.noiseBuf = buf;
      A.applyVolumes(true);
    }
    if (A.ctx.state !== 'running') A.ctx.resume().catch(function () {});
    A.started = true;
    A.stats.ctx = A.ctx.state;
    A.ctx.onstatechange = function () { A.stats.ctx = A.ctx.state; };
  };

  A.applyVolumes = function (now) {
    if (!A.ctx) return;
    var t = A.ctx.currentTime, m = A.musicVol(), s = A.sfxVol();
    var gm = m * m * 2.6, gs = s * s * 2.0;
    if (now) { A.musicBus.gain.value = gm; A.sfxBus.gain.value = gs; }
    else { A.musicBus.gain.setTargetAtTime(gm, t, 0.04); A.sfxBus.gain.setTargetAtTime(gs, t, 0.04); }
    if (m <= 0) A.stopMusic(); else if (A.mode) A.setMode(A.mode, true);
  };

  // ------------------------------------------------------------ primitives
  // Each takes the time t, the sound's options o ({ k: pitch factor, v: volume factor }) and a spec; all feed A.sfxBus.
  function endAt(o, t) { if (t > o.end) o.end = t; }
  // oscillator with an exponential pitch glide f0 -> f1 and an attack/decay envelope. flt: optional { type, f, q } filter
  function T(o, t, type, f0, f1, dur, v, atk, flt) {
    var c = A.ctx, os = c.createOscillator(), g = c.createGain(), k = o.k, out = o.out;
    os.type = type; os.frequency.setValueAtTime(Math.max(20, f0 * k), t);
    if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * k), t + dur);
    atk = atk || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * o.v, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (flt) { var f = c.createBiquadFilter(); f.type = flt.type; f.frequency.value = flt.f; f.Q.value = flt.q || 1; os.connect(f); f.connect(g); } else os.connect(g);
    g.connect(out); os.start(t); os.stop(t + dur + 0.03); endAt(o, t + dur + 0.03);
  }
  // filtered noise; the filter glides f0 -> f1
  function N(o, t, dur, v, type, f0, f1, q, atk) {
    var c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q || 1; f.frequency.setValueAtTime(Math.max(30, f0 * o.k), t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * o.k), t + dur);
    atk = atk || 0.003;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * o.v, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.out); s.start(t, rnd()); s.stop(t + dur + 0.03); endAt(o, t + dur + 0.03);
  }
  function hz(semi) { return 440 * Math.pow(2, (semi - 9) / 12); }      // semitones above C4 -> Hz  (hz(9) = 440)
  function arp(o, t, notes, gap, type, dur, v) { notes.forEach(function (n, i) { T(o, t + i * gap, type, hz(n), hz(n), dur, v, 0.006); }); }

  // ---------------------------------------------------------------- sounds
  // cd = per-sound cooldown (ms), pri = 1: may use the extra voices, fn(t, o, a)
  var S = {
    // --- player attacks: physical and short. Blades ring, blunt weapons thud, arrows whoosh and twang, the mage sparkles.
    atk_mage:   { cd: 55, fn: function (t, o) { T(o, t, 'sine', 700, 1500, 0.1, 0.2); T(o, t + 0.03, 'sine', 1400, 2800, 0.1, 0.12); T(o, t + 0.07, 'triangle', 2100, 3600, 0.1, 0.07); N(o, t, 0.12, 0.09, 'highpass', 5000, 8000, 1, 0.02); T(o, t, 'sine', 200, 120, 0.06, 0.12); } },
    atk_archer: { cd: 55, fn: function (t, o) { N(o, t, 0.11, 0.22, 'bandpass', 2800, 900, 2); T(o, t, 'triangle', 330, 290, 0.16, 0.16); T(o, t, 'sine', 660, 640, 0.12, 0.07); T(o, t, 'sine', 120, 80, 0.05, 0.14); } },
    atk_sword:  { cd: 70, fn: function (t, o) { N(o, t, 0.13, 0.3, 'bandpass', 1800, 5600, 1.2); T(o, t + 0.03, 'sine', 2100, 2100, 0.22, 0.07); T(o, t + 0.03, 'sine', 3150, 3150, 0.16, 0.045); T(o, t, 'sine', 180, 100, 0.05, 0.14); } },
    atk_axe:    { cd: 80, fn: function (t, o) { N(o, t, 0.15, 0.32, 'bandpass', 1200, 3200, 1); T(o, t + 0.04, 'sine', 1500, 1500, 0.2, 0.06); T(o, t + 0.04, 'sine', 2250, 2250, 0.14, 0.04); T(o, t + 0.04, 'sine', 130, 60, 0.12, 0.28); } },
    atk_mace:   { cd: 90, fn: function (t, o) { N(o, t, 0.1, 0.22, 'bandpass', 800, 400, 0.8); T(o, t + 0.04, 'sine', 120, 45, 0.18, 0.5); N(o, t + 0.04, 0.09, 0.3, 'lowpass', 900, 200); } },
    atk_hammer: { cd: 100, fn: function (t, o) { N(o, t, 0.14, 0.24, 'bandpass', 500, 220, 0.8); T(o, t + 0.06, 'sine', 90, 32, 0.26, 0.6); N(o, t + 0.06, 0.16, 0.38, 'lowpass', 700, 120); T(o, t + 0.06, 'sawtooth', 70, 35, 0.12, 0.1); } },
    hit:   { cd: 38, fn: function (t, o) { T(o, t, 'sine', 170, 55, 0.09, 0.32); N(o, t, 0.06, 0.26, 'bandpass', 2200, 800, 0.9); } },
    crit:  { cd: 60, pri: 1, fn: function (t, o) { T(o, t, 'sine', 200, 50, 0.13, 0.4); N(o, t, 0.08, 0.32, 'bandpass', 2600, 900, 0.9); T(o, t + 0.01, 'sine', 1900, 1900, 0.28, 0.12); T(o, t + 0.01, 'sine', 2850, 2850, 0.2, 0.08); T(o, t + 0.04, 'sine', 3800, 4600, 0.14, 0.05); } },
    // --- skills
    skill_mage:    { cd: 120, pri: 1, fn: function (t, o) { T(o, t, 'sine', 240, 60, 0.32, 0.45); N(o, t, 0.28, 0.24, 'bandpass', 1500, 400, 1); arp(o, t + 0.02, [12, 19, 24, 28], 0.04, 'sine', 0.2, 0.1); } },
    skill_warrior: { cd: 120, pri: 1, fn: function (t, o) { T(o, t, 'sine', 120, 34, 0.4, 0.7); N(o, t, 0.34, 0.45, 'lowpass', 1800, 90, 0.7); T(o, t, 'sawtooth', 90, 40, 0.2, 0.14); } },
    skill_archer:  { cd: 120, pri: 1, fn: function (t, o) { for (var i = 0; i < 4; i++) { N(o, t + i * 0.04, 0.1, 0.2, 'bandpass', 3000 - i * 250, 1000, 2); T(o, t + i * 0.04, 'triangle', 340 - i * 20, 300, 0.1, 0.1); } } },
    // --- hero
    phit:   { cd: 90, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 190, 65, 0.26, 0.2); N(o, t, 0.2, 0.2, 'lowpass', 1000, 200); T(o, t, 'square', 95, 50, 0.16, 0.1); } },
    dodge:  { cd: 90, fn: function (t, o, a) { N(o, t, 0.15, a && a.cross ? 0.2 : 0.14, 'bandpass', 500, a && a.cross ? 3200 : 2200, 1); T(o, t, 'sine', 300, a && a.cross ? 900 : 560, 0.11, 0.05); } },
    blocked: { cd: 170, fn: function (t, o) { T(o, t, 'sine', 125, 70, 0.1, 0.14); N(o, t, 0.06, 0.1, 'lowpass', 700, 300); } },
    heal:   { cd: 150, fn: function (t, o) { arp(o, t, [7, 11, 14], 0.07, 'sine', 0.22, 0.09); } },
    levelup: { cd: 300, pri: 1, fn: function (t, o) { arp(o, t, [0, 4, 7, 12], 0.085, 'triangle', 0.35, 0.16); arp(o, t + 0.01, [12, 16, 19, 24], 0.085, 'sine', 0.5, 0.06); N(o, t + 0.3, 0.5, 0.05, 'highpass', 6000, 6000, 1, 0.1); } },
    card:   { cd: 120, fn: function (t, o) { T(o, t, 'square', 520, 780, 0.08, 0.07); T(o, t + 0.05, 'triangle', 1040, 1040, 0.16, 0.1); T(o, t + 0.05, 'sine', 1560, 1560, 0.2, 0.04); } },
    dead:   { cd: 800, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 330, 50, 1.6, 0.22); N(o, t, 1.4, 0.25, 'lowpass', 1500, 80); T(o, t, 'sine', 90, 28, 1.7, 0.3); } },
    won:    { cd: 800, pri: 1, fn: function (t, o) { arp(o, t, [0, 4, 7, 12, 16, 19, 24], 0.12, 'triangle', 0.6, 0.15); arp(o, t, [-12, -8, -5], 0.3, 'sine', 1.2, 0.12); } },
    // --- monsters
    die:    { cd: 45, fn: function (t, o, a) { var b = a && a.type; N(o, t, 0.3, 0.2, 'lowpass', 2200, 180); T(o, t, 'sawtooth', 270, 60, 0.3, 0.1); if (b === 'skeleton') N(o, t, 0.12, 0.18, 'bandpass', 3200, 1500, 3); if (b === 'cultist') T(o, t, 'sine', 700, 200, 0.4, 0.06); } },
    boss_die: { cd: 800, pri: 1, fn: function (t, o) {
      T(o, t, 'sawtooth', 210, 30, 1.8, 0.26); N(o, t, 2.0, 0.34, 'lowpass', 1600, 70); T(o, t, 'sine', 62, 24, 1.8, 0.45);
      for (var i = 0; i < 4; i++) { N(o, t + 0.25 + i * 0.28, 0.35, 0.16, 'lowpass', 900, 100); T(o, t + 0.25 + i * 0.28, 'sine', 90 - i * 10, 30, 0.35, 0.2); }
      arp(o, t + 1.3, [-5, -8, -12, -17], 0.2, 'triangle', 0.9, 0.09);
    } },
    spawn:  { cd: 110, fn: function (t, o) { T(o, t, 'sine', 180, 320, 0.16, 0.05); N(o, t, 0.12, 0.04, 'bandpass', 700, 1400, 2); } },
    windup_s: { cd: 130, fn: function (t, o) { T(o, t, 'square', 420, 640, 0.09, 0.09); } },
    shoot:  { cd: 90, fn: function (t, o) { N(o, t, 0.1, 0.22, 'bandpass', 1500, 700, 2); T(o, t, 'triangle', 380, 190, 0.08, 0.12); } },
    shoot_boss: { cd: 150, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 260, 90, 0.3, 0.14); N(o, t, 0.3, 0.2, 'bandpass', 1800, 500, 1.4); T(o, t, 'square', 520, 180, 0.2, 0.06); } },
    summon: { cd: 300, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 70, 140, 0.7, 0.14, 0.2); T(o, t, 'sawtooth', 74, 150, 0.7, 0.1, 0.2); N(o, t, 0.6, 0.12, 'bandpass', 300, 1500, 2, 0.2); } },
    enrage: { cd: 800, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 160, 55, 1.1, 0.3); N(o, t, 1.0, 0.25, 'bandpass', 600, 220, 1.2); T(o, t, 'square', 78, 62, 1.0, 0.1); } },
    // boss wind-ups last as long as the sim's wind-up (dur seconds)
    wind_slam:   { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 1; T(o, t, 'sawtooth', 50, 150, d, 0.2, d * 0.6); N(o, t, d, 0.2, 'lowpass', 150, 1100, 1, d * 0.7); } },
    wind_burst:  { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 0.6; T(o, t, 'square', 300, 1100, d, 0.1, d * 0.7); T(o, t, 'sine', 600, 2200, d, 0.08, d * 0.7); N(o, t, d, 0.08, 'highpass', 2000, 6000, 1, d * 0.8); } },
    wind_charge: { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 0.8; N(o, t, d, 0.22, 'bandpass', 200, 1500, 2, d * 0.8); T(o, t, 'sawtooth', 70, 210, d, 0.16, d * 0.7); T(o, t, 'square', 35, 35, d, 0.05, d * 0.5); } },
    slam:   { cd: 150, pri: 1, fn: function (t, o) { T(o, t, 'sine', 95, 28, 0.42, 0.85); N(o, t, 0.3, 0.55, 'lowpass', 1500, 70); T(o, t, 'sawtooth', 110, 40, 0.18, 0.14); } },
    rune:   { cd: 250, fn: function (t, o) { T(o, t, 'sine', 330, 760, 0.55, 0.08, 0.25); T(o, t, 'triangle', 335, 770, 0.55, 0.05, 0.25); } },
    erupt:  { cd: 180, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 220, 50, 0.32, 0.16); N(o, t, 0.3, 0.2, 'bandpass', 1400, 300, 1); T(o, t, 'sine', 80, 40, 0.3, 0.2); } },
    fizzle: { cd: 150, fn: function (t, o) { N(o, t, 0.2, 0.22, 'bandpass', 2200, 400, 1.5); } },
    // --- cracks
    crack_open: { cd: 120, fn: function (t, o) { N(o, t, 0.5, 0.26, 'lowpass', 500, 100); T(o, t, 'sawtooth', 95, 40, 0.5, 0.15); for (var i = 0; i < 3; i++) N(o, t + 0.04 + rnd() * 0.3, 0.03, 0.14, 'highpass', 3000, 3000); } },
    crack_big:  { cd: 300, pri: 1, fn: function (t, o) { N(o, t, 0.9, 0.34, 'lowpass', 600, 70); T(o, t, 'sawtooth', 80, 30, 0.9, 0.22); T(o, t, 'sine', 48, 28, 1.1, 0.32); for (var i = 0; i < 5; i++) N(o, t + 0.05 + rnd() * 0.6, 0.04, 0.16, 'highpass', 2500, 2500); } },
    crack_close: { cd: 200, fn: function (t, o) { N(o, t, 0.55, 0.16, 'lowpass', 90, 900); T(o, t, 'sine', 40, 90, 0.4, 0.1); } },
    scar:   { cd: 200, fn: function (t, o) { T(o, t, 'sine', 140, 45, 0.3, 0.18); N(o, t, 0.25, 0.14, 'lowpass', 900, 120); } },
    seg:    { cd: 100, fn: function (t, o) { T(o, t, 'sine', 420, 80, 0.36, 0.15); N(o, t, 0.28, 0.1, 'lowpass', 1300, 100); } },
    super:  { cd: 600, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 110, 98, 1.3, 0.2, 0.3); T(o, t, 'sawtooth', 116, 104, 1.3, 0.16, 0.3); T(o, t, 'sine', 55, 40, 1.5, 0.35, 0.2); N(o, t, 1.2, 0.2, 'lowpass', 300, 900, 1, 0.4); } },
    exit_open: { cd: 400, fn: function (t, o) { N(o, t, 0.8, 0.2, 'lowpass', 400, 160, 1); T(o, t, 'sawtooth', 70, 55, 0.8, 0.1, 0.1); T(o, t + 0.5, 'triangle', hz(7), hz(7), 0.5, 0.07); } },
    // --- loot
    chest:  { cd: 300, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 110, 220, 0.2, 0.07); N(o, t, 0.15, 0.1, 'bandpass', 1800, 900, 2); arp(o, t + 0.15, [0, 4, 7, 12, 16], 0.07, 'triangle', 0.4, 0.12); N(o, t + 0.2, 0.6, 0.07, 'highpass', 6000, 6000, 1, 0.1); } },
    drop:   { cd: 90, fn: function (t, o, a) {
      var r = Math.min(4, (a && a.rarity) | 0), base = [9, 12, 16, 19, 24][r], i, n;
      for (i = 0; i <= Math.min(r, 3); i++) { n = hz(base + [0, 4, 7, 12][i]); T(o, t + i * 0.055, 'sine', n, n, 0.22 + r * 0.07, 0.18); T(o, t + i * 0.055, 'sine', n * 2.76, n * 2.76, 0.12 + r * 0.03, 0.05 + r * 0.01); }
      if (r >= 2) N(o, t + 0.05, 0.35 + r * 0.1, 0.05 + r * 0.015, 'highpass', 5000 + r * 900, 5000 + r * 900, 1, 0.05);
      if (r >= 4) { T(o, t + 0.25, 'sine', hz(31), hz(31), 0.8, 0.12); T(o, t + 0.3, 'sine', hz(36), hz(36), 0.9, 0.09); }
    } },
    gold:   { cd: 75, fn: function (t, o) { T(o, t, 'sine', 1568, 1568, 0.05, 0.14); T(o, t + 0.05, 'sine', 2093, 2093, 0.22, 0.16); T(o, t + 0.05, 'sine', 5770, 5770, 0.1, 0.04); } },
    scroll: { cd: 150, fn: function (t, o) { N(o, t, 0.16, 0.1, 'bandpass', 3200, 5200, 1.5); T(o, t + 0.05, 'sine', 880, 1320, 0.22, 0.07); } },
    tome:   { cd: 150, fn: function (t, o) { T(o, t, 'sine', 400, 1200, 0.3, 0.09); T(o, t + 0.05, 'triangle', 600, 1800, 0.3, 0.05); N(o, t, 0.3, 0.04, 'highpass', 5000, 5000, 1, 0.1); } },
    item:   { cd: 90, fn: function (t, o) { N(o, t, 0.05, 0.1, 'highpass', 3500, 3500); T(o, t, 'square', 1800, 1200, 0.06, 0.04); T(o, t + 0.04, 'triangle', 1500, 1500, 0.12, 0.05); } },
    orb:    { cd: 70, fn: function (t, o) { T(o, t, 'sine', 900, 1500, 0.07, 0.1); } },
    orb_heal: { cd: 100, fn: function (t, o) { T(o, t, 'sine', 500, 900, 0.18, 0.14); } },
    equip:  { cd: 120, fn: function (t, o) { N(o, t, 0.06, 0.14, 'highpass', 3000, 3000); T(o, t, 'square', 1900, 1200, 0.06, 0.04); T(o, t + 0.05, 'triangle', 900, 900, 0.1, 0.06); } },
    identify: { cd: 120, fn: function (t, o) { arp(o, t, [12, 16, 19], 0.06, 'sine', 0.2, 0.07); } },
    // --- world and people
    door:   { cd: 250, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 85, 55, 0.45, 0.14); N(o, t, 0.45, 0.2, 'lowpass', 600, 180); T(o, t + 0.4, 'sine', 70, 35, 0.3, 0.2); } },
    leave:  { cd: 250, fn: function (t, o) { arp(o, t, [7, 4, 0, -5], 0.1, 'triangle', 0.35, 0.09); N(o, t, 0.5, 0.08, 'lowpass', 900, 150); } },
    merchant: { cd: 300, fn: function (t, o) { arp(o, t, [14, 19, 16, 21], 0.07, 'sine', 0.5, 0.08); N(o, t, 0.3, 0.05, 'highpass', 6500, 6500, 1, 0.05); } },
    buy:    { cd: 120, fn: function (t, o) { T(o, t, 'square', 1568, 1568, 0.05, 0.05); T(o, t + 0.06, 'square', 1175, 1175, 0.05, 0.05); T(o, t + 0.12, 'triangle', 2093, 2093, 0.2, 0.08); } },
    cagelocked: { cd: 300, fn: function (t, o) { T(o, t, 'square', 170, 150, 0.09, 0.08); T(o, t + 0.12, 'square', 150, 130, 0.12, 0.08); } },
    rescue: { cd: 500, pri: 1, fn: function (t, o) { arp(o, t, [0, 4, 7, 9, 12, 16], 0.1, 'triangle', 0.5, 0.12); N(o, t, 0.7, 0.08, 'highpass', 5500, 5500, 1, 0.1); } },
    montoto: { cd: 250, fn: function (t, o) {      // a grumbling old voice: saw syllables through a moving formant
      var n = 5 + (rnd() * 3 | 0), f = 90 + rnd() * 25;
      for (var i = 0; i < n; i++) { var s = t + i * (0.1 + rnd() * 0.04), fo = 350 + rnd() * 700; T(o, s, 'sawtooth', f * (1 + rnd() * 0.25), f * 0.85, 0.1, 0.17, 0.015, { type: 'bandpass', f: fo, q: 3 }); }
    } },
    burst:  { cd: 80, fn: function (t, o) { T(o, t, 'sine', 520, 200, 0.2, 0.08); N(o, t, 0.15, 0.06, 'bandpass', 2000, 700, 1.5); } },
    chain:  { cd: 90, fn: function (t, o) { for (var i = 0; i < 4; i++) T(o, t + i * 0.025, 'square', 700 + rnd() * 1800, 400, 0.03, 0.04); N(o, t, 0.1, 0.07, 'highpass', 3500, 3500); } },
    zone:   { cd: 200, fn: function (t, o) { T(o, t, 'sine', 130, 190, 0.5, 0.1, 0.2); N(o, t, 0.5, 0.06, 'bandpass', 500, 900, 2, 0.2); } },
    echo:   { cd: 100, fn: function (t, o) { T(o, t, 'sine', 1100, 1100, 0.18, 0.09); T(o, t + 0.1, 'sine', 1100, 1100, 0.18, 0.05); } },
    room:   { cd: 300, fn: function (t, o) { N(o, t, 0.5, 0.2, 'bandpass', 300, 900, 1, 0.2); } },
    // --- UI
    click:  { cd: 30, ui: 1, fn: function (t, o) { T(o, t, 'square', 700, 460, 0.05, 0.14); T(o, t, 'sine', 1400, 900, 0.045, 0.07); } },
    hover:  { cd: 40, ui: 1, fn: function (t, o) { T(o, t, 'sine', 920, 920, 0.035, 0.05); } },
    back:   { cd: 30, ui: 1, fn: function (t, o) { T(o, t, 'square', 460, 320, 0.06, 0.13); T(o, t, 'sine', 920, 560, 0.045, 0.06); } }
  };
  A.sounds = S;

  // ------------------------------------------------------------------ play
  A.play = function (name, a) {
    var st = A.stats;
    if (A.muted) return;
    var c = A.ctx;
    if (!c || c.state !== 'running') { st.early++; return; }
    var def = S[name];
    if (!def) return;
    var now = c.currentTime, ms = now * 1000, i;
    if (ms - (last[name] || -1e9) < (def.cd || 40)) { st.cooled++; return; }
    for (i = voices.length - 1; i >= 0; i--) if (voices[i] <= now) voices.splice(i, 1);
    if (voices.length >= (def.pri ? CAP_PRI : CAP)) { st.dropped++; return; }
    last[name] = ms;
    var o = { k: def.ui ? 1 : 0.94 + rnd() * 0.12, v: (a && a.v) || 1, out: A.sfxBus, end: now };
    try { def.fn(now + 0.005, o, a || {}); } catch (err) { st.errors = (st.errors || 0) + 1; return; }
    voices.push(o.end);
    st.played++; st.byName[name] = (st.byName[name] || 0) + 1;
    if (voices.length > st.voicesMax) st.voicesMax = voices.length;
    if (!def.ui) lastAny = ms; else lastUi = ms;
  };
  // UI sounds: not on top of a game sound that has just played (a card pick or a door has its own)
  A.ui = function (name) {
    if (!A.ctx) { A.stats.early++; return; }
    if (A.ctx.currentTime * 1000 - lastAny < 60) return;
    A.play(name);
  };
  A.preview = function () { var c = A.ctx; if (c) { last.click = -1e9; A.play('click'); } };

  // monsters by id, to tell a boss wind-up from a small one
  function monster(sim, id) { var ms = sim.monsters, i; for (i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i]; return null; }

  // one sim event -> sounds. `scene` is the GameScene.
  A.event = function (e, scene) {
    if (A.muted || !A.ctx || (scene.fx && scene.fx.quiet)) { if (!A.ctx && !A.muted) A.stats.early++; return; }
    var p = A.play, sim = scene.sim, m;
    switch (e.t) {
      case 'cast': p(scene.cls.id === 'archer' ? 'atk_archer' : 'atk_mage'); break;
      case 'swing': p('atk_' + (e.w || 'sword')); break;
      case 'hit': if (e.src === 'dot') break; p(e.crit ? 'crit' : 'hit'); break;
      case 'phit': p('phit'); break;
      case 'die': p(e.type === 'tyrant' ? 'boss_die' : 'die', { type: e.type }); break;
      case 'spawn': p('spawn'); break;
      case 'dodge': p('dodge', { cross: e.cross }); break;
      case 'pulse': p(scene.cls.id === 'warrior' ? 'skill_warrior' : 'skill_mage'); break;
      case 'volley': p('skill_archer'); break;
      case 'burst': p('burst'); break;
      case 'chain': p('chain'); break;
      case 'execute': p('crit'); break;
      case 'echo': p('echo'); break;
      case 'zone': p('zone'); break;
      case 'blocked': p('blocked'); break;
      case 'heal': p('heal'); break;
      case 'levelup': p('levelup'); break;
      case 'gold': p('gold'); break;
      case 'orb': p(e.kind === 'heal' ? 'orb_heal' : 'orb'); break;
      case 'drop': p('drop', { rarity: e.rarity }); break;
      case 'pickup': p(e.kind === 'scroll' ? 'scroll' : e.kind === 'tome' ? 'tome' : 'item'); break;
      case 'chest': p('chest'); break;
      case 'equip': p('equip'); break;
      case 'identify': p('identify'); break;
      case 'merchant': if (e.open) p('merchant'); break;
      case 'buy': p('buy'); break;
      case 'cagelocked': p('cagelocked'); break;
      case 'rescue': p('rescue'); break;
      case 'room': p('room'); break;
      case 'fissure':
        if (e.state === 'opening') p(e.big ? 'crack_big' : 'crack_open');
        else if (e.state === 'closing') p('crack_close');
        else if (e.state === 'scar') p('scar');
        break;
      case 'seg': p('seg'); break;
      case 'phase': if (e.phase === 'super') p('super'); else if (e.phase === 'exit') p('exit_open'); break;
      case 'windup':
        m = monster(sim, e.id);
        if (m && m.def.boss) p(m.st === 'burstWind' ? 'wind_burst' : m.st === 'chargeWind' ? 'wind_charge' : 'wind_slam', { dur: e.dur });
        else p('windup_s');
        break;
      case 'slam': p('slam'); break;
      case 'enrage': p('enrage'); break;
      case 'summon': p('summon'); break;
      case 'shoot': m = monster(sim, e.id); p(m && m.def.boss ? 'shoot_boss' : 'shoot'); break;
      case 'hex': p('rune'); break;
      case 'erupt': p('erupt'); break;
      case 'fizzle': p('fizzle'); break;
      case 'dead': p('dead'); break;
      case 'won': p('won'); break;
    }
  };

  // ------------------------------------------------------------------ music
  // Generative and deterministic: every note is a pure function of the bar number (a hash, no state, no Math.random), so a track
  // never needs memory and always sounds musical (chords from fixed progressions, melodies on a scale that land on chord tones).
  //   city  80 BPM, A minor: soft string pad, plucked harp arpeggio, lute-like bass, a woodwind melody every other 2 bars
  //   run   72 BPM, D minor / phrygian: cello drone, distant choir pad, a sparse ostinato, soft frame drum
  //   boss  144 BPM on the run's clock: driving low toms, shaker, clap, brass stabs on the run's chord root; the run dips to 80 %
  // Each track is a gain node with a cheap echo; a 150 ms scheduler adds the notes of the bars that are due. A change of mode
  // cross-fades over 2.5 s, the boss layer fades in over 1.5 s.
  var tracks = {}, schedTimer = null;
  function hh(a, b) {      // deterministic hash -> [0, 1)
    var x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var QUAL = { min: [0, 3, 7], maj: [0, 4, 7], p5: [0, 7, 12] };
  // progressions: 4 chords of [root MIDI, quality]; a cycle picks one by hash (never the same twice in a row)
  var CITY_PROG = [
    [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj']],
    [[45, 'min'], [43, 'maj'], [41, 'maj'], [43, 'maj']],
    [[45, 'min'], [50, 'min'], [41, 'maj'], [40, 'min']],
    [[41, 'maj'], [48, 'maj'], [43, 'maj'], [45, 'min']]
  ];
  var RUN_PROG = [
    [[50, 'min'], [46, 'maj'], [43, 'min'], [45, 'p5']],
    [[50, 'min'], [51, 'maj'], [50, 'min'], [48, 'maj']],
    [[50, 'min'], [43, 'min'], [46, 'maj'], [45, 'p5']],
    [[50, 'min'], [53, 'maj'], [43, 'min'], [50, 'min']]
  ];
  function progIndex(cycle, salt) { var i = Math.floor(hh(cycle, salt) * 4), p = Math.floor(hh(cycle - 1, salt) * 4); return i === p && cycle > 0 ? (i + 1) % 4 : i; }
  function chordOf(table, step, perCycle, salt) { var cyc = Math.floor(step / perCycle); return table[progIndex(cyc, salt)][((step % perCycle) + perCycle) % perCycle]; }
  function notesOf(ch, lo, hi) {      // every note of the chord between lo and hi (MIDI), ascending
    var out = [], n, iv = QUAL[ch[1]];
    for (n = lo; n <= hi; n++) if (iv.indexOf(((n - ch[0]) % 12 + 12) % 12) >= 0 || (ch[1] === 'p5' && ((n - ch[0]) % 12 + 12) % 12 === 0)) out.push(n);
    return out;
  }
  var A_MINOR = [0, 2, 4, 5, 7, 9, 11];
  function scaleNotes(lo, hi, tonic, set) { var o = [], n; for (n = lo; n <= hi; n++) if (set.indexOf(((n - tonic) % 12 + 12) % 12) >= 0) o.push(n); return o; }

  // one voice: oscillators w = [[type, freq ratio, detune cents, gain]] -> optional low-pass (lp = [from, to] Hz over the note) -> envelope
  // (attack a, hold to dur, release r) -> track. vib = [Hz, cents]. echo: also feeds the track's echo.
  function V(tr, t, f, dur, o) {
    var c = A.ctx, g = c.createGain(), end = t + dur + o.r + 0.05, i, os, wg, last = g, lf = null;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v, t + o.a);
    g.gain.setValueAtTime(o.v, Math.max(t + o.a, t + dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + o.r);
    var dst = g;
    if (o.lp) {
      var fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 0.7;
      fl.frequency.setValueAtTime(o.lp[0], t); if (o.lp[1] !== o.lp[0]) fl.frequency.exponentialRampToValueAtTime(o.lp[1], t + dur + o.r * 0.5);
      fl.connect(g); dst = fl;
    }
    if (o.vib) { lf = c.createOscillator(); var lg = c.createGain(); lf.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; lf.connect(lg); lf.start(t); lf.stop(end); lf._g = lg; }
    for (i = 0; i < o.w.length; i++) {
      os = c.createOscillator(); wg = c.createGain();
      os.type = o.w[i][0]; os.frequency.value = f * o.w[i][1]; os.detune.value = o.w[i][2]; wg.gain.value = o.w[i][3];
      if (lf) lf._g.connect(os.detune);
      os.connect(wg); wg.connect(dst); os.start(t); os.stop(end);
    }
    g.connect(tr.out); if (o.echo) g.connect(tr.send);
  }
  function nz(tr, t, dur, v, type, f, q, echo) {
    var c = A.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(tr.out); if (echo) g.connect(tr.send);
    s.start(t, (t * 7.31) % 0.9); s.stop(t + dur + 0.02);
  }
  function tom(tr, t, f, v, len) {      // low tom / frame drum: a pitched sine that falls, plus a muffled skin slap
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(tr.out); o.start(t); o.stop(t + len + 0.02);
    nz(tr, t, 0.09, v * 0.7, 'bandpass', f * 6, 0.8);
  }

  var CITY_BEAT = 0.75, RUN_BEAT = 60 / 72, BOSS_BEAT = RUN_BEAT / 2;
  var HARP = [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 1, 3, 2, 4, 3, 1], [0, 1, 2, 1, 3, 2, 4, 2], [0, 2, 3, 2, 1, 2, 3, 1]];
  var PHRASE = [[1.5, 0.5, 1, 1, 2, 2], [1, 1, 2, 1, 3], [2, 1, 1, 2, 2], [0.5, 0.5, 1, 2, 1, 3], [3, 1, 1, 1, 2]];
  var OSTI = [[1, 0, 1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 1, 0, 0], [1, 0, 1, 0, 1, 0, 0, 1], [1, 0, 0, 0, 1, 0, 1, 0]];
  var MOTIF = [[0, 0, 3], [0, 7, 5], [0, 3, 1], [0, 5, 3]];
  var WOOD = [['triangle', 1, 0, 0.6], ['sine', 1, 0, 0.5], ['sine', 2, 0, 0.1]];

  function schedCity(tr, b) {
    var T = tr.t0 + b * 4 * CITY_BEAT, ch = chordOf(CITY_PROG, b, 4, 1), i, s, p;
    var iv = QUAL[ch[1]];
    // strings: the triad, close voiced, swelling in over the bar
    for (i = 0; i < 3; i++) V(tr, T, midi(ch[0] + 12 + iv[i]), 2.5, { w: [['sawtooth', 1, -9, 0.5], ['sawtooth', 1, 9, 0.5]], a: 0.9, r: 1.4, v: 0.075, lp: [1100, 1100], vib: [4.6, 6], echo: true });
    // lute-like bass: root on beat 1, fifth on beat 3
    V(tr, T, midi(ch[0] + 12), 0.1, { w: [['triangle', 1, 0, 0.8], ['sine', 2, 0, 0.2]], a: 0.008, r: 0.7, v: 0.2, lp: [1400, 500] });
    if (hh(b, 5) < 0.6) V(tr, T + 2 * CITY_BEAT, midi(ch[0] + 12 + iv[2]), 0.1, { w: [['triangle', 1, 0, 0.8]], a: 0.008, r: 0.55, v: 0.13, lp: [1400, 500] });
    // harp: eighth notes over the chord, one of four patterns, some rests
    var pool = notesOf(ch, 57, 84), pat = HARP[Math.floor(hh(b, 2) * 4)];
    for (s = 0; s < 8; s++) {
      if (s > 0 && hh(b, 20 + s) < 0.14) continue;
      var n = pool[Math.min(pat[s], pool.length - 1)];
      V(tr, T + s * CITY_BEAT / 2, midi(n), 0.02, { w: [['triangle', 1, 0, 0.7], ['sine', 2, 0, 0.3], ['sine', 3.01, 0, 0.08]], a: 0.004, r: 1.0 + hh(b, 40 + s) * 0.4, v: (s === 0 ? 0.24 : 0.17) * (0.8 + hh(b, 60 + s) * 0.4), echo: true });
    }
    // woodwind: a phrase over two bars, about two times in three
    if (b % 2 === 0 && hh(b, 7) < 0.7) {
      var rh = PHRASE[Math.floor(hh(b, 8) * PHRASE.length)], sc = scaleNotes(64, 86, 9, A_MINOR), ct = notesOf(ch, 64, 86);
      var nxt = chordOf(CITY_PROG, b + 1, 4, 1), nct = notesOf(nxt, 64, 86);
      var idx = sc.indexOf(ct[Math.floor(hh(b, 9) * ct.length)]), beat = hh(b, 10) < 0.35 ? 1 : 0;
      for (p = 0; p < rh.length; p++) {
        if (p === rh.length - 1) { var tgt = nct[Math.floor(hh(b, 11) * nct.length)]; idx = sc.indexOf(tgt); }
        else if (p > 0) { idx += [-2, -1, -1, 1, 1, 2][Math.floor(hh(b, 12 + p) * 6)]; }
        idx = Math.max(0, Math.min(sc.length - 1, idx));
        var ts = T + beat * CITY_BEAT, len = rh[p] * CITY_BEAT;
        V(tr, ts, midi(sc[idx]), Math.max(0.2, len * 0.85), { w: WOOD, a: 0.07, r: 0.3, v: 0.12, vib: [5.2, 9], echo: true });
        nz(tr, ts, 0.18, 0.012, 'bandpass', midi(sc[idx]) * 2, 2, false);
        beat += rh[p];
        if (beat > 7.5) break;
      }
    }
  }

  function schedRun(tr, b) {
    var T = tr.t0 + b * 4 * RUN_BEAT, ci = Math.floor(b / 2), ch = chordOf(RUN_PROG, ci, 4, 2), iv = QUAL[ch[1]], i, s;
    if (b % 2 === 0) {
      // the drone follows the chord root (a slow glide), and a distant choir holds the chord for two bars
      tr.drone.forEach(function (o, k) { o.frequency.setTargetAtTime(midi(ch[0] - 12 + (k > 1 ? 7 : 0)), T, 0.7); });
      for (i = 0; i < 3; i++) V(tr, T, midi(ch[0] + 12 + iv[i]), 5.4, { w: [['sawtooth', 1, -12, 0.5], ['sawtooth', 1, 11, 0.5], ['sine', 2, 0, 0.3]], a: 2.2, r: 2.6, v: 0.06, lp: [750, 750], q: 1.5, vib: [4.2, 7], echo: true });
    }
    // sparse ostinato in staccato strings: root, minor second, fifth, minor third
    if (hh(b, 11) < 0.78) {
      var pat = OSTI[Math.floor(hh(b, 12) * 4)], step = RUN_BEAT / 2;
      for (s = 0; s < 8; s++) {
        if (!pat[s] || hh(b, 30 + s) < 0.2) continue;
        var deg = [0, 0, 0, 1, 7, 3][Math.floor(hh(b, 50 + s) * 6)];
        V(tr, T + s * step, midi(ch[0] + 12 + deg), 0.05, { w: [['sawtooth', 1, 0, 0.6], ['square', 1, 6, 0.25]], a: 0.005, r: 0.26, v: 0.09, lp: [1500, 380], q: 2, echo: true });
      }
    }
    // soft low percussion: frame drum on 1 and 3, a tap now and then
    tom(tr, T, 82, 0.34, 0.45);
    tom(tr, T + 2 * RUN_BEAT, 78, 0.2, 0.4);
    if (hh(b, 13) < 0.45) tom(tr, T + 3.5 * RUN_BEAT, 100, 0.12, 0.25);
    if (hh(b, 14) < 0.25) tom(tr, T + 1.5 * RUN_BEAT, 100, 0.09, 0.25);
  }

  function schedBoss(tr, bb) {      // bb: boss bar on the run's clock (4 boss beats; a run chord lasts 4 boss bars)
    var T = tr.t0 + bb * 4 * BOSS_BEAT, abs = bb + tr.off, ch = chordOf(RUN_PROG, Math.floor(abs / 4), 4, 2), st = BOSS_BEAT / 2, s, i;
    var kick = [1, 0, 0, hh(abs, 3) < 0.5 ? 1 : 0, 1, 0, 0, 0];
    for (s = 0; s < 8; s++) {
      if (kick[s]) tom(tr, T + s * st, 58, s === 0 ? 0.8 : 0.6, 0.3);
      if (s === 2 || s === 6) { nz(tr, T + s * st, 0.14, 0.2, 'bandpass', 1900, 0.9, true); tom(tr, T + s * st, 150, 0.2, 0.14); }
      nz(tr, T + s * st, 0.04, s % 2 ? 0.06 : 0.04, 'highpass', 7000, 1);
    }
    V(tr, T, midi(ch[0] - 12), 0.1, { w: [['sawtooth', 1, 0, 0.6], ['sine', 1, 0, 0.5]], a: 0.01, r: BOSS_BEAT * 3.4, v: 0.14, lp: [500, 200] });
    // brass stab motif every other bar: three stabs on the chord root, the third / fifth / second degree
    if (abs % 2 === 0 && hh(abs, 4) < 0.85) {
      var m = MOTIF[Math.floor(hh(abs, 6) * MOTIF.length)], at = [0, 3, 4];
      for (i = 0; i < 3; i++) {
        var f = midi(ch[0] + 12 + m[i]), ts = T + at[i] * st;
        V(tr, ts, f, i === 2 ? 0.34 : 0.12, { w: [['sawtooth', 1, -8, 0.4], ['sawtooth', 1, 0, 0.4], ['sawtooth', 1, 8, 0.4], ['square', 0.5, 0, 0.25]], a: 0.025, r: 0.16, v: 0.12, lp: [500, 3000], q: 1.2, echo: true });
        V(tr, ts, f * 1.5, i === 2 ? 0.34 : 0.12, { w: [['sawtooth', 1, 4, 0.5]], a: 0.03, r: 0.16, v: 0.05, lp: [500, 2600], echo: true });
      }
    }
  }

  function makeTrack(kind) {
    var c = A.ctx, tr = { kind: kind, out: c.createGain(), src: [], nodes: [], bar: 0, drone: [], t0: c.currentTime + 0.25 };
    tr.out.gain.value = 0; tr.out.connect(A.musicBus);
    var dl = c.createDelay(1.5), fb = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain();
    dl.delayTime.value = kind === 'city' ? CITY_BEAT / 2 * 1.5 : kind === 'run' ? RUN_BEAT * 0.75 : BOSS_BEAT * 0.75;
    fb.gain.value = kind === 'city' ? 0.4 : 0.45; lp.type = 'lowpass'; lp.frequency.value = 2200; send.gain.value = 0.5;
    send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(tr.out);
    tr.send = send; tr.nodes.push(dl, fb, lp, send);
    if (kind === 'run') {      // cello drone: two detuned saws on the root and one on the fifth, through a slowly moving low-pass
      var f = c.createBiquadFilter(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
      f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 1.2; g.gain.value = 0.13; f.connect(g); g.connect(tr.out);
      l.frequency.value = 0.05; lg.gain.value = 220; l.connect(lg); lg.connect(f.frequency); l.start();
      [[38, -6], [38, 7], [45, 3]].forEach(function (n) {
        var o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = midi(n[0]); o.detune.value = n[1]; og.gain.value = n[0] === 45 ? 0.4 : 0.6;
        o.connect(og); og.connect(f); o.start(); tr.src.push(o); tr.drone.push(o);
      });
      tr.src.push(l); tr.nodes.push(f, g, lg);
    }
    return tr;
  }
  function barLen(tr) { return tr.kind === 'city' ? 4 * CITY_BEAT : tr.kind === 'run' ? 4 * RUN_BEAT : 4 * BOSS_BEAT; }
  function tick() {
    if (!A.ctx || A.ctx.state !== 'running') return;
    var until = A.ctx.currentTime + 1.0;
    Object.keys(tracks).forEach(function (k) {
      var tr = tracks[k], len = barLen(tr);
      while (tr.t0 + tr.bar * len < until) {
        if (tr.kind === 'city') schedCity(tr, tr.bar); else if (tr.kind === 'run') schedRun(tr, tr.bar); else schedBoss(tr, tr.bar);
        tr.bar++;
      }
    });
  }

  function killTrack(tr) {
    tr.src.forEach(function (s) { try { s.stop(); } catch (err) { /* already stopped */ } });
    tr.nodes.concat(tr.out).forEach(function (n) { try { n.disconnect(); } catch (err) { /* ok */ } });
  }
  function fade(tr, to, secs) {
    var t = A.ctx.currentTime, g = tr.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + secs);
  }
  function drop(kind, secs) {
    var tr = tracks[kind];
    if (!tr) return;
    delete tracks[kind];
    fade(tr, 0, secs);
    setTimeout(function () { killTrack(tr); }, secs * 1000 + 200);
  }
  function ensure(kind, level, secs) {
    var tr = tracks[kind];
    if (!tr) {
      tr = tracks[kind] = makeTrack(kind);
      if (kind === 'boss') {      // the boss layer shares the run's clock: it starts on the next boss bar
        var run = tracks.run, len = 4 * BOSS_BEAT, k = run ? Math.ceil((A.ctx.currentTime + 0.25 - run.t0) / len) : 0;
        tr.t0 = (run ? run.t0 : tr.t0) + k * len; tr.off = k; tr.bar = 0;
        tr.off = k;
      }
    }
    if (tr.level !== level) { tr.level = level; fade(tr, level, secs); }
  }
  A.stopMusic = function () { Object.keys(tracks).forEach(function (k) { drop(k, 0.3); }); A.stats.music = 'none'; };

  // mode: 'city' | 'run'; the boss layer is separate (A.setBoss)
  A.setMode = function (mode, force) {
    A.mode = mode;
    if (!A.ctx || A.ctx.state !== 'running' || A.musicVol() <= 0) { if (A.musicVol() <= 0 && A.ctx) A.stopMusic(); return; }
    if (!force && tracks[mode] && tracks[mode].level > 0) return;
    drop(mode === 'city' ? 'run' : 'city', 2.5);
    if (mode === 'city') drop('boss', 1.5);
    ensure(mode, 1, 2.5);
    if (!schedTimer) schedTimer = setInterval(tick, 150);
    A.stats.music = mode;
    A.setBoss(A.boss);
  };
  A.setBoss = function (on) {
    A.boss = on; A.stats.boss = on;
    if (!A.ctx || A.ctx.state !== 'running' || A.musicVol() <= 0) return;
    if (on && A.mode === 'run') { ensure('boss', 1, 1.5); if (tracks.run) { tracks.run.level = 0.8; fade(tracks.run, 0.8, 1.5); } }
    else { drop('boss', 2); if (tracks.run && tracks.run.level !== 1) { tracks.run.level = 1; fade(tracks.run, 1, 2); } }
  };

  // which scene is on screen decides the music; a boss in the room adds the layer
  function poll() {
    if (!A.ctx || !G.game) return;
    A.stats.ctx = A.ctx.state;
    if (A.ctx.state !== 'running') return;
    var sm = G.game.scene, mode = sm.isActive('game') ? 'run' : 'city', boss = false, gs = G.gameScene;
    if (mode === 'run' && gs && gs.sim && gs.sim.state !== 'dead') {
      var ms = gs.sim.monsters, i;
      for (i = 0; i < ms.length; i++) if (ms[i].def.boss && !ms[i].dead) { boss = true; break; }
    }
    if (mode !== A.mode || !tracks[mode]) A.setMode(mode);
    if (boss !== A.boss) A.setBoss(boss);
  }

  // QA: levels of the buses, measured with analysers (created on demand; nothing runs when it is not called).
  // A.meter(ms) -> Promise of { music, sfx, master } in dBFS RMS and { masterPeak } (the largest sample seen, dBFS)
  A.meter = function (ms) {
    var c = A.ctx;
    if (!c) return Promise.resolve(null);
    var nodes = { music: A.musicBus, sfx: A.sfxBus, master: A.master }, an = {}, acc = {}, buf = new Float32Array(32768);
    Object.keys(nodes).forEach(function (k) { var a = c.createAnalyser(); a.fftSize = 32768; nodes[k].connect(a); an[k] = a; acc[k] = { sum: 0, n: 0, peak: 0 }; });
    return new Promise(function (res) {
      var iv = setInterval(function () {
        Object.keys(an).forEach(function (k) {
          an[k].getFloatTimeDomainData(buf);
          for (var i = 0; i < buf.length; i++) { var v = buf[i]; acc[k].sum += v * v; acc[k].n++; if (Math.abs(v) > acc[k].peak) acc[k].peak = Math.abs(v); }
        });
      }, 120);
      setTimeout(function () {
        clearInterval(iv);
        var out = {};
        Object.keys(an).forEach(function (k) {
          out[k] = +(20 * Math.log10(Math.sqrt(acc[k].sum / Math.max(1, acc[k].n)) + 1e-9)).toFixed(1);
          out[k + 'Peak'] = +(20 * Math.log10(acc[k].peak + 1e-9)).toFixed(1);
          try { nodes[k].disconnect(an[k]); } catch (err) { /* ok */ }
        });
        res(out);
      }, ms);
    });
  };

  A.init();
})(globalThis.G = globalThis.G || {});
