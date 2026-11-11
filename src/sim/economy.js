// Economy (step 7, docs/specs/economy.md): sell prices, the town shop, upgrades, permanent ranks, gold banking, the in-run merchant.
// Pure functions over a `gear` ({ equipped, bag, scrolls, gold, ranks, shop, nextId }) and items. No Phaser, no wall clock.
(function (G) {
  var T = 16;
  function E(B) { return B.economy; }

  // ------------------------------------------------------------------ prices
  G.sellPrice = function (item, B) {
    var S = E(B).sell, v = S.base[item.rarity] * (1 + S.ilvl * (item.ilvl - 1)) * (item.unid ? S.unid : 1);
    return Math.max(S.min, Math.round(v));
  };
  // price of an item in the town shop: the identified sell price x buyMult (x rareBuyMult for a rare)
  G.buyPrice = function (item, B) {
    var S = E(B).sell, H = E(B).shop;
    return Math.round(S.base[item.rarity] * (1 + S.ilvl * (item.ilvl - 1)) * (item.rarity >= 2 ? H.rareBuyMult : H.buyMult));
  };
  G.canUpgrade = function (item, B) {
    return !!item && item.src !== 'shop' && !item.unid && (item.up | 0) < E(B).upgrade.max[item.rarity];
  };
  G.upgradeCost = function (item, B) {
    if (!G.canUpgrade(item, B)) return null;
    var U = E(B).upgrade;
    return Math.round(U.cost[item.rarity] * (1 + U.ilvl * (item.ilvl - 1)) * (1 + U.grow * (item.up | 0)));
  };
  G.rankCost = function (gear, id, B) {
    var r = (gear.ranks && gear.ranks[id]) | 0, C = E(B).rankCost;
    return r >= C.length ? null : C[r];
  };

  // ------------------------------------------------------------------ gold and selling
  G.bankGold = function (gear, n, B) {
    var have = gear.gold | 0, now = Math.min(E(B).gold.cap, have + Math.max(0, n | 0));
    gear.gold = now;
    return now - have;
  };
  G.sellFromBag = function (gear, idx, B) {
    var it = gear.bag[idx];
    if (!it) return 0;
    var v = G.sellPrice(it, B);
    gear.bag.splice(idx, 1);
    G.bankGold(gear, v, B);
    return v;
  };
  // sells n spare kept scrolls; returns the gold gained
  G.sellScrolls = function (gear, n, B) {
    n = Math.min(n | 0, gear.scrolls | 0);
    if (n <= 0) return 0;
    gear.scrolls -= n;
    var v = n * E(B).sell.scroll;
    G.bankGold(gear, v, B);
    return v;
  };

  // ------------------------------------------------------------------ the shop
  // 7 entries: the base items of `rarities` (commons, magic) and one rare. Rolled from the save's own counter, so a save restocks the same way.
  G.restockShop = function (gear, B, clsId) {
    var H = E(B).shop, id = G.classDef(B, clsId).id, ci = Math.max(0, G.classIds(B).indexOf(id));
    var rolls = gear.shop && gear.shop.rolls > 0 ? gear.shop.rolls : 0;
    var rng = new G.RNG(G.hash32(rolls, 7070 + ci)), ilvl = 1 + H.ilvlAdd, rares = 0;
    var stock = H.rarities.map(function (r) {
      if (r >= 2 && rares >= H.maxRare) return null;
      if (r >= 2) rares++;
      return G.rollShopItem(rng, ilvl, r, B, gear, id);
    });
    gear.shop = { rolls: rolls + 1, stock: stock };
    return gear.shop;
  };
  G.shopStockOk = function (shop, B) {
    var n = E(B).shop.rarities.length;
    return !!shop && shop.rolls >= 0 && Array.isArray(shop.stock) && shop.stock.length === n;
  };
  G.ensureShop = function (gear, B, clsId) {
    if (!G.shopStockOk(gear.shop, B)) G.restockShop(gear, B, clsId);
    return gear.shop;
  };
  // buys stock[idx] into the kept bag; returns the item or null (no stock, no gold, bag full)
  G.shopBuy = function (gear, idx, B) {
    var sh = gear.shop, it = sh && sh.stock[idx];
    if (!it || gear.bag.length >= B.loot.stashSize) return null;
    var p = G.buyPrice(it, B);
    if ((gear.gold | 0) < p) return null;
    gear.gold -= p; sh.stock[idx] = null; gear.bag.push(it);
    return it;
  };
  G.shopBuyScroll = function (gear, B) {
    var p = E(B).shop.scroll;
    if ((gear.gold | 0) < p || (gear.scrolls | 0) >= B.loot.scrollCap) return false;
    gear.gold -= p; gear.scrolls = (gear.scrolls | 0) + 1;
    return true;
  };

  // ------------------------------------------------------------------ upgrades
  // +1 item level; stats rescale from the values at the drop (stats0). No rng.
  G.upgradeItem = function (item, B) {
    if (!G.canUpgrade(item, B)) return false;
    var I = B.items;
    if (!(item.up > 0)) { item.ilvl0 = item.ilvl; item.stats0 = Object.assign({}, item.stats); }
    item.ilvl++; item.up = (item.up | 0) + 1;
    var f = (1 + I.ilvlGrow * (item.ilvl - 1)) / (1 + I.ilvlGrow * (item.ilvl0 - 1));
    for (var k in item.stats0) {
      var v = item.stats0[k] * f;
      item.stats[k] = k === 'regen' ? Math.max(0.1, Math.round(v * 10) / 10) : Math.max(1, Math.round(v));
    }
    item.power = item.ilvl * (2 + item.rarity);
    return true;
  };
  // where: { bag: idx } or { slot: key }; pays and upgrades
  G.upgradeAt = function (gear, where, B) {
    var it = where.bag !== undefined ? gear.bag[where.bag] : gear.equipped[where.slot], c = G.upgradeCost(it, B);
    if (c === null || (gear.gold | 0) < c) return false;
    if (!G.upgradeItem(it, B)) return false;
    gear.gold -= c;
    return true;
  };

  // ------------------------------------------------------------------ ranks
  G.buyRank = function (gear, id, B) {
    var c = G.rankCost(gear, id, B);
    if (!E(B).ranks[id] || c === null || (gear.gold | 0) < c) return false;
    gear.gold -= c;
    if (!gear.ranks) gear.ranks = {};
    gear.ranks[id] = (gear.ranks[id] | 0) + 1;
    return true;
  };
  G.rankStats = function (gear, B) {
    var out = {}, R = E(B).ranks;
    if (!gear || !gear.ranks) return out;
    for (var id in gear.ranks) if (R[id] && gear.ranks[id] > 0) out[R[id].stat] = (out[R[id].stat] || 0) + R[id].per * gear.ranks[id];
    return out;
  };
  G.rankTotal = function (gear) { var n = 0; for (var k in (gear.ranks || {})) n += gear.ranks[k] | 0; return n; };

  // ------------------------------------------------------------------ the merchant (pure functions of the seed and the room)
  G.merchantRooms = function (seed, B) {
    var M = E(B).merchant, out = [];
    for (var i = M.lo; i <= M.hi && out.length < M.maxPerRun; i++)
      if (G.hash32(seed >>> 0, 6060 + i * 37) / 4294967296 < M.chance) out.push(i);
    return out;
  };
  G.merchantSpot = function (room, B) {
    var M = E(B).merchant, sx = Math.floor(room.start.x / T), sy = Math.floor(room.start.y / T);
    for (var i = 0; i < M.spots.length; i++) {
      var tx = sx + M.spots[i][0], ty = sy + M.spots[i][1];
      if (tx >= 0 && ty >= 0 && tx < room.w && ty < room.h && !room.tiles[ty * room.w + tx]) return { x: tx * T + 8, y: ty * T + 8 };
    }
    return null;
  };
})(globalThis.G = globalThis.G || {});
