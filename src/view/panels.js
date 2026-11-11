// Panels: equipment screen (7 slots + bag + item details), settings (zoom and shake sliders),
// and the end-of-run result. They are built in whichever UI scene opens them (title or HUD),
// pause the run while open, and are rebuilt on resize so they fit both orientations.
(function (G) {
  var UI = G.UI;
  // paper-doll layout on a 3x3 grid
  var DOLL = { helmet: [1, 0], weapon: [0, 1], armor: [1, 1], shield: [2, 1], gloves: [0, 2], belt: [1, 2], boots: [2, 2] };
  var P = G.Panels = { current: null, L: null, scene: null, sel: null, resultState: null };

  P.isOpen = function () { return !!P.current; };
  P.close = function (silent) {
    if (P.L) P.L.destroy();
    P.L = null; P.current = null;
    if (!silent) { G.paused = false; if (G.screen !== 'title') G.screen = 'game'; }
    G.storeSave(G.save);
  };
  P.relayout = function (scene) {
    if (!P.current) return;
    var c = P.current;
    if (P.L) P.L.destroy();
    P.L = null; P.current = null;
    if (c === 'inventory') P.openInventory(scene, true);
    else if (c === 'settings') P.openSettings(scene, P.back);
    else if (c === 'result') P.openResult(scene, P.resultState);
    else if (c === 'debug') P.openDebug(scene);
    else if (c === 'abilities') P.openAbilities(scene);
  };
  function sim() { return G.gameScene && G.screen !== 'title' ? G.gameScene.sim : null; }
  function gear() { var s = sim(); return s ? s.gear : G.gearOf(G.save, G.cls); }
  function fmt(v, d) { return d ? v.toFixed(d) : '' + Math.round(v); }
  function statText(k, v) { var lab = G.STAT_LABEL[k]; return '+' + (k === 'regen' ? v.toFixed(1) : v) + lab[1] + ' ' + lab[0]; }

  // ------------------------------------------------------------ abilities
  // The hero's abilities in this run: the active slots (rank, what it does), the passives, and the family progress.
  P.openAbilities = function (scene) {
    if (P.L) P.L.destroy();
    var s = sim();
    if (!s) { P.openInventory(scene); return; }
    var V = G.view, B = s.B, p = s.player, wide = V.W >= 300, C = s.cls, wt = (G.weaponOf(C, s.gear) || {}).id;
    P.current = 'abilities'; P.scene = scene; G.paused = true; G.screen = 'inventory';
    var pw = wide ? Math.min(V.W - 8, 340) : Math.min(V.W - 8, 264), ph = Math.min(V.H - 8, wide ? 262 : 400);
    var L = P.L = UI.modal(scene, pw, ph, 'ABILITIES'), x0 = L.x + 8, y = L.y + 20, inner = pw - 16, i;
    L.button(L.x + pw - 22, L.y + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'abil_close' });
    L.button(L.x + pw - 70, L.y + 3, 44, 16, 'BACK', function () { P.openInventory(scene); }, { name: 'abil_back' });
    var counts = G.familyCounts(p.abil, B);

    L.text(x0, y, 'ACTIVE', 'ui_dim'); y += 10;
    for (i = 0; i < B.abilityRules.slots; i++) {
      var id = p.slots[i];
      if (!id) { L.panel(x0, y, inner, 24, 'inset', 1); L.image(x0 + 12, y + 12, 'slot', 2).setAlpha(0.5); L.text(x0 + 24, y + 8, 'Empty slot', 'ui_dim'); y += 26; continue; }
      var info = G.abilityInfo(id, B, p.abil[id], s.clsId, wt), F = B.families[info.fam];
      var dt = L.text(x0 + 24, y + 13, info.desc, 'ui_text').setMaxWidth(inner - 30), rh = Math.max(24, dt.height + 16);
      L.panel(x0, y, inner, rh, 'inset', 1);
      L.image(x0 + 12, y + rh / 2, 'fam_' + info.fam, 2);
      L.text(x0 + 24, y + 3, info.name, G.ABILITY_COLOR[info.rarity]);
      for (var r = 0; r < info.max; r++) L.bar(x0 + inner - 5 - (info.max - r) * 7, y + 4, 5, 3, r < info.rank ? F.icon : 'ui_line', 3);
      y += rh + 2;
    }
    y += 3;
    var pas = Object.keys(p.abil).filter(function (k) { return B.abilities[k].type === 'passive'; });
    L.text(x0, y, 'PASSIVE', 'ui_dim'); y += 10;
    if (!pas.length) { L.text(x0, y, 'None yet', 'ui_dim'); y += 10; }
    var cols = wide ? 3 : 1, cw = Math.floor(inner / cols);
    pas.forEach(function (k, j) {
      var pi = G.abilityInfo(k, B, p.abil[k], s.clsId, wt), px = x0 + (j % cols) * cw, py = y + Math.floor(j / cols) * 10;
      L.image(px + 4, py + 4, 'fam_' + pi.fam, 2).setScale(0.5);
      var nm = L.text(px + 10, py, pi.name + ' ' + pi.rank + '/' + pi.max, G.ABILITY_COLOR[pi.rarity]);
      if (!wide) { var t = L.text(0, py, pi.desc, 'ui_dim'); t.x = x0 + inner - t.width; if (t.x < px + 14 + nm.width) t.setVisible(false); }
    });
    y += Math.ceil(pas.length / cols) * 10 + 3;

    L.text(x0, y, 'FAMILIES', 'ui_dim'); y += 10;
    var fams = Object.keys(B.families).filter(function (f) { return counts[f]; });
    if (!fams.length) L.text(x0, y, 'None yet', 'ui_dim');
    fams.forEach(function (f) {
      var F = B.families[f], n = counts[f], tier = G.famTier(n, B);
      L.image(x0 + 6, y + 5, 'fam_' + f, 2);
      L.text(x0 + 14, y + 1, F.name, F.text);
      for (var j = 0; j < 4; j++) {
        var thr = j === 1 || j === 3;
        L.bar(x0 + 54 + j * 9, y, 7, 7, thr ? 'ui_warn' : 'ui_line', 2);
        L.bar(x0 + 55 + j * 9, y + 1, 5, 5, j < n ? F.icon : 'ui_bg', 2.2);
      }
      var t4 = wide ? F.t4.desc.split(':')[0] : F.t4.desc, bonus = tier >= 2 ? t4 : (tier === 1 ? F.t2.desc : 'next at 2: ' + F.t2.desc);
      var bt = L.text(x0 + 94, y + 1, bonus, tier ? 'ui_good' : 'ui_dim').setMaxWidth(inner - 96);
      y += Math.max(13, bt.height + 4);
    });
  };

  // ------------------------------------------------------------- inventory
  P.openInventory = function (scene, keepSel) {
    if (P.L) P.L.destroy();
    var V = G.view, g = gear(), B = G.BAL, s = sim(), wide = V.W >= 300;
    P.current = 'inventory'; P.scene = scene; G.paused = true;
    if (G.screen !== 'title') G.screen = 'inventory';
    if (!keepSel) P.sel = null;
    var pw = wide ? Math.min(V.W - 8, 340) : Math.min(V.W - 8, 264), ph = wide ? Math.min(V.H - 8, 200) : Math.min(V.H - 8, 340);
    var L = P.L = UI.modal(scene, pw, ph, s ? 'GEAR' : 'EQUIPMENT');
    var x0 = L.x, y0 = L.y;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'inv_close' });
    L.button(x0 + pw - 44, y0 + 3, 18, 16, '', function () { P.openSettings(scene, 'inventory'); }, { icon: 'i_gear', name: 'inv_settings' });
    if (s) L.button(x0 + pw - 116, y0 + 3, 68, 16, 'ABILITIES', function () { P.openAbilities(scene); }, { name: 'inv_abil' });

    var passives = s ? s.player.abil : {}, cls = s ? s.clsId : G.cls;
    var stats = G.computeStats(B, g, passives, cls), base = G.computeStats(B, { equipped: {} }, passives, cls);
    function select(sel) {
      // tapping the selected thing again acts on it (equip / unequip)
      if (P.sel && sel && P.sel.kind === sel.kind && P.sel.key === sel.key) { act(); return; }
      P.sel = sel; P.openInventory(scene, true);
    }
    function act() {
      var sl = P.sel;
      if (!sl) return;
      if (s) { if (sl.kind === 'sbag' && s.equipFromSealed(sl.key)) { P.sel = null; P.openInventory(scene, true); } return; }   // in a run: equip from the sealed bag only
      if (sl.kind === 'bag') G.equipFromBag(g, sl.key, B, cls); else G.unequip(g, sl.key, B);
      P.sel = null; G.storeSave(G.save); P.openInventory(scene, true);
    }
    function cell(x, y, item, slotKey, sel, name) {
      var bg = L.image(x + 10, y + 10, item ? 'rar_' + item.rarity : 'slot', 1);
      var ic = L.image(x + 10, y + 10, (item ? G.itemIcon(item) : 'i_' + (slotKey || 'bag')), 2);
      if (!item) { ic.setAlpha(slotKey ? 0.22 : 0); }
      if (P.sel && P.sel.kind === sel.kind && P.sel.key === sel.key) L.image(x + 10, y + 10, 'select', 3);
      if (item || slotKey) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', function () { if (item) select(sel); });
      }
      UI.hit(name, x, y, 20, 20);
    }
    // the 7 equipment slots
    var dx = x0 + 8, dy = y0 + 20, k;
    for (k in DOLL) cell(dx + DOLL[k][0] * 22, dy + DOLL[k][1] * 22, g.equipped[k], k, { kind: 'slot', key: k }, 'slot_' + k);

    // character stats (totals; green when gear is adding to them)
    var gsc = G.gearScore(g), rows = [['Gear', '' + gsc, gsc > 0], ['HP', fmt(stats.maxHp), stats.maxHp > base.maxHp], ['Armor', fmt(stats.armor), stats.armor > base.armor],
      ['Damage', fmt(stats.dmg, 1), stats.dmg > base.dmg], ['Atk/s', fmt(1 / stats.atkInterval, 2), stats.atkInterval < base.atkInterval],
      ['Crit', fmt(stats.crit * 100) + '%', stats.crit > base.crit], ['Move', fmt(stats.speed), stats.speed > base.speed],
      ['Range', fmt(stats.range), stats.range > base.range], [G.classDef(B, cls).skill.name, fmt(stats.pulseDmg), stats.pulseDmg > base.pulseDmg],
      ['Regen', fmt(stats.regen, 1) + '/s', stats.regen > base.regen]];
    var sx = wide ? x0 + 8 : x0 + 8 + 72, sy = wide ? dy + 70 : dy, sw = wide ? 66 : pw - 88, maxRows = wide ? Math.floor((ph - 96) / 10) : 7;
    if (!wide) sy -= 2;
    rows.slice(0, maxRows).forEach(function (r, i) {
      L.text(sx, sy + i * 10, r[0], 'ui_dim');
      var t = L.text(0, sy + i * 10, r[1], r[2] ? 'ui_good' : 'ui_text');
      t.x = sx + sw - t.width;
    });

    // bag
    var bx = wide ? x0 + 82 : x0 + 8, by = wide ? y0 + 20 : dy + 72;
    var cols = wide ? 5 : Math.max(5, Math.min(10, Math.floor((pw - 14) / 22))), rowsN = s ? 2 : Math.ceil(B.loot.stashSize / cols), i;
    if (s) {      // in a run: the sealed bag of this run, shown as a grid
      var sb = B.loot.bagSize, bi = G.bestRarity(s.bag);
      L.text(bx, by, 'SEALED BAG OF THIS RUN ' + s.bag.length + '/' + sb, 'ui_dim').setMaxWidth(wide ? cols * 22 : pw - 16);
      for (i = 0; i < sb; i++) cell(bx + (i % cols) * 22, by + 11 + Math.floor(i / cols) * 22, s.bag[i], null, { kind: 'sbag', key: i }, 'sbag_' + i);
      rowsN = Math.ceil(sb / cols);
    } else {
      L.text(bx, by, 'BAG ' + g.bag.length + '/' + B.loot.stashSize, 'ui_dim');
      for (i = 0; i < B.loot.stashSize; i++) cell(bx + (i % cols) * 22, by + 11 + Math.floor(i / cols) * 22, g.bag[i], null, { kind: 'bag', key: i }, 'bag_' + i);
    }

    // item details
    var ix = wide ? bx + cols * 22 + 6 : x0 + 8, iy = wide ? y0 + 20 : by + 11 + rowsN * 22 + 4, iw = x0 + pw - 8 - ix, ih = y0 + ph - 6 - iy;
    L.panel(ix, iy, iw, ih, 'inset', 1);
    var sl = P.sel, isBag = sl && (sl.kind === 'bag' || sl.kind === 'sbag'), item = sl ? (sl.kind === 'bag' ? g.bag[sl.key] : sl.kind === 'sbag' ? s.bag[sl.key] : g.equipped[sl.key]) : null;
    if (!item) {
      P.sel = null;
      L.text(ix + 5, iy + 5, s ? 'Tap an item for its stats. Tap it again to equip.' : (wide ? 'Tap an item to see its stats. Tap it again to equip.' : 'Tap an item for its stats. Tap again to equip.'), 'ui_dim').setMaxWidth(iw - 10);
    } else {
      var col = UI.RARITY[item.rarity], ty = iy + 5;
      var nm = L.text(ix + 5, ty, item.name, col).setMaxWidth(iw - 10); ty += nm.height + 3;
      var foreign = G.foreignClass(item, B, cls);
      L.text(ix + 5, ty, UI.RARITY_NAME[item.rarity] + ' ' + (item.wtype ? item.wtype.charAt(0).toUpperCase() + item.wtype.slice(1) : G.SLOT_NAME[item.slot]), col); ty += 10;
      if (foreign) { L.text(ix + 5, ty, foreign + ' weapon', 'ui_warn'); ty += 10; }
      L.text(ix + 5, ty, 'Item level ' + item.ilvl, 'ui_dim'); ty += 12;
      // each stat, and the change against what is equipped in that slot
      var cur = isBag ? g.equipped[item.slot] : null;
      G.STAT_ORDER.forEach(function (st) {
        var v = item.stats[st], c = cur ? cur.stats[st] || 0 : 0;
        if (v == null && !(isBag && c)) return;
        if (ty > iy + ih - 34) return;
        var line = L.text(ix + 5, ty, v != null ? statText(st, v) : G.STAT_LABEL[st][0], v != null ? 'ui_text' : 'ui_dim');
        if (isBag && cur) {
          var d = Math.round(((v || 0) - c) * 10) / 10;
          if (d) { var dt = L.text(0, ty, (d > 0 ? '+' : '') + d, d > 0 ? 'ui_good' : 'ui_bad'); dt.x = ix + iw - 5 - dt.width; if (dt.x < line.x + line.width + 3) dt.setVisible(false); }
        }
        ty += 10;
      });
      var bw = Math.floor((iw - 14) / 2), byy = iy + ih - 22;
      if (s) {      // in a run: equip from the sealed bag (own-class weapons), or drop from it
        if (sl.kind === 'sbag') {
          var better2 = !cur || G.itemValue(item, B) > G.itemValue(cur, B);
          L.button(ix + 5, byy, bw, 18, 'EQUIP', act, { name: 'equip', color: better2 ? 'ui_good' : 'ui_text' }).setEnabled(!foreign);
          L.button(ix + 9 + bw, byy, bw, 18, 'DROP', function () { s.dropSealed(sl.key); P.sel = null; P.openInventory(scene, true); }, { name: 'drop' });
        }
      }
      else if (sl.kind === 'bag') {
        var better = !cur || G.itemValue(item, B) > G.itemValue(cur, B);
        L.button(ix + 5, byy, bw, 18, 'EQUIP', act, { name: 'equip', color: better ? 'ui_good' : 'ui_text' }).setEnabled(!foreign);
        L.button(ix + 9 + bw, byy, bw, 18, 'DROP', function () { G.dropFromBag(g, sl.key); P.sel = null; G.storeSave(G.save); P.openInventory(scene, true); }, { name: 'drop' });
      } else {
        L.button(ix + 5, byy, Math.max(bw, 52), 18, 'UNEQUIP', act, { name: 'unequip' }).setEnabled(g.bag.length < B.loot.stashSize);
      }
    }
  };

  // -------------------------------------------------------------- settings
  P.openSettings = function (scene, back) {
    if (P.L) P.L.destroy();
    var V = G.view, set = G.save.settings, inRun = !!sim();
    P.current = 'settings'; P.scene = scene; P.back = back || null; G.paused = true;
    if (G.screen !== 'title') G.screen = 'settings';
    var pw = Math.min(V.W - 8, 190), ph = 132;
    var L = P.L = UI.modal(scene, pw, ph, 'SETTINGS'), x0 = L.x, y0 = L.y, sw = pw - 78;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { leave(); }, { icon: 'i_close', name: 'set_close' });
    function leave() { if (P.back === 'inventory') P.openInventory(scene); else P.close(); }

    // zoom: integer pixel scale for the whole game (art and UI together)
    L.text(x0 + 8, y0 + 28, 'Zoom');
    var zt = L.text(x0 + pw - 30, y0 + 28, V.S + 'x', 'ui_warn');
    UI.slider(L, x0 + 44, y0 + 24, sw - 8, V.steps, Math.min(set.zoom, V.steps - 1), function (k) {
      set.zoom = k; G.storeSave(G.save);
      scene.time.delayedCall(1, function () { G.applyView(); });       // rebuilds this panel at the new scale
    }, 'zoom');
    if (V.steps === 1) L.text(x0 + 8, y0 + 40, 'Screen too small to zoom in.', 'ui_dim');
    else L.text(x0 + 8, y0 + 40, 'Bigger pixels, closer view.', 'ui_dim');

    // screen shake: 0..100 % of a capped amplitude
    L.text(x0 + 8, y0 + 62, 'Shake');
    var st = L.text(x0 + pw - 30, y0 + 62, set.shake + '%', 'ui_warn');
    UI.slider(L, x0 + 44, y0 + 58, sw - 8, 11, Math.round(set.shake / 10), function (k) {
      set.shake = k * 10; st.setText(set.shake + '%'); G.storeSave(G.save);
      if (G.gameScene && inRun) G.gameScene.fx.shake(0.6);
    }, 'shake');
    L.text(x0 + 8, y0 + 74, 'Set to 0% to turn shake off.', 'ui_dim');

    var bw = Math.floor((pw - 22) / 2);
    L.button(x0 + 8, y0 + ph - 26, bw, 18, inRun ? 'RESUME' : 'CLOSE', leave, { name: 'set_resume' });
    if (inRun) L.button(x0 + 14 + bw, y0 + ph - 26, bw, 18, 'QUIT RUN', function () { P.close(true); G.toTitle(); }, { name: 'set_quit', color: 'ui_bad' });
    else L.button(x0 + 14 + bw, y0 + ph - 26, bw, 18, 'RESET SAVE', function () {
      var keep = G.save.settings; G.save = G.newSave(); G.save.settings = keep; G.storeSave(G.save); P.close(true); G.toTitle();
    }, { name: 'set_reset', color: 'ui_bad' });
    void zt;
  };

  // ----------------------------------------------------------------- debug
  // Cheats to test fast. Toggles stay on for the browser session; actions apply at once.
  P.openDebug = function (scene) {
    if (P.L) P.L.destroy();
    var V = G.view, s = sim(), C = G.cheats, gs = G.gameScene;
    if (!s) return;
    P.current = 'debug'; P.scene = scene; G.paused = true; G.screen = 'debug';
    var pw = Math.min(V.W - 8, 204), rows = 7, ph = 30 + rows * 21 + 6;
    var L = P.L = UI.modal(scene, pw, ph, 'DEBUG'), x0 = L.x, y0 = L.y, bw = Math.floor((pw - 22) / 2);
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'dbg_close' });
    function reopen() { P.openDebug(scene); }
    function act(fn) { return function () { fn(); P.close(); }; }
    var B = [
      ['GOD ' + (C.god ? 'ON' : 'OFF'), function () { C.god = !C.god; reopen(); }, 'dbg_god', C.god],
      ['NO CD ' + (C.noCd ? 'ON' : 'OFF'), function () { C.noCd = !C.noCd; reopen(); }, 'dbg_nocd', C.noCd],
      ['SPEED x' + gs.speed, function () {
        var next = { 1: 2, 2: 4, 4: 8 }[gs.speed] || 1;
        gs.speed = C.speed = next; gs.fx.quiet = next > 4; reopen();
      }, 'dbg_speed', gs.speed > 1],
      ['KILL ALL', act(function () { s.cheatKillAll(); }), 'dbg_kill'],
      ['SKIP PHASE', act(function () { s.cheatSkipPhase(); }), 'dbg_skip'],
      ['LEVEL UP', act(function () { s.cheatLevel(); }), 'dbg_level'],
      s.testRoom >= 0 ? ['RESTART ROOM', act(function () { s.restartTestRoom(); }), 'dbg_next']
        : ['NEXT ROOM', act(function () { s.cheatRoom(s.roomIndex + 1); }), 'dbg_next'],
      ['BOSS ROOM', act(function () { s.cheatRoom(s.B.run.rooms - 1); }), 'dbg_boss'],
      ['GIVE LOOT', act(function () { s.cheatLoot(); }), 'dbg_loot'],
      ['DOORS', act(function () { s.cheatChoice(); }), 'dbg_doors'],
      ['ABILITIES', act(function () { s.cheatAbilities(s.defaultActives()); }), 'dbg_abil'],
      ['RESUME', function () { P.close(); }, 'dbg_resume']
    ];
    B.forEach(function (b, i) {
      var bx = x0 + 8 + (i % 2) * (bw + 6), by = y0 + 24 + Math.floor(i / 2) * 21;
      L.button(bx, by, bw, 18, b[0], b[1], { name: b[2], color: b[3] ? 'ui_good' : 'ui_text' });
    });
    L.text(x0 + 8, y0 + ph - 15, 'Room ' + (s.roomIndex + 1) + '  ' + s.phase + '  seed ' + s.seed, 'ui_dim');
  };

  // ---------------------------------------------------------------- result
  P.openResult = function (scene, state) {
    if (P.L) P.L.destroy();
    var V = G.view, s = G.gameScene.sim, B = s.B, won = state === 'won', left = state === 'left', R = s.result || { items: 0, kept: 0, lost: 0, best: -1 };
    if ((P.resultState !== state || !P.counted) && s.testRoom < 0) {      // test-room deaths are not runs
      P.counted = true;
      G.save.stats.runs++; if (won) G.save.stats.wins++;
      G.save.stats.best = Math.max(G.save.stats.best || 0, s.roomsCleared);
      G.storeSave(G.save);
    }
    P.current = 'result'; P.scene = scene; P.resultState = state; G.paused = true; G.screen = 'result';
    G.gameScene.ended = true;
    var pw = Math.min(V.W - 8, 230), ph = 144;
    var L = P.L = UI.modal(scene, pw, ph, null), x0 = L.x, y0 = L.y, cx = V.W / 2;
    UI.centerX(L.text(0, y0 + 9, won ? 'RIFT SEALED' : (left ? 'YOU LEFT' : 'YOU DIED'), won ? 'ui_good' : (left ? 'ui_warn' : 'ui_bad'), true), cx);
    var t = Math.round(s.tick / 60), gs = G.gearScore(s.gear), lines = [
      [won ? 'All ' + B.run.rooms + ' rooms cleared' : left ? 'Left after room ' + (s.roomIndex + 1) + ' of ' + B.run.rooms : s.testRoom >= 0 ? 'Fell in the test room (clears: ' + s.loops + ')' : 'Fell in room ' + (s.roomIndex + 1) + ' of ' + B.run.rooms, 'ui_text'],
      ['Level ' + s.player.level + '   Kills ' + s.kills + '   ' + Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2), 'ui_dim'],
      state === 'dead' ? [R.items ? 'The bag was lost: ' + R.items + (R.items === 1 ? ' item' : ' items') + (B.run.deathKeepsEquipped ? '  (worn gear kept)' : '  (worn gear lost)') : 'The bag was empty', R.items ? 'ui_bad' : 'ui_dim']
        : [R.kept + (R.kept === 1 ? ' item' : ' items') + ' kept in your bag' + (R.lost ? ', ' + R.lost + ' lost (bag full)' : ''), 'ui_good'],
      ['Gear score ' + gs, 'ui_dim']];
    var next = B.run.tierGear[s.tier + 1];
    if (next != null) lines.push(gs >= next ? ['Tier ' + (s.tier + 2) + ' unlocked: harder rifts, better loot', 'ui_warn'] : ['Tier ' + (s.tier + 2) + ' needs gear score ' + next, 'ui_dim']);
    lines.forEach(function (l, i) { UI.centerX(L.text(0, y0 + 34 + i * 12, l[0], l[1]).setMaxWidth(pw - 12), cx); });
    var bw = Math.floor((pw - 28) / 3);
    L.button(x0 + 8, y0 + ph - 28, bw, 20, 'AGAIN', function () { P.counted = false; P.close(true); G.restartRun(); }, { name: 'res_again', color: 'ui_good' });
    L.button(x0 + 14 + bw, y0 + ph - 28, bw, 20, 'GEAR', function () { P.counted = false; P.close(true); G.toTitle(true); }, { name: 'res_gear' });
    L.button(x0 + 20 + bw * 2, y0 + ph - 28, bw, 20, 'TITLE', function () { P.counted = false; P.close(true); G.toTitle(); }, { name: 'res_title' });
  };

  G.restartRun = function () {
    var g = G.game.scene;
    G.runSeed = (G.runSeed + 1) >>> 0;
    G.paused = false;
    g.stop('hud'); g.stop('game'); g.start('game');
  };
  G.toTitle = function (openGear) {
    var g = G.game.scene;
    G.paused = false; G.openGearOnTitle = !!openGear;
    g.stop('hud'); g.stop('game'); g.start('title');
  };
})(globalThis.G = globalThis.G || {});
