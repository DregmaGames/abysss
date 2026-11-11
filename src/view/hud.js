// HUD scene. By default the screen shows only: HP, level, current objective, fissure
// progress and the inventory button. Touch controls appear only after a touch. Panels open on top.
(function (G) {
  var UI = G.UI;

  G.HudScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function HudScene() { Phaser.Scene.call(this, { key: 'hud' }); },

    create: function () {
      var self = this;
      G.hud = this;
      this.game_ = G.gameScene;
      this.L = null; this.level = null; this.toastT = 0; this.toastMsg = null; this.pickCard = -1; this.SL = null;
      this.botWait = 0; this.endT = -1; this.stickId = null; this.choiceL = null;
      this.build();
      this.game.events.on('viewchange', this.onView, this);

      var kb = this.input.keyboard;
      kb.on('keydown-I', function () { self.toggleInventory(); });
      kb.on('keydown-F2', function (e) { if (e && e.preventDefault) e.preventDefault(); self.toggleDebug(); });
      kb.on('keydown-TAB', function (e) { e.preventDefault(); self.toggleInventory(); });
      kb.on('keydown-ESC', function () {
        if (self.level && self.pickCard >= 0) { self.pickCard = -1; self.openLevel(); }      // slot picker: back to the cards
        else if (G.Panels.isOpen()) G.Panels.close(); else if (!self.level && !self.choiceL) G.Panels.openSettings(self);
      });
      ['ONE', 'TWO', 'THREE'].forEach(function (k, i) { kb.on('keydown-' + k, function () { self.pickLevel(i); }); });

      // touch: a floating stick on the left 60 % of the screen
      this.input.on('pointerdown', function (p, over) {
        if (p.wasTouch && !G.touch) { G.touch = true; self.build(); }
        if (!G.touch || over.length || G.paused || self.level || self.choiceL || self.stickId != null) return;
        var S = G.view.S;
        if (p.x / S > G.view.W * 0.6) return;
        self.stickId = p.id; self.stickX = p.x / S; self.stickY = p.y / S;
        self.stickBase.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
        self.stickKnob.setPosition(Math.round(self.stickX), Math.round(self.stickY)).setVisible(true);
      });
      this.input.on('pointermove', function (p) {
        if (p.id !== self.stickId) return;
        var S = G.view.S, dx = p.x / S - self.stickX, dy = p.y / S - self.stickY, l = Math.sqrt(dx * dx + dy * dy) || 1, m = Math.min(l, 18);
        self.stickKnob.setPosition(Math.round(self.stickX + dx / l * m), Math.round(self.stickY + dy / l * m));
        var v = self.game_.controls.virtual;
        if (l < 5) { v.mx = 0; v.my = 0; } else { v.mx = dx / l; v.my = dy / l; }
      });
      var release = function (p) { if (p.id === self.stickId) self.dropStick(); };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);

      this.events.once('shutdown', function () {
        self.game.events.off('viewchange', self.onView, self);
        G.hud = null; G.Panels.close(true); G.paused = false;
      });
    },

    dropStick: function () {
      this.stickId = null;
      if (this.stickBase) { this.stickBase.setVisible(false); this.stickKnob.setVisible(false); }
      var v = this.game_.controls.virtual; v.mx = 0; v.my = 0;
    },

    onView: function () {
      this.build();
      if (this.level) this.openLevel();
      if (this.choiceL) this.openChoice();
      G.Panels.relayout(this);
    },

    // ---------------------------------------------------------------- layout
    build: function () {
      var self = this, V = G.view, X = UI.PAD, Y = UI.PAD;
      UI.camera(this);
      if (this.L) this.L.destroy();
      if (this.SL) { this.SL.destroy(); this.SL = null; }
      var L = this.L = UI.layer(this, 100);
      this.last = {};
      var vg = this.add.image(0, 0, UI.vignette(this)).setOrigin(0, 0);
      vg._dz = -50; L.add(vg);

      // HP + level (top-left)
      L.panel(X, Y, 86, 27, 'plate');
      L.image(X + 8, Y + 9, 'heart');
      L.bar(X + 15, Y + 4, 66, 9, 'hp_d');
      this.hpFill = L.bar(X + 15, Y + 4, 66, 9, 'hp', 1.5);
      this.hpText = L.text(X + 17, Y + 5, '');
      this.lvText = L.text(X + 5, Y + 17, '', 'ui_warn');
      L.bar(X + 37, Y + 19, 44, 3, 'xp_d');
      this.xpFill = L.bar(X + 37, Y + 19, 44, 3, 'xp', 1.5);

      // inventory button (top-right)
      this.invBtn = L.button(V.W - X - 26, Y, 26, 26, '', function () { self.toggleInventory(); }, { icon: 'i_bag', name: 'inv' });
      // the sealed bag: only the item count, tinted with the best rarity (bottom-right of the button)
      this.invBadge = L.text(V.W - X - 4, Y + 18, '', 'ui_dim').setVisible(false);
      this.invBadge._dz = 4; this.invBadge.setDepth(L.depth + 4);

      // objective + fissure progress: top-centre, or a second row when the screen is narrow
      var free = V.W - (86 + X * 2) - (26 + X * 2);
      this.obj = free >= 150 ? { x: X + 86 + X, y: Y, w: free } : { x: X, y: Y + 30, w: V.W - X * 2 };
      // debug button (cheats for testing): under the inventory button, below the objective row if that wraps
      if (G.debug) L.button(V.W - X - 26, (this.obj.y === Y ? Y : this.obj.y) + 30, 26, 14, 'DBG', function () { self.toggleDebug(); }, { name: 'dbg' });
      this.objPlate = L.panel(0, this.obj.y, 100, 27, 'plate');
      this.objText = L.text(0, this.obj.y + 5, '');
      this.roomText = L.text(0, this.obj.y + 16, '', 'ui_dim');
      this.pips = [];
      this.superBarBg = L.bar(0, this.obj.y + 18, 72, 4, 'hp_d');
      this.superBar = L.bar(0, this.obj.y + 18, 72, 4, 'em2', 1.5);

      // transient toast (pickups, bag full): fades out, not part of the resting HUD
      this.toast = L.text(0, V.H - 30, '').setVisible(false);
      this.ptr = L.image(0, 0, 'pips_open').setVisible(false);
      if (this.toastMsg && this.toastT > 0) this.say(this.toastMsg[0], this.toastMsg[1], true);

      // touch controls: only once a touch has been seen (or ?touch=1)
      this.stickBase = L.image(0, 0, 'stick_base').setVisible(false);
      this.stickKnob = L.image(0, 0, 'stick_knob', 3).setVisible(false);
      this.stickId = null;
      this.tDodge = this.tPulse = null;
      if (G.touch) {
        var mk = function (x, y, icon, fn, name) {
          var b = L.image(x, y, 'tbtn'); L.image(x, y, icon, 3);
          b.setInteractive({ useHandCursor: true });
          b.on('pointerdown', fn);
          UI.hit(name, x - 15, y - 15, 30, 30);
          return b;
        };
        this.tPulse = mk(V.W - 24, V.H - 60, 't_pulse', function () { if (!G.paused) self.game_.controls.pulse(); }, 'tpulse');
        this.tDodge = mk(V.W - 58, V.H - 26, 't_dodge', function () { if (!G.paused) self.game_.controls.dodge(); }, 'tdodge');
      }
      this.refresh();
    },

    toggleDebug: function () {
      if (!G.debug || this.level) return;
      if (G.Panels.current === 'debug') { G.Panels.close(); return; }
      var st = this.game_.sim.state;
      if (st === 'dead' || st === 'won' || st === 'left' || st === 'choice') return;
      this.dropStick();
      G.Panels.openDebug(this);
    },

    toggleInventory: function () {
      if (this.level || this.choiceL) return;
      if (G.Panels.isOpen()) { G.Panels.close(); return; }
      var st = this.game_.sim.state;
      if (st === 'dead' || st === 'won' || st === 'left') return;
      this.dropStick();
      G.Panels.openInventory(this);
    },

    say: function (text, color, keep) {
      this.toast.setText(text).setTint(UI.hex(color || 'ui_text')).setVisible(true).setAlpha(1);
      UI.centerX(this.toast, G.view.W / 2);
      this.toastMsg = [text, color];
      if (!keep) this.toastT = 150;
    },

    onEvent: function (e) {
      if (e.t === 'pickup') {
        if (!e.item) this.say('Ability tome', 'tome2');      // gear goes into the sealed bag: the counter shows it
      } else if (e.t === 'msg') this.say(e.text, 'ui_bad');
      else if (e.t === 'levelup') this.openLevel();
      else if (e.t === 'famTier' && e.tier > e.prev) this.say(this.game_.sim.B.families[e.fam].name + ' bonus ' + (e.tier === 2 ? 4 : 2) + '!', 'ui_good');
      else if (e.t === 'choice') this.openChoice();
      else if (e.t === 'dead' || e.t === 'won' || e.t === 'left') { this.endT = 50; G.storeSave(G.save); }      // the bag was banked (or, on death, the worn gear kept): save it now
      else if (e.t === 'equip') G.storeSave(G.save);
      else if (e.t === 'room') { this.last = {}; G.storeSave(G.save); }
    },

    // ------------------------------------------------- after a room: leave or a door
    // Shown when sim.state is 'choice'. Door cards state the fissure modifier and the loot bonus it pays.
    openChoice: function () {
      var sim = this.game_.sim, self = this, B = sim.B, V = G.view, i;
      if (this.choiceL) this.choiceL.destroy();
      this.choiceL = null;
      if (sim.state !== 'choice') return;
      if (G.Panels.isOpen()) G.Panels.close(true);
      this.dropStick();
      G.screen = 'choice'; G.paused = true;
      this.botWait = this.game_.speed > 4 ? 1 : 60;
      var n = sim.doors.length, row = V.W >= 300, gap = 6, mw = row ? Math.min(V.W - 8, 330) : Math.min(V.W - 8, 264), inner = mw - 16;
      var cw = row ? Math.floor((inner - gap * (n - 1)) / n) : inner, ch = 0, lines = [];
      for (i = 0; i < n; i++) {      // measure the cards: tallest one sets the height
        var fx = G.doorEffects(B, sim.doors[i]), h = 24, tmp = UI.text(this, 0, 0, fx.join('\n'), 'ui_text').setMaxWidth(cw - 10);
        h += tmp.height + 4; tmp.destroy(); lines.push(fx); ch = Math.max(ch, h);
      }
      var cardsH = row ? ch : n * ch + (n - 1) * 4, mh = 20 + 22 + cardsH + 8 + 20 + (row ? 14 : 24);
      var m = this.choiceL = UI.modal(this, mw, mh, 'ROOM ' + (sim.roomIndex + 1) + ' CLEARED'), x0 = m.x + 8, y = m.y + 18;
      var best = G.bestRarity(sim.bag), cnt = sim.bag.length;
      m.text(x0, y + 1, 'Sealed bag: ' + cnt + (cnt === 1 ? ' item' : ' items'), 'ui_text');
      if (best >= 0) { var bt = m.text(0, y + 1, 'best: ' + UI.RARITY_NAME[best], UI.RARITY[best]); bt.x = x0 + inner - bt.width; }
      y += 14;
      for (i = 0; i < n; i++) {
        (function (k) {
          var id = sim.doors[k], def = B.doors.mods[id], cx = row ? x0 + k * (cw + gap) : x0, cy = row ? y : y + k * (ch + 4);
          var card = m.button(cx, cy, cw, ch, '', function () { self.pickDoor(k); }, { name: 'door_' + k });
          void card;
          m.text(cx + 5, cy + 4, def.name, 'ui_warn');
          var kt = m.text(0, cy + 4, '' + (k + 1), 'ui_dim'); kt.x = cx + cw - 5 - kt.width;
          var t = m.text(cx + 5, cy + 15, lines[k].join('\n'), 'ui_text').setMaxWidth(cw - 10);
          m.text(cx + 5, cy + 15 + t.height + 3, '+' + Math.round(def.loot * 100) + '% loot', 'ui_good');
        })(i);
      }
      y += cardsH + 8;
      m.button(x0, y, inner, 18, 'LEAVE WITH THE BAG', function () { self.pickDoor(n); }, { name: 'leave', color: 'ui_good' });
      m.text(x0, y + 22, 'Leaving or winning keeps the bag. Dying loses it.', 'ui_dim').setMaxWidth(inner);
    },
    // i < number of doors: take that door; i === doors.length (the 3rd key with two doors): leave
    pickDoor: function (i) {
      var sim = this.game_.sim;
      if (!this.choiceL || sim.state !== 'choice') return;
      var leave = i >= sim.doors.length;
      if (!leave && !sim.doors[i]) return;
      this.choiceL.destroy(); this.choiceL = null;
      G.screen = 'game'; G.paused = false;
      if (leave) sim.leave(); else sim.takeDoor(i);
    },

    // ------------------------------------------------------- level-up choice
    openLevel: function () {
      var sim = this.game_.sim, self = this, B = sim.B, V = G.view;
      if (this.level) this.level.destroy();
      if (sim.state !== 'levelup') { this.level = null; return; }
      if (G.Panels.isOpen()) G.Panels.close();
      this.dropStick();
      this.openAbilityLevel(); this.botWait = this.game_.speed > 4 ? 1 : 30; G.screen = 'levelup';
    },
    pickLevel: function (i) {
      var sim = this.game_.sim;
      if (sim.state === 'choice') { this.pickDoor(i); return; }      // keys 1, 2: doors; 3: leave
      if (!this.level || sim.state !== 'levelup') return;
      if (this.pickCard >= 0) { if (i < 3) this.applyAbility(this.pickCard, i); return; }     // slot picker: i is the slot
      if (!sim.choices[i]) return;
      if (sim.needsSlot(i)) { this.pickCard = i; this.openLevel(); return; }                 // open the slot picker
      this.applyAbility(i, 0);
    },
    applyAbility: function (i, slot) {
      var sim = this.game_.sim;
      if (!this.level || sim.state !== 'levelup' || !sim.choices[i]) return;
      this.level.destroy(); this.level = null; this.pickCard = -1;
      G.screen = 'game';
      sim.chooseAbility(i, slot);      // may emit another 'levelup', handled next frame
    },

    // ability level-up (spec section 9): cards with family and bonus progress, the slots, the families,
    // and the slot picker when a new active needs a slot
    openAbilityLevel: function () {
      var sim = this.game_.sim, self = this, B = sim.B, V = G.view, p = sim.player, i, k;
      var n = sim.choices.length, row = V.W >= 300, gap = 6, counts = G.familyCounts(p.abil, B);
      if (this.pickCard >= 0 && !sim.needsSlot(this.pickCard)) this.pickCard = -1;
      var picking = this.pickCard >= 0;
      var cw = row ? Math.min(150, Math.floor((V.W - 24 - gap * (n - 1)) / n)) : Math.min(V.W - 24, 254);
      var mw = row ? n * cw + (n - 1) * gap + 16 : cw + 16, inner = mw - 16;
      var title = sim.choiceTome ? 'ABILITY TOME' : 'LEVEL ' + p.level;
      var FAMS = Object.keys(B.families).filter(function (f) { return counts[f]; });

      // one text, or only its size when `measure` (a throwaway object)
      function T(m, measure, str, x, y, color, maxW) {
        var t = UI.text(self, x, y, str, color);
        if (maxW) t.setMaxWidth(maxW);
        if (measure) { var r = { width: t.width, height: t.height }; t.destroy(); return r; }
        t._dz = 2; m.add(t);
        return t;
      }
      function pips(m, x, y, count, fam) {
        for (var j = 0; j < 4; j++) {
          var thr = j === 1 || j === 3;
          m.bar(x + j * 9, y, 7, 7, thr ? 'ui_warn' : 'ui_line', 2);
          m.bar(x + j * 9 + 1, y + 1, 5, 5, j < count ? B.families[fam].icon : 'ui_bg', 2.2);
        }
      }
      // the bonus a family reaches when its count goes from `a` to `b` (text or null)
      function bonusText(fam, a, b) {
        var t1 = G.famTier(a, B), t2 = G.famTier(b, B), F = B.families[fam];
        if (t2 > t1) return (t2 === 2 ? F.t4.desc : F.t2.desc);
        return null;
      }
      // a card: returns its height. x/y: top-left.
      function card(m, measure, i, cx, cy) {
        var id = sim.choices[i], own = p.abil[id] || 0, info = G.abilityInfo(id, B, own + 1, sim.clsId), F = B.families[info.fam];
        var after = (counts[info.fam] || 0) + (own ? 0 : 1), x0 = cx + 5, wt = cw - 10, y = cy + 4, t, need = sim.needsSlot(i);
        if (!measure) {
          m.image(cx + 11, cy + 10, 'fam_' + info.fam);
          T(m, false, info.name, cx + 20, cy + 4, G.ABILITY_COLOR[info.rarity], cw - 36);
          T(m, false, '' + (i + 1), cx + cw - 8, cy + 4, 'ui_dim');
        }
        y = cy + 17;
        var kind = info.type === 'active' ? 'ACTIVE' : 'PASSIVE';
        t = T(m, measure, kind, x0, y, 'ui_text');
        if (!measure) T(m, false, info.famName, x0 + t.width + 6, y, F.text);
        if (!measure) { var rt = T(m, false, own ? 'Rank ' + info.rank + '/' + info.max : 'NEW', 0, y, own ? 'ui_dim' : 'ui_good'); rt.x = cx + cw - 5 - rt.width; }
        y += 11;
        t = T(m, measure, info.desc, x0, y, 'ui_text', wt);
        y += t.height + 4;
        if (!measure) {
          pips(m, x0, y, after, info.fam);
          T(m, false, after + '/4', x0 + 38, y, 'ui_dim');
        }
        y += 10;
        var bt = bonusText(info.fam, counts[info.fam] || 0, after);
        if (bt) { t = T(m, measure, bt, x0, y, 'ui_good', wt); y += t.height + 2; }
        if (need) { T(m, measure, 'Replaces a slot', x0, y, 'ui_warn'); y += 10; }
        return y + 3 - cy;
      }
      // the slots and the families the player owns: returns its height
      function strip(m, measure, x0, y0) {
        var y = y0, bw = Math.floor((inner - 8) / 3), j;
        T(m, measure, 'ACTIVE SLOTS', x0, y, 'ui_dim'); y += 10;
        for (j = 0; j < 3; j++) {
          var sx = x0 + j * (bw + 4), id = p.slots[j];
          if (!measure) {
            m.panel(sx, y, bw, 22, 'inset', 1);
            if (id) {
              var d = B.abilities[id];
              m.image(sx + 9, y + 11, 'fam_' + d.fam);
              T(m, false, d.name, sx + 18, y + 3, G.ABILITY_COLOR[d.rarity], bw - 20);
              T(m, false, 'Rank ' + p.abil[id] + '/' + d.max, sx + 18, y + 12, 'ui_dim');
            } else { m.image(sx + 9, y + 11, 'slot').setAlpha(0.5); T(m, false, 'Empty', sx + 18, y + 7, 'ui_dim'); }
          }
        }
        y += 26;
        if (FAMS.length) {
          T(m, measure, 'FAMILIES', x0, y, 'ui_dim'); y += 10;
          var per = Math.max(1, Math.floor(inner / 56));
          FAMS.forEach(function (f, j) {
            var fx = x0 + (j % per) * 56, fy = y + Math.floor(j / per) * 13;
            if (!measure) { m.image(fx + 6, fy + 6, 'fam_' + f); pips(m, fx + 14, fy + 1, counts[f], f); }
          });
          y += Math.ceil(FAMS.length / per) * 13;
        }
        return y - y0;
      }

      var m, mh, x0;
      if (!picking) {
        var ch = 0;
        for (i = 0; i < n; i++) ch = Math.max(ch, card(null, true, i, 0, 0));
        var sh = strip(null, true, 0, 0);
        mh = 40 + (row ? ch : n * (ch + gap) - gap) + 8 + sh + 6;
        m = this.level = UI.modal(this, mw, mh, null);
        x0 = m.x + 8;
        UI.centerX(m.text(0, m.y + 7, title, 'ui_warn', true), V.W / 2);
        UI.centerX(m.text(0, m.y + 26, 'Choose one', 'ui_dim'), V.W / 2);
        sim.choices.forEach(function (id, i) {
          var cx = row ? x0 + i * (cw + gap) : x0, cy = row ? m.y + 40 : m.y + 40 + i * (ch + gap);
          var bg = m.panel(cx, cy, cw, ch, 'btn', 1);
          card(m, false, i, cx, cy);
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', function () { bg.setFrame('btn_hot'); });
          bg.on('pointerout', function () { bg.setFrame('btn'); });
          bg.on('pointerdown', function () { self.pickLevel(i); });
          UI.hit('card_' + i, cx, cy, cw, ch);
        });
        strip(m, false, x0, m.y + 40 + (row ? ch : n * (ch + gap) - gap) + 8);
      } else {
        // slot picker: which active does the new one replace?
        var cid = sim.choices[this.pickCard], cd = B.abilities[cid];
        var sbh = 44;
        mh = 36 + 24 + 3 * (sbh + 4) + 26 + 8;
        m = this.level = UI.modal(this, mw, mh, null);
        x0 = m.x + 8;
        UI.centerX(m.text(0, m.y + 7, 'Replace which active?', 'ui_warn', true), V.W / 2);
        m.image(x0 + 6, m.y + 31, 'fam_' + cd.fam);
        m.text(x0 + 16, m.y + 27, cd.name, G.ABILITY_COLOR[cd.rarity]);
        var nt = m.text(0, m.y + 27, 'NEW', 'ui_good'); nt.x = x0 + inner - nt.width;
        m.text(x0, m.y + 40, 'It replaces one of your actives. The old one loses all its ranks.', 'ui_dim').setMaxWidth(inner);
        for (k = 0; k < 3; k++) {
          (function (k) {
            var id = p.slots[k], d = B.abilities[id], sy = m.y + 62 + k * (sbh + 4);
            var bg = m.panel(x0, sy, inner, sbh, 'btn', 1);
            m.image(x0 + 11, sy + 11, 'fam_' + d.fam);
            m.text(x0 + 22, sy + 5, d.name, G.ABILITY_COLOR[d.rarity]);
            m.text(x0 + 22, sy + 16, 'Rank ' + p.abil[id] + '/' + d.max + '  ' + B.families[d.fam].name, 'ui_dim');
            m.text(x0 + inner - 12, sy + 5, '' + (k + 1), 'ui_dim');
            // a family drops a tier when this slot goes (net of the new active's own family)
            var net = Object.assign({}, counts); net[d.fam]--; net[cd.fam] = (net[cd.fam] || 0) + 1;
            var loss = null;
            Object.keys(B.families).forEach(function (f) {
              var a = G.famTier(counts[f] || 0, B), b = G.famTier(net[f] || 0, B);
              if (b < a && !loss) {
                var bn = a === 2 ? B.families[f].t4.desc.split(':')[0] : B.families[f].t2.desc;
                loss = B.families[f].name + ' ' + (counts[f] || 0) + ' -> ' + (net[f] || 0) + ': loses ' + bn;
              }
            });
            if (loss) m.text(x0 + 6, sy + 27, loss, 'ui_bad').setMaxWidth(inner - 12);
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerover', function () { bg.setFrame('btn_hot'); });
            bg.on('pointerout', function () { bg.setFrame('btn'); });
            bg.on('pointerdown', function () { self.pickLevel(k); });
            UI.hit('slot_' + k, x0, sy, inner, sbh);
          })(k);
        }
        var by = m.y + 62 + 3 * (sbh + 4);
        m.button(x0, by, inner, 18, 'BACK', function () { self.pickCard = -1; self.openLevel(); }, { name: 'slot_back' });
      }
    },

    // the 3 active slots in play: small family icons with rank pips, bottom centre
    drawSlots: function () {
      if (this.SL) this.SL.destroy();
      this.SL = null;
      var sim = this.game_.sim;
      var V = G.view, B = sim.B, p = sim.player, SL = this.SL = UI.layer(this, 100), x0 = Math.round((V.W - 57) / 2), y0 = V.H - 24, j, r;
      for (j = 0; j < 3; j++) {
        var id = p.slots[j], x = x0 + j * 20;
        SL.panel(x, y0, 17, 17, 'plate');
        if (!id) continue;
        var d = B.abilities[id];
        SL.image(x + 8.5, y0 + 8.5, 'fam_' + d.fam);
        for (r = 0; r < d.max; r++) SL.bar(x + 1 + r * 5, y0 + 18, 4, 2, r < p.abil[id] ? B.families[d.fam].icon : 'ui_line', 2);
      }
    },

    // --------------------------------------------------------------- refresh
    refresh: function () {
      var sim = this.game_.sim, p = sim.player, L = this.last, X = UI.PAD, i, O = this.obj;
      var hp = Math.ceil(p.hp), key = hp + '/' + p.maxHp;
      if (L.hp !== key) {
        L.hp = key;
        this.hpFill.setDisplaySize(Math.max(0.01, Math.round(66 * Math.max(0, p.hp) / p.maxHp)), 9);
        this.hpText.setText(key);
        UI.centerX(this.hpText, X + 15 + 33);
      }
      var sk = p.slots.map(function (id) { return id ? id + p.abil[id] : '-'; }).join(',') + '|' + G.view.W + 'x' + G.view.H;
      if (L.slots !== sk) { L.slots = sk; this.drawSlots(); }
      if (L.lv !== p.level) { L.lv = p.level; this.lvText.setText('LV ' + p.level); }
      var xp = Math.round(44 * Math.min(1, p.exp / p.expNext));
      if (L.xp !== xp) { L.xp = xp; this.xpFill.setDisplaySize(Math.max(0.01, xp), 3); }

      var bagKey = sim.bag.length + '/' + G.bestRarity(sim.bag);
      if (L.bag !== bagKey) {
        L.bag = bagKey;
        var bb = G.bestRarity(sim.bag);
        this.invBadge.setVisible(sim.bag.length > 0).setText('' + sim.bag.length).setTint(UI.hex(bb >= 0 ? UI.RARITY[bb] : 'ui_dim'));
        this.invBadge.x = G.view.W - X - 4 - this.invBadge.width;
      }
      var fp = sim.fissureProgress(), obj = sim.objective();
      var okey = obj + '|' + fp.states.join(',') + '|' + sim.phase + '|' + sim.roomIndex + '|' + sim.loops + '|' + sim.mod;
      if (L.obj !== okey) {
        L.obj = okey;
        this.objText.setText(obj);
        var showBar = sim.phase === 'super', n = fp.total + 1, pipsW = fp.total * 8 + 10, rowW = showBar ? 72 : pipsW;
        var room = sim.testRoom >= 0 ? 'Test #' + (sim.loops + 1) : 'Room ' + (sim.roomIndex + 1) + '/' + sim.B.run.rooms + (sim.mod ? ' ' + sim.B.doors.mods[sim.mod].name : '');
        this.roomText.setText(room);
        var w = Math.min(O.w, Math.max(this.objText.width, rowW + this.roomText.width + 8) + 14), x0 = O.x + Math.round((O.w - w) / 2);
        // centre on the screen when the free area allows it
        var mid = Math.round((G.view.W - w) / 2);
        if (mid >= O.x && mid + w <= O.x + O.w) x0 = mid;
        this.objPlate.setPosition(x0, O.y).setSize(w, 27);
        UI.centerX(this.objText, x0 + w / 2);
        var total = rowW + 8 + this.roomText.width, px = x0 + Math.round((w - total) / 2);
        this.roomText.setPosition(px + rowW + 8, O.y + 16);
        while (this.pips.length < n) this.pips.push(this.L.image(0, 0, 'pip_wait').setOrigin(0, 0));
        for (i = 0; i < this.pips.length; i++) {
          var pip = this.pips[i], st = fp.states[i];
          pip.setVisible(i < n && !showBar);
          if (i >= n) continue;
          var tag = st === 'scar' ? 'done' : (st === 'dormant' ? 'wait' : 'open');
          pip.setFrame((i === n - 1 ? 'pips_' : 'pip_') + tag).setPosition(px + i * 8, O.y + (i === n - 1 ? 15 : 16));
        }
        this.superBarBg.setVisible(showBar).setPosition(px, O.y + 18);
        this.superBar.setVisible(showBar).setPosition(px, O.y + 18);
      }
      if (sim.phase === 'super') this.superBar.setDisplaySize(Math.max(0.01, Math.round(72 * sim.superProgress())), 4);
      this.updatePointer();
      if (this.tPulse) this.tPulse.setAlpha(p.pulseCd > 0 ? 0.35 : 1);
      if (this.tDodge) this.tDodge.setAlpha(p.dodgeCd > 0 ? 0.35 : 1);
    },

    // objective pointer: a blinking marker on the screen edge, only while the objective is off-screen
    updatePointer: function () {
      var gs = this.game_, t = gs.sim.objectiveTarget(), V = G.view, wv = gs.cameras.main.worldView;
      if (!t || gs.sim.state !== 'play') { this.ptr.setVisible(false); return; }
      var x = t.x - wv.x, y = t.y - wv.y, top = this.obj.y + 34, m = 12;
      if (x >= m && x <= V.W - m && y >= top && y <= V.H - m) { this.ptr.setVisible(false); return; }
      var cx = V.W / 2, cy = (top + V.H - m) / 2, dx = x - cx, dy = y - cy;
      var k = Math.min(dx ? (dx > 0 ? V.W - m - cx : cx - m) / Math.abs(dx) : 1e9, dy ? (dy > 0 ? V.H - m - cy : cy - top) / Math.abs(dy) : 1e9);
      this.ptr.setFrame(t.kind === 'chest' ? 'pip_done' : (t.kind === 'exit' ? 'pips_done' : 'pips_open'));
      this.ptr.setPosition(Math.round(cx + dx * k), Math.round(cy + dy * k)).setVisible((gs.frame >> 4) % 4 !== 0);
    },

    update: function () {
      var gs = this.game_, sim = gs.sim;
      this.refresh();
      if (this.toastT > 0) {
        this.toastT--;
        if (this.toastT < 30) this.toast.setAlpha(this.toastT < 15 ? 0.4 : 0.7);
        if (this.toastT === 0) this.toast.setVisible(false);
      }
      if (sim.state === 'levelup' && !this.level) this.openLevel();
      if (sim.state === 'choice' && !this.choiceL) this.openChoice();
      if (this.choiceL && gs.bot && !G.manualLevel && --this.botWait <= 0) { var ch = gs.bot.afterRoom(); this.pickDoor(ch < 0 ? sim.doors.length : ch); }
      if (this.level && gs.bot && !G.manualLevel && --this.botWait <= 0) {
        var pk = gs.bot.pickAbility(); this.applyAbility(pk.i, pk.slot);
      }
      if (this.endT > 0 && --this.endT === 0) G.Panels.openResult(this, sim.state);
    }
  });
})(globalThis.G = globalThis.G || {});
