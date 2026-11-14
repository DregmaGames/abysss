// HD art pilot, view only. Sprites from the HD atlas (twice the art density) are drawn at half scale, so they keep the
// size and anchor (feet, centre) of the chunky sprites while one HD pixel is one screen pixel at 960x540 (S = 2).
// Everything else keeps the chunky atlas. Switch: ?hd=0|1 (this session) > Settings "HD art (test)" (saved) > on.
//
// G.Rig gives a sprite code-made motion so one pose still feels alive: facing by flip, a walk (bob, sway, squash on each
// step, dust), breathing, wind-up anticipation and a release lunge synced to sim events, hit recoil, a death that reads,
// and a soft contact shadow. Every offset and scale is rounded to whole HD pixels (origin shifts, not positions: Phaser
// floors positions to art pixels), so nothing blurs or shimmers; the frames come from G.ANIM (src/view/anim.js).
(function (G) {
  var UI = G.UI, D = 2;     // HD density: HD pixels per art pixel

  var HD = G.HD = {
    density: D,
    // the session's mode: ?hd=0|1|2 wins, then the saved setting (false / true / 'lo'), then HD
    // (the user's choice after playing the pilot, step big rooms).
    // G.hdMode: new art on / off. G.hdStyle: 'hd' = double density; 'lo' = the "27 px" test (tools/lo_sprite.py): the
    // same sheets reduced to the game's art pixel grid, frames lo_<name> (an entity without them keeps its HD frames),
    // the chunky floor, and motion in whole art pixels with no tilt.
    init: function () {
      var p = G.params.get('hd'), sv = G.save && G.save.settings ? G.save.settings.hd : undefined;
      var m = p === '0' ? false : p === '1' ? true : p === '2' ? 'lo' : sv === false ? false : sv === 'lo' ? 'lo' : true;
      G.hdMode = m !== false; G.hdStyle = m === 'lo' ? 'lo' : 'hd';
    },
    mode: function () { return !G.hdMode ? false : G.hdStyle === 'lo' ? 'lo' : true; },
    next: function () { var m = HD.mode(); return m === false ? 'lo' : m === 'lo' ? true : false; },     // off -> 27 px -> HD -> off
    // the frame to show for an HD frame name: its lo_ version in the '27 px' mode, when the atlas has one
    pick: function (t, name) { return G.hdStyle === 'lo' && t.has('lo_' + name) ? 'lo_' + name : name; },
    set: function (m) {
      G.hdMode = m !== false && !!m; G.hdStyle = m === 'lo' ? 'lo' : 'hd';
      if (G.save) { G.save.settings.hd = HD.mode(); G.storeSave(G.save); }
      if (G.gameScene && G.gameScene.sys.isActive()) G.gameScene.rebuildArt();
      if (G.city && G.city.sys.isActive()) G.city.scene.restart();
    },
    FXPAD: 8,      // px a glow mask is bigger than its frame, per side (tools/weapon_fx.py PAD)
    // the glow of a weapon item: G.cheats.glow (a key of G.ANIM.glow, or 'none') previews one; else by the item's rarity
    glowOf: function (item) {
      var c = (G.cheats && G.cheats.glow) || G.params.get('glow');
      if (c) return c === 'none' ? null : c;
      return item ? G.ANIM.glowByRarity[item.rarity] || null : null;
    },
    // Visible equipment. The hero's body sheet by the body armour worn: none -> `<id>_bare`, else `<id>_<look>` by the
    // item's material (G.ANIM.armorLook), when the class has those sheets; else the class's own sheet (armour drawn in).
    // ?look=bare|leather|chain|plate|full forces one.
    heroEnt: function (id, eq) {
      var bare = id + '_bare', look = G.params.get('look'), A = eq && eq.armor;
      if (!G.ANIM.ent[bare]) return id;
      if (look === 'full') return id;
      if (look && G.ANIM.ent[id + '_' + look]) return id + '_' + look;
      if (!A) return bare;
      var ent = id + '_' + G.ANIM.armorLook[A.mat != null ? A.mat : 2];
      return G.ANIM.ent[ent] ? ent : bare;      // no sheet for that armour yet: the new base, not the old full sheet (?look=full shows that)
    },
    // the trim colour of the body armour worn (?arar=<rarity> previews one)
    trimColor: function (eq) {
      var p = G.params.get('arar'), A = eq && eq.armor, r = p != null ? +p : A ? A.rarity : null;
      return r == null ? null : G.ANIM.trimByRarity[Math.max(0, Math.min(G.ANIM.trimByRarity.length - 1, r | 0))];
    },
    // the weapon to draw in the hand of a sheet that marks its fist (ANIM `hands`): by the equipped weapon (?wpn=1 / ?wpn=0 forces)
    heroWeapon: function (ent, cls, eq) {
      var E = G.ANIM.ent[ent], p = G.params.get('wpn'), item = eq && eq.weapon;
      if (!E || !E.hands || p === '0' || (!item && p !== '1')) return null;
      var wt = cls && cls.weapons ? G.weaponOf(cls, { equipped: eq || {} }).id : ({ mage: 'staff', archer: 'bow' }[cls && cls.id] || 'weapon');
      var fr = G.ANIM.wpnArt[wt] || G.ANIM.wpnArt.any;
      return fr ? { frame: fr, glow: HD.glowOf(item) } : null;
    },
    // the tint of a glow at time t: one colour, or a slow walk round `cycle`
    glowColor: function (g, t) {
      if (!g.cycle) return g.color;
      var n = g.cycle.length, u = (t / (g.cycleT || 3)) % 1 * n, i = Math.floor(u), f = u - i, a = g.cycle[i], b = g.cycle[(i + 1) % n];
      function ch(sh) { return Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f); }
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    },
    meta: function (name) { var J = G_ASSETS.hd_atlasJson; return J && J.frames[name]; },
    // the HD frame for an HD name or a chunky frame name (G.ANIM.map), or null (HD off, or no such frame)
    frame: function (scene, name) {
      if (!G.hdMode || !name || !scene.textures.exists('hd')) return null;
      var t = scene.textures.get('hd');
      if (t.has(name)) return HD.pick(t, name);
      var m = G.ANIM.map[name];
      return m && t.has(m) ? HD.pick(t, m) : null;
    },
    // a static image (cage, prop): the HD frame at half scale if there is one, else the chunky frame. Origin as given.
    show: function (img, name, ox, oy) {
      var hf = HD.frame(img.scene, name);
      if (hf) {
        if (img.texture.key !== 'hd') img.setTexture('hd', hf); else img.setFrame(hf, false, false);
        img.setScale(1 / D).setOrigin(ox, oy);
      } else {
        HD.chunky(img, name);
        img.setOrigin(ox, oy);
      }
      fitHit(img);
      img.isHD = !!hf;
      return img;
    },
    // back to the chunky atlas (HD switched off, or a frame without HD art)
    chunky: function (img, name) {
      if (img.texture.key !== 'atlas') img.setTexture('atlas', name);
      else if (name) img.setFrame(name, true, false);
      if (img.scaleX !== 1 || img.scaleY !== 1) img.setScale(1);
      if (img.rotation) img.setRotation(0);
      img.isHD = false;
      fitHit(img);
    },
    // frames of a state of an entity, following the fallbacks, that the HD atlas has; null when none
    frames: function (scene, ent, state) {
      var A = G.ANIM, E = A.ent[ent], seen = 0;
      if (!E || !G.hdMode || !scene.textures.exists('hd')) return null;
      var t = scene.textures.get('hd');
      while (state && seen++ < 5) {
        var st = E[state];
        if (st && st.frames) {
          var fr = st.frames.filter(function (f) { return t.has(f); }).map(function (f) { return HD.pick(t, f); });
          if (fr.length) return { state: state, list: fr, def: st };
        }
        state = (E.fallback && E.fallback[state]) || A.fallback[state];
      }
      return null;
    },
    // the soft contact shadow texture (a radial falloff at screen resolution), made once per game
    shadowTex: function (scene) {
      if (scene.textures.exists('hd_shadow')) return;
      var w = 64, h = 24, c = scene.textures.createCanvas('hd_shadow', w, h), ctx = c.getContext(), im = ctx.createImageData(w, h);
      var col = G_ASSETS.palette.void, r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), d = Math.sqrt(dx * dx + dy * dy), i = (y * w + x) * 4;
        var a = d >= 1 ? 0 : Math.pow(1 - d, 0.55) * 0.8 + (d < 0.6 ? 0.12 : 0);
        im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = Math.round(Math.min(1, a) * 255);
      }
      ctx.putImageData(im, 0, 0); c.refresh();
    }
  };

  function q(v, step) { return Math.round(v / step) * step; }
  // a tappable sprite whose frame changed size (chunky <-> HD): its hit box follows the frame
  function fitHit(img) { var h = img.input && img.input.hitArea; if (h && (h.width !== img.frame.width || h.height !== img.frame.height)) h.setSize(img.frame.width, img.frame.height); }
  HD.fitHit = fitHit;
  // a chunky (atlas) sprite at a size multiplier k (BAL.tune hero / monsters): its height snapped to whole art pixels, the width in step
  HD.tuneChunky = function (img, k) {
    var sc = k === 1 ? 1 : Math.max(1, Math.round(img.frame.height * k)) / img.frame.height;
    if (img.scaleX !== sc || img.scaleY !== sc) img.setScale(sc);
  };
  function sign(v) { return v < 0 ? -1 : 1; }

  // ------------------------------------------------------------------ rig
  // One per animated sprite. update(dt, o) each frame with o = { x, y (feet, world), ground (shadow y), face (sim facing),
  // tx (target x or null), state (idle / walk / attack / slam / charge / burst), speed (base speed, px/s), alpha, depth }.
  // Returns false when the entity has no HD frame: the caller then draws it the chunky way (and the rig hides its shadow).
  G.Rig = function (scene, img, ent) {
    this.scene = scene; this.img = img; this.ent = ent;
    this.lx = null; this.ly = 0; this.spd = 0; this.ph = 0; this.wa = 0; this.t = (img.x * 0.37 + img.y * 0.11) % 3; this.face = 1; this.flipT = 0;
    this.wind = 0; this.windDur = 0; this.rel = 0; this.relDur = 0; this.hit = 0; this.hitDir = 0; this.stepN = 0; this.hdOn = false; this.st = 'idle';
    HD.shadowTex(scene);
    this.shadow = scene.add.image(0, 0, 'hd_shadow').setDepth(-99).setVisible(false);
    this.artH = img.height;
  };
  var R = G.Rig.prototype;
  R.motion = function () { var E = G.ANIM.ent[this.ent]; return (E && E.motion) || {}; };
  R.windup = function (dur) { this.wind = this.windDur = Math.max(0.05, dur); };
  R.release = function (dur) { this.wind = 0; this.rel = this.relDur = dur || 0.25; };
  R.attack = function (dur) {      // an attack with no wind-up (the hero's); the sheet's attack `dur` wins, so its poses can be seen
    var E = G.ANIM.ent[this.ent], a = E && E.attack;
    this.rel = this.relDur = (a && a.dur) || dur || 0.25; this.atkFrames = true;
  };    // an attack with no wind-up (the hero's)
  R.hurt = function (fromX) { this.hit = 0.2; this.hitDir = sign(this.img.x - fromX); };
  R.destroy = function () { this.shadow.destroy(); if (this.glowImg) this.glowImg.destroy(); if (this.wpnImg) { this.wpnImg.destroy(); this.wpnGlow.destroy(); } if (this.trimImg) this.trimImg.destroy(); };

  R.update = function (dt, o) {
    var img = this.img, scene = this.scene, M = this.motion();
    if (!HD.frames(scene, this.ent, 'idle') && !HD.frames(scene, this.ent, o.state)) { this.hdOn = false; this.shadow.setVisible(false); if (this.glowImg) this.glowImg.setVisible(false); if (this.wpnImg) { this.wpnImg.setVisible(false); this.wpnGlow.setVisible(false); } if (this.trimImg) this.trimImg.setVisible(false); this.lx = null; return false; }
    this.hdOn = true;
    // movement since the last frame (sim feet position); a jump (new room, dodge) does not count as walking
    if (this.lx === null) { this.lx = o.x; this.ly = o.y; }
    var dx = o.x - this.lx, dy = o.y - this.ly, d = Math.sqrt(dx * dx + dy * dy);
    this.lx = o.x; this.ly = o.y;
    if (d > 12) d = 0;
    if (dt > 0) this.spd += ((d / dt) - this.spd) * Math.min(1, dt * 14);
    var attacking = o.state !== 'idle' && o.state !== 'walk', moving = this.spd > 4 && !attacking;
    var ref = o.speed || 30, wdef = (G.ANIM.ent[this.ent].walk) || {}, fps = wdef.fps || 9, stride = 2 * ref / fps;   // fps frames at base speed
    if (moving) this.ph += d / stride;
    else if (this.ph % 1 > 0.001) this.ph = Math.min(Math.ceil(this.ph), this.ph + dt * 4);      // finish the step: feet down
    this.wa += ((moving ? 1 : 0) - this.wa) * Math.min(1, dt * 10);
    this.t += dt;
    // facing: the target while winding up / attacking, else the way it walks, else the sim's facing; a short hysteresis
    var want = o.tx != null && (attacking || this.wind > 0 || this.rel > 0) ? sign(o.tx - o.x) : Math.abs(dx) > 0.04 ? sign(dx) : (o.face || this.face);
    if (want !== this.face) { this.flipT += dt; if (this.flipT > 0.09 || this.wind > 0) { this.face = want; this.flipT = 0; } } else this.flipT = 0;
    var td = o.tx != null ? sign(o.tx - o.x) : this.face;
    // the frame: 'walk' is locomotion, shown as idle while standing
    // an attack started by attack() (the hero's swing / cast) shows the attack frames over walk or idle while it lasts
    if (this.atkFrames && this.rel <= 0) this.atkFrames = false;
    var fstate = this.atkFrames ? 'attack' : o.state === 'walk' && !moving ? 'idle' : o.state;
    var fs = HD.frames(scene, this.ent, fstate) || HD.frames(scene, this.ent, 'idle');
    var list = fs.list, n = list.length, st = fs.def, fname;
    if (fs.state === 'walk') fname = list[Math.floor(((this.ph / 2) % 1) * (st.cycle || n)) % n];
    else if (attacking || this.atkFrames) {
      var k = this.wind > 0 ? 1 - this.wind / this.windDur : 1;
      fname = this.rel > 0 || k >= 1 ? list[n - 1] : list[Math.min(n - 2, Math.floor(k * (n - 1)))] || list[0];
      if (this.atkFrames && this.rel > 0 && n > 1) {
        var pr = 1 - this.rel / this.relDur;
        fname = st.split ? (pr < st.split ? list[0] : list[n - 1]) : list[Math.min(n - 1, Math.floor(pr * n))];      // split: share of the attack held on the wind-up pose
      }
      if (this.rel <= 0) this.atkFrames = false;
    } else fname = list[Math.floor(this.t * (st.fps || 1)) % n];
    if (this.hit > 0) { var hf = HD.frames(scene, this.ent, 'hurt'); if (hf && hf.state === 'hurt') fname = hf.list[0]; }
    if (img.texture.key !== 'hd') img.setTexture('hd', fname); else if (img.frame.name !== fname) img.setFrame(fname, false, false);
    var W = img.frame.width, H = img.frame.height, meta = HD.meta(fname) || {};
    // the motion, in HD pixels and shares of the size
    var ox = 0, oy = 0, sx = 1, sy = 1, rot = 0, faces = M.faces || 1;
    var f = this.ph % 1, s = Math.sin(Math.PI * f), wa = this.wa;
    if (wa > 0.02 && !attacking) {
      oy -= s * (M.bob || 0) * wa;
      var c = Math.max(0, 1 - f / 0.22) * (this.ph > 0.5 ? 1 : 0);          // just after a foot lands
      sy += (-(M.squash || 0) * c + (M.squash || 0) * 0.45 * s) * wa;
      sx += ((M.squash || 0) * 0.7 * c - (M.squash || 0) * 0.25 * s) * wa;
      rot += (M.tilt || 0) * wa * (Math.floor(this.ph) % 2 ? 1 : -1) * Math.min(1, s * 2) + (M.tilt || 0) * 0.5 * wa * this.face;
      var step = Math.floor(this.ph);
      if (step !== this.stepN) {
        this.stepN = step;
        if (M.dust && scene.fx && !scene.fx.quiet) scene.fx.burst(o.x - this.face * 2, o.ground + 1, 'ui_dim', M.dust, 18, 0.28);
      }
    } else this.stepN = Math.floor(this.ph);
    var b = Math.sin(this.t * 6.2832 / (M.breathT || 1.6)) * (1 - wa);
    sy += (M.breathe || 0) * b; sx -= (M.breathe || 0) * 0.4 * b;
    if (this.wind > 0) {            // anticipation: lean back from the target, crouch, tip away
      var kw = 1 - this.wind / this.windDur, e = kw * kw * (3 - 2 * kw);
      ox -= td * (M.lean || 0) * e; sy -= 0.08 * e; sx += 0.05 * e; rot -= td * (M.tilt || 0.03) * 1.2 * e;
      this.wind -= dt;
      if (this.wind <= 0) this.release((st && st.hold) || 0.25);
    }
    if (this.rel > 0) {             // release: a short lunge and stretch toward the target
      var kr = this.rel / this.relDur, e2 = kr > 0.75 ? 1 : kr / 0.75;
      ox += td * (M.lunge || 0) * e2; sx += (M.stretch || 0) * e2; sy -= (M.stretch || 0) * 0.5 * e2; rot += td * (M.tilt || 0.03) * 0.8 * e2;
      this.rel -= dt;
    }
    if (this.hit > 0) {             // recoil away from the hit, a brief squash
      var kh = this.hit / 0.2;
      ox += this.hitDir * (M.recoil || 0) * kh; sy -= 0.09 * kh; sx += 0.07 * kh;
      this.hit -= dt;
    }
    // whole HD pixels: size, offsets; three tilt steps at most. A lo_ frame (2x2 HD px per art px): whole art pixels, no tilt.
    // o.k (BAL.tune hero / monsters, visual only): x the drawn size round the feet, still snapped to whole HD pixels
    var P = fname.indexOf('lo_') === 0 ? D : 1, k = o.k || 1;
    var ws = Math.max(P, Math.round(W * sx * k / P) * P), hs = Math.max(P, Math.round(H * sy * k / P) * P), sxq = ws / W, syq = hs / H;
    var oxq = Math.round(ox * k / P) * P, oyq = Math.round(oy * k / P) * P, rq = P > 1 ? 0 : q(rot, 0.035);
    var flip = (this.face * faces) < 0, ax = meta.anchor ? meta.anchor.x : 0.5;
    img.setFlipX(flip).setScale(sxq / D, syq / D).setRotation(rq)
      .setOrigin((flip ? 1 - ax : ax) - oxq / ws, 1 - oyq / hs)
      .setPosition(o.x, o.y);
    if (o.depth != null) img.setDepth(o.depth);
    img.isHD = true;
    fitHit(img);
    this.artH = hs / D;
    // the weapon's rarity glow (o.glow = a key of G.ANIM.glow): the frame's mask fx_<frame> (tools/weapon_fx.py, FXPAD px
    // bigger on every side) drawn over the sprite with the same transform, tinted, additive, pulsing
    // the armour's trim in its rarity colour: trim_<frame> (same size as the frame) over the sprite, same transform
    var tname = 'trim_' + fname, tri = this.trimImg;
    if (o.trim != null && img.visible && scene.textures.get('hd').has(tname)) {
      if (!tri) tri = this.trimImg = scene.add.image(0, 0, 'hd', tname);
      if (tri.frame.name !== tname) tri.setFrame(tname, false, false);
      tri.setVisible(true).setFlipX(flip).setScale(img.scaleX, img.scaleY).setRotation(rq).setOrigin(img.originX, img.originY)
        .setPosition(o.x, o.y).setDepth((o.depth != null ? o.depth : img.depth) + 0.005).setTint(o.trim).setAlpha(o.alpha == null ? 1 : o.alpha);
    } else if (tri) tri.setVisible(false);
    var gdef = o.glow && G.ANIM.glow[o.glow], gname = 'fx_' + fname, gi = this.glowImg;
    if (gdef && img.visible && scene.textures.get('hd').has(gname)) {
      if (!gi) gi = this.glowImg = scene.add.image(0, 0, 'hd', gname).setBlendMode(Phaser.BlendModes.ADD);
      if (gi.frame.name !== gname) gi.setFrame(gname, false, false);
      var pd = HD.FXPAD, pulse = 0.5 + 0.5 * Math.sin(this.t * 6.2832 / (gdef.period || 1.4));
      gi.setVisible(true).setFlipX(flip).setScale(img.scaleX, img.scaleY).setRotation(rq)
        .setOrigin((img.originX * W + pd) / (W + 2 * pd), (img.originY * H + pd) / (H + 2 * pd)).setPosition(o.x, o.y)
        .setDepth((o.depth != null ? o.depth : img.depth) + 0.01).setTint(HD.glowColor(gdef, this.t))
        .setAlpha((o.alpha == null ? 1 : o.alpha) * (gdef.min + (gdef.max - gdef.min) * pulse));
      if (gdef.sparks && scene.fx && !scene.fx.quiet && dt > 0 && Math.floor(this.t * gdef.sparks) !== Math.floor((this.t - dt) * gdef.sparks))
          if (meta.head) scene.fx.burst(o.x + ((flip ? W - meta.head[0] : meta.head[0]) - img.originX * W) * img.scaleX + Math.sin(this.t * 37) * 1.5,
          o.y + (meta.head[1] - img.originY * H) * img.scaleY, gdef.spark || 'gold', 1, 14, 0.45);      // from the weapon's head
    } else if (gi) gi.setVisible(false);
    // a held weapon (o.weapon = { frame, glow }): the frame says where its fist is and which way the weapon points
    // (meta.hand = x, y, degrees, length; tools/hand_weapon.py); the weapon sprite stands upright with its guard at the
    // bottom centre, so it is put on the fist and turned. Its rarity glow is a second, additive copy of it.
    var wp = o.weapon, wi = this.wpnImg, wg = this.wpnGlow;
    if (wp && meta.hand && img.visible && scene.textures.get('hd').has(wp.frame)) {
      if (!wi) { wi = this.wpnImg = scene.add.image(0, 0, 'hd', wp.frame); wg = this.wpnGlow = scene.add.image(0, 0, 'hd', wp.frame).setBlendMode(Phaser.BlendModes.ADD); }
      if (wi.frame.name !== wp.frame) { wi.setFrame(wp.frame, false, false); wg.setFrame(wp.frame, false, false); }
      var hx = o.x + ((flip ? W - meta.hand[0] - 0.5 : meta.hand[0] + 0.5) - img.originX * W) * img.scaleX, hy = o.y + (meta.hand[1] + 0.5 - img.originY * H) * img.scaleY;
      var ha = meta.hand[2] * Math.PI / 180, wr = (flip ? Math.PI - ha : ha) + Math.PI / 2 + rq, wd = (o.depth != null ? o.depth : img.depth) + 0.02, wal = o.alpha == null ? 1 : o.alpha;
      var wsc = k === 1 ? 1 / D : Math.max(1, Math.round(wi.frame.height * k)) / wi.frame.height / D;      // the weapon at the hero's size, whole HD px
      var gy = G.ANIM.wpnGrip[wp.frame] || 1;
      wi.setVisible(true).setFlipX(flip).setOrigin(0.5, gy).setScale(wsc).setRotation(wr).setPosition(hx, hy).setDepth(wd).setAlpha(wal);
      var wgd = wp.glow && G.ANIM.glow[wp.glow];
      if (wgd) wg.setVisible(true).setFlipX(flip).setOrigin(0.5, gy).setScale(wsc).setRotation(wr).setPosition(hx, hy).setDepth(wd + 0.01).setTint(HD.glowColor(wgd, this.t))
        .setAlpha(wal * (wgd.min + (wgd.max - wgd.min) * (0.5 + 0.5 * Math.sin(this.t * 6.2832 / (wgd.period || 1.4)))));
      else wg.setVisible(false);
    } else if (wi) { wi.setVisible(false); wg.setVisible(false); }
    // soft contact shadow: as wide as the feet, smaller while the body is up
    var fw = Math.max(8, ((meta.foot || W * 0.6) / D) * 1.15 + 4) * k, lift = 1 - Math.max(0, -oyq) * 0.04;
    var sw = Math.round(fw * lift / 2) * 2;
    this.shadow.setVisible(img.visible).setPosition(o.x, o.ground).setDisplaySize(sw, Math.max(3, Math.round(sw * 0.34)))
      .setAlpha((o.alpha == null ? 1 : o.alpha) * (o.shadowAlpha == null ? 0.85 : o.shadowAlpha));
    return true;
  };

  // A death that reads: a white flash, knocked back away from the hit with a small hop while it tips over, then it
  // flattens into the floor and fades, shedding bits. The corpse is a copy of the sprite; the sim monster is already gone.
  R.die = function (fromX, color, big) {
    var img = this.img, scene = this.scene, M = this.motion();
    var c = scene.add.image(img.x, img.y, img.texture.key, img.frame.name).setFlipX(img.flipX).setOrigin(img.originX, img.originY)
      .setScale(img.scaleX, img.scaleY).setDepth(img.depth);
    var sh = scene.add.image(this.shadow.x, this.shadow.y, 'hd_shadow').setDepth(-99).setDisplaySize(this.shadow.displayWidth, this.shadow.displayHeight).setAlpha(this.shadow.alpha);
    var dur = M.die || 0.75;
    scene.corpses = scene.corpses || [];
    scene.corpses.push({ img: c, sh: sh, t: 0, dur: dur, dir: fromX == null ? -this.face : sign(img.x - fromX), x0: img.x, y0: img.y, W: img.frame.width, H: img.frame.height,
      sx: img.scaleX, sy: img.scaleY, ox: img.originX, color: color, big: !!big, shed: 0 });
  };
  // advance the corpses (called by the scene each frame)
  G.Rig.corpses = function (scene, dt) {
    var L = scene.corpses, i;
    if (!L) return;
    for (i = L.length - 1; i >= 0; i--) {
      var k = L[i], c = k.img;
      k.t += dt;
      var u = k.t / k.dur;
      if (u >= 1) { c.destroy(); k.sh.destroy(); L.splice(i, 1); continue; }
      var kb = k.big ? 0.15 : 0.4, fall = Math.min(1, u / kb), flat = Math.max(0, (u - kb) / (1 - kb));
      // knock-back (ease out) with a hop; the boss shudders in place instead
      var dist = k.big ? 0 : 12 * (1 - (1 - fall) * (1 - fall)), hop = k.big ? 0 : Math.sin(Math.PI * fall) * 4;
      var jit = k.big && flat < 0.6 ? ((Math.floor(k.t * 30) % 2) ? 1 : -1) : 0;
      var sy = k.sy * (1 - 0.85 * flat * flat), sx = k.sx * (1 + 0.3 * flat);
      var hs = Math.max(1, Math.round(k.H * sy * D)) / D, ws = Math.max(1, Math.round(k.W * sx * D)) / D;      // whole HD pixels
      c.setScale(ws / k.W, hs / k.H).setPosition(Math.round(k.x0 + k.dir * dist), Math.round(k.y0 - hop))
        .setOrigin(k.ox - jit / (ws * D), 1).setRotation(q(k.big ? 0 : k.dir * 0.35 * fall, 0.035));
      c.setAlpha(1 - Math.max(0, (flat - 0.35) / 0.65));
      if (k.t < 0.07 || (k.big && flat < 0.5 && Math.floor(k.t * 10) % 2 === 0)) c.setTintFill(0xffffff); else c.setTint(k.big ? 0xffc0a0 : 0xd8d0c8);
      k.sh.setPosition(Math.round(k.x0 + k.dir * dist), k.sh.y).setAlpha((1 - u) * 0.8);
      // bits shed as it falls apart
      if (scene.fx && flat > 0 && k.shed < (k.big ? 6 : 3) && flat > k.shed / (k.big ? 6 : 3)) {
        k.shed++;
        scene.fx.burst(c.x, c.y - hs * 0.4, k.color || 'ui_dim', k.big ? 14 : 5, k.big ? 90 : 45, 0.45);
      }
    }
  };
  G.Rig.clearCorpses = function (scene) {
    (scene.corpses || []).forEach(function (k) { k.img.destroy(); k.sh.destroy(); });
    scene.corpses = [];
  };
})(globalThis.G = globalThis.G || {});
