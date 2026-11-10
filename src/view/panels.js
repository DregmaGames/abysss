// Panels: equipment screen (10 slots + bag), settings (zoom, shake), run result.
// One panel at a time; opening one pauses the run. Works from the HUD and from the title.
(function (G) {
  var UI = G.UI;
  var EQ_POS = { weapon: [0, 0], helmet: [1, 0], amulet: [2, 0], shield: [0, 1], armor: [1, 1], ring1: [2, 1],
    gloves: [0, 2], belt: [1, 2], ring2: [2, 2], boots: [1, 3] };
  var P = G.Panels = { m: null, kind: null, scene: null, sel: null, hits: {} };

  P.isOpen = function () { return !!P.m; };
  // The result panel only closes through its own buttons (force), so Esc / I cannot strand a finished run.
  P.close = function (force) {
    if (!P.m || (P.kind === 'result' && !force)) return;
    if (P.off) { P.off(); P.off = null; }
    P.m.destroy(); P.m = null; P.kind = null; P.hits = {};
    G.paused = false;
    G.screen = G.gameScene && G.hud ? 'game' : 'title';
    if (P.scene && P.scene.refresh && !G.hud) P.scene.refresh();
  };
  function begin(scene, kind) {
    if (P.m && P.kind === 'result' && kind !== 'result') return false;
    if (P.m) { if (P.off) { P.off(); P.off = null; } P.m.destroy(); P.m = null; }
    P.scene = scene; P.kind = kind; P.hits = {};
    G.paused = true; G.screen = kind;
    return true;
  }
  function sim() { return G.gameScene && G.hud ? G.gameScene.sim : null; }
  function hit(name, x, y) { P.hits[name] = { x: x * UI.S, y: y * UI.S }; }   // logical 960x540 coords, for QA clicks

  // ------------------------------------------------------------- equipment
  function statLine(k, v) { var L = G.STAT_LABEL[k]; return (k === 'cdrPct' ? '-' : '+') + v + L[1] + ' ' + L[0]; }

  P.openInventory = function (scene) { if (begin(scene, 'inventory')) P.drawInventory(); };

  P.drawInventory = function () {
    var scene = P.scene, gear = G.save.gear, B = G.BAL, s = sim();
    if (P.m) P.m.destroy();
    P.hits = {};
    var m = P.m = UI.modal(scene, 304, 164, 'EQUIPMENT');
    m.button(214, 3, 62, 14, 'SETTINGS', function () { P.openSettings(P.scene, 'inventory'); }); hit('settings', m.x + 245, m.y + 10);
    m.button(280, 3, 20, 14, 'X', function () { P.close(); });
    hit('close', m.x + 290, m.y + 10);

    function cell(x, y, item, ghost, selected, name, onClick) {
      var bg = scene.add.image(m.x + x, m.y + y, 'atlas', 'slot').setOrigin(0, 0);
      m.c.add(bg);
      if (item) {
        m.c.add(scene.add.image(m.x + x + 10, m.y + y + 10, 'atlas', 'i_' + item.slot));
        m.c.add(scene.add.image(m.x + x, m.y + y, 'atlas', 'rar_' + item.rarity).setOrigin(0, 0));
      } else if (ghost) m.c.add(scene.add.image(m.x + x + 10, m.y + y + 10, 'atlas', 'i_' + ghost).setAlpha(0.2));
      if (selected) m.c.add(scene.add.image(m.x + x - 1, m.y + y - 1, 'atlas', 'select').setOrigin(0, 0));
      bg.setInteractive({ useHandCursor: !!item });
      bg.on('pointerdown', onClick);
      hit(name, m.x + x + 10, m.y + y + 10);
    }

    // resolve the selection against current gear (items move when equipped)
    var selItem = null, selWhere = null, selIdx = -1, k, i;
    if (P.sel != null) {
      for (k in gear.equipped) if (gear.equipped[k] && gear.equipped[k].id === P.sel) { selItem = gear.equipped[k]; selWhere = k; }
      for (i = 0; i < gear.bag.length; i++) if (gear.bag[i].id === P.sel) { selItem = gear.bag[i]; selWhere = 'bag'; selIdx = i; }
      if (!selItem) P.sel = null;
    }

    Object.keys(EQ_POS).forEach(function (key) {
      var it = gear.equipped[key], pos = EQ_POS[key];
      cell(8 + pos[0] * 21, 19 + pos[1] * 21, it, key.replace(/[12]$/, ''), it && it.id === P.sel, 'eq_' + key, function () {
        if (!it) return;
        if (P.sel === it.id) P.act('unequip'); else { P.sel = it.id; P.drawInventory(); }
      });
    });
    m.text(84, 9, 'BAG ' + gear.bag.length + '/' + B.loot.bagSize, 'ui_dim');
    for (i = 0; i < B.loot.bagSize; i++) {
      (function (idx) {
        var it = gear.bag[idx];
        cell(84 + (idx % 5) * 21, 19 + Math.floor(idx / 5) * 21, it, null, it && it.id === P.sel, 'bag_' + idx, function () {
          if (!it) return;
          if (P.sel === it.id) P.act('equip'); else { P.sel = it.id; P.drawInventory(); }
        });
      })(i);
    }

    // details
    m.c.add(UI.panel(scene, m.x + 198, m.y + 19, 100, 139, 'plate'));
    if (selItem) {
      var col = UI.RARITY[selItem.rarity], y = 23;
      var nm = m.text(203, y, selItem.name, col); nm.setMaxWidth(92);
      y += nm.height > 12 ? 21 : 11;
      m.text(203, y, UI.RARITY_NAME[selItem.rarity] + ' ' + G.SLOT_NAME[selItem.slot], 'ui_dim'); y += 10;
      m.text(203, y, 'Level ' + selItem.ilvl + '   Power ' + selItem.power, 'ui_dim'); y += 12;
      G.STAT_ORDER.forEach(function (sk) {
        if (selItem.stats[sk] == null) return;
        m.text(203, y, statLine(sk, selItem.stats[sk]), 'ui_text'); y += 10;
      });
      if (selWhere === 'bag') {
        var cur = gear.equipped[G.targetSlot(gear, selItem, B)];
        var d = cur ? G.itemValue(selItem, B) - G.itemValue(cur, B) : 1;
        m.text(203, 127, cur ? (d > 0.01 ? 'Better than equipped' : (d < -0.01 ? 'Weaker than equipped' : 'Same as equipped')) : 'Slot is empty',
          d > 0.01 ? 'ui_good' : (d < -0.01 ? 'ui_bad' : 'ui_dim'));
        m.button(202, 138, 46, 16, 'EQUIP', function () { P.act('equip'); }); hit('equip', m.x + 225, m.y + 146);
        m.button(250, 138, 44, 16, 'DROP', function () { P.act('drop'); }); hit('drop', m.x + 272, m.y + 146);
      } else {
        m.text(203, 127, 'Equipped: ' + G.SLOT_NAME[selWhere], 'ui_good');
        var ub = m.button(202, 138, 92, 16, 'UNEQUIP', function () { P.act('unequip'); }); hit('unequip', m.x + 248, m.y + 146);
        ub.setEnabled(gear.bag.length < B.loot.bagSize);
      }
    } else {
      var hint = m.text(203, 26, 'Click an item to see its stats. Click it again to equip or unequip.', 'ui_dim');
      hint.setMaxWidth(90);
    }

    // character stats: totals, with the part that comes from gear in green
    var st = s ? s.stats : G.computeStats(B, gear, null), g = G.gearStats(gear);
    var rows = [
      ['Max HP', '' + st.maxHp, g.hp ? '+' + g.hp : ''],
      ['Armor', '' + st.armor, g.armor ? '+' + g.armor : ''],
      ['Damage', st.dmg.toFixed(1), g.dmgPct ? '+' + g.dmgPct + '%' : ''],
      ['Atk/s', (1 / st.atkInterval).toFixed(2), g.atkPct ? '+' + g.atkPct + '%' : ''],
      ['Crit', Math.round(st.crit * 100) + '%', g.crit ? '+' + g.crit + '%' : ''],
      ['Move', '' + Math.round(st.speed), g.movePct ? '+' + g.movePct + '%' : ''],
      ['Range', '' + Math.round(st.range), g.rangePct ? '+' + g.rangePct + '%' : ''],
      ['Pulse', '' + Math.round(st.pulseDmg), g.pulsePct ? '+' + g.pulsePct + '%' : ''],
      ['Pulse cd', st.pulseCd.toFixed(1) + 's', g.cdrPct ? '-' + g.cdrPct + '%' : ''],
      ['Regen', st.regen.toFixed(1) + '/s', g.regen ? '+' + g.regen.toFixed(1) : '']
    ];
    if (g.expPct) rows[9] = ['EXP', Math.round(st.expMult * 100) + '%', '+' + g.expPct + '%'];
    m.text(8, 106, 'STATS', 'ui_warn');
    m.text(40, 106, 'Gear score ' + G.gearScore(gear) + '   green = from gear', 'ui_dim');
    rows.forEach(function (r, idx) {
      var cx = 8 + Math.floor(idx / 5) * 88, cy = 116 + (idx % 5) * 9;
      var a = m.text(cx, cy, r[0], 'ui_dim'), b = m.text(cx, cy, r[1], 'ui_text');
      b.x = a.x + 44;
      if (r[2]) { var c = m.text(cx, cy, r[2], 'ui_good'); c.x = b.x + b.width + 4; }
    });
  };

  P.act = function (what) {
    var gear = G.save.gear, B = G.BAL, s = sim(), i, idx = -1, key = null;
    for (i = 0; i < gear.bag.length; i++) if (gear.bag[i].id === P.sel) idx = i;
    for (var k in gear.equipped) if (gear.equipped[k] && gear.equipped[k].id === P.sel) key = k;
    if (what === 'equip' && idx >= 0) G.equipFromBag(gear, idx, B);
    else if (what === 'unequip' && key) G.unequip(gear, key, B);
    else if (what === 'drop' && idx >= 0) { G.dropFromBag(gear, idx); P.sel = null; }
    else return;
    if (s) s.recalc();                    // stats change immediately
    G.storeSave(G.save);
    P.drawInventory();
  };

  // --------------------------------------------------------------- settings
  P.openSettings = function (scene, back) {
    if (!begin(scene, 'settings')) return;
    var m = P.m = UI.modal(scene, 210, 124, 'SETTINGS'), set = G.save.settings, inRun = !!sim();
    var handlers = [];
    function slider(y, name, label, min, max, step, get, put, fmt) {
      var tx = 96, tw = 80;
      m.text(10, y + 2, label, 'ui_text');
      var track = scene.add.image(m.x + tx, m.y + y + 5, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(tw, 2).setTint(UI.hex('ui_line'));
      var zone = scene.add.image(m.x + tx - 6, m.y + y - 3, 'atlas', 'px').setOrigin(0, 0).setDisplaySize(tw + 12, 18).setAlpha(0.001);
      var knob = UI.panel(scene, 0, m.y + y - 1, 8, 14, 'btn_hot');
      var val = UI.text(scene, m.x + tx + tw + 6, m.y + y + 2, '', 'ui_warn');
      m.c.add([track, zone, knob, val]);
      function place() { var v = get(); knob.x = m.x + tx + Math.round((v - min) / (max - min) * tw) - 4; val.setText(fmt(v)); }
      function setFrom(px) {
        var f = Math.max(0, Math.min(1, (px - (m.x + tx)) / tw));
        put(Math.round((min + f * (max - min)) / step) * step);
        place(); G.storeSave(G.save);
        if (G.gameScene && G.hud) G.gameScene.applySettings();
      }
      var drag = false;
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', function (p) { drag = true; setFrom(p.worldX); });
      var mv = function (p) { if (drag && p.isDown) setFrom(p.worldX); else drag = false; };
      scene.input.on('pointermove', mv);
      handlers.push(mv);
      place();
      hit(name + '_min', m.x + tx, m.y + y + 6); hit(name + '_max', m.x + tx + tw, m.y + y + 6); hit(name + '_mid', m.x + tx + tw / 2, m.y + y + 6);
    }
    slider(26, 'zoom', 'Zoom', 2, 4, 1, function () { return set.zoom; }, function (v) { set.zoom = v; }, function (v) { return 'x' + v; });
    slider(50, 'shake', 'Screen shake', 0, 100, 10, function () { return set.shake; }, function (v) { set.shake = v; }, function (v) { return v + '%'; });
    var note = m.text(10, 70, 'Zoom x3 keeps world and HUD on one pixel size.', 'ui_dim'); note.setMaxWidth(190);
    m.button(10, 100, 60, 16, 'BACK', function () { if (back === 'inventory') P.openInventory(scene); else P.close(); }); hit('back', m.x + 40, m.y + 108);
    if (inRun) { m.button(140, 100, 60, 16, 'QUIT RUN', function () { P.close(); G.toTitle(); }); hit('quit', m.x + 170, m.y + 108); }
    P.off = function () { handlers.forEach(function (h) { scene.input.off('pointermove', h); }); };
  };

  // ----------------------------------------------------------------- result
  P.openResult = function (scene, state) {
    begin(scene, 'result');
    var s = G.gameScene.sim, won = state === 'won', m = P.m = UI.modal(scene, 230, 136, null), B = G.BAL;
    var head = m.text(0, 9, won ? 'RIFT SEALED' : 'YOU DIED', won ? 'ui_good' : 'ui_bad', true);
    head.x = Math.round((UI.W - head.width) / 2);
    var secs = Math.round(s.tick / 60);
    var lines = [
      ['Seed', G.runSeed + '   Tier ' + (G.tier + 1)],
      ['Rooms cleared', s.roomsCleared + ' / ' + B.run.rooms],
      ['Kills', '' + s.kills],
      ['Level', '' + s.player.level],
      ['Time', Math.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2)],
      ['Gear score', G.gearScore(G.save.gear) + '  (gear is kept)']
    ];
    lines.forEach(function (l, i) { m.text(22, 34 + i * 11, l[0], 'ui_dim'); m.text(104, 34 + i * 11, l[1], 'ui_text'); });
    m.button(10, 110, 66, 18, 'RETRY SEED', function () { P.close(true); G.restartRun(false); }); hit('retry', m.x + 43, m.y + 119);
    m.button(82, 110, 66, 18, 'NEW RUN', function () { P.close(true); G.restartRun(true); }); hit('new', m.x + 115, m.y + 119);
    m.button(154, 110, 66, 18, 'TITLE', function () { P.close(true); G.toTitle(); }); hit('title', m.x + 187, m.y + 119);
    G.save.stats.runs++; if (won) G.save.stats.wins++;
    G.storeSave(G.save);
    G.lastResult = { seed: G.runSeed, tier: G.tier, state: state, rooms: s.roomsCleared, kills: s.kills, level: s.player.level, seconds: secs };
  };

  G.restartRun = function (newSeed) {
    if (newSeed) G.runSeed = Math.floor(Math.random() * 1000000);
    var gs = G.gameScene;
    gs.scene.stop('hud');
    gs.scene.restart();
  };
  G.toTitle = function () {
    var gs = G.gameScene;
    G.storeSave(G.save);
    gs.scene.stop('hud');
    gs.scene.start('title');
  };
})(globalThis.G = globalThis.G || {});
