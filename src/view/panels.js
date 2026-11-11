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
    if (!silent) { G.paused = false; if (G.screen !== 'title' && G.screen !== 'city') G.screen = 'game'; else if (G.screen === 'city') G.screen = 'city'; }
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
    else if (c === 'shop') P.openShop(scene, true);
    else if (c === 'montoto') P.openMontoto(scene, true);
  };
  function sim() { return G.gameScene && G.screen !== 'title' && G.screen !== 'city' ? G.gameScene.sim : null; }
  function gear() { var s = sim(); return s ? s.gear : G.gearOf(G.save, G.cls); }
  function fmt(v, d) { return d ? v.toFixed(d) : '' + Math.round(v); }
  function statText(k, v) { return G.statLine(k, v); }

  // ------------------------------------------------------------ abilities
  // The hero's abilities in this run: the active slots (rank, what it does), the passives, and the family progress.
  P.openAbilities = function (scene) {
    if (P.L) P.L.destroy();
    var s = sim();
    if (!s) { P.openInventory(scene); return; }
    var V = G.view, B = s.B, p = s.player, wide = V.W >= 300, C = s.cls, wt = (G.weaponOf(C, s.gear) || {}).id;
    P.current = 'abilities'; P.scene = scene; G.paused = true; G.screen = 'inventory';
    var pw = wide ? Math.min(V.W - 8, 340) : Math.min(V.W - 8, 264), ph = Math.min(V.H - 8, wide ? 262 : 400);
    var L = P.L = UI.modal(scene, pw, ph, G.t('abil.title')), x0 = L.x + 8, y = L.y + 20, inner = pw - 16, i;
    L.button(L.x + pw - 22, L.y + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'abil_close' });
    L.button(L.x + pw - 70, L.y + 3, 44, 16, G.t('lvl.back'), function () { P.openInventory(scene); }, { name: 'abil_back' });
    var counts = G.familyCounts(p.abil, B);

    L.text(x0, y, G.t('abil.actives'), 'ui_dim'); y += 10;
    for (i = 0; i < B.abilityRules.slots; i++) {
      var id = p.slots[i];
      if (!id) { L.panel(x0, y, inner, 24, 'inset', 1); L.image(x0 + 12, y + 12, 'slot', 2).setAlpha(0.5); L.text(x0 + 24, y + 8, G.t('abil.emptySlot'), 'ui_dim'); y += 26; continue; }
      var info = G.abilityText(id, B, p.abil[id], s.clsId, wt), F = B.families[info.fam];
      var dt = L.text(x0 + 24, y + 13, info.desc, 'ui_text').setMaxWidth(inner - 30), rh = Math.max(24, dt.height + 16);
      L.panel(x0, y, inner, rh, 'inset', 1);
      L.image(x0 + 12, y + rh / 2, 'fam_' + info.fam, 2);
      L.text(x0 + 24, y + 3, info.name, G.ABILITY_COLOR[info.rarity]);
      for (var r = 0; r < info.max; r++) L.bar(x0 + inner - 5 - (info.max - r) * 7, y + 4, 5, 3, r < info.rank ? F.icon : 'ui_line', 3);
      y += rh + 2;
    }
    y += 3;
    var pas = Object.keys(p.abil).filter(function (k) { return B.abilities[k].type === 'passive'; });
    L.text(x0, y, G.t('abil.passives'), 'ui_dim'); y += 10;
    if (!pas.length) { L.text(x0, y, G.t('abil.none'), 'ui_dim'); y += 10; }
    var cols = wide ? 3 : 1, cw = Math.floor(inner / cols);
    pas.forEach(function (k, j) {
      var pi = G.abilityText(k, B, p.abil[k], s.clsId, wt), px = x0 + (j % cols) * cw, py = y + Math.floor(j / cols) * 10;
      L.image(px + 4, py + 4, 'fam_' + pi.fam, 2).setScale(0.5);
      var nm = L.text(px + 10, py, pi.name + ' ' + pi.rank + '/' + pi.max, G.ABILITY_COLOR[pi.rarity]);
      if (!wide) { var t = L.text(0, py, pi.desc, 'ui_dim'); t.x = x0 + inner - t.width; if (t.x < px + 14 + nm.width) t.setVisible(false); }
    });
    y += Math.ceil(pas.length / cols) * 10 + 3;

    L.text(x0, y, G.t('lvl.families'), 'ui_dim'); y += 10;
    var fams = Object.keys(B.families).filter(function (f) { return counts[f]; });
    if (!fams.length) L.text(x0, y, G.t('abil.none'), 'ui_dim');
    fams.forEach(function (f) {
      var F = B.families[f], n = counts[f], tier = G.famTier(n, B);
      L.image(x0 + 6, y + 5, 'fam_' + f, 2);
      L.text(x0 + 14, y + 1, G.famName(f), F.text);
      for (var j = 0; j < 4; j++) {
        var thr = j === 1 || j === 3;
        L.bar(x0 + 54 + j * 9, y, 7, 7, thr ? 'ui_warn' : 'ui_line', 2);
        L.bar(x0 + 55 + j * 9, y + 1, 5, 5, j < n ? F.icon : 'ui_bg', 2.2);
      }
      var t4d = G.t('fam.' + f + '.t4'), t2d = G.t('fam.' + f + '.t2'), t4 = wide ? t4d.split(':')[0] : t4d, bonus = tier >= 2 ? t4 : (tier === 1 ? t2d : G.t('abil.nextAt', { desc: t2d }));
      var bt = L.text(x0 + 94, y + 1, bonus, tier ? 'ui_good' : 'ui_dim').setMaxWidth(inner - 96);
      y += Math.max(13, bt.height + 4);
    });
  };

  // ------------------------------------------------------------- inventory
  P.openInventory = function (scene, keepSel) {
    if (P.L) P.L.destroy();
    var V = G.view, g = gear(), B = G.BAL, s = sim(), wide = V.W >= 300;
    P.current = 'inventory'; P.scene = scene; G.paused = true;
    if (G.screen !== 'title' && G.screen !== 'city') G.screen = 'inventory';
    if (!keepSel) P.sel = null;
    var pw = wide ? Math.min(V.W - 8, 340) : Math.min(V.W - 8, 264), ph = wide ? Math.min(V.H - 8, 200) : Math.min(V.H - 8, 340);
    var L = P.L = UI.modal(scene, pw, ph, G.t(s ? 'inv.gear' : 'inv.equipment'));
    var x0 = L.x, y0 = L.y;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'inv_close' });
    L.button(x0 + pw - 44, y0 + 3, 18, 16, '', function () { P.openSettings(scene, 'inventory'); }, { icon: 'i_gear', name: 'inv_settings' });
    if (s) L.button(x0 + pw - 124, y0 + 3, 76, 16, G.t('abil.title'), function () { P.openAbilities(scene); }, { name: 'inv_abil' });

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
      if (s) {
        if (sl.kind !== 'sbag') return;
        var it0 = s.bag[sl.key];
        if (it0 && it0.unid) return;                // an unidentified item cannot be equipped (IDENTIFY first)
        if (s.equipFromSealed(sl.key)) { P.sel = null; P.openInventory(scene, true); }
        return;
      }   // in a run: equip from the sealed bag only
      if (sl.kind === 'bag') G.equipFromBag(g, sl.key, B, cls); else G.unequip(g, sl.key, B);
      P.sel = null; G.storeSave(G.save); P.openInventory(scene, true);
    }
    function cell(x, y, item, slotKey, sel, name) {
      var bg = L.image(x + 10, y + 10, item ? 'rar_' + item.rarity : 'slot', 1);
      var ic = L.image(x + 10, y + 10, (item ? G.itemIcon(item) : 'i_' + (slotKey || 'bag')), 2);
      if (!item) { ic.setAlpha(slotKey ? 0.22 : 0); }
      else if (item.unid) { ic.setAlpha(0.55); L.image(x + 10, y + 10, 'i_unid', 3); }      // unidentified: a "?" over the icon
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
    var gsc = G.gearScore(g), rows = [[G.t('inv.rowGear'), '' + gsc, gsc > 0], [G.t('inv.rowHp'), fmt(stats.maxHp), stats.maxHp > base.maxHp], [G.t('inv.rowArmor'), fmt(stats.armor), stats.armor > base.armor],
      [G.t('inv.rowDamage'), fmt(stats.dmg, 1), stats.dmg > base.dmg], [G.t('inv.rowAtk'), fmt(1 / stats.atkInterval, 2), stats.atkInterval < base.atkInterval],
      [G.t('inv.rowCrit'), fmt(stats.crit * 100) + '%', stats.crit > base.crit], [G.t('inv.rowMove'), fmt(stats.speed), stats.speed > base.speed],
      [G.t('inv.rowRange'), fmt(stats.range), stats.range > base.range], [G.skillLabel(cls), fmt(stats.pulseDmg), stats.pulseDmg > base.pulseDmg],
      [G.t('inv.rowRegen'), fmt(stats.regen, 1) + '/s', stats.regen > base.regen]];
    var sx = wide ? x0 + 8 : x0 + 8 + 72, sy = wide ? dy + 70 : dy, sw = wide ? 72 : pw - 88, maxRows = wide ? Math.floor((ph - 96) / 10) : 7;
    if (!wide) sy -= 2;
    rows.slice(0, maxRows).forEach(function (r, i) {
      L.text(sx, sy + i * 10, r[0], 'ui_dim');
      var t = L.text(0, sy + i * 10, r[1], r[2] ? 'ui_good' : 'ui_text');
      t.x = sx + sw - t.width;
    });

    // bag
    var bx = wide ? x0 + 82 : x0 + 8, by = wide ? y0 + 20 : dy + 72;
    var cols = wide ? 5 : Math.max(5, Math.min(10, Math.floor((pw - 14) / 22))), rowsN = s ? 2 : Math.ceil(B.loot.stashSize / cols), i;
    var scrollCount = s ? s.scrollsHeld() : 0;
    if (s) {      // in a run: the sealed bag of this run, shown as a grid
      var sb = B.loot.bagSize, bi = G.bestRarity(s.bag);
      var hd = L.text(bx, by, G.t(wide ? 'inv.sealedBag' : 'inv.sealedBagRun', { n: s.bag.length, m: sb }), 'ui_dim');
      for (i = 0; i < sb; i++) cell(bx + (i % cols) * 22, by + 11 + Math.floor(i / cols) * 22, s.bag[i], null, { kind: 'sbag', key: i }, 'sbag_' + i);
      rowsN = Math.ceil(sb / cols);
    } else {
      L.text(bx, by, G.t('inv.bag', { n: g.bag.length, m: B.loot.stashSize }), 'ui_dim');
      scrollCount = g.scrolls | 0;
      for (i = 0; i < B.loot.stashSize; i++) cell(bx + (i % cols) * 22, by + 11 + Math.floor(i / cols) * 22, g.bag[i], null, { kind: 'bag', key: i }, 'bag_' + i);
    }

    // scrolls of Identification: kept ones, plus (in a run) the sealed ones found so far
    var sct = L.text(0, wide ? by + 13 + rowsN * 22 : by, 'x' + scrollCount + (s && s.scrolls ? ' ' + G.t('inv.sealedScrolls', { n: s.scrolls }) : ''), scrollCount ? 'gold' : 'ui_dim');
    if (wide) { sct.x = bx + 12; L.image(sct.x - 7, sct.y + 5, 'i_scroll', 2); }
    else {
      // narrow: the bag title and the scroll count share a line. When they would meet, the title gets its short form, then the count loses its note.
      sct.x = bx + cols * 22 - sct.width;
      if (hd && hd.x + hd.width + 16 > sct.x) hd.setText(G.t('inv.sealedBag', { n: s.bag.length, m: B.loot.bagSize }));
      if (hd && hd.x + hd.width + 16 > sct.x) { sct.setText('x' + scrollCount); sct.x = bx + cols * 22 - sct.width; }
      L.image(sct.x - 8, by + 4, 'i_scroll', 2);
    }
    if (s && wide) L.text(bx, sct.y + 12, G.t('inv.foundNote'), 'ui_dim').setMaxWidth(cols * 22);

    // item details
    var ix = wide ? bx + cols * 22 + 6 : x0 + 8, iy = wide ? y0 + 20 : by + 11 + rowsN * 22 + 4, iw = x0 + pw - 8 - ix, ih = y0 + ph - 6 - iy;
    L.panel(ix, iy, iw, ih, 'inset', 1);
    var sl = P.sel, isBag = sl && (sl.kind === 'bag' || sl.kind === 'sbag'), item = sl ? (sl.kind === 'bag' ? g.bag[sl.key] : sl.kind === 'sbag' ? s.bag[sl.key] : g.equipped[sl.key]) : null;
    if (!item) {
      P.sel = null;
      L.text(ix + 5, iy + 5, G.t(s ? 'inv.tapRun' : (wide ? 'inv.tapWide' : 'inv.tapNarrow')), 'ui_dim').setMaxWidth(iw - 10);
    } else {
      var col = UI.RARITY[item.rarity], ty = iy + 5;
      var nm = L.text(ix + 5, ty, G.itemName(item), col).setMaxWidth(iw - 10); ty += nm.height + 3;
      var foreign = G.foreignClass(item, B, cls);
      L.text(ix + 5, ty, G.itemType(item), col); ty += 10;
      if (foreign) { L.text(ix + 5, ty, G.t('inv.foreign', { cls: G.t('cls.' + G.weaponClass(B, item.wtype)) }), 'ui_warn'); ty += 10; }
      L.text(ix + 5, ty, G.t('inv.itemLevel', { n: item.ilvl }), 'ui_dim'); ty += 12;
      if (item.unid) {
        L.text(ix + 5, ty, G.t('inv.unid'), 'ui_warn'); ty += 10;
        L.text(ix + 5, ty, G.t(scrollCount ? 'inv.hiddenScroll' : 'inv.hiddenNeed'), 'ui_dim').setMaxWidth(iw - 10);
      }
      // each stat, and the change against what is equipped in that slot
      var cur = isBag ? g.equipped[item.slot] : null;
      if (!item.unid) G.STAT_ORDER.forEach(function (st) {
        var v = item.stats[st], c = cur ? cur.stats[st] || 0 : 0;
        if (v == null && !(isBag && c)) return;
        if (ty > iy + ih - (!s && sl.kind === 'bag' ? 54 : 34)) return;
        var line = L.text(ix + 5, ty, v != null ? statText(st, v) : G.t('stat.' + st), v != null ? 'ui_text' : 'ui_dim');
        if (isBag && cur) {
          var d = Math.round(((v || 0) - c) * 10) / 10;
          if (d) { var dt = L.text(0, ty, (d > 0 ? '+' : '') + d, d > 0 ? 'ui_good' : 'ui_bad'); dt.x = ix + iw - 5 - dt.width; if (dt.x < line.x + line.width + 3) dt.setVisible(false); }
        }
        ty += 10;
      });
      var bw = Math.floor((iw - 14) / 2), byy = iy + ih - 22;
      if (s) {      // in a run: equip from the sealed bag (own-class weapons), or drop from it
        if (sl.kind === 'sbag') {
          var better2 = !item.unid && (!cur || G.itemValue(item, B) > G.itemValue(cur, B));
          if (item.unid) L.button(ix + 5, byy, bw, 18, G.t('inv.identify'), function () { if (s.identifySealed(sl.key)) P.openInventory(scene, true); }, { name: 'identify', color: 'gold' }).setEnabled(scrollCount > 0);
          else L.button(ix + 5, byy, bw, 18, G.t('inv.equip'), act, { name: 'equip', color: better2 ? 'ui_good' : 'ui_text' }).setEnabled(!foreign);
          L.button(ix + 9 + bw, byy, bw, 18, G.t('inv.drop'), function () { s.dropSealed(sl.key); P.sel = null; P.openInventory(scene, true); }, { name: 'drop' });
        }
      }
      else if (sl.kind === 'bag') {
        var better = !item.unid && (!cur || G.itemValue(item, B) > G.itemValue(cur, B));
        if (item.unid) L.button(ix + 5, byy, bw, 18, G.t('inv.identify'), function () { if (G.identifyInBag(g, sl.key)) { G.storeSave(G.save); P.openInventory(scene, true); } }, { name: 'identify', color: 'gold' }).setEnabled(scrollCount > 0);
        else L.button(ix + 5, byy, bw, 18, G.t('inv.equip'), act, { name: 'equip', color: better ? 'ui_good' : 'ui_text' }).setEnabled(!foreign);
        L.button(ix + 9 + bw, byy, bw, 18, G.t('inv.drop'), function () { G.dropFromBag(g, sl.key); P.sel = null; G.storeSave(G.save); P.openInventory(scene, true); }, { name: 'drop' });
        L.button(ix + 5, byy - 20, iw - 10, 18, G.t('inv.sell', { n: G.sellPrice(item, B) }), function () { G.sellFromBag(g, sl.key, B); P.sel = null; G.storeSave(G.save); P.openInventory(scene, true); }, { name: 'sell', color: 'gold' });
      } else {
        L.button(ix + 5, byy, Math.max(bw, 52), 18, G.t('inv.unequip'), act, { name: 'unequip' }).setEnabled(g.bag.length < B.loot.stashSize);
      }
    }
  };


  // ------------------------------------------------------------------ shop
  // The city's stalls (step 8). who 'smith': the Blacksmith (BUY with the scrolls, SELL, UPGRADE); who 'trainer': the Trainer (permanent RANKS, shared passives).
  // For the selected class. Sim functions: src/sim/economy.js.
  P.shop = { tab: 'buy', sel: null, who: 'smith' };
  P.openShop = function (scene, keep, who) {
    if (P.L) P.L.destroy();
    if (who) P.shop.who = who;
    who = P.shop.who;
    var V = G.view, B = G.BAL, E = B.economy, g = G.gearOf(G.save, G.cls), cls = G.cls, wide = V.W >= 300, st = P.shop, i;
    G.ensureShop(g, B, cls);
    P.current = 'shop'; P.scene = scene; G.paused = true;
    if (!keep) { st.tab = who === 'trainer' ? 'ranks' : 'buy'; st.sel = null; }
    var pw = wide ? Math.min(V.W - 8, 340) : Math.min(V.W - 8, 264), ph = wide ? Math.min(V.H - 8, 226) : Math.min(V.H - 8, 400);
    var L = P.L = UI.modal(scene, pw, ph, G.t(who === 'trainer' ? 'shop.trainer' : 'shop.smith')), x0 = L.x, y0 = L.y;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'shop_close' });
    var hx = x0 + 18 + G.t(who === 'trainer' ? 'shop.trainer' : 'shop.smith').length * 6;      // after the title, whatever its length
    L.image(hx, y0 + 10, 'i_gold');
    var gtx = L.text(hx + 8, y0 + 6, '' + (g.gold | 0), 'gold');
    L.text(hx + 8 + gtx.width + 10, y0 + 6, G.classLabel(cls), 'ui_dim');
    function refresh() { G.storeSave(G.save); P.openShop(scene, true); }
    var tabs = [['buy', G.t('shop.buy'), 'shop_buy'], ['sell', G.t('shop.sell'), 'shop_sell'], ['up', G.t('shop.upgrade'), 'shop_up']], tw = Math.floor((pw - 16 - 6) / 3);
    if (who === 'trainer') tabs = [];
    tabs.forEach(function (t, k) {
      L.button(x0 + 8 + k * (tw + 3), y0 + 22, tw, 16, t[1], function () { st.tab = t[0]; st.sel = null; P.openShop(scene, true); }, { name: t[2], color: st.tab === t[0] ? 'ui_warn' : 'ui_text' });
    });
    var cy = who === 'trainer' ? y0 + 26 : y0 + 42;

    // grid of cells (same look as the inventory); returns the geometry for the detail panel
    var cols = wide ? 5 : Math.max(5, Math.min(10, Math.floor((pw - 14) / 22))), bx = wide ? x0 + 8 : x0 + 8;
    function cell(x, y, item, key, name, extra) {
      var bg = L.image(x + 10, y + 10, item ? 'rar_' + item.rarity : 'slot', 1);
      if (item) L.image(x + 10, y + 10, extra || G.itemIcon(item), 2); else if (extra) L.image(x + 10, y + 10, extra, 2);
      if (item && item.unid) L.image(x + 10, y + 10, 'i_unid', 3);
      if (st.sel === key) L.image(x + 10, y + 10, 'select', 3);
      if (item || extra) { bg.setInteractive({ useHandCursor: true }); bg.on('pointerdown', function () { st.sel = key; P.openShop(scene, true); }); }
      UI.hit(name, x, y, 20, 20);
    }
    function grid(n, gy, at) { for (var k = 0; k < n; k++) at(k, bx + (k % cols) * 22, gy + Math.floor(k / cols) * 22); return gy + Math.ceil(n / cols) * 22; }
    function panelBox(gridBottom) {
      var ix = wide ? bx + cols * 22 + 6 : x0 + 8, iy = wide ? cy + 11 : gridBottom + 4, iw = x0 + pw - 8 - ix, ih = y0 + ph - 6 - iy;
      L.panel(ix, iy, iw, ih, 'inset', 1);
      return { ix: ix, iy: iy, iw: iw, ih: ih };
    }
    // item card: name, type, level, stats with the change against the worn item; returns the next y
    function card(b, item, worn) {
      var col = UI.RARITY[item.rarity], ty = b.iy + 5, nm = L.text(b.ix + 5, ty, G.itemName(item), col).setMaxWidth(b.iw - 10);
      ty += nm.height + 2;
      L.text(b.ix + 5, ty, G.itemType(item) + '  ' + G.t('inv.lv', { n: item.ilvl }), col); ty += 11;
      if (item.unid) { L.text(b.ix + 5, ty, G.t('shop.unidCard'), 'ui_warn'); return ty + 11; }
      G.STAT_ORDER.forEach(function (k) {
        var v = item.stats[k], c = worn ? worn.stats[k] || 0 : 0;
        if (v == null && !c) return;
        if (ty > b.iy + b.ih - 44) return;
        var line = L.text(b.ix + 5, ty, v != null ? statText(k, v) : G.t('stat.' + k), v != null ? 'ui_text' : 'ui_dim');
        if (worn) {
          var d = Math.round(((v || 0) - c) * 10) / 10;
          if (d) { var dt = L.text(0, ty, (d > 0 ? '+' : '') + d, d > 0 ? 'ui_good' : 'ui_bad'); dt.x = b.ix + b.iw - 5 - dt.width; if (dt.x < line.x + line.width + 3) dt.setVisible(false); }
        }
        ty += 10;
      });
      return ty;
    }
    function hint(b, item, worn) {
      if (!G.canEquip(item, B, cls) || item.unid) return;
      var t = !worn ? [G.t('shop.slotEmpty'), 'ui_good'] : G.itemValue(item, B) > G.itemValue(worn, B) + 0.01 ? [G.t('shop.better'), 'ui_good'] : [G.t('shop.notBetter'), 'ui_dim'];
      L.text(b.ix + 5, b.iy + b.ih - 36, t[0], t[1]);
    }
    var b, item, worn;

    if (st.tab === 'buy') {
      L.text(bx, cy, G.t('shop.forSale'), 'ui_dim');
      var stock = g.shop.stock, nS = stock.length;
      var gb = grid(nS + 1, cy + 11, function (k, x, y) {
        if (k < nS) cell(x, y, stock[k], 's' + k, 'shop_item_' + k); else cell(x, y, null, 'scroll', 'shop_item_scroll', 'i_scroll');
      });
      b = panelBox(gb);
      if (st.sel === 'scroll') {
        L.text(b.ix + 5, b.iy + 5, G.t('shop.scroll'), 'gold');
        L.text(b.ix + 5, b.iy + 17, G.t('shop.scrollDesc'), 'ui_dim').setMaxWidth(b.iw - 10);
        L.text(b.ix + 5, b.iy + b.ih - 36, G.t('shop.have', { n: g.scrolls | 0 }), 'ui_dim');
        L.button(b.ix + 5, b.iy + b.ih - 22, b.iw - 10, 18, G.t('shop.buyPrice', { n: E.shop.scroll }), function () { if (G.shopBuyScroll(g, B)) refresh(); }, { name: 'shop_buy_item', color: 'gold' })
          .setEnabled((g.gold | 0) >= E.shop.scroll && (g.scrolls | 0) < B.loot.scrollCap);
      } else if (st.sel && st.sel[0] === 's' && stock[+st.sel.slice(1)]) {
        var idx = +st.sel.slice(1); item = stock[idx]; worn = g.equipped[item.slot];
        card(b, item, worn); hint(b, item, worn);
        var price = G.buyPrice(item, B), can = (g.gold | 0) >= price && g.bag.length < B.loot.stashSize;
        L.button(b.ix + 5, b.iy + b.ih - 22, b.iw - 10, 18, g.bag.length >= B.loot.stashSize ? G.t('shop.bagFull') : G.t('shop.buyPrice', { n: price }), function () { if (G.shopBuy(g, idx, B)) { st.sel = null; refresh(); } }, { name: 'shop_buy_item', color: 'gold' }).setEnabled(can);
      } else L.text(b.ix + 5, b.iy + 5, G.t('shop.tapBuy'), 'ui_dim').setMaxWidth(b.iw - 10);
    } else if (st.tab === 'sell') {
      L.text(bx, cy, G.t('inv.bag', { n: g.bag.length, m: B.loot.stashSize }), 'ui_dim');
      var gb2 = grid(B.loot.stashSize, cy + 11, function (k, x, y) { cell(x, y, g.bag[k], 'b' + k, 'shop_bag_' + k); });
      // spare scrolls
      var sy = wide ? gb2 + 3 : gb2 + 2;
      L.image(bx + 6, sy + 6, 'i_scroll', 2);
      L.text(bx + 14, sy + 3, 'x' + (g.scrolls | 0), (g.scrolls | 0) ? 'gold' : 'ui_dim');
      L.button(bx + 44, sy - 1, 76, 15, G.t('shop.sellOne', { n: E.sell.scroll }), function () { if (G.sellScrolls(g, 1, B)) refresh(); }, { name: 'shop_sell_scroll' }).setEnabled((g.scrolls | 0) > 0);
      b = panelBox(wide ? gb2 + 3 : sy + 16);
      item = st.sel && st.sel[0] === 'b' ? g.bag[+st.sel.slice(1)] : null;
      if (item) {
        worn = g.equipped[item.slot];
        card(b, item, worn); hint(b, item, worn);
        var sp = G.sellPrice(item, B);
        if (item.unid) L.text(b.ix + 5, b.iy + b.ih - 36, G.t('shop.sellsFor', { n: sp, m: G.sellPrice(Object.assign({}, item, { unid: false }), B) }), 'ui_dim').setMaxWidth(b.iw - 10);
        L.button(b.ix + 5, b.iy + b.ih - 22, b.iw - 10, 18, G.t('inv.sell', { n: sp }), function () { G.sellFromBag(g, +st.sel.slice(1), B); st.sel = null; refresh(); }, { name: 'shop_sell_item', color: 'gold' });
      } else L.text(b.ix + 5, b.iy + 5, G.t('shop.tapSell') + ' ' + G.t('mon.sellHint'), 'ui_dim').setMaxWidth(b.iw - 10);
    } else if (st.tab === 'up') {
      var list = [];
      G.ITEM_SLOTS.forEach(function (k) { if (G.canUpgrade(g.equipped[k], B)) list.push({ key: 'w' + k, item: g.equipped[k], where: { slot: k }, worn: true }); });
      g.bag.forEach(function (it, k) { if (G.canUpgrade(it, B)) list.push({ key: 'b' + k, item: it, where: { bag: k } }); });
      L.text(bx, cy, G.t('shop.upList'), 'ui_dim');
      var gb3 = grid(Math.max(1, list.length), cy + 11, function (k, x, y) { if (list[k]) cell(x, y, list[k].item, list[k].key, 'shop_up_' + k); else cell(x, y, null, 'none', 'shop_up_none'); });
      b = panelBox(gb3);
      var cur = null; list.forEach(function (e) { if (e.key === st.sel) cur = e; });
      if (cur) {
        item = cur.item; var cl = JSON.parse(JSON.stringify(item)); G.upgradeItem(cl, B);
        var ty = b.iy + 5, nm = L.text(b.ix + 5, ty, G.itemName(item), UI.RARITY[item.rarity]).setMaxWidth(b.iw - 10); ty += nm.height + 2;
        L.text(b.ix + 5, ty, G.t('shop.upLevel', { a: item.ilvl, b: cl.ilvl, n: item.up | 0, m: E.upgrade.max[item.rarity] }), 'ui_dim'); ty += 11;
        G.STAT_ORDER.forEach(function (k) {
          if (item.stats[k] == null || ty > b.iy + b.ih - 30) return;
          L.text(b.ix + 5, ty, G.t('stat.' + k) + ' ' + item.stats[k] + ' > ' + cl.stats[k], 'ui_text'); ty += 10;
        });
        var cost = G.upgradeCost(item, B);
        L.button(b.ix + 5, b.iy + b.ih - 22, b.iw - 10, 18, G.t('shop.upPrice', { n: cost }), function () { if (G.upgradeAt(g, cur.where, B)) refresh(); }, { name: 'shop_up_item', color: 'gold' }).setEnabled((g.gold | 0) >= cost);
      } else L.text(b.ix + 5, b.iy + 5, G.t(list.length ? 'shop.tapUp' : 'shop.nothingUp'), 'ui_dim').setMaxWidth(b.iw - 10);
    } else {
      L.text(x0 + 8, cy, G.t('shop.ranks'), 'ui_dim');
      var ids = Object.keys(E.ranks), rh = wide ? 26 : 30;
      ids.forEach(function (id, k) {
        var R = E.ranks[id], ry = cy + 12 + k * (rh + 2), rank = (g.ranks && g.ranks[id]) | 0, cost = G.rankCost(g, id, B), iw = pw - 16;
        L.panel(x0 + 8, ry, iw, rh, 'inset', 1);
        L.text(x0 + 13, ry + 4, G.t('rank.' + id + '.name'), 'ui_text');
        L.text(x0 + 13, ry + 15, G.t('rank.' + id + '.text') + (rank ? '  ' + G.t('shop.rankNow', { n: R.per * rank }) : ''), 'ui_dim');
        for (var r = 0; r < E.rankCost.length; r++) { L.bar(x0 + 8 + iw - 72 - (E.rankCost.length - r) * 7, ry + 4, 5, 5, r < rank ? 'gold' : 'ui_line', 3); }
        var bt = L.button(x0 + 8 + iw - 64, ry + 3, 58, rh - 6, cost === null ? G.t('shop.max') : G.t('shop.rankBuy', { n: cost }), function () { if (G.buyRank(g, id, B)) refresh(); }, { name: 'shop_rank_' + id, color: 'gold' });
        bt.setEnabled(cost !== null && (g.gold | 0) >= cost);
      });
      L.text(x0 + 8, cy + 12 + ids.length * (rh + 2) + 2, G.t('shop.ranksNote'), 'ui_dim').setMaxWidth(pw - 16);
    }
  };

  // ------------------------------------------------------------------ Don Montoto
  // Don Montoto (step 8): one story line per talk (src/lore.js, the index is saved on the character) and a free identification of the whole kept bag, item by item
  // with a short reveal. Same identification as a scroll: clears `unid`, the stats were rolled at the drop. Sim: G.montotoStory, G.identifyAll (src/sim/economy.js).
  P.monto = { story: null, idx: 0, queue: [], reveal: null, n: 0 };
  P.openMontoto = function (scene, keep) {
    if (P.L) P.L.destroy();
    var V = G.view, g = G.gearOf(G.save, G.cls), st = P.monto;
    P.current = 'montoto'; P.scene = scene; G.paused = true;
    if (!keep) { st.queue = []; st.reveal = null; st.n = 0; st.idx = (g.city.story | 0) % G.MONTOTO_STORIES.length; G.montotoStory(g); G.storeSave(G.save); }
    var pw = Math.min(V.W - 8, 260), ph = Math.min(V.H - 8, 200);
    var L = P.L = UI.modal(scene, pw, ph, G.t('mon.name')), x0 = L.x, y0 = L.y;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { st.reveal = null; st.queue = []; P.close(); }, { icon: 'i_close', name: 'monto_close' });
    var bx = x0 + 8, iw = pw - 16;
    if (st.reveal) {                                   // the reveal: the item shows, then its stats one line at a time
      var it = st.reveal, col = UI.RARITY[it.rarity], cx = x0 + pw / 2, keys = G.STAT_ORDER.filter(function (k) { return it.stats[k] != null; });
      L.panel(bx, y0 + 24, iw, ph - 24 - 6, 'inset', 1);
      L.image(cx, y0 + 50, 'rar_' + it.rarity, 1); L.image(cx, y0 + 50, G.itemIcon(it), 2);
      if (st.n < 1) L.image(cx, y0 + 50, 'i_unid', 3);
      UI.centerX(L.text(0, y0 + 68, st.n < 1 ? G.t('mon.examining') : G.itemName(it), st.n < 1 ? 'ui_dim' : col).setMaxWidth(iw - 8), cx);
      if (st.n >= 1) {
        UI.centerX(L.text(0, y0 + 80, G.itemType(it) + '  ' + G.t('inv.lv', { n: it.ilvl }), col), cx);
        keys.forEach(function (k, i) { if (i < st.n - 1) UI.centerX(L.text(0, y0 + 96 + i * 11, statText(k, it.stats[k]), 'ui_text'), cx); });
      }
      var done = st.n - 1 >= keys.length, more = st.queue.length;
      if (done) L.button(bx + 6, y0 + ph - 28, iw - 12, 18, more ? G.t('mon.next', { n: more }) : G.t('mon.ok'), function () {
        st.reveal = st.queue.shift() || null; st.n = 0; P.openMontoto(scene, true);
      }, { name: 'monto_ok', color: 'ui_good' });
      else {
        scene.time.delayedCall(st.n < 1 ? 700 : 280, function () { if (P.current === 'montoto' && st.reveal === it) { st.n++; P.openMontoto(scene, true); } });
        L.button(bx + iw - 48, y0 + 28, 44, 14, G.t('mon.skip'), function () { st.reveal = null; st.queue = []; P.openMontoto(scene, true); }, { name: 'monto_skip' });
      }
      return;
    }
    // his story: the line of this talk
    L.panel(bx, y0 + 24, iw, 78, 'inset', 1);
    L.text(bx + 6, y0 + 30, '"' + G.storyText(st.idx) + '"', 'ui_text').setMaxWidth(iw - 12);
    var hidden = g.bag.filter(function (it) { return it.unid; }).length, by = y0 + 108;
    L.text(bx, by, G.t('mon.hidden', { n: hidden }), 'ui_dim');
    L.button(bx, by + 14, iw, 20, G.t(hidden ? 'mon.identifyAll' : 'mon.nothingToIdentify'), function () {
      var list = G.identifyAll(g);
      if (!list.length) return;
      G.storeSave(G.save); st.reveal = list.shift(); st.queue = list; st.n = 0; P.openMontoto(scene, true);
    }, { name: 'monto_do', color: 'gold' }).setEnabled(hidden > 0);
    L.text(bx, by + 40, G.t('mon.again'), 'ui_dim').setMaxWidth(iw);
  };

  // -------------------------------------------------------------- settings
  P.openSettings = function (scene, back) {
    if (P.L) P.L.destroy();
    var V = G.view, set = G.save.settings, inRun = !!sim();
    P.current = 'settings'; P.scene = scene; P.back = back || null; G.paused = true;
    if (G.screen !== 'title' && G.screen !== 'city') G.screen = 'settings';
    var pw = Math.min(V.W - 8, 200), ph = 152, t = G.t;
    var L = P.L = UI.modal(scene, pw, ph, t('set.title')), x0 = L.x, y0 = L.y, tw = pw - 16 - 36;
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { leave(); }, { icon: 'i_close', name: 'set_close' });
    function leave() { if (P.back === 'inventory') P.openInventory(scene); else P.close(); }

    // language: applies at once (every open screen is rebuilt), saved in the shared settings
    L.text(x0 + 8, y0 + 27, t('set.language'));
    [['en', 'ENGLISH'], ['es', 'ESPAÑOL']].forEach(function (b, i) {
      var on = G.lang === b[0];
      L.button(x0 + pw - 8 - 108 + i * 56, y0 + 22, 52, 16, b[1], function () {
        if (G.lang === b[0]) return;
        set.lang = b[0]; G.setLang(b[0]); G.storeSave(G.save);
        scene.time.delayedCall(1, function () { G.applyView(); });       // rebuilds this panel and every screen in the new language
      }, { name: 'lang_' + b[0], color: on ? 'ui_warn' : 'ui_text' });
    });

    // a slider row: label and value above, then [-] track [+]. `commit` rebuilds the screen, so it waits for the pointer to go up.
    function row(y, label, valueText, steps, index, live, commit, name) {
      L.text(x0 + 8, y, label);
      var vt = L.text(0, y, valueText, 'ui_warn'); vt.x = x0 + pw - 8 - vt.width;
      var sl = UI.slider(L, x0 + 28, y + 12, pw - 56, steps, index, function (k) { var v = live(k); vt.setText(v); vt.x = x0 + pw - 8 - vt.width; }, name, commit);
      L.button(x0 + 8, y + 12, 14, 14, '-', function () { sl.set(sl.index - 1, true); }, { name: name + '_minus' });
      L.button(x0 + pw - 22, y + 12, 14, 14, '+', function () { sl.set(sl.index + 1, true); }, { name: name + '_plus' });
      return sl;
    }
    // zoom: integer pixel scale for the whole game (art and UI together); the knob, the label and V.S always agree
    row(y0 + 44, t('set.zoom'), V.S + 'x', V.steps, V.S - V.lo, function (k) { return (V.lo + k) + 'x'; }, function (k) {
      set.zoom = V.lo + k - V.base; G.storeSave(G.save);
      scene.time.delayedCall(1, function () { G.applyView(); });       // rebuilds this panel at the new scale
    }, 'zoom');
    L.text(x0 + 8, y0 + 72, V.steps === 1 ? t('set.zoomNone') : t('set.zoomHint'), 'ui_dim').setMaxWidth(pw - 16);

    // screen shake: 0..100 % of a capped amplitude
    row(y0 + 88, t('set.shake'), set.shake + '%', 11, Math.round(set.shake / 10), function (k) {
      set.shake = k * 10; G.storeSave(G.save);
      if (G.gameScene && inRun) G.gameScene.fx.shake(0.6);
      return set.shake + '%';
    }, null, 'shake');
    L.text(x0 + 8, y0 + 116, t('set.shakeHint'), 'ui_dim').setMaxWidth(pw - 16);

    var bw = Math.floor((pw - 22) / 2);
    L.button(x0 + 8, y0 + ph - 26, bw, 18, inRun ? t('set.resume') : t('set.close'), leave, { name: 'set_resume' });
    if (inRun) L.button(x0 + 14 + bw, y0 + ph - 26, bw, 18, t('set.quit'), function () { P.close(true); G.toCity(); }, { name: 'set_quit', color: 'ui_bad' });
    else L.button(x0 + 14 + bw, y0 + ph - 26, bw, 18, t('set.reset'), function () {
      var keep = G.save.settings; G.save = G.newSave(); G.save.settings = keep; G.storeSave(G.save); P.close(true); G.toTitle();
    }, { name: 'set_reset', color: 'ui_bad' });
    void tw;
  };

  // ----------------------------------------------------------------- debug
  // Cheats to test fast. Toggles stay on for the browser session; actions apply at once.
  P.openDebug = function (scene) {
    if (P.L) P.L.destroy();
    var V = G.view, s = sim(), C = G.cheats, gs = G.gameScene;
    if (!s) return;
    P.current = 'debug'; P.scene = scene; G.paused = true; G.screen = 'debug';
    var pw = Math.min(V.W - 8, 204), rows = 7, ph = 30 + rows * 21 + 6;
    var L = P.L = UI.modal(scene, pw, ph, G.t('dbg.title')), x0 = L.x, y0 = L.y, bw = Math.floor((pw - 22) / 2);
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', function () { P.close(); }, { icon: 'i_close', name: 'dbg_close' });
    function reopen() { P.openDebug(scene); }
    function act(fn) { return function () { fn(); P.close(); }; }
    var B = [
      [G.t('dbg.god', { s: G.t(C.god ? 'dbg.on' : 'dbg.off') }), function () { C.god = !C.god; reopen(); }, 'dbg_god', C.god],
      [G.t('dbg.noCd', { s: G.t(C.noCd ? 'dbg.on' : 'dbg.off') }), function () { C.noCd = !C.noCd; reopen(); }, 'dbg_nocd', C.noCd],
      [G.t('dbg.speed', { n: gs.speed }), function () {
        var next = { 1: 2, 2: 4, 4: 8 }[gs.speed] || 1;
        gs.speed = C.speed = next; gs.fx.quiet = next > 4; reopen();
      }, 'dbg_speed', gs.speed > 1],
      [G.t('dbg.killAll'), act(function () { s.cheatKillAll(); }), 'dbg_kill'],
      [G.t('dbg.skip'), act(function () { s.cheatSkipPhase(); }), 'dbg_skip'],
      [G.t('dbg.level'), act(function () { s.cheatLevel(); }), 'dbg_level'],
      s.testRoom >= 0 ? [G.t('dbg.restart'), act(function () { s.restartTestRoom(); }), 'dbg_next']
        : [G.t('dbg.next'), act(function () { s.cheatRoom(s.roomIndex + 1); }), 'dbg_next'],
      [G.t('dbg.boss'), act(function () { s.cheatRoom(s.B.run.rooms - 1); }), 'dbg_boss'],
      [G.t('dbg.loot'), act(function () { s.cheatLoot(); }), 'dbg_loot'],
      [G.t('dbg.doors'), act(function () { s.cheatChoice(); }), 'dbg_doors'],
      [G.t('dbg.merchant'), act(function () { s.cheatMerchant(); }), 'dbg_merchant'],
      [G.t('dbg.cage'), act(function () { s.cheatCage(); }), 'dbg_cage'],
      [G.t('dbg.abilities'), act(function () { s.cheatAbilities(s.defaultActives()); }), 'dbg_abil'],
      [G.t('dbg.resume'), function () { P.close(); }, 'dbg_resume']
    ];
    B.forEach(function (b, i) {
      var bx = x0 + 8 + (i % 2) * (bw + 6), by = y0 + 24 + Math.floor(i / 2) * 21;
      L.button(bx, by, bw, 18, b[0], b[1], { name: b[2], color: b[3] ? 'ui_good' : 'ui_text' });
    });
    L.text(x0 + 8, y0 + ph - 15, G.t('dbg.info', { n: s.roomIndex + 1, phase: G.t('phase.' + s.phase), s: s.seed }), 'ui_dim');
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
    var pw = Math.min(V.W - 8, 230), ph = 156;
    var L = P.L = UI.modal(scene, pw, ph, null), x0 = L.x, y0 = L.y, cx = V.W / 2;
    UI.centerX(L.text(0, y0 + 9, G.t(won ? 'res.won' : (left ? 'res.left' : 'res.dead')), won ? 'ui_good' : (left ? 'ui_warn' : 'ui_bad'), true), cx);
    var t = Math.round(s.tick / 60), gs = G.gearScore(s.gear), lines = [
      [won ? G.t('res.allCleared', { n: B.run.rooms }) : left ? G.t('res.leftAfter', { a: s.roomIndex + 1, b: B.run.rooms }) : s.testRoom >= 0 ? G.t('res.fellTest', { n: s.loops }) : G.t('res.fell', { a: s.roomIndex + 1, b: B.run.rooms }), 'ui_text'],
      [G.t('res.stats', { l: s.player.level, k: s.kills, t: Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2) }), 'ui_dim'],
      state === 'dead' ? [R.items ? G.t('res.bagLost', { items: G.plural('items', R.items) }) + G.t(B.run.deathKeepsEquipped ? 'res.wornKept' : 'res.wornLost') : G.t('res.bagEmpty'), R.items ? 'ui_bad' : 'ui_dim']
        : [G.t('res.kept', { items: G.plural('items', R.kept) }) + (R.lost ? G.t('res.keptLost', { n: R.lost }) : ''), 'ui_good'],
      s.testRoom >= 0 ? [G.t('res.gear', { n: gs }), 'ui_dim'] : (state === 'dead' ? [R.goldLost ? G.t('res.goldLost', { n: R.goldLost }) : G.t('res.goldNone'), 'ui_bad'] : [G.t('res.goldKept', { n: R.goldKept }), 'gold']),
      [G.t('res.gear', { n: gs }), 'ui_dim']];
    // one line each, 12 px apart; a line too long for the panel wraps (Spanish, narrow screens) and the ones below move down
    var ly = y0 + 34;
    lines.forEach(function (l) {
      var tx = L.text(0, ly, l[0], l[1]).setMaxWidth(pw - 12);
      UI.centerX(tx, cx);
      ly += 12 + Math.max(0, Math.round(tx.height / 10) - 1) * 10;
    });
    var bw = Math.floor((pw - 24) / 2);
    L.button(x0 + 8, y0 + ph - 28, bw, 20, G.t('res.again'), function () { P.counted = false; P.close(true); G.restartRun(); }, { name: 'res_again', color: 'ui_good' });
    L.button(x0 + 16 + bw, y0 + ph - 28, bw, 20, G.t('res.city'), function () { P.counted = false; P.close(true); G.toCity(); }, { name: 'res_city', color: 'gold' });
  };

  G.restartRun = function () {
    var g = G.game.scene;
    G.runSeed = (G.runSeed + 1) >>> 0;
    G.paused = false;
    g.stop('hud'); g.stop('game'); g.start('game');
  };
  G.toCity = function () {
    var g = G.game.scene;
    G.paused = false; G.runSeed = (G.runSeed + 1) >>> 0;      // a new seed for the next run from the portal
    g.stop('hud'); g.stop('game'); g.start('city');
  };
  G.toTitle = function (openGear) {
    var g = G.game.scene;
    G.paused = false; G.openGearOnTitle = !!openGear;
    g.stop('hud'); g.stop('game'); g.stop('cityhud'); g.stop('city'); g.start('title');
  };
})(globalThis.G = globalThis.G || {});
