# Spec: economy (step 7)

Written by the design session (Opus). The implementation session (Sonnet) builds it from this file
without asking questions. Where this spec leaves a choice open, it says so and gives a default.

The data is already in `src/balance.js`: `economy` (gold, sell, shop, upgrade, rankCost, ranks, merchant,
scrollDrops) and `bot.shop`. The sim does not read it yet: loading it changes nothing (checked: `sim_bot --seeds 1-10
--json` identical for mage, warrior and archer before and after). Every number below comes from that table; if this
file and the table disagree, the table wins.

Until step 8 builds the walkable town, **the town shop and selling live on the title screen**, next to
EQUIPMENT (as equipping does today). Step 8 moves the same panel behind an NPC; the sim functions do not change.


## Decisions by the user (2026-11-11)

- Gold of a run is lost on death (as the spec says, `gold.deathKeeps` 0).
- Gold belongs to each character (per class, as the spec says).
- The merchant takes the run's gold only (as the spec says).
- CHANGE: the town shop may also sell RARE items at a very high price, at most 1 rare in stock at a time, never epic or better
  (`G.rollShopItem` throws above `shop.maxRarity` 2). Rare shop items are identified. This replaces "commons and magic only"
  (section 4, `shop.maxRarity` 1) and answers open question 4 as "up to rare at a high price". Price: `shop.rareBuyMult` 10
  (the identified sell price x 10) = 250 gold, which is 5 times the magic item of the shop
  (50, `buyMult` 5), 10 times what the rare sells for, and above the first upgrade of a found rare (100 to 200).
  The stock is the 6 entries above plus a 7th entry, the rare (`shop.rarities` = [0, 0, 0, 0, 1, 1, 2], `shop.maxRare` 1).

## Design assumptions (defaults; the user may change them, see "Open questions" at the end)

- Gold follows the bag rule: gold earned in a run is sealed, banked on leave or win, lost on death (`gold.deathKeeps` 0).
- Gold, ranks, the shop stock and scrolls are **per class**, like gear and the kept bag.
- The merchant takes the run's sealed gold only (not the kept gold).
- The shop sells commons and magic items only (`shop.maxRarity` 1).


## 1. What the player sees

- Coins: every kill, closed fissure, opened chest and the boss pay gold at once (a small "+3" and coins flying to the
  counter; nothing to pick up). The HUD shows the run's gold next to the bag button. Deeper rooms and harder doors pay more.
- Leaving or winning keeps the run's gold; dying loses it, like the sealed bag. The result screen says how much was kept or lost.
- On the title screen a SHOP button opens the shop of the selected class, with four tabs:
  BUY (6 base items and the Scroll of Identification), SELL (the kept bag and spare scrolls), UPGRADE (+1 item level
  for found items) and RANKS (5 permanent stats bought with gold). The class's gold is shown on top.
- Rare, epic and legendary items are never in the shop. They only drop in the rifts. The shop is where gold turns
  into small, steady power (ranks, upgrades of what you found, scrolls), never into the best gear.
- Sometimes a merchant stands near the entrance of a room. Walk up and tap him: the run pauses and he sells Scrolls of
  Identification and healing potions for the run's gold. What you buy from him is sealed like what you find.
- Scrolls drop far less often than before (about 4 in a full run instead of 13 to 16), so they are something to buy.


## 2. Gold

### Sources and amounts

All gold of a run goes through one function: `amount = base x gold.room[roomIndex] x (1 + gold.door x sim.lootBonus)`.

| Source | base | When |
|---|---|---|
| Kill (any monster, summons included) | `gold.kill` x monster `threat` (imp / bat 0.3, skeleton 0.6, hound 0.9, warden 2.4, tyrant 12) | in `S.kill` |
| Normal fissure closed | `gold.close` 1.5 | in `S.closeReward`, `!f.big` |
| Super fissure closed | `gold.superClose` 6 | in `S.closeReward`, `f.big` |
| Chest opened | `gold.chest` 8 | in `S.updateRoomGoals` when the chest opens |
| Boss killed | `gold.boss` 50 (plus its kill gold) | in `S.kill`, `def.boss` |

- `gold.room` = 1.0, 1.1, ..., 1.8, 2.0 (rooms 1 to 10).
- **Door bonus**: the door's loot share (`doors.mods.*.loot`, 0.20 to 0.30) adds the same share of gold in that room
  (`gold.door` = 1). A "Hardened foes" room (+25 %) pays 25 % more gold.
- No rng: fractions accumulate in `sim.goldFrac`; the whole part moves to `sim.gold`. Gold never draws from any rng,
  so it cannot shift a run.
- None in the test room.

Expected gold per run (first estimate; the career check measures it, see section 12):
3 rooms then leave ~100 + ~30 from selling; 5 rooms ~200 + ~60; a full win ~550-650 + ~110; death 0.

### Kept and lost

- `sim.gold`: sealed gold of this run. Starts at 0 every run (kept gold is not carried into the run).
- `finishRun('left' | 'won')`: `G.bankGold(gear, sim.gold, B)` adds it to `gear.gold` (cap `gold.cap`).
- `finishRun('dead')`: kept = `Math.floor(sim.gold x gold.deathKeeps)` (0 today), the rest is lost. Quitting from settings
  counts as death (as for the bag). Test room: nothing.
- `this.result` gains `gold` (sealed at the end), `goldKept`, `goldEarned` (all earned in the run), `goldSpent` (at the merchant).


## 3. Sell prices

`G.sellPrice(item, B) = max(sell.min, round(sell.base[rarity] x (1 + sell.ilvl x (ilvl - 1)) x (item.unid ? sell.unid : 1)))`
with `sell.base` = 3, 8, 20, 50, 120, `sell.ilvl` 0.25, `sell.unid` 0.4. Other classes' weapons sell like any item.
An upgraded item sells at its new item level (the upgrade cost is not refunded). A Scroll of Identification sells for `sell.scroll` 5.

| ilvl | common | magic (unid) | rare (unid) | epic (unid) | legendary (unid) |
|---|---|---|---|---|---|
| 1 | 3 | 8 (3) | 20 (8) | 50 (20) | 120 (48) |
| 4 | 5 | 14 (6) | 35 (14) | 88 (35) | 210 (84) |
| 7 | 8 | 20 (8) | 50 (20) | 125 (50) | 300 (120) |
| 10 | 10 | 26 (10) | 65 (26) | 163 (65) | 390 (156) |

Why 0.4 for unidentified: a scroll costs 25. Identifying a magic or rare item only to sell it loses gold; identifying an
epic or legendary to sell it pays. So scrolls go to items you might wear, and selling unidentified junk is fine.

Selling happens only between runs (title shop, SELL tab; also a SELL button next to DROP in the EQUIPMENT item detail).
Nothing is sold in a run, and the merchant does not buy.


## 4. The town shop (title screen until step 8)

### Base items

- Stock: one item per entry of `shop.rarities` = [0, 0, 0, 0, 1, 1] (4 commons, 2 magic), all identified, marked `src: 'shop'`.
- Item level = `1 + shop.ilvlAdd` = 2 (difficulty tiers were removed on 2026-11-11; this is what tier 1 gave). Drops reach ilvl 4, so a shop item is always behind the best drops.
- Slots: any of the 7; a weapon is one of the **class's own** weapon types (equal weight among them), never another class's.
- Price = `round(sell.base[rarity] x (1 + sell.ilvl x (ilvl - 1)) x shop.buyMult)`, `buyMult` 5:
  common 19, magic 50.
- A bought item goes into the kept bag (refused when the bag is full: "Bag is full"). A sold-out entry stays empty.
- Restock: after every run of the class ends (any result) and when the stock is missing (first open, old save).
  Rolled with `new G.RNG(G.hash32(gear.shop.rolls, 7070 + classIndex))` (`classIndex` = index in `G.classIds(B)`), then
  `rolls++`. Same save = same stock.

### HARD RULE: the shop never sells the best gear

`G.rollShopItem` throws if asked for a rarity above `shop.maxRarity` (1). Rare, epic and legendary items only drop in rifts.
`check_bag.js` asserts it over 200 restocks per class, and the career check reports the source of every equipped item.

### Scroll of Identification

Unlimited, `shop.scroll` 25 gold each, added to `gear.scrolls` (cap `loot.scrollCap` 99). Sells back for 5.

### Upgrades for found items

- Any identified item in the kept bag or worn, that is not a shop item (`src !== 'shop'`), with upgrades left:
  `(item.up | 0) < upgrade.max[rarity]` (1, 2, 3, 3, 3). An unidentified item must be identified first.
- Effect: `ilvl + 1`; on the first upgrade store `ilvl0 = ilvl` and `stats0 = copy of stats`. Each stat becomes
  `stats0[k] x (1 + items.ilvlGrow x (ilvl - 1)) / (1 + items.ilvlGrow x (ilvl0 - 1))`, rounded like `G.rollItem`
  (regen 1 decimal min 0.1, others whole min 1). `power = ilvl x (2 + rarity)` is recomputed, so gear score and
  room threat (`run.gearK`) follow. `up++`. No rng. A worn item changes at once (stats recomputed in the next run; on the title the
  EQUIPMENT view reads it).
- Cost = `round(upgrade.cost[rarity] x (1 + upgrade.ilvl x (ilvl - 1)) x (1 + upgrade.grow x up))`, cost = 20, 40, 80, 160, 320.
  Examples: magic ilvl 3 first upgrade 60; rare ilvl 4: 140, 240, 360; legendary ilvl 4: 560, 960, 1440.
- Each upgrade is +about 12-20 % on the item's stats. Upgrades are how gold makes a lucky drop last, not a way around drops.

### Permanent ranks

| id | name | stat | per rank | at max (5) |
|---|---|---|---|---|
| vitality | Vitality | hp | +6 | +30 max HP |
| might | Might | dmgPct | +3 | +15 % damage |
| haste | Haste | atkPct | +2 | +10 % attack speed |
| guard | Guard | armor | +3 | +15 armor |
| insight | Insight | expPct | +4 | +20 % EXP gain |

- Cost of the next rank: `rankCost[rank]` = 60, 140, 260, 420, 620 (1500 per stat, 7500 for all 25 ranks). Max rank = `rankCost.length`.
- Per class: `gear.ranks = { id: rank }`.
- How they stack with the step 5 abilities: rank stats are a third source in `G.computeStats`, added to the gear and ability
  stats of the same key **before** the caps (`items.cap`): `v(k) = gear[k] + abilities[k] + ranks[k]`. They are not
  abilities: they do not count for families, are never offered on level-up, and do not change offers. They are not gear:
  they do not count in the gear score and do not raise room threat. They apply in every run of the class from the start.
- Size check: all 25 ranks are about one good magic item per stat. A step 5 build gives +30-60 % damage; Might at max adds 15.
  Ranks matter, gear and abilities matter more.


## 5. The merchant (in-run)

- **Where**: rooms index `lo` 1 to `hi` 8 (the 2nd to the 9th room; never the first, the boss room or the test room).
  Present in room i when `G.hash32(seed, 6060 + i x 37) / 4294967296 < merchant.chance` (0.15), in room order, at most
  `maxPerRun` 2. `G.merchantRooms(seed, B)` returns the list (pure, no rng stream touched). About 1.1 merchants in a full run.
- **Spot**: the first entry of `merchant.spots` (tile offsets from the start tile: (2,0), (-2,0), (2,-1), (-2,-1), (0,-2), (0,2))
  whose tile is open floor (not a wall). The start area is kept free of cracks by mapgen, so the spot is reachable. No map
  change. If none is open (should not happen), no merchant in that room. He does not block movement, monsters ignore him,
  he cannot be hurt. He stays the whole room.
- **Buying**: when the hero is within `talkR` 22 px, a "TRADE" tag shows over him. Tapping (clicking) him, or the
  inventory key / `E`, opens his panel: `sim.openMerchant()`, state `'merchant'`, the run pauses (the scene steps only in `'play'`,
  as for the level-up). Out of range or in another state, nothing happens.
- **Stock** (per merchant, fixed, no rng): Scroll of Identification `scroll.price` 40 (town 25), stock 3; Healing potion
  `potion.price` 30, stock 2, heals 40 % of max HP at once (no potion item, no inventory slot). Prices do not scale with anything.
- **Payment**: the run's sealed gold only. A bought scroll goes to `sim.scrolls` (sealed: banked on leave / win, lost on death)
  and counts in `sim.scrollsBought` (not in `scrollsFound`).
- Panel: run gold, two rows (icon, name, price, "x left", BUY), CLOSE. QA names `merch_scroll`, `merch_potion`, `merch_close`.
  CLOSE or Esc -> `sim.closeMerchant()` -> `'play'`.


## 6. Per class or shared: per class

Gold (`gear.gold`), ranks (`gear.ranks`), the shop stock (`gear.shop`) and scrolls (`gear.scrolls`, unchanged) live in
`save.gears[cls]`, next to the class's worn gear and kept bag. Why:
- It is one rule for everything a run banks: a run banks its bag, scrolls and gold into the class that played it. No
  exception to explain, and the result screen and title show one class's numbers.
- Classes are separate characters. A shared wallet would let a strong class buy the ranks and scrolls of a new one, and
  switching class would skip the early game the user approved with per-class gear.
- The career check stays one class at a time, and the numbers of one class do not depend on what the others did.
The cost: a new class starts poor. That is the same as its empty gear today. (Open question 2.)


## 7. Scroll drops (lower)

Copy `economy.scrollDrops` into `BAL.loot` and delete `scrollDrops`:

| | before | after |
|---|---|---|
| killScroll (normal kill) | 0.012 | 0.002 |
| eliteScroll | 0.2 | 0.05 |
| bossScroll | 1 | 1 |
| chestScroll | 0.4 | 0.06 |
| superScroll | 0.5 | 0.06 |

Expected found per full run: about 0.7 kills + 0.9 elites (15 wardens) + 1 boss + 0.6 chests + 0.7 super = ~4 (with door bonus), down
from 13-16; a 5-room run ~1.2. `rng.chance` draws once whatever the chance, so no rng stream shifts; runs differ only because
fewer items get identified and worn.


## 8. Data shape (`src/balance.js`, already written)

```
economy: {
  gold:    { kill, close, superClose, chest, boss, room[10], door, deathKeeps, cap },
  sell:    { base[5], ilvl, unid, min, scroll },
  shop:    { rarities[6], maxRarity, ilvlAdd, buyMult, scroll },
  upgrade: { cost[5], ilvl, grow, max[5] },
  rankCost: [5],
  ranks:   { id: { name, stat, per, text } },          // order of keys = display order
  merchant:{ chance, lo, hi, maxPerRun, talkR, spots[[dx, dy]], scroll: { price, stock }, potion: { price, stock, heal } },
  scrollDrops: { ... }                                  // move into loot (section 7), then delete
}
bot.shop: { rankOrder[5], potionHp, baseItemMax }
```


## 9. Sim interfaces

New file `src/sim/economy.js` (pure functions over a `gear` and the items), loaded right after `sim/items.js`. Add it to the
file lists of `tools/build.py`, `tools/sim_bot.js`, `tools/determinism.js` and `tools/check_bag.js`.

**Items (`src/sim/items.js`)**
- Split `G.rollItem` so the stat roll is shared: `G.makeItem(rng, slot, rarity, wd, ilvl, B, gear)` does the shuffle, the
  ranges, the name and the id. `G.rollItem` keeps its draws in the same order (slot pick, rarity, weapon pick, shuffle,
  ranges): **runs must stay identical** (check with `sim_bot --seeds 1-10 --json` before switching the scroll drops).
- `G.rollShopItem(rng, ilvl, rarity, B, gear, clsId)`: throws if `rarity > B.economy.shop.maxRarity`; slot `rng.pick(ITEM_SLOTS)`,
  weapon type `rng.pick` among `loot.weaponTypes` with `cls === clsId`; `makeItem`; sets `src: 'shop'`, no `unid`.

**Economy (`src/sim/economy.js`)**
- `G.sellPrice(item, B)`, `G.buyPrice(item, B)` (shop items), `G.upgradeCost(item, B)` (null when it cannot be upgraded),
  `G.canUpgrade(item, B)`, `G.rankCost(gear, id, B)` (null at max).
- `G.sellFromBag(gear, idx, B)` -> gold gained (0 if no item); `G.sellScrolls(gear, n, B)`.
- `G.bankGold(gear, n, B)` -> amount kept (cap).
- `G.restockShop(gear, B, clsId)`: `gear.shop = { rolls, stock: [item|null x6] }` as in section 4.
  `G.ensureShop(gear, B, clsId)`: restock if `gear.shop` is missing or its stock is malformed.
- `G.shopBuy(gear, idx, B)` -> item or null (gold, room in the kept bag); `G.shopBuyScroll(gear, B)` -> bool.
- `G.upgradeItem(item, B)` -> bool (section 4); `G.upgradeAt(gear, where, B)` with `where` = `{ bag: idx }` or `{ slot: key }`
  pays and upgrades.
- `G.buyRank(gear, id, B)` -> bool; `G.rankStats(gear, B)` -> `{ stat: total }` (empty for a gear without `ranks`).
- `G.merchantRooms(seed, B)` -> sorted room indexes (section 5); `G.merchantSpot(room, B)` -> `{ x, y }` px or null.
- `G.computeStats` (core.js): add `r = G.rankStats(gear, B)` and use `v(k) = g[k] + p[k] + r[k]`.

**Sim state (`core.js`, `combat.js`, `fissures.js`)**
- Constructor: `gold = 0, goldFrac = 0, goldEarned = 0, goldSpent = 0, scrollsBought = 0`,
  `merchantAt = this.testRoom >= 0 ? [] : G.merchantRooms(seed, B)`.
- `loadRoom`: `this.merchant = merchantAt includes index ? { x, y, stock: { scroll, potion } } : null`.
- `S.addGold(base, src, x, y)`: test room -> nothing; else the formula of section 2; emits `{ t: 'gold', v, src, x, y }` when
  `v >= 1`. Called from `kill` (after the existing drops, so no draw order changes), `closeReward`, the chest opening, and the boss.
- `S.canTalk()`: state `'play'`, a merchant, distance <= `talkR`.
- `S.openMerchant()` -> bool; `S.merchantBuy(kind)` (`'scroll'` | `'potion'`) -> bool: stock left and `gold >= price`;
  `gold -= price; goldSpent += price`; scroll: `scrolls++, scrollsBought++`; potion: `heal(maxHp x heal)`; emits
  `{ t: 'buy', kind, price }`. `S.closeMerchant()` -> `'play'`. Events `{ t: 'merchant', open: true|false }`.
- `finishRun`: section 2; `result.gold`, `goldKept`, `goldEarned`, `goldSpent`, `scrollsBought`. `gold = 0` after.
- `S.cheatMerchant()` (debug): puts a merchant in this room at its spot and adds 200 sealed gold. DBG panel button `MERCHANT`
  (`dbg_merchant`).

**Determinism**: gold has no rng; the merchant's presence and spot are hashes of the seed; his stock is fixed; opening him is a
player input like a door. A run where nobody opens a merchant is the same run as before step 7 except for the scroll drop rates.

**Run end in the view**: when a run ends (`hud.js`, where it stores the save), call `G.restockShop(gear, B, cls)` before
`G.storeSave`. `sim_bot --career` does the same between runs.


## 10. Save v6 and migration (`src/save.js`)

- `G.newGear()` adds `gold: 0, ranks: {}, shop: null`. `G.newSave()` has `v: 6`.
- Items may carry `src: 'shop'`, `up`, `ilvl0`, `stats0`. Items without them are found items, never upgraded.
- Load v4 / v5 / v6 through the per-class path (accept `s.v` 4, 5 or 6): `gold` = whole number in [0, `gold.cap`], else 0;
  `ranks` = only known ids, whole numbers clamped to [0, `rankCost.length`]; `shop`: kept if it has `rolls >= 0` and a
  6-entry `stock` of items (`ok`) or nulls, else null (restocked on first open). Set `s.v = 6`. v2 / v3 go through the old
  path and get the defaults from `newGear`. Nothing is lost.


## 11. View

- **Title**: the row EQUIPMENT / SETTINGS becomes EQUIPMENT / SHOP / SETTINGS (three buttons of equal width, same row, names
  `title_gear`, `title_shop`, `title_settings`). Must fit at 540 px wide.
- **Shop panel** (`G.Panels.openShop(scene)`, same frame and grid style as the inventory): gold on top (coin icon), tabs
  BUY / SELL / UPGRADE / RANKS (`shop_buy`, `shop_sell`, `shop_up`, `shop_ranks`).
  BUY: 6 item cells + a scroll cell; tapping shows the item card (stats, "better/worse" hint as in EQUIPMENT) and BUY (price)
  (`shop_buy_item`), disabled without gold or bag room. SELL: the kept bag grid; the card shows the price (unidentified:
  "Sells for 6 (14 if identified)"), SELL (`shop_sell_item`); a row "Scrolls: n  SELL 1 (+5)" (`shop_sell_scroll`).
  UPGRADE: worn items then the kept bag, only those `canUpgrade`; the card shows the stats now -> after, ilvl, cost,
  "upgrades n/max", UPGRADE (`shop_up_item`). RANKS: 5 rows: name, text, rank pips n/5, next cost, BUY (`shop_rank_<id>`).
  Every action stores the save.
- **EQUIPMENT** item detail on the title: SELL (price) next to DROP. The stats panel includes the ranks (they are in
  `computeStats`); the base line (`computeStats` with no gear) excludes them, so the difference shows as gear + ranks. Fine.
- **HUD**: coin icon and run gold next to the inventory button; `gold` events: "+v" floating in gold colour, throttled to one
  label per 0.2 s (sum the rest). Result screen: "Gold: +n kept" or "Gold: n lost".
- **Merchant**: sprite `merchant_0..2` (idle, 3 frames: hooded trader with a pack), a "TRADE" tag in range, the panel of
  section 5. Icons `i_gold` and `i_potion`. All art through `tools/pixelart.py`, palette `assets/palette.json`.


## 12. Bot policy (`src/qa/bot.js`)

**Which unidentified items are worth a scroll** (used in and out of runs; replaces "every own-class item, best first"):
own-class (`G.canEquip`), `unid`, and the worn item of its slot is missing, or of lower rarity, or of the same rarity and lower
item level. Order: rarity, then ilvl, then id.

**Between runs: `G.Bot.shopVisit(gear, B, clsId)`** (replaces `prepareGear` in `--career`; keep `prepareGear` for old callers).
Returns a log `{ sold: n, goldSold, scrollsBought, itemsBought: [names], upgrades: [names], ranks: [ids], spent: { scrolls, items, upgrades, ranks } }`.
1. `G.ensureShop`. Identify worthy items with kept scrolls; when out, buy a scroll (25) if gold allows and identify; repeat.
2. Equip the best per slot (today's loop).
3. Sell everything left in the kept bag (the bot keeps nothing it does not wear). Keep all scrolls.
4. Base items: in stock order, buy an item the class can wear when its slot is empty or its value beats the worn one by > 0.01,
   at most `bot.shop.baseItemMax` 2 per visit, and wear it (sell what it replaced).
5. Ranks and upgrades: repeatedly take the **cheapest affordable** of: the next rank of each rank, and the next upgrade of
   each worn found item. Ties: ranks in `bot.shop.rankOrder`, then upgrades in slot order. Stop when nothing is affordable.
6. Restock happens after the run (section 9), not here.

**In a run: the merchant.** Once per merchant room, after the chest is opened (phase `'exit'`): want = worthy items in the sealed
bag minus scrolls held; buy `min(want, stock, floor(gold / price))` scrolls, and a potion if HP < `bot.shop.potionHp` x max.
If there is something to buy, walk to him (`pathDir`), `openMerchant`, buy, `closeMerchant` in the same `update` call, then go on to
the exit. Otherwise ignore him. `G.botRun` treats a leftover `'merchant'` state by closing it.


## 13. Career check

`node tools/sim_bot.js --career 10 --seeds 1-10 --class <c>` for mage, warrior and archer (3 careers of 10 runs; not 30, see the
brief). Gear, gold, ranks, scrolls and shop carry over; between runs `shopVisit`, after each run `restockShop`.

Per run, print one line (and put it in `--json` under `runs[i].eco`):
`run i: ... gold +earned (kept k, lost l, merchant m) sold s (n items) | bought: scrolls a, items [..], upgrades [..], ranks [..] | gold left g`.
At the end print:
- gold per run (earned in run, from selling), total spent per category, ranks reached;
- the worn items: slot, name, rarity, ilvl (+ups), source (`drop` / `shop`), value;
- `bestFromDrops: PASS|FAIL`. PASS when the 3 highest-value worn items are all drops, and no worn shop item is worth more than the
  best worn drop. Also print the count of worn shop items (expected 0-2 by run 10) and assert no item of rarity >= 2 has `src: 'shop'`.

Tuning targets (tune `economy.gold.*`, prices, then rank costs; within +-50 % of the numbers here, else note it):
- gold earned per run (in run + selling): ~130 for a 3-room run, 500-750 for a win;
- scrolls found per full run 3-5; scrolls bought 1-5 per run;
- ranks bought by run 10: 5-12 of 25;
- worn shop items at run 10: at most 2, and `bestFromDrops` PASS for all three classes.


## 14. Acceptance checklist (implementation session)

Test budget (`CLAUDE.md` and the step brief): the determinism check, at most 10 seeds per Node bot run, careers of 10 runs,
3 browser seeds once at the end, 2 screenshots. Never more.

- [ ] Before any change: `node tools/sim_bot.js --seeds 1-10 --json --class <c>` for the 3 classes saved to /tmp. After the
      `makeItem` split and the economy code but **before** moving the scroll drops: identical field by field except the new
      gold fields. Run this check with no merchants (`--set economy.merchant.chance=0`), because the bot's merchant visit
      changes runs on purpose.
- [ ] `python3 tools/build.py` succeeds; `node tools/determinism.js` passes; extend it: seed 3 with a merchant room played twice
      (identical, including gold and purchases).
- [ ] `node tools/check_bag.js` passes, with new checks: sell prices of the table in section 3; unid price; scroll sell; shop stock
      rarities and ilvl, own-class weapons only; 200 restocks per class never above `maxRarity`; buy with no gold / full bag
      refused; upgrade (stats, power, cost, max, shop item refused, unidentified refused); ranks (cost curve, cap, stats in
      `computeStats`, not in gear score, not in families); gold banked on leave / win, lost on death, none in the test room;
      door bonus applied to gold; merchant rooms deterministic, never room 0 / boss / test, at most 2; merchant buy (gold,
      stock, sealed scroll lost on death, potion heals); save v5 -> v6 migration and a malformed v6 save.
- [ ] Node bot seeds 1-10 per class (default policy, fresh gear): 0 softlocks, 0 timeouts; report wins (they may drop with fewer
      scrolls; report, do not tune abilities for it), scrolls found per run, merchants met and used, gold per run.
- [ ] Careers (section 13), one per class: report the per-run lines and the end block; `bestFromDrops` PASS for all three.
- [ ] Browser: `node qa/bot.js` once at the end, 3 seeds (mage 3, warrior 4, archer 5): 0 console errors, 0 softlocks, results
      match Node.
- [ ] 2 screenshots: the title shop (RANKS or BUY tab) at 960x540, and the merchant panel in a run at 540x960 (DBG `MERCHANT`).
      Look at both: text fits, prices readable, nothing off screen.
- [ ] `docs/STATUS.md`: what was tested, the numbers, what is still rough. Append "Implementation notes" to this file for
      any choice this spec left open.
- [ ] One commit, English message; `python3 tools/check_secrets.py` before it.


## Open questions for the user

1. Death and gold: lose all the run's gold (default, like the bag) / keep 25 % / keep it all.
2. Gold, ranks and shop: per class (default) / one shared wallet, ranks per class / wallet and ranks shared by all classes.
3. Merchant payment: the run's gold only (default) / run gold first, then kept gold / kept gold only.
4. Shop rarities: common and magic (default) / common only / up to rare at a high price.


## Implementation notes (Sonnet, 2026-11-11)

- The shop stock has 7 entries (6 base items + the rare, see "Decisions by the user"); `G.shopStockOk` checks 7, not 6. Epic and legendary: `G.rollShopItem` throws above `shop.maxRarity` 2.
  `shop.maxRare` 1 is enforced in `G.restockShop`. A rare costs `shop.rareBuyMult` 10 x the identified sell price (250 / 400 / 550).
- The merchant opens with a tap on him or the I key (inventory key) when in reach. The spec's E key is the pulse key in this game, so it is not bound.
- Coins "flying to the counter" is a small gold burst at the source plus one summed "+n" label per 0.2 s; the HUD counter just updates.
- A potion can be bought at full HP (it heals nothing); the bot buys one only when HP < `bot.shop.potionHp`.
- The bot (`G.Bot.shopVisit`) buys the rare last, only with gold left after ranks and upgrades, and only when it beats the worn item.
  Careers never reached 250 spare gold, so no rare was bought (the code path is covered by a manual check with 5000 gold: it buys and wears it).
- Worthy unidentified items stay in the kept bag between runs (they are not sold) while the bag has room for a full sealed bag (`stashSize - bagSize`); the weakest are sold beyond that.
- `sim_bot --career` runs `shopVisit` once before run 1 and once after every run (after `restockShop`); the sales printed on a run's line are those of the visit after that run.
- Quitting from settings does not call `finishRun` (as before): the run's gold is simply never banked, which is the same as losing it.
- `--set loot.killScroll=...` etc. restores the old scroll rates; with those and `economy.merchant.chance=0` the 10-seed runs of all 3 classes were identical field by field to the runs before step 7.

## Balance pass, 2026-11-11 (Opus)

Problem: after steps 6 and 7 careers of 10 runs won 1 / 0 / 0 (mage / warrior / archer), fresh gear 0 / 0 / 1. Causes: too few scrolls
(few items identified and worn) and a career leave target (start 3, +1 per extraction) that reaches the boss only at run 8, when the gear
score has already unlocked tier 2. Targets: career first win at run 4-7 and 2-5 wins; fresh gear 0-2 wins; no softlocks; best worn items from drops.
Not touched (step 10): abilities, monsters, classes, door modifiers, room difficulty.

Changes (all numbers in `src/balance.js`):
- `loot` scroll drops: killScroll 0.002 -> 0.0035, eliteScroll 0.05 -> 0.1, chestScroll 0.06 -> 0.22, superScroll 0.06 -> 0.2 (boss 1 unchanged).
- `economy.shop.scroll` 25 -> 15; `economy.merchant.scroll.price` 40 -> 25 (sell price 5 unchanged).
- `economy.rankCost` [60, 140, 260, 420, 620] -> [40, 90, 160, 250, 360] (1500 -> 900 per stat).
- Bot career policy, `bot.career` new `pushHp` 0.7 and `pushGear` 6 (`src/qa/bot.js` `Bot.canPush`, passed by `tools/sim_bot.js --career`):
  at the target room the bot goes on when HP >= 70 % and gear score >= 6 x the next room's number; still leaves
  under `lowHp`. `--leave N` turns pushing off. Fresh-gear runs are unchanged (no target).
- `tools/check_bag.js` reads the scroll, merchant and rank prices from the balance (scroll drop rates are listed with the new numbers).

Rounds (careers `--career 10 --seeds 1-10`, W = first win run; fresh `--seeds 1-10`), wins mage / warrior / archer:

| round | change | career wins (first) | fresh wins |
|---|---|---|---|
| 0 | before | 1 (10) / 0 / 0 | 0 / 0 / 1 |
| 1 | scrolls 0.004 / 0.12 / 0.3 / 0.25, prices 15 / 25 | 0 / 0 / 0 | 1 / 2 / 3 |
| 2 | pushHp 0.7 | 2 (6) / 1 (7) / 1 (5), many deaths | 1 / 2 / 3 |
| 3 | + pushGear 6 | 1 (7) / 2 (5) / 1 (7) | 1 / 2 / 3 |
| 4 | rank costs lower | 1 (6) / 3 (5) / 1 (10) | 1 / 2 / 3 |
| 5 | scrolls 0.003 / 0.08 / 0.15 / 0.15 | 1 (8) / 1 (5) / 1 (9) | 0 / 1 / 0 |
| 6 | scrolls 0.0035 / 0.1 / 0.22 / 0.2 (kept) | 3 (8) / 1 (5) / 1 (9) | 0 / 1 / 2 |

Result (round 6, kept; the budget of 6 rounds ended): **targets not fully met**. Fresh gear 0 / 1 / 2: met. Careers: mage 3 wins but the first at
run 8; warrior and archer 1 win (runs 5 and 9). 0 softlocks, 0 timeouts in all runs. `bestFromDrops` PASS x3 (mage wears 1 shop item).
Scrolls found per career run 6.0 / 5.3 / 3.2, fresh 2.7 / 4.6 / 4.1; gold per career run (earned + sold) 584 / 524 / 343; ranks by run 10 20 / 16 / 15 of 25
(above the spec's 5-12: intended, ranks add power without raising room threat).

What still limited careers before the tiers were removed (2026-11-11, historical): the career takes the highest unlocked tier, so after the first win the gear score passes 70 and
the bot plays tier 2, where it leaves hurt at rooms 7-9 or dies (warrior 4 deaths at tier 2); the archer dies in rooms 2-3 in its first 3 runs
and starts late. Next levers, not tried: a career tier policy (stay on a tier until it is won), `bot.career.startRoom` 2, more scrolls only from
chests / supers (careers are scroll-limited: round 5 vs 6), or the tier-2 difficulty in step 10.
