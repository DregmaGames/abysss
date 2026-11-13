// Game scene: owns the sim, steps it at a fixed 60 Hz, and draws its state.
// The view never changes game state; it reads sim objects and plays sim events.
(function (G) {
  var UI = G.UI, STEP = 1000 / 60, ADD = Phaser.BlendModes.ADD;
  var SHADOW = { s: 'shadow_s', m: 'shadow_m', l: 'shadow_l' };
  var DIE_COLOR = { imp: 'ir2', bat: 'bt2', skeleton: 'sk2', hound: 'hd2', cultist: 'cu2', warden: 'wd2', tyrant: 'ty2' };
  var SHOT_FRAME = { bone: 'shot_bone', big: 'shot_big', orb: 'shot' };
  var POSE_STATE = { 2: 'slam', 3: 'charge', 4: 'burst' };     // boss attack pose frame -> animation state (src/view/anim.js)
  var HOP_H = 12, ARC_LIFE = 30;          // dodge across a crack: hop height (px), trail fade (frames)

  G.GameScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function GameScene() { Phaser.Scene.call(this, { key: 'game' }); },

    create: function () {
      var P = G.params, self = this;
      G.screen = 'game';
      if (G.runSeed == null) G.runSeed = P.has('seed') ? parseInt(P.get('seed'), 10) >>> 0 : 1;
      if (G.cls == null) G.cls = G.classDef(G.BAL, P.get('class') || (G.save && G.save.settings.cls)).id;   // ?class=<id>, or the title's class picker
      // debug panel toggles (src/view/panels.js): kept for the whole browser session, across runs
      G.cheats = G.cheats || { god: false, noCd: false, speed: 1 };
      G.debug = P.get('debug') !== '0' && P.get('bot') !== '1' && !G.tutorial;    // ?debug=0 hides the debug button
      this.speed = P.has('speed') ? parseFloat(P.get('speed')) : G.cheats.speed;
      G.manualLevel = P.get('manual') === '1';      // QA: level-up cards are clicked by the test, not auto-picked
      // the daily challenge (G.startDaily): the day's seed, class and doors, and a kit of its own (the save's gear is not used or changed)
      var D = G.daily && !G.testRoom && !G.tutorial ? G.daily : null;
      this.sim = G.tutorial ? new G.Sim({ seed: 1, gear: G.gearOf(G.save, G.cls), events: true, cheats: {}, cls: G.cls, tutorial: { reward: !G.save.hints.tut.got } })
        : D ? new G.Sim({ seed: D.seed, gear: G.dailyGear(D, G.BAL), events: true, cheats: G.cheats, cls: D.cls, daily: D })
        : new G.Sim({ seed: G.runSeed, gear: G.gearOf(G.save, G.cls), events: true, cheats: G.cheats, testRoom: !!G.testRoom, cls: G.cls });
      var C = this.cls = this.sim.cls;
      this.controls = new G.Controls(this);
      this.fx = new G.FX(this);
      this.fx.quiet = this.speed > 4;
      this.bot = P.get('bot') === '1' && G.Bot ? new G.Bot(this.sim, P.get('build'), { leave: P.get('leave') }) : null;   // ?build=<id>: the bot's ability build; ?leave=N: it leaves after room N
      this.maps = { monsters: new Map(), bolts: new Map(), shots: new Map(), orbs: new Map(), drops: new Map() };
      this.acc = 0; this.frame = 0; this.ended = false; this.worstStuck = 0;
      this.groundG = this.add.graphics().setDepth(-700);     // cooldown rings, telegraphs
      this.hpG = this.add.graphics().setDepth(7000);         // monster health bars, above every sprite
      this.fxG = this.add.graphics().setDepth(7995);         // ability effects: chain lightning, orbiting bodies
      this.chains = [];
      this.arcG = this.add.graphics().setDepth(7990);         // the hop arc of a dodge across a crack
      this.hop = null; this.arc = []; this.bumpT = 0; this.bumpX = 0; this.bumpY = 0; this.blockN = 0;
      this.player = this.add.image(0, 0, 'atlas', C.sprite.frames + '_0').setOrigin(0.42, 1);
      this.playerShadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100);
      this.prig = new G.Rig(this, this.player, C.id);      // HD hero (when a sheet for the class is imported): frame animation + motion
      // a class with weapon types holds its weapon as its own sprite (frame w_<type>), swung on the 'swing' event
      this.weaponImg = C.weapons ? this.add.image(0, 0, 'atlas', 'w_' + G.weaponOf(C, this.sim.gear).id).setOrigin(0.5, 0.9) : null;
      this.swingT = 0;
      this.playerGlow = this.add.image(0, 0, 'atlas', 'glow').setDepth(-640).setBlendMode(ADD).setTint(UI.hex(C.sprite.glow)).setAlpha(0.14);
      this.chest = this.add.image(0, 0, 'atlas', 'chest_closed').setOrigin(0.5, 1);
      this.chestGlow = this.add.image(0, 0, 'atlas', 'glow_s').setDepth(-640).setBlendMode(ADD).setTint(UI.hex('gold')).setAlpha(0);
      // the merchant (step 7): idle sprite, a TRADE tag in reach, tap to open his panel
      this.merch = this.add.image(0, 0, 'atlas', 'merchant_0').setOrigin(0.5, 1).setVisible(false);
      this.merchShadow = this.add.image(0, 0, 'atlas', 'shadow_s').setDepth(-100).setVisible(false);
      this.tradeTag = UI.text(this, 0, 0, G.t('game.trade'), 'ui_warn').setDepth(7500).setVisible(false);
      this.merch.setInteractive({ useHandCursor: true });
      this.merch.on('pointerdown', function () { if (!G.paused && self.sim.canTalk() && G.hud) G.hud.openMerchant(); });
      // Don Montoto's cage (step 8): tap it in reach to free him once the room is clear
      this.cageImg = this.add.image(0, 0, 'atlas', 'cage_0').setOrigin(0.5, 1).setVisible(false);
      this.cageTag = UI.text(this, 0, 0, G.t('mon.freeHim'), 'ui_warn').setDepth(7500).setVisible(false);
      this.cageImg.setInteractive({ useHandCursor: true });
      this.cageImg.on('pointerdown', function () { if (!G.paused) self.sim.freeCaged(); });
      this.goldAcc = 0; this.goldT = 0;
      this.door = this.add.image(0, 0, 'atlas', 'door_closed').setOrigin(0.5, 1).setDepth(-600);
      this.doorGlow = this.add.image(0, 0, 'atlas', 'glow').setDepth(-640).setBlendMode(ADD).setTint(UI.hex('em2')).setAlpha(0);
      this.cam = { x: 0, y: 0 };
      this.buildRoom();
      this.applyView();
      this.game.events.on('viewchange', this.applyView, this);
      this.events.once('shutdown', function () { self.game.events.off('viewchange', self.applyView, self); if (self.roomView) self.roomView.destroy(); self.roomView = null; });
      G.gameScene = this;
      G.paused = false;
      if (G.HudScene) { if (this.scene.isActive('hud')) this.scene.stop('hud'); this.scene.launch('hud'); this.scene.bringToTop('hud'); }
      this.sim.events.length = 0;
      this.cameras.main.fadeIn(250, 7, 6, 11);
      G.ready = true;
    },

    applyView: function () { this.cameras.main.setZoom(G.view.S); },
    // HD switched on or off in the settings: the room (floor) and every sprite are made again; the rigs pick the atlas per frame
    rebuildArt: function () {
      var keep = this.cam.x, keepY = this.cam.y;
      this.buildRoom();
      this.cam.x = keep; this.cam.y = keepY;
    },

    buildRoom: function () {
      var sim = this.sim, room = sim.room, k;
      if (this.roomView) this.roomView.destroy();
      for (k in this.maps) { this.maps[k].forEach(function (s) { if (s.sh) s.sh.destroy(); if (s.gl) s.gl.destroy(); if (s.rig) s.rig.destroy(); s.destroy(); }); this.maps[k].clear(); }
      G.Rig.clearCorpses(this);
      this.fx.clear();
      this.hop = null; this.arc.length = 0; this.blockN = 0;
      this.roomView = new G.RoomView(this, room);
      this.door.setPosition(room.exit.tx * 16 + 8, 32);
      this.doorGlow.setPosition(room.exit.tx * 16 + 8, 40);
      this.chest.setPosition(sim.chest.x, sim.chest.y + 6).setDepth(sim.chest.y + 6);
      this.chestGlow.setPosition(sim.chest.x, sim.chest.y);
      this.cam.x = sim.player.x; this.cam.y = sim.player.y;
    },

    // ------------------------------------------------------------- main loop
    update: function (time, delta) {
      var sim = this.sim, steps = 0, max = Math.max(8, Math.ceil(this.speed * 4));   // catch up to 8 steps per frame, then drop time
      this.frame++;
      if (!G.paused && !this.ended) {
        this.acc += Math.min(delta, 100) * this.speed;
        if (!this.bot) this.controls.read(sim.input);
        while (this.acc >= STEP && steps < max && sim.state === 'play') {
          this.acc -= STEP; steps++;
          if (this.bot) this.bot.update();
          sim.step();
        }
        if (this.acc > STEP * max) this.acc = 0;
        var stuck = sim.stuckSeconds();
        if (stuck > this.worstStuck) this.worstStuck = stuck;
        if (sim.state === 'levelup' && !G.HudScene) sim.choosePassive(0);
      } else {
        this.controls._dodge = false; this.controls._pulse = false;
      }
      this.rdt = !G.paused && !this.ended ? Math.min(delta, 100) / 1000 * this.speed : 0;      // animation time (HD rigs)
      this.playEvents();
      this.sync();
      G.Rig.corpses(this, this.rdt);
      this.fx.update(Math.min(delta, 100) / 1000);
      this.updateCamera();
      this.roomView.tick(this.frame, sim.fissures, sim.tick);
    },

    updateCamera: function () {
      var cam = this.cameras.main, p = this.sim.player, room = this.sim.room, V = G.view;
      var vw = V.W, vh = V.H, rw = room.w * 16, rh = room.h * 16;
      this.cam.x += (p.x - this.cam.x) * 0.14; this.cam.y += (p.y - 8 - this.cam.y) * 0.14;
      var cx = rw <= vw ? rw / 2 : Math.max(vw / 2, Math.min(rw - vw / 2, this.cam.x));
      // the HUD covers the top strip of the screen: let the view scroll that far above the room,
      // so the exit gate in the top wall is never hidden behind the objective plate
      var top = G.hud && G.hud.obj ? G.hud.obj.y + 30 : 34;
      var cy = rh + top <= vh ? (rh - top) / 2 : Math.max(vh / 2 - top, Math.min(rh - vh / 2, this.cam.y));
      cam.centerOn(Math.round(cx) + this.fx.sx, Math.round(cy) + this.fx.sy);
    },

    // ---------------------------------------------------------------- events
    playEvents: function () {
      var ev = this.sim.events, fx = this.fx, i, e, s;
      for (i = 0; i < ev.length; i++) {
        e = ev[i];
        G.audio.event(e, this);
        switch (e.t) {
          case 'hit':
            if (e.src === 'dot') { s = this.maps.monsters.get(e.id); if (s) fx.spark(e.x, e.y + 2, 'em3', 0.2); break; }   // dot ticks: no number, no flash
            s = this.maps.monsters.get(e.id);
            if (s && !(s.flashCd > 0)) { s.flash = s.big ? 2 : 3; s.flashCd = s.big ? 16 : 7; }
            if (s && s.rig) s.rig.hurt(this.sim.player.x);
            fx.number(e.x, e.y - (s ? (s.artH || s.height) - 8 : 0), (e.crit ? e.dmg + '!' : '' + e.dmg), e.crit ? 'ui_warn' : 'ui_text');
            fx.burst(e.x, e.y, 'orb', e.crit ? 6 : 3, 60, 0.25);
            if (e.crit) fx.shake(0.12);
            break;
          case 'phit':
            this.prig.hurt(this.sim.player.x - this.sim.player.face);
            fx.number(e.x, e.y - 22, '-' + e.dmg, 'ui_bad');
            fx.burst(e.x, e.y, 'blood', 10, 80, 0.35);
            fx.shake(0.45);
            this.hurtFlash = 4;
            break;
          case 'gold': this.goldAcc += e.v; this.goldX = e.x; this.goldY = e.y; fx.burst(e.x, e.y - 6, 'gold', 3, 40, 0.3); break;
          case 'heal': fx.number(e.x, e.y - 22, '+' + e.v, 'ui_good'); break;
          case 'die':
            var bossy = e.type === 'tyrant';
            s = this.maps.monsters.get(e.id);
            if (s && s.rig && s.rig.hdOn) { s.rig.die(this.sim.player.x, DIE_COLOR[e.type], bossy); s.setVisible(false); }
            fx.burst(e.x, e.y, DIE_COLOR[e.type] || 'ir2', bossy ? 70 : 12, bossy ? 150 : 80, bossy ? 0.9 : 0.4);
            fx.burst(e.x, e.y, 'rg3', 5, 50, 0.5);
            if (bossy || e.type === 'warden') { fx.shake(0.8); fx.ring(e.x, e.y, 4, 48, 0.4, 'em2'); }
            break;
          case 'spawn': fx.burst(e.x, e.y, 'rg3', 6, 50, 0.3); fx.ring(e.x, e.y, 2, 9, 0.25, 'rg2', 0.6); break;
          case 'pulse':
            var pf = this.cls.sprite.fx || ['orb_c', 'orb', 'mb2'];
            fx.ring(e.x, e.y, 6, e.r, 0.28, pf[0]); fx.ring(e.x, e.y, 2, e.r - 8, 0.34, pf[1]); fx.ring(e.x, e.y, 2, e.r - 18, 0.4, pf[2]);
            fx.burst(e.x, e.y, pf[1], 16, 150, 0.3);
            fx.shake(this.cls.attack.kind === 'arc' ? 0.5 : 0.3);
            break;
          case 'burst':
            var bc = e.fam ? G.BAL.families[e.fam].icon : 'orb';
            fx.ring(e.x, e.y, 3, e.r, 0.26, bc); fx.ring(e.x, e.y, 1, e.r * 0.6, 0.3, 'white', 0.8);
            fx.burst(e.x, e.y, bc, 8, 90, 0.3);
            fx.shake(0.12);
            break;
          case 'chain': this.chains.push({ pts: e.pts, life: 7, c: e.fam ? G.BAL.families[e.fam].icon : 'gold' }); fx.burst(e.pts[2], e.pts[3], 'gold', 3, 40, 0.2); break;
          case 'execute': fx.burst(e.x, e.y, 'ui_bad', 8, 70, 0.3); fx.shake(0.15); break;
          case 'echo': fx.burst(e.x, e.y, 'tome2', 5, 50, 0.25); break;
          case 'volley':
            var vf = this.cls.sprite.fx;
            fx.ring(e.x, e.y, 4, e.r * 0.7, 0.3, vf[0]); fx.ring(e.x, e.y, 2, e.r * 0.45, 0.34, vf[1]);
            for (var va = 0; va < 14; va++) fx.spark(e.x + Math.cos(va / 14 * 6.2832) * 10, e.y - 4 + Math.sin(va / 14 * 6.2832) * 10, vf[2], 0.25);
            fx.shake(0.25);
            break;
          case 'cast': this.prig.attack(0.22); break;
          case 'swing':
            this.swingT = 9; this.prig.attack(0.22);
            // melee: a crescent of sparks swept along the arc (leading edge bright), a nick of shake on a crit
            var sc = e.whirl ? 'white' : (this.cls.sprite.slash || 'ui_text');
            for (var sr = 0; sr < 2; sr++) for (var sa = -5; sa <= 5; sa++) {
              var ang = e.a + sa / 10 * e.arc, rr = e.r * (sr ? 0.62 : 0.95) + 5;
              fx.spark(e.x + Math.cos(ang) * rr, e.y - 4 + Math.sin(ang) * rr, e.crit ? 'ui_warn' : (Math.abs(sa) > 3 && !sr ? 'white' : sc), 0.14 + Math.abs(sa) * 0.012);
            }
            if (e.crit) fx.shake(0.25);
            break;
          case 'bump':
            fx.burst(e.x, e.y, 'ui_dim', 4, 50, 0.2);
            break;
          case 'dodge':
            fx.burst(e.x, e.y, this.cls.sprite.dash, 8, 50, 0.3); this.dashTrail = 10;
            // across an open crack: the mage hops in an arc and leaves a dotted trail of it
            if (e.cross) { this.hop = { dur: e.dur }; this.planArc(e); }
            break;
          case 'land':
            if (e.cross) { fx.burst(e.x, e.y + 5, 'ui_dim', 6, 40, 0.3); fx.ring(e.x, e.y + 5, 2, 10, 0.25, this.cls.sprite.dash, 0.5); }
            break;
          case 'blocked':
            // pushing into an open crack: sparks where the mage touches it, the lip flares, the mage recoils
            fx.burst(e.x, e.y, 'em4', 4, 40, 0.25);
            this.roomView.bump(e.x, e.y, this.sim.tick);
            this.bumpT = 6; this.bumpX = -e.dx; this.bumpY = -e.dy;
            if (this.blockN++ % 4 === 0) fx.number(this.sim.player.x, this.sim.player.y - 22, G.t('game.dodgeToCross'), 'ui_warn');
            break;
          case 'windup': s = this.maps.monsters.get(e.id); if (s) { s.wind = Math.round(e.dur * 60); s.rig.windup(e.dur); } break;
          case 'shoot': s = this.maps.monsters.get(e.id); if (s && s.rig.wind > 0) s.rig.release(); break;
          case 'puff': fx.burst(e.x, e.y, 'ui_dim', 3, 30, 0.2); break;
          case 'hex': fx.burst(e.x, e.y - 14, 'shot1', 6, 50, 0.3); break;
          case 'erupt': fx.ring(e.x, e.y, 4, e.r, 0.3, 'shot1'); fx.burst(e.x, e.y, 'shot2', 16, 90, 0.45); fx.shake(0.35); break;
          case 'fizzle': fx.burst(e.x, e.y, 'ui_dim', 8, 40, 0.3); break;
          case 'slam': fx.ring(e.x, e.y, 8, e.r, 0.3, 'em3'); fx.burst(e.x, e.y, 'em2', 30, 140, 0.5); fx.shake(0.9); break;
          case 'enrage': fx.ring(e.x, e.y, 6, 70, 0.6, 'blood'); fx.shake(0.7); break;
          case 'fissure':
            if (e.state === 'opening') { fx.shake(e.big ? 0.9 : 0.4); fx.ring(e.x, e.y, 2, e.big ? 44 : 22, 0.5, 'rg3', 0.6); fx.burst(e.x, e.y, 'em3', e.big ? 30 : 12, 90, 0.5); }
            if (e.state === 'closing') fx.ring(e.x, e.y, e.big ? 48 : 26, 3, 0.6, 'em3', 0.6);
            if (e.state === 'scar') { fx.burst(e.x, e.y, 'em4', e.big ? 50 : 20, 100, 0.7); fx.shake(e.big ? 0.8 : 0.3); }
            break;
          case 'seg': fx.burst(e.x, e.y, 'em4', 10, 70, 0.5); fx.ring(e.x, e.y, 14, 2, 0.4, 'em3', 0.5); break;
          case 'chest': fx.burst(e.x, e.y, 'gold', 30, 110, 0.7); fx.ring(e.x, e.y, 3, 30, 0.4, 'gold'); break;
          case 'drop': fx.burst(e.x, e.y, UI.RARITY[e.rarity], 8, 50, 0.5); break;
          case 'pickup': fx.burst(this.sim.player.x, this.sim.player.y, e.item ? UI.RARITY[e.item.rarity] : (e.kind === 'scroll' ? 'gold' : 'tome2'), 10, 60, 0.4); break;
          case 'cagelocked': if (G.hud) G.hud.say(G.t('mon.clearFirst'), 'ui_warn'); break;
          case 'rescue': fx.burst(e.x, e.y - 4, 'tome2', 24, 90, 0.7); fx.ring(e.x, e.y, 3, 26, 0.4, 'gold'); fx.number(e.x, e.y - 26, G.t('mon.freed'), 'gold'); G.storeSave(G.save); break;
          case 'room': this.buildRoom(); this.cameras.main.fadeIn(300, 7, 6, 11); break;
          case 'dead': fx.shake(1); fx.burst(this.sim.player.x, this.sim.player.y, this.cls.sprite.glow, 36, 120, 0.9); break;
        }
        if (G.hud) G.hud.onEvent(e);
      }
      ev.length = 0;
    },

    // ------------------------------------------------------------------ sync
    sync: function () {
      var sim = this.sim, tick = sim.tick, self = this, p = sim.player, rdt = this.rdt || 0;
      // player
      var walk = p.moving ? [1, 0, 2, 0][(tick >> 3) & 3] : 0, prig = this.prig;
      var heq = sim.gear && sim.gear.equipped;
      prig.ent = G.HD.heroEnt(this.cls.id, heq);                    // visible equipment: the sheet by the armour worn
      var hdHero = !!G.HD.frames(this, prig.ent, 'idle');           // the class has HD frames (a sheet imported for it)
      if (!hdHero) {
        if (this.player.isHD || this.player.texture.key !== 'atlas') G.HD.chunky(this.player, this.cls.sprite.frames + '_0');
        this.player.setFrame(this.cls.sprite.frames + '_' + walk).setFlipX(p.face < 0).setOrigin(p.face < 0 ? 0.58 : 0.42, 1);
      }
      // hop: height of the dodge arc over a crack (0 outside it); bump: a 1 px recoil off the edge
      var lift = 0, bx = 0, by = 0;
      if (this.hop) {
        var k = p.dashT > 0 ? 1 - p.dashT / this.hop.dur : 1;
        lift = Math.round(Math.sin(Math.PI * Math.min(1, k)) * HOP_H);
        if (p.dashT <= 0) this.hop = null;
      }
      if (this.bumpT > 0) { this.bumpT--; bx = Math.round(this.bumpX); by = Math.round(this.bumpY); }
      this.player.setPosition(p.x + bx, p.y + p.r + 1 - lift + by).setDepth(p.y + p.r + (lift ? 400 : 0));
      this.playerShadow.setPosition(p.x, p.y + p.r).setScale(1 - lift / (HOP_H * 2.5)).setVisible(!hdHero);
      if (hdHero) prig.update(rdt, { x: p.x + bx, y: p.y + p.r + 1 - lift + by, ground: p.y + p.r, face: p.face, tx: null, state: 'walk',
        speed: this.cls.base.speed, depth: p.y + p.r + (lift ? 400 : 0), shadowAlpha: 0.85 * (1 - lift / (HOP_H * 1.5)),
        glow: G.HD.glowOf(heq && heq.weapon), weapon: G.HD.heroWeapon(prig.ent, this.cls, heq) });
      else prig.shadow.setVisible(false);
      if (this.weaponImg) {
        var wi = this.weaponImg, wd = G.weaponOf(this.cls, sim.gear).id;
        if (this.swingT > 0) this.swingT--;
        var wa = this.swingT > 0 ? -1.0 + 2.7 * (1 - this.swingT / 9) : 0.3;
        wi.setFrame('w_' + wd).setFlipX(p.face < 0).setRotation(p.face * wa).setAlpha(this.player.alpha)
          .setPosition(p.x + bx + p.face * 5, p.y + p.r + 1 - lift + by - 11).setDepth(p.y + p.r + (lift ? 400 : 0) + 0.5).setVisible(sim.state !== 'dead' && !hdHero);      // the HD sheet has the weapon drawn in
      }
      this.drawArc();
      this.playerGlow.setPosition(p.x, p.y);
      this.player.setVisible(sim.state !== 'dead');
      if (this.hurtFlash > 0) { this.hurtFlash--; this.player.setTintFill(0xffffff); }
      else if (p.dashT > 0) this.player.setTintFill(UI.hex(this.cls.sprite.dash));
      else this.player.clearTint();
      this.player.setAlpha(p.iframes > 0 && p.dashT <= 0 && (tick >> 2) % 2 ? 0.45 : 1);
      if (this.dashTrail > 0) { this.dashTrail--; if (tick % 2 === 0) this.fx.burst(p.x, p.y, this.cls.sprite.glow, 2, 10, 0.25); }

      this.list('monsters', sim.monsters, function (m) {
        var s = self.add.image(m.x, m.y, 'atlas', m.type + '_0').setOrigin(0.5, 1);
        s.sh = self.add.image(m.x, m.y, 'atlas', SHADOW[m.def.shadow]).setDepth(-100);
        s.flash = 0; s.wind = 0; s.flashCd = 0; s.big = !!(m.def.boss || m.def.elite);
        s.rig = new G.Rig(self, s, m.type);       // HD art: motion and soft shadow (src/view/hd.js); unused for chunky monsters
        return s;
      }, function (s, m) {
        var fly = m.def.fly || 0, rate = m.def.ai === 'weave' ? 2 : 3, pose = G.attackPose(m, p);
        var state = pose ? (m.def.boss ? POSE_STATE[pose] : 'attack') : 'walk';
        if (s.rig.update(rdt, { x: m.x, y: m.y + m.r + 1 - fly, ground: m.y + m.r, face: m.face, tx: p.x, state: state, speed: m.def.speed,
          depth: m.y + m.r, alpha: m.emerge > 0 ? 0.6 : 1 })) {
          s.sh.setVisible(false);
          s.artH = s.rig.artH;
        } else {
          if (s.isHD || s.texture.key !== 'atlas') G.HD.chunky(s, m.type + '_0');
          s.setPosition(m.x, m.y + m.r + 1 - fly).setDepth(m.y + m.r).setFlipX(m.face < 0).setOrigin(0.5, 1);
          s.setFrame(m.type + '_' + (pose || (((tick >> rate) + m.id) & 1)));
          s.sh.setVisible(true).setPosition(m.x, m.y + m.r);
          s.artH = s.height;
        }
        s.setAlpha(m.emerge > 0 ? 0.6 : 1);
        if (s.flashCd > 0) s.flashCd--;
        if (s.flash > 0) { s.flash--; s.setTintFill(0xffffff); }
        else if (s.wind > 0) { s.wind--; if ((s.wind >> 2) % 2) s.setTint(0xffb040); else s.clearTint(); }
        else if (m.emerge > 0) s.setTint(UI.hex('rg3'));
        else if (m.enraged) s.setTint(0xffb080);
        else if (m.fx && (m.fx.chill || m.fx.burn || m.fx.poison || m.fx.bleed || m.fx.mark)) {
          // status tint: chill blue, burn orange, poison green, bleed red, mark white (the strongest first)
          s.setTint(UI.hex(m.fx.chill ? 'mb3' : m.fx.burn ? 'em3' : m.fx.poison ? 'rg3' : m.fx.bleed ? 'blood' : 'ui_text'));
        }
        else s.clearTint();
      });
      this.drawHealthBars();
      this.list('bolts', sim.bolts, function (b) {
        var A = self.cls.attack, wv = !!b.wave, s = self.add.image(b.x, b.y, 'atlas', wv ? 'bolt' : A.frame).setDepth(8000);
        if (wv) s.setTint(UI.hex('gold'));       // Thunder Wave: a gold bolt
        s.wv = wv;
        s.gl = self.add.image(b.x, b.y, 'atlas', 'glow_s').setDepth(-640).setBlendMode(ADD).setTint(UI.hex(wv ? 'gold' : A.glow)).setAlpha(0.5);
        return s;
      }, function (s, b) {
        s.setPosition(b.x, b.y - 6); s.gl.setPosition(b.x, b.y);
        if (self.cls.attack.rotate && !s.wv) s.setRotation(Math.atan2(b.vy, b.vx));
        if (!self.fx.quiet && (tick + b.id) % 2 === 0) self.fx.spark(b.x, b.y - 6, s.wv ? 'gold' : (b.crit ? 'ui_warn' : self.cls.attack.glow), 0.18);
      });
      this.list('shots', sim.shots, function (b) { return self.add.image(b.x, b.y, 'atlas', SHOT_FRAME[b.kind] || 'shot').setDepth(8000); },
        function (s, b) { s.setPosition(b.x, b.y - 4); if (b.kind === 'bone') s.setFlip(((tick >> 2) & 1) === 1, ((tick >> 3) & 1) === 1); });
      this.list('orbs', sim.orbs, function (o) { return self.add.image(o.x, o.y, 'atlas', o.kind === 'exp' ? 'orb_exp' : 'orb_heal').setDepth(-50); },
        function (s, o) { s.setPosition(o.x, o.y + (((tick >> 3) + o.id) % 4 === 0 ? -1 : 0)); });
      this.list('drops', sim.drops, function (d) {
        var s = self.add.image(d.x, d.y, 'atlas', d.kind === 'tome' ? 'i_tome' : d.kind === 'scroll' ? 'i_scroll' : G.itemIcon(d.item)).setDepth(d.y);
        s.sh = self.add.image(d.x, d.y + 8, 'atlas', 'shadow_s').setDepth(-100);
        s.rar = d.item ? d.item.rarity : 3;
        s.gl = self.add.image(d.x, d.y, 'atlas', 'glow_s').setDepth(-640).setBlendMode(ADD).setTint(UI.hex(d.item ? UI.RARITY[s.rar] : 'tome1')).setAlpha(0.6);
        return s;
      }, function (s, d) {
        s.setPosition(d.x, d.y + ([0, -1, -2, -1][((tick >> 3) + d.id) & 3]));
        if ((tick + d.id * 7) % 24 === 0) self.fx.burst(d.x, d.y - 2, d.item ? UI.RARITY[s.rar] : 'tome2', 1 + (s.rar > 1 ? 1 : 0), 14, 0.6);
      });

      // merchant
      var mc = sim.merchant;
      this.merch.setVisible(!!mc); this.merchShadow.setVisible(!!mc);
      if (mc) {
        this.merch.setPosition(mc.x, mc.y + 6).setDepth(mc.y + 6).setFrame('merchant_' + ((tick >> 4) % 3));
        this.merchShadow.setPosition(mc.x, mc.y + 5);
        var near = sim.canTalk();
        this.tradeTag.setText(G.t('game.trade')).setVisible(near).setPosition(Math.round(mc.x - this.tradeTag.width / 2), Math.round(mc.y - 26 - ((tick >> 4) & 1)));
      } else this.tradeTag.setVisible(false);
      // the cage
      var cg = sim.cage;
      this.cageImg.setVisible(!!cg);
      if (cg) {
        G.HD.show(this.cageImg.setPosition(cg.x, cg.y + 8).setDepth(cg.y + 8), 'cage_' + ((tick >> 5) & 1), 0.5, 1);
        this.cageTag.setText(sim.roomClear() ? G.t('mon.freeHim') : G.t('mon.locked')).setVisible(sim.cageNear()).setPosition(Math.round(cg.x - this.cageTag.width / 2), Math.round(cg.y - 22 - ((tick >> 4) & 1)));
      } else this.cageTag.setVisible(false);
      // gold: one floating label per 0.2 s (the rest is summed)
      if (this.goldAcc > 0 && --this.goldT <= 0) { this.fx.number(this.goldX, this.goldY - 14, '+' + this.goldAcc, 'gold'); this.goldAcc = 0; this.goldT = 12; }
      // chest and exit
      var c = sim.chest;
      this.chest.setVisible(c.state !== 'hidden').setFrame(c.state === 'open' ? 'chest_open' : 'chest_closed');
      this.chestGlow.setAlpha(c.state === 'closed' ? 0.45 + ((tick >> 3) % 4) * 0.05 : (c.state === 'open' ? 0.3 : 0));
      this.door.setFrame(sim.exit.open ? 'door_open' : 'door_closed');
      this.doorGlow.setAlpha(sim.exit.open ? 0.35 + ((tick >> 3) % 3) * 0.04 : 0);
      this.drawGround(tick);
      this.drawEffects(tick);
    },

    // ability effects each frame: chain lightning (a few frames), orbiting bodies, ground zones
    drawEffects: function (tick) {
      var g = this.fxG, sim = this.sim, B = sim.B, i, j, k;
      g.clear();
      for (i = this.chains.length - 1; i >= 0; i--) {
        var c = this.chains[i], pts = c.pts;
        if (--c.life <= 0) { this.chains.splice(i, 1); continue; }
        for (j = 0; j + 3 < pts.length; j += 2) {
          var x0 = pts[j], y0 = pts[j + 1] - 4, x1 = pts[j + 2], y1 = pts[j + 3] - 4, n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
          for (k = 0; k <= n; k++) {
            var jit = k > 0 && k < n ? ((k * 7 + j + tick) % 3) - 1 : 0;
            g.fillStyle(UI.hex(k % 3 ? c.c : 'white'), 1);
            g.fillRect(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n) + jit, 1, 1);
          }
        }
      }
      for (i = 0; i < sim.orbiters.length; i++) {
        var o = sim.orbiters[i], key = o.key, fam = key.indexOf('fam:') === 0 ? key.slice(4, key.indexOf('/')) : B.abilities[key.slice(0, key.indexOf('/'))].fam;
        if (!o.x) continue;
        var ox = Math.round(o.x), oy = Math.round(o.y - 4), col = B.families[fam].icon;
        g.fillStyle(UI.hex(col), 0.5); g.fillRect(ox - 2, oy - 2, 5, 5);
        g.fillStyle(UI.hex(col), 1); g.fillRect(ox - 1, oy - 1, 3, 3);
        g.fillStyle(UI.hex('white'), 1); g.fillRect(ox, oy, 1, 1);
      }
      var zg = this.groundG;
      for (i = 0; i < sim.zones.length; i++) {
        var z = sim.zones[i], zc = UI.hex(B.families[z.fam].icon), zr = Math.round(z.r), pulse = (tick >> 4) % 2, zx = Math.round(z.x), zy = Math.round(z.y);
        var ring = G.ellipsePixels(zr, Math.max(1, Math.round(zr * 0.75)));
        zg.fillStyle(zc, 0.8);
        for (j = 0; j < ring.length; j += 2) zg.fillRect(zx + ring[j], zy + ring[j + 1], 1, 1);
        zg.fillStyle(zc, 0.28);
        for (var yy = -zr; yy <= zr; yy += 3) for (var xx = -zr; xx <= zr; xx += 3) {
          var ey = yy / 0.75;
          if (xx * xx + ey * ey <= zr * zr && ((xx + yy) / 3 + pulse) % 2 === 0) zg.fillRect(zx + xx, zy + yy, 2, 2);
        }
      }
    },

    // a health bar over every hurt monster (the boss always): 1 px dark frame, 2 px tall fill, as wide as the monster
    drawHealthBars: function () {
      var g = this.hpG, ms = this.sim.monsters, i;
      g.clear();
      for (i = 0; i < ms.length; i++) {
        var m = ms[i], s = this.maps.monsters.get(m.id);
        if (m.dead || !s || (m.hp >= m.maxHp && !m.def.boss)) continue;   // only once hurt (the boss always)
        var w = m.def.boss ? 34 : Math.max(10, Math.round(m.r * 2) + 2);
        var x = Math.round(m.x - w / 2), y = Math.round(m.y + m.r + 1 - (m.def.fly || 0) - (s.artH || s.height)) - 5;
        var fill = Math.max(m.hp > 0 ? 1 : 0, Math.round(w * Math.max(0, m.hp) / m.maxHp));
        g.fillStyle(UI.hex('outline'), 1); g.fillRect(x - 1, y - 1, w + 2, 4);
        g.fillStyle(UI.hex('hp_d'), 1); g.fillRect(x, y, w, 2);
        g.fillStyle(UI.hex(m.def.elite || m.def.boss ? 'ui_warn' : 'hp'), 1); g.fillRect(x, y, fill, 2);
      }
    },

    // the arc of a dodge across a crack, drawn whole when the dodge starts: from the mage's feet to
    // where the dash will stop (walls shorten it), as a dotted parabola that fades after landing
    planArc: function (e) {
      var sim = this.sim, r = sim.player.r, D = sim.cls.dodge.dist, d = 0, a = this.arc;
      while (d < D && !sim.boxHits(e.x + e.dx * (d + 1), e.y + e.dy * (d + 1), r)) d++;
      a.length = 0;
      for (var j = 0; j <= d; j++) {
        var q = j / Math.max(1, d);
        a.push({ x: Math.round(e.x + e.dx * j), y: Math.round(e.y + r + e.dy * j - Math.sin(Math.PI * q) * HOP_H) });
      }
      this.arcLife = ARC_LIFE;
    },
    drawArc: function () {
      var g = this.arcG, a = this.arc, i;
      if (!this.hop && this.arcLife > 0) this.arcLife--;
      g.clear();
      if (!a.length || (!this.hop && this.arcLife <= 0)) { a.length = 0; return; }
      var alpha = this.hop ? 0.9 : 0.9 * this.arcLife / ARC_LIFE, c = UI.hex(this.cls.sprite.dash), c2 = UI.hex(this.cls.sprite.glow);
      for (i = 0; i < a.length; i++) {
        g.fillStyle((i >> 1) % 2 ? c2 : c, alpha);
        g.fillRect(a[i].x, a[i].y, 1, 1);
      }
      // landing mark: a small bracket on the floor where the dash ends
      var L = a[a.length - 1];
      g.fillStyle(c, alpha);
      g.fillRect(L.x - 4, L.y, 3, 1); g.fillRect(L.x + 2, L.y, 3, 1); g.fillRect(L.x - 4, L.y - 1, 1, 1); g.fillRect(L.x + 4, L.y - 1, 1, 1);
    },

    list: function (name, arr, make, update) {
      var map = this.maps[name], seen = this.frame, i, s;
      for (i = 0; i < arr.length; i++) {
        s = map.get(arr[i].id);
        if (!s) { s = make(arr[i]); map.set(arr[i].id, s); }
        s.seen = seen;
        update(s, arr[i]);
      }
      if (map.size !== arr.length) {
        map.forEach(function (sp, id) { if (sp.seen !== seen) { if (sp.sh) sp.sh.destroy(); if (sp.gl) sp.gl.destroy(); if (sp.rig) sp.rig.destroy(); sp.destroy(); map.delete(id); } });
      }
    },

    // ground layer: pulse cooldown ring + dodge arc under the mage, telegraphed attacks
    drawGround: function (tick) {
      var g = this.groundG, sim = this.sim, p = sim.player, s = sim.stats, i, j, pts, n, k;
      g.clear();
      if (sim.state === 'dead') return;
      var px = Math.round(p.x), py = Math.round(p.y + p.r);
      pts = G.ellipsePixels(12, 6); n = pts.length / 2;
      var ready = p.pulseCd <= 0, frac = ready ? 1 : 1 - p.pulseCd / s.pulseCd;
      k = Math.floor(frac * n);
      for (j = 0; j < n; j++) {
        g.fillStyle(UI.hex(ready ? ((tick >> 4) % 2 ? 'orb_c' : 'orb') : (j < k ? 'mb2' : 'wb0')), 1);
        g.fillRect(px + pts[j * 2], py + pts[j * 2 + 1], 1, 1);
      }
      if (p.dodgeCd > 0) {
        pts = G.ellipsePixels(8, 4); n = pts.length / 2; k = Math.floor((1 - p.dodgeCd / s.dodgeCd) * n);
        g.fillStyle(UI.hex('mb3'), 1);
        for (j = 0; j < k; j++) g.fillRect(px + pts[j * 2], py + pts[j * 2 + 1], 1, 1);
      }
      // the tutorial's marked spot beyond the crack: a pulsing ring on the floor (the arrow above it comes from the HUD)
      if (sim.tut && sim.tutId() === 'cross') {
        var sp = sim.room.tut.spot, rr = 9 + ((tick >> 3) % 3), ep = G.ellipsePixels(rr, Math.round(rr / 2));
        g.fillStyle(UI.hex((tick >> 4) % 2 ? 'ui_warn' : 'orb_c'), 1);
        for (j = 0; j < ep.length / 2; j++) g.fillRect(Math.round(sp.x) + ep[j * 2], Math.round(sp.y) + ep[j * 2 + 1], 1, 1);
      }
      // lunges and charges: a dotted lane on the floor during the wind-up
      for (i = 0; i < sim.monsters.length; i++) {
        var m = sim.monsters[i], len = 0;
        if (m.st === 'wind') len = m.def.lungeSpeed * m.def.lungeTime;
        else if (m.st === 'chargeWind') len = m.def.chargeSpeed * m.def.chargeTime;
        if (!len) continue;
        g.fillStyle(UI.hex((tick >> 2) % 2 ? 'em4' : 'em2'), 1);
        for (j = 6; j < len; j += 3) {
          g.fillRect(Math.round(m.x + m.lx * j), Math.round(m.y + m.r + m.ly * j), 1, 1);
          if (m.def.boss) g.fillRect(Math.round(m.x + m.lx * j - m.ly * 6), Math.round(m.y + m.r + m.ly * j + m.lx * 6), 1, 1);
        }
      }
      // ranged wind-ups: dotted aim lines toward the hero (skeleton 1, warden 3); boss burst: the lanes of the volley (drawLanes)
      var blink = UI.hex((tick >> 2) % 2 ? 'em4' : 'em2');
      for (i = 0; i < sim.monsters.length; i++) {
        var q = sim.monsters[i], rays = null, from = 0, to = 0, base = 0;
        if (q.wind > 0 && (q.def.ai === 'ranged' || q.def.ai === 'elite')) {
          base = Math.atan2(p.y - q.y, p.x - q.x); from = q.r + 4; to = q.r + 30;
          rays = q.def.ai === 'elite' ? [base - q.def.spread, base, base + q.def.spread] : [base];
        } else if (q.st === 'burstWind' || (q.st === 'burst' && q.vol === 1)) this.drawLanes(g, q, tick);
        if (!rays) continue;
        g.fillStyle(blink, 1);
        for (j = 0; j < rays.length; j++) {
          var cx = Math.cos(rays[j]), cy = Math.sin(rays[j]);
          for (k = from; k < to; k += 3) g.fillRect(Math.round(q.x + cx * k), Math.round(q.y - 4 + cy * k), 1, 1);
        }
      }
      this.drawPools(g, tick);
      for (i = 0; i < sim.teles.length; i++) {
        var t = sim.teles[i], tx = Math.round(t.x), ty = Math.round(t.y), r = Math.round(t.r), f = t.t / t.dur;
        if (t.rune) { this.drawRune(g, tx, ty, r, f, tick); continue; }
        g.fillStyle(UI.hex('em2'), 1);
        pts = G.ellipsePixels(r, r);
        for (j = 0; j < pts.length; j += 2) g.fillRect(tx + pts[j], ty + pts[j + 1], 1, 1);
        g.fillStyle(UI.hex(f > 0.75 && (tick >> 2) % 2 ? 'em4' : 'em1'), 1);
        var rr = Math.max(2, Math.round(r * f)), step = f > 0.75 ? 2 : 3;
        for (var yy = -rr; yy <= rr; yy += step) for (var xx = -rr; xx <= rr; xx += step) {
          if (xx * xx + yy * yy <= rr * rr && ((xx + yy) / step) % 2 === 0) g.fillRect(tx + xx, ty + yy, 1, 1);
        }
      }
    },

    // A cultist's rune (its wind-up): a pink circle on the floor with a star inside that is drawn stroke by stroke; when the last stroke
    // closes, it erupts. The rim blinks in the last quarter. Enemy magic is pink (like enemy shots), so it is never taken for a fissure.
    drawRune: function (g, x, y, r, f, tick) {
      var pts = G.ellipsePixels(r, r), j, k, late = f > 0.75 && (tick >> 2) % 2;
      g.fillStyle(UI.hex(late ? 'shot2' : 'shot1'), 1);
      for (j = 0; j < pts.length; j += 2) g.fillRect(x + pts[j], y + pts[j + 1], 1, 1);
      g.fillStyle(UI.hex('shot0'), 0.55);
      for (var yy = -r; yy <= r; yy += 2) for (var xx = -r; xx <= r; xx += 2) if (xx * xx + yy * yy < (r - 1) * (r - 1) && ((xx + yy) >> 1) % 2 === 0) g.fillRect(x + xx, y + yy, 1, 1);
      // a five-pointed star, one stroke after the other
      g.fillStyle(UI.hex(late ? 'shot2' : 'shot1'), 1);
      var n = 5, total = f * n, rr = r - 3;
      for (k = 0; k < n && k < total; k++) {
        var a0 = -1.5708 + k * 2 * 6.2832 / n, a1 = a0 + 2 * 6.2832 / n, part = Math.min(1, total - k);
        var x0 = Math.cos(a0) * rr, y0 = Math.sin(a0) * rr, x1 = Math.cos(a1) * rr, y1 = Math.sin(a1) * rr, steps = Math.ceil(rr * 2 * part);
        for (j = 0; j <= steps; j++) { var u = j / (rr * 2); g.fillRect(Math.round(x + x0 + (x1 - x0) * u), Math.round(y + y0 + (y1 - y0) * u), 1, 1); }
      }
    },
    // Rift pools left by the runes: a dithered pink disc with a bright rim that bubbles; it thins out and blinks in its last second.
    // On the ground layer (under the hero and the monsters), so nothing is hidden.
    drawPools: function (g, tick) {
      var sim = this.sim, i, j, pts;
      for (i = 0; i < sim.pools.length; i++) {
        var q = sim.pools[i], x = Math.round(q.x), y = Math.round(q.y), r = Math.round(q.r), last = q.t < 1, ph = ((tick >> 3) + q.id) & 3;
        if (last && (tick >> 2) % 2) continue;
        g.fillStyle(UI.hex('shot0'), last ? 0.5 : 0.8);
        for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) {
          if (xx * xx + yy * yy >= r * r || ((xx + yy) & 1)) continue;
          g.fillRect(x + xx, y + yy, 1, 1);
        }
        g.fillStyle(UI.hex('shot1'), last ? 0.6 : 0.9);
        for (var k = 0; k < 9; k++) {      // bubbles: a few brighter blobs that move with the phase
          var h = G.hash32(q.id * 31 + k, ph), bx = (h % (2 * r - 6)) - r + 3, by = ((h >>> 8) % (2 * r - 6)) - r + 3;
          if (bx * bx + by * by < (r - 3) * (r - 3)) g.fillRect(x + bx, y + by, 2, 2);
        }
        g.fillStyle(UI.hex(ph & 1 ? 'shot1' : 'shot2'), 1);
        pts = G.ellipsePixels(r, r);
        for (j = 0; j < pts.length; j += 2) g.fillRect(x + pts[j], y + pts[j + 1], 1, 1);
      }
    },

    // Boss burst: every lane of the coming volley is a band on the floor, from the boss to the first wall (at most LANE px).
    // A dim dithered strip 7 px wide shows where the shots will fly; a bright core runs outward and reaches the end when they fire.
    // The second volley (half a step round) gets the same while the boss waits for it. Drawn on the ground layer, under every sprite.
    drawLanes: function (g, q, tick) {
      var D = q.def, sim = this.sim, rate = q.enraged ? D.enrageRate : 1, second = q.st === 'burst', LANE = 150;
      var nb = D.burstShots + (q.enraged ? 4 : 0), a0 = q.ba + (second ? Math.PI / nb : 0), gap = D.burstGap * rate;
      var f = Math.max(0, Math.min(1, second ? 1 - (q.t - gap) / gap : 1 - q.t / (D.burstWindup * rate)));
      var from = q.r + 5, lanes = [], j, k, w, pass;
      for (j = 0; j < nb; j++) {
        var a = a0 + j / nb * 6.283, cx = Math.cos(a), cy = Math.sin(a), len = LANE;
        for (k = from; k < LANE; k += 4) if (sim.boxHits(q.x + cx * k, q.y + cy * k, 2)) { len = k; break; }
        lanes.push({ cx: cx, cy: cy, len: len, head: from + f * (len - from) });
      }
      // pass 0: the dim strip beyond the head, 1: the lit strip behind it, 2: the dim core, 3: the bright core
      for (pass = 0; pass < 4; pass++) {
        if (pass === 0) g.fillStyle(UI.hex('em1'), 0.9);
        else if (pass === 1) g.fillStyle(UI.hex('em2'), 0.85);
        else if (pass === 2) g.fillStyle(UI.hex('em2'), 1);
        else g.fillStyle(UI.hex((tick >> 2) % 2 ? 'em4' : 'em3'), 1);
        for (j = 0; j < nb; j++) {
          var l = lanes[j];
          for (k = from; k < l.len; k += 2) {
            var lit = k <= l.head, x = q.x + l.cx * k, y = q.y + l.cy * k;
            if ((pass & 1) !== (lit ? 1 : 0)) continue;
            if (pass >= 2) { g.fillRect(Math.round(x), Math.round(y), lit ? 2 : 1, lit ? 2 : 1); continue; }
            for (w = -3; w <= 3; w++) if (w && (((k >> 1) + w) & 1)) g.fillRect(Math.round(x - l.cy * w), Math.round(y + l.cx * w), 1, 1);
          }
        }
      }
    }
  });

  // Attack pose frame (2, 3 or 4) while a monster winds up or is about to touch the hero, else 0 (walk cycle).
  // View only: reads the sim, never changes it.
  G.attackPose = function (m, p) {
    var st = m.st, ai = m.def.ai;
    if (m.def.boss) return st === 'slam' ? 2 : st === 'burstWind' || st === 'burst' ? 4 : st === 'chargeWind' || st === 'charge' ? 3 : 0;
    if (ai === 'dummy') return 0;
    if (ai === 'lunge') return st === 'wind' || st === 'lunge' ? 2 : 0;
    if (ai === 'ranged' || ai === 'elite' || ai === 'caster') return m.wind > 0 ? 2 : 0;
    var dx = p.x - m.x, dy = p.y - m.y, reach = m.r + p.r + 10;
    return dx * dx + dy * dy < reach * reach ? 2 : 0;
  };

  // QA snapshot: what a test needs to know about the running game, in one call
  G.qa.state = function () {
    var gs = G.gameScene, sim = gs && gs.sim, out = { screen: G.screen, ready: !!G.ready, view: G.view, errors: G.qa.errors.slice(), panel: G.Panels ? G.Panels.current : null, city: G.city ? G.city.snapshot() : null };
    if (sim) {
      var p = sim.player;
      out.sim = { state: sim.state, room: sim.roomIndex, phase: sim.phase, tick: sim.tick, hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level,
        gold: sim.gold, scrolls: sim.scrolls, merchant: !!sim.merchant, canTalk: sim.canTalk(), cage: sim.cage ? { x: sim.cage.x, y: sim.cage.y } : null, canFree: sim.canFree(), roomClear: sim.roomClear(), cageAt: sim.cageAt, kills: sim.kills, rooms: sim.roomsCleared, stuck: +sim.stuckSeconds().toFixed(1), worstStuck: +gs.worstStuck.toFixed(1),
        monsters: sim.monsters.length, bag: sim.bag.length, kept: sim.gear.bag.length, mod: sim.mod, doors: sim.doors.slice(), result: sim.result, gearScore: G.gearScore(sim.gear), hash: sim.room.hash,
        daily: sim.daily ? { date: sim.daily.date, seed: sim.daily.seed, cls: sim.daily.cls, score: G.dailyScore(sim).total, share: G.dailyShare ? G.dailyShare(sim) : null } : null,
        objective: sim.objective(), objectiveText: G.t(sim.objective()), test: sim.testRoom >= 0, loops: sim.loops, touch: !!G.touch, fissures: sim.fissures.map(function (f) { return f.state; }), x: Math.round(p.x), y: Math.round(p.y) };
    }
    return out;
  };
})(globalThis.G = globalThis.G || {});
