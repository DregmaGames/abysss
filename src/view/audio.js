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
  var CAP = 16, CAP_PRI = 22;          // simultaneous voices (priority sounds may go to CAP_PRI)
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
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      A.master = c.createGain(); A.master.gain.value = 0.9;
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
    var gm = m * m * 0.55, gs = s * s * 1.0;
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
    // --- player attacks
    atk_mage:   { cd: 55, fn: function (t, o) { T(o, t, 'sine', 950, 380, 0.13, 0.17); T(o, t, 'triangle', 1500, 700, 0.09, 0.07); N(o, t, 0.06, 0.05, 'highpass', 4500, 4500); } },
    atk_archer: { cd: 55, fn: function (t, o) { N(o, t, 0.1, 0.16, 'bandpass', 2600, 900, 2); T(o, t, 'triangle', 240, 110, 0.1, 0.1); T(o, t + 0.01, 'square', 700, 300, 0.04, 0.035); } },
    atk_sword:  { cd: 70, fn: function (t, o) { N(o, t, 0.15, 0.2, 'bandpass', 1700, 5200, 1.2); T(o, t, 'sawtooth', 320, 150, 0.06, 0.035); } },
    atk_axe:    { cd: 80, fn: function (t, o) { N(o, t, 0.2, 0.26, 'bandpass', 1100, 2600, 1); T(o, t + 0.05, 'sine', 150, 70, 0.12, 0.12); } },
    atk_mace:   { cd: 90, fn: function (t, o) { N(o, t, 0.18, 0.22, 'bandpass', 700, 300, 0.8); T(o, t + 0.07, 'sine', 100, 45, 0.2, 0.26); } },
    atk_hammer: { cd: 100, fn: function (t, o) { N(o, t, 0.26, 0.28, 'bandpass', 450, 200, 0.8); T(o, t + 0.1, 'sine', 75, 34, 0.3, 0.36); N(o, t + 0.1, 0.3, 0.14, 'lowpass', 320, 120); } },
    hit:   { cd: 32, fn: function (t, o) { N(o, t, 0.05, 0.17, 'bandpass', 1500, 900, 1); T(o, t, 'square', 250, 120, 0.06, 0.07); } },
    crit:  { cd: 60, pri: 1, fn: function (t, o) { N(o, t, 0.07, 0.2, 'bandpass', 1900, 1000, 1); T(o, t, 'square', 300, 110, 0.08, 0.09); T(o, t, 'triangle', 1500, 2300, 0.16, 0.1); T(o, t + 0.03, 'sine', 3000, 3600, 0.12, 0.04); } },
    // --- skills
    skill_mage:    { cd: 120, pri: 1, fn: function (t, o) { T(o, t, 'sine', 220, 50, 0.45, 0.32); N(o, t, 0.4, 0.2, 'bandpass', 900, 200, 1); T(o, t, 'triangle', 500, 1300, 0.22, 0.09); } },
    skill_warrior: { cd: 120, pri: 1, fn: function (t, o) { T(o, t, 'sine', 120, 32, 0.55, 0.45); N(o, t, 0.5, 0.3, 'lowpass', 1800, 90, 0.7); T(o, t, 'sawtooth', 90, 40, 0.3, 0.1); } },
    skill_archer:  { cd: 120, pri: 1, fn: function (t, o) { for (var i = 0; i < 5; i++) N(o, t + i * 0.035, 0.1, 0.12, 'bandpass', 3000 - i * 200, 1000, 2); T(o, t, 'triangle', 300, 800, 0.25, 0.08); } },
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
    windup_s: { cd: 130, fn: function (t, o) { T(o, t, 'square', 420, 640, 0.09, 0.04); } },
    shoot:  { cd: 90, fn: function (t, o) { N(o, t, 0.1, 0.1, 'bandpass', 1500, 700, 2); T(o, t, 'triangle', 380, 190, 0.08, 0.05); } },
    shoot_boss: { cd: 150, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 260, 90, 0.3, 0.14); N(o, t, 0.3, 0.2, 'bandpass', 1800, 500, 1.4); T(o, t, 'square', 520, 180, 0.2, 0.06); } },
    summon: { cd: 300, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 70, 140, 0.7, 0.14, 0.2); T(o, t, 'sawtooth', 74, 150, 0.7, 0.1, 0.2); N(o, t, 0.6, 0.12, 'bandpass', 300, 1500, 2, 0.2); } },
    enrage: { cd: 800, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 160, 55, 1.1, 0.3); N(o, t, 1.0, 0.25, 'bandpass', 600, 220, 1.2); T(o, t, 'square', 78, 62, 1.0, 0.1); } },
    // boss wind-ups last as long as the sim's wind-up (dur seconds)
    wind_slam:   { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 1; T(o, t, 'sawtooth', 50, 150, d, 0.2, d * 0.6); N(o, t, d, 0.2, 'lowpass', 150, 1100, 1, d * 0.7); } },
    wind_burst:  { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 0.6; T(o, t, 'square', 300, 1100, d, 0.1, d * 0.7); T(o, t, 'sine', 600, 2200, d, 0.08, d * 0.7); N(o, t, d, 0.08, 'highpass', 2000, 6000, 1, d * 0.8); } },
    wind_charge: { cd: 300, pri: 1, fn: function (t, o, a) { var d = a.dur || 0.8; N(o, t, d, 0.22, 'bandpass', 200, 1500, 2, d * 0.8); T(o, t, 'sawtooth', 70, 210, d, 0.16, d * 0.7); T(o, t, 'square', 35, 35, d, 0.05, d * 0.5); } },
    slam:   { cd: 150, pri: 1, fn: function (t, o) { T(o, t, 'sine', 105, 28, 0.7, 0.55); N(o, t, 0.55, 0.42, 'lowpass', 1700, 70); T(o, t, 'sawtooth', 120, 40, 0.3, 0.12); } },
    rune:   { cd: 250, fn: function (t, o) { T(o, t, 'sine', 330, 760, 0.55, 0.08, 0.25); T(o, t, 'triangle', 335, 770, 0.55, 0.05, 0.25); } },
    erupt:  { cd: 180, pri: 1, fn: function (t, o) { T(o, t, 'sawtooth', 220, 50, 0.32, 0.16); N(o, t, 0.3, 0.2, 'bandpass', 1400, 300, 1); T(o, t, 'sine', 80, 40, 0.3, 0.2); } },
    fizzle: { cd: 150, fn: function (t, o) { N(o, t, 0.2, 0.1, 'bandpass', 2200, 400, 1.5); } },
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
      var r = (a && a.rarity) | 0, base = [9, 12, 16, 19, 24][Math.min(4, r)];
      for (var i = 0; i <= Math.min(r, 3); i++) T(o, t + i * 0.055, r > 1 ? 'triangle' : 'sine', hz(base + [0, 4, 7, 12][i]), hz(base + [0, 4, 7, 12][i]), 0.25 + r * 0.06, 0.1 + r * 0.01, 0.004);
      if (r >= 2) N(o, t + 0.05, 0.4 + r * 0.1, 0.03 + r * 0.01, 'highpass', 5000 + r * 800, 5000 + r * 800, 1, 0.05);
      if (r >= 4) { T(o, t + 0.25, 'sine', hz(31), hz(31), 0.8, 0.07); T(o, t + 0.3, 'sine', hz(36), hz(36), 0.9, 0.05); }
    } },
    gold:   { cd: 75, fn: function (t, o) { T(o, t, 'square', 1568, 1568, 0.05, 0.045); T(o, t + 0.05, 'square', 2093, 2093, 0.14, 0.05); T(o, t + 0.05, 'sine', 4186, 4186, 0.1, 0.025); } },
    scroll: { cd: 150, fn: function (t, o) { N(o, t, 0.16, 0.1, 'bandpass', 3200, 5200, 1.5); T(o, t + 0.05, 'sine', 880, 1320, 0.22, 0.07); } },
    tome:   { cd: 150, fn: function (t, o) { T(o, t, 'sine', 400, 1200, 0.3, 0.09); T(o, t + 0.05, 'triangle', 600, 1800, 0.3, 0.05); N(o, t, 0.3, 0.04, 'highpass', 5000, 5000, 1, 0.1); } },
    item:   { cd: 90, fn: function (t, o) { N(o, t, 0.05, 0.1, 'highpass', 3500, 3500); T(o, t, 'square', 1800, 1200, 0.06, 0.04); T(o, t + 0.04, 'triangle', 1500, 1500, 0.12, 0.05); } },
    orb:    { cd: 70, fn: function (t, o) { T(o, t, 'sine', 900, 1500, 0.06, 0.04); } },
    orb_heal: { cd: 100, fn: function (t, o) { T(o, t, 'sine', 500, 900, 0.16, 0.06); } },
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
    echo:   { cd: 100, fn: function (t, o) { T(o, t, 'sine', 1100, 1100, 0.18, 0.04); T(o, t + 0.1, 'sine', 1100, 1100, 0.18, 0.025); } },
    room:   { cd: 300, fn: function (t, o) { N(o, t, 0.5, 0.08, 'bandpass', 300, 900, 1, 0.2); } },
    // --- UI
    click:  { cd: 30, ui: 1, fn: function (t, o) { T(o, t, 'square', 700, 460, 0.045, 0.06); T(o, t, 'sine', 1400, 900, 0.04, 0.03); } },
    hover:  { cd: 40, ui: 1, fn: function (t, o) { T(o, t, 'sine', 920, 920, 0.03, 0.022); } },
    back:   { cd: 30, ui: 1, fn: function (t, o) { T(o, t, 'square', 460, 320, 0.055, 0.055); T(o, t, 'sine', 920, 560, 0.04, 0.025); } }
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
  // Two ambient tracks (city: warm A dorian pad and soft plucks; run: dark D drone, wind and low bells) and a boss layer
  // (a slow heartbeat drum, a tritone drone, ticks). Each track is a few oscillators plus a scheduler tick every 150 ms,
  // so the cost is small. A change of mode cross-fades over 2.5 s; the boss layer fades in over 1.5 s on top of the run track.
  var tracks = {}, schedTimer = null;

  function osc(c, type, f, v, dest, detune) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; g.gain.value = v;
    o.connect(g); g.connect(dest); o.start();
    return o;
  }
  function lfo(c, f, depth, param) { var o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; }

  function makeTrack(kind) {
    var c = A.ctx, out = c.createGain(), tr = { kind: kind, out: out, src: [], nodes: [], next: 0, next2: 0, beat: 0 };
    out.gain.value = 0; out.connect(A.musicBus);
    // a cheap echo: delay with a darkened feedback
    var dl = c.createDelay(1.5), fb = c.createGain(), lp = c.createBiquadFilter(), send = c.createGain();
    dl.delayTime.value = kind === 'boss' ? 0.3 : 0.52; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 1500; send.gain.value = 0.55;
    send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out);
    tr.send = send; tr.nodes.push(dl, fb, lp, send);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7; tr.pad = c.createGain(); tr.pad.connect(f); f.connect(out); tr.nodes.push(f, tr.pad);
    if (kind === 'city') {
      f.frequency.value = 700;
      tr.src.push(lfo(c, 0.06, 260, f.frequency));
      [[110, 0.07], [164.81, 0.05], [196, 0.035], [261.63, 0.03]].forEach(function (n) {
        tr.src.push(osc(c, 'triangle', n[0], n[1], tr.pad, -7), osc(c, 'triangle', n[0], n[1], tr.pad, 7));
      });
      tr.src.push(osc(c, 'sine', 55, 0.09, out));
    } else if (kind === 'run') {
      f.frequency.value = 240;
      tr.src.push(lfo(c, 0.045, 110, f.frequency));
      tr.src.push(osc(c, 'sawtooth', 73.42, 0.06, tr.pad, -5), osc(c, 'sawtooth', 73.42, 0.05, tr.pad, 6));
      tr.src.push(osc(c, 'triangle', 155.56, 0.012, tr.pad, 0), osc(c, 'sine', 36.71, 0.12, out));
      tr.src.push(lfo(c, 0.031, 0.04, tr.pad.gain));
      // wind: looped noise through a slow band-pass
      var ws = c.createBufferSource(), wf = c.createBiquadFilter(), wg = c.createGain();
      ws.buffer = A.noiseBuf; ws.loop = true; wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 4; wg.gain.value = 0.035;
      ws.connect(wf); wf.connect(wg); wg.connect(out); ws.start();
      tr.src.push(ws, lfo(c, 0.07, 250, wf.frequency), lfo(c, 0.05, 0.02, wg.gain));
      tr.nodes.push(wf, wg);
    } else {                          // boss layer: a tritone drone, the drum is scheduled
      f.frequency.value = 520;
      tr.src.push(lfo(c, 0.11, 200, f.frequency));
      tr.src.push(osc(c, 'sawtooth', 146.83, 0.05, tr.pad, 0), osc(c, 'sawtooth', 207.65, 0.04, tr.pad, 4), osc(c, 'sine', 36.71, 0.1, out));
    }
    tr.next = tr.next2 = c.currentTime + 0.3;
    return tr;
  }

  var CITY_SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76];            // A minor pentatonic + D (MIDI)
  var RUN_BELLS = [50, 53, 56, 57, 62];                                // D, F, Ab, A, D: a diminished edge
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function note(tr, t, f, v, dur, type, send) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(tr.out); if (send) g.connect(tr.send);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(tr, t, f, v, dur) {      // inharmonic partials: a cold bell
    [1, 2.76, 5.4].forEach(function (r, i) { note(tr, t, f * r, v / (1 + i * 1.6), dur / (1 + i * 0.7), 'sine', true); });
  }
  function schedule(tr, until) {
    var c = A.ctx;
    if (tr.kind === 'city') {
      while (tr.next < until) {          // a pluck every 2-5 s
        var n = CITY_SCALE[(rnd() * CITY_SCALE.length) | 0];
        note(tr, tr.next, midi(n), 0.05, 1.8, 'triangle', true);
        if (rnd() < 0.35) note(tr, tr.next + 0.34, midi(n + (rnd() < 0.5 ? 7 : 3) - 12 + 12), 0.03, 1.4, 'sine', true);
        tr.next += 2 + rnd() * 3;
      }
      while (tr.next2 < until) {         // a long pad note every 9-14 s
        var pn = [45, 48, 50, 52, 55][(rnd() * 5) | 0], d = 7 + rnd() * 3;
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = midi(pn + 12);
        g.gain.setValueAtTime(0.0001, tr.next2); g.gain.linearRampToValueAtTime(0.045, tr.next2 + 3); g.gain.linearRampToValueAtTime(0.0001, tr.next2 + d);
        o.connect(g); g.connect(tr.pad); o.start(tr.next2); o.stop(tr.next2 + d + 0.1);
        tr.next2 += 9 + rnd() * 5;
      }
    } else if (tr.kind === 'run') {
      while (tr.next < until) {          // a low bell every 5-10 s, sometimes a far drip
        bell(tr, tr.next, midi(RUN_BELLS[(rnd() * RUN_BELLS.length) | 0] + (rnd() < 0.5 ? 12 : 0)), 0.055, 4.5);
        tr.next += 5 + rnd() * 5;
      }
      while (tr.next2 < until) {
        note(tr, tr.next2, midi(86 + ((rnd() * 4) | 0) * 2), 0.018, 0.5, 'sine', true);
        tr.next2 += 6 + rnd() * 9;
      }
    } else {                             // boss: a heartbeat of 0.6 s: thud, softer thud, rest, rest; ticks on the off beat
      while (tr.next < until) {
        var b = tr.beat++ % 4, t0 = tr.next;
        if (b === 0 || b === 1) {
          var o2 = c.createOscillator(), g2 = c.createGain();
          o2.type = 'sine'; o2.frequency.setValueAtTime(b ? 70 : 85, t0); o2.frequency.exponentialRampToValueAtTime(34, t0 + 0.22);
          g2.gain.setValueAtTime(0.0001, t0); g2.gain.linearRampToValueAtTime(b ? 0.22 : 0.34, t0 + 0.008); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
          o2.connect(g2); g2.connect(tr.out); o2.start(t0); o2.stop(t0 + 0.33);
        }
        if (b === 2 || b === 3) {
          var s = c.createBufferSource(), sf = c.createBiquadFilter(), sg = c.createGain();
          s.buffer = A.noiseBuf; sf.type = 'highpass'; sf.frequency.value = 6000;
          sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(0.05, t0 + 0.004); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
          s.connect(sf); sf.connect(sg); sg.connect(tr.out); s.start(t0, rnd()); s.stop(t0 + 0.07);
        }
        if (b === 3 && rnd() < 0.5) note(tr, t0, midi(62 + ((rnd() * 3) | 0) * 3), 0.03, 0.9, 'triangle', true);
        tr.next += 0.3;
      }
    }
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
    if (!tr) { tr = tracks[kind] = makeTrack(kind); }
    if (tr.level !== level) { tr.level = level; fade(tr, level, secs); }
  }
  A.stopMusic = function () { Object.keys(tracks).forEach(function (k) { drop(k, 0.3); }); A.stats.music = 'none'; };

  // mode: 'city' | 'run'; the boss layer is separate (A.setBoss)
  A.setMode = function (mode, force) {
    A.mode = mode;
    if (!A.ctx || A.ctx.state !== 'running' || A.musicVol() <= 0) { if (A.musicVol() <= 0 && A.ctx) A.stopMusic(); return; }
    if (!force && tracks[mode] && tracks[mode].level > 0) return;
    var other = mode === 'city' ? 'run' : 'city';
    drop(other, 2.5);
    ensure(mode, mode === 'run' && A.boss ? 0.7 : 1, 2.5);
    if (!schedTimer) schedTimer = setInterval(tick, 150);
    A.stats.music = mode;
    A.setBoss(A.boss);
  };
  A.setBoss = function (on) {
    A.boss = on; A.stats.boss = on;
    if (!A.ctx || A.ctx.state !== 'running' || A.musicVol() <= 0) return;
    if (on && A.mode === 'run') { ensure('boss', 1, 1.5); if (tracks.run) { tracks.run.level = 0.7; fade(tracks.run, 0.7, 1.5); } }
    else { drop('boss', 2); if (tracks.run && tracks.run.level !== 1) { tracks.run.level = 1; fade(tracks.run, 1, 2); } }
  };
  function tick() {
    if (!A.ctx || A.ctx.state !== 'running') return;
    var until = A.ctx.currentTime + 0.6;
    Object.keys(tracks).forEach(function (k) { schedule(tracks[k], until); });
  }

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

  A.init();
})(globalThis.G = globalThis.G || {});
