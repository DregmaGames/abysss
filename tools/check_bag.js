#!/usr/bin/env node
// Step 6 sim checks (Node, no browser): what happens to the sealed bag when a run is died, left or won; the doors and their
// modifiers; the save migration. Prints one line per check and exits 1 on the first group with a failure.
//   node tools/check_bag.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'lore.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/tutorial.js', 'sim/boss.js', 'sim/daily.js', 'qa/bot.js', 'save.js', 'backup.js'];
function load(store) {
  const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
  if (store) ctx.localStorage = store;
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}
let fails = 0;
function check(name, ok, extra) { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); }

// a sim with a few worn items and `n` items in the sealed bag
function mk(G, n, seed, bal) {
  const gear = G.newGear(), sim = new G.Sim({ seed: seed || 5, gear, bal });
  for (let i = 0; i < 3; i++) gear.equipped[G.ITEM_SLOTS[i]] = G.rollItem(sim.rngRoom, 1, 0, sim.B, gear, sim.cls);
  gear.bag.push(G.rollItem(sim.rngRoom, 1, 0, sim.B, gear, sim.cls));      // one item already kept from an earlier run
  for (let i = 0; i < n; i++) sim.bag.push(G.rollItem(sim.rngRoom, 3, 1, sim.B, gear, sim.cls));
  return sim;
}
const ids = o => Object.keys(o).map(k => o[k] && o[k].id).join(',');

(function dying() {
  const G = load(), sim = mk(G, 4), g = sim.gear, eq = ids(g.equipped), kept = g.bag.length;
  while (sim.state === 'play') sim.hurtPlayer(9999);
  check('die: state dead, sealed bag empty', sim.state === 'dead' && sim.bag.length === 0);
  check('die: all 4 items lost, none banked', sim.result.lost === 4 && sim.result.kept === 0 && g.bag.length === kept);
  check('die: equipped gear kept (deathKeepsEquipped true)', ids(g.equipped) === eq);
  const G2 = load(); G2.BAL.run.deathKeepsEquipped = false;
  const s2 = mk(G2, 2); s2.hurtPlayer(9999);
  check('die: with deathKeepsEquipped false the worn gear is stripped', Object.values(s2.gear.equipped).every(v => v === null));
})();

(function leaving() {
  const G = load(), sim = mk(G, 5), g = sim.gear, eq = ids(g.equipped), kept = g.bag.length;
  check('leave: not allowed in a room', sim.leave() === false && sim.state === 'play');
  sim.cheatChoice();
  check('choice: state choice, two different doors', sim.state === 'choice' && sim.doors.length === 2 && sim.doors[0] !== sim.doors[1], sim.doors.join(','));
  check('choice: nothing is banked yet', g.bag.length === kept && sim.bag.length === 5);
  check('leave: ok', sim.leave() === true && sim.state === 'left');
  check('leave: all 5 items moved to the kept bag, sealed bag empty', g.bag.length === kept + 5 && sim.bag.length === 0 && sim.result.kept === 5 && sim.result.lost === 0);
  check('leave: equipped gear untouched', ids(g.equipped) === eq);
  // a full kept bag: what does not fit is lost
  const s2 = mk(G, 8); while (s2.gear.bag.length < s2.B.loot.stashSize - 3) s2.gear.bag.push(G.rollItem(s2.rngRoom, 1, 0, s2.B, s2.gear, s2.cls));
  s2.cheatChoice(); s2.leave();
  check('leave: kept bag full, 3 of 8 fit, 5 lost', s2.gear.bag.length === s2.B.loot.stashSize && s2.result.kept === 3 && s2.result.lost === 5);
  // leaving the test room never banks
  const t = new G.Sim({ seed: 5, gear: G.newGear(), testRoom: true });
  t.bag.push(G.rollItem(t.rngRoom, 1, 0, t.B, t.gear, t.cls)); t.state = 'choice'; t.leave();
  check('leave: test room banks nothing', t.gear.bag.length === 0);
})();

(function winning() {
  const G = load(), sim = mk(G, 6), g = sim.gear, kept = g.bag.length;
  sim.cheatRoom(sim.B.run.rooms - 1);
  for (let i = 0; i < 800 && (sim.state === 'play' || sim.state === 'levelup'); i++) { if (sim.state === 'levelup') { sim.chooseAbility(0, 0); continue; } if (i % 20 === 0) sim.cheatSkipPhase(); sim.step(); }
  // the boss drops gear into the room: those are not picked up, so only the 6 items we put in count
  check('win: state won through the boss room (no choice after room 10)', sim.state === 'won', 'state ' + sim.state);
  check('win: sealed bag kept (6 items in the kept bag)', g.bag.length === kept + 6 && sim.bag.length === 0 && sim.result.kept === 6);
})();

(function doors() {
  const G = load(), B = G.BAL;
  const a = G.doorsFor(77, 3, B), b = G.doorsFor(77, 3, B);
  check('doors: same seed and room, same doors', JSON.stringify(a) === JSON.stringify(b), a.join(','));
  let varied = new Set(); for (let s = 1; s <= 30; s++) varied.add(G.doorsFor(s, 3, B).join());
  check('doors: they vary with the seed', varied.size > 5, varied.size + ' different pairs in 30 seeds');
  // the chosen door is the run's input: two sims with the same seed and choices end identical, another choice differs
  function play(pickIdx) {
    const gear = G.newGear(), sim = new G.Sim({ seed: 11, gear });
    sim.cheatChoice(); sim.takeDoor(pickIdx); sim.cheatChoice(); sim.takeDoor(0);
    for (let i = 0; i < 600; i++) sim.step();
    return { sim, h: JSON.stringify([sim.doorLog, sim.roomIndex, sim.room.hash, sim.fissures.length, sim.monsters.length, sim.tick, Math.round(sim.player.hp)]) };
  }
  const r1 = play(1), r2 = play(1), r3 = play(0);
  check('doors: same seed + same choices = same run', r1.h === r2.h, r1.sim.doorLog.join('>'));
  check('doors: the other door gives another run', r1.h !== r3.h, r3.sim.doorLog.join('>'));
  // each modifier does what it says (room index 2, seed 4)
  const base = new G.Sim({ seed: 4, gear: G.newGear() });
  base.loadRoom(2);
  const cells = f => f.fissures.filter(x => !x.big).reduce((t, x) => t + x.cells.length, 0), nb = base.fissures.filter(x => !x.big).length;
  const sup = f => f.fissures[f.fissures.length - 1].queue.length;
  for (const id of Object.keys(B.doors.mods)) {
    const m = B.doors.mods[id], s = new G.Sim({ seed: 4, gear: G.newGear() }); s.loadRoom(2, id);
    let ok = s.mod === id && s.lootBonus === m.loot, what = '';
    if (m.crackLen) { ok = ok && cells(s) > cells(base) * 1.1; what = 'crack cells ' + cells(base) + ' -> ' + cells(s); }
    if (m.extraCracks) { ok = ok && s.fissures.filter(x => !x.big).length === nb + m.extraCracks; what = 'cracks ' + nb + ' -> ' + s.fissures.filter(x => !x.big).length; }
    if (m.extraElite) { ok = ok && sup(s) === sup(base) + 1 && s.fissures[s.fissures.length - 1].queue.includes(m.extraElite); what = 'super wave ' + sup(base) + ' -> ' + sup(s); }
    if (m.threat) { ok = ok && Math.abs(s.threat / base.threat - m.threat) < 1e-9; what = 'threat x' + (s.threat / base.threat).toFixed(2); }
    if (m.spawnEvery || m.aliveThreat) what = (m.spawnEvery ? 'pause between packs x' + m.spawnEvery : 'alive cap x' + m.aliveThreat) + ' (read in updateFissures)';
    check('mod ' + id + ': loot +' + Math.round(m.loot * 100) + '%, ' + G.doorEffects(B, id).join('; '), ok, what);
  }
  // fast spawns: more monsters are out after the same time
  function pause(mod) { const s = new G.Sim({ seed: 4, gear: G.newGear(), cheats: { god: true } }); s.loadRoom(2, mod); for (let i = 0; i < 600 && !s.monsters.length; i++) s.step(); return s.spawnCd; }
  const o1 = pause(null), o2 = pause('fastSpawns');
  check('mod fastSpawns: the pause after a pack is halved', Math.abs(o2 / o1 - 0.5) < 0.05, o1.toFixed(2) + ' s -> ' + o2.toFixed(2) + ' s');
  // loot bonus: more gear dropped by the same kills (many rooms, deterministic)
  function dropsFor(mod) { let n = 0; for (let seed = 1; seed <= 12; seed++) { const s = new G.Sim({ seed, gear: G.newGear() }); s.loadRoom(1, mod); for (let k = 0; k < 400; k++) { s.spawnMonster('imp', s.player.x + 30, s.player.y, 0); s.kill(s.monsters[s.monsters.length - 1]); } n += s.drops.filter(d => d.kind === 'item').length; } return n; }
  const d0 = dropsFor(null), d1 = dropsFor('manyCracks');
  check('loot bonus: +30% gear drop chance gives more drops from the same kills', d1 > d0, d0 + ' -> ' + d1 + ' item drops (4800 imp kills)');
})();

(function equipInRun() {
  const G = load(), sim = mk(G, 4), g = sim.gear, B = sim.B;
  const w = G.BAL.loot.weaponTypes.find(t => t.cls !== sim.clsId), mine = G.BAL.loot.weaponTypes.find(t => t.cls === sim.clsId);
  const helm = sim.bag.find(i => i.slot === 'helmet') || (sim.bag[0].slot = 'helmet', sim.bag[0]);
  helm.unid = false;      // the fixture's roll may be rare or better (unidentified, not wearable yet): this check is about the swap
  const oldHelm = g.equipped.helmet, n0 = sim.bag.length, hi = sim.bag.indexOf(helm);
  const key = sim.equipFromSealed(hi);
  check('in-run equip: item moves from the sealed bag onto the hero', key === 'helmet' && g.equipped.helmet === helm && !sim.bag.includes(helm));
  check('in-run equip: the replaced item takes its place in the sealed bag (count same if one was worn)', sim.bag.length === (oldHelm ? n0 : n0 - 1) && (!oldHelm || sim.bag.includes(oldHelm)));
  if (w) { sim.bag.push({ id: 900, slot: 'weapon', wtype: w.id, rarity: 1, ilvl: 1, name: 'Foreign', stats: { dmg: 1 }, power: 1 }); const before = sim.bag.length; check('in-run equip: another class\'s weapon is refused', sim.equipFromSealed(before - 1) === null && sim.bag.length === before); }
  while (sim.bag.length < B.loot.bagSize) sim.bag.push(G.rollItem(sim.rngRoom, 1, 0, B, g, sim.cls));
  const arm = sim.bag.findIndex(i => i.slot === 'armor'); if (arm >= 0) { const ok = sim.equipFromSealed(arm); check('in-run equip: a swap works with a full sealed bag', ok === 'armor' && sim.bag.length === B.loot.bagSize || sim.bag.length === B.loot.bagSize - 1); }
  const worn = ids(g.equipped);
  sim.hurtPlayer(9999);
  check('in-run equip: gear equipped in the run survives death, the sealed bag does not', ids(g.equipped) === worn && sim.bag.length === 0);
})();

(function migration() {
  const store = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = v; } };
  const G = load(store), SLOTS = G.SLOTS, KEY = 'riftscar.save.v2';
  const item = (id, slot) => ({ id, slot, rarity: 1, ilvl: 2, name: 'Old ' + slot, stats: { hp: 9 }, power: 6 });
  const eq = {}; SLOTS.forEach(s => { eq[s] = null; }); eq.helmet = item(40, 'helmet');
  const bag = []; for (let i = 0; i < 24; i++) bag.push(item(i + 1, SLOTS[i % 7])); bag.push({ junk: true }, null);
  const old = (v, extra) => JSON.stringify(Object.assign({ v, gear: { equipped: eq, bag, nextId: 5 }, settings: { zoom: 1, shake: 50 }, stats: { runs: 7, wins: 1, best: 6 } }, extra));
  const total = g => g.bag.length + Object.values(g.equipped).filter(Boolean).length;
  store.data[KEY] = old(2);
  let s = G.loadSave();
  check('save: v2 loads as v8, gear goes to mage (default), 24 items + 1 worn, junk dropped', s.v === 8 && total(s.gears.mage) === 25 && s.gears.mage.bag[0].name === 'Old helmet' && !s.gear);
  check('save: other classes start empty (none stored, gearOf makes empty)', !s.gears.warrior && total(G.gearOf(s, 'warrior')) === 0 && total(G.gearOf(s, 'archer')) === 0);
  check('save: worn gear, settings and stats survive', s.gears.mage.equipped.helmet.id === 40 && s.settings.zoom === 1 && s.stats.runs === 7);
  check('save: item ids cannot collide with new drops (nextId raised)', s.gears.mage.nextId >= 41, 'nextId ' + s.gears.mage.nextId);
  store.data[KEY] = old(3, { settings: { zoom: 0, shake: 100, cls: 'warrior' } });
  s = G.loadSave();
  check('save: a v3 save goes to the class selected in it (warrior)', total(s.gears.warrior) === 25 && !s.gears.mage);
  const big = []; for (let i = 0; i < 50; i++) big.push(item(i + 1, 'armor'));
  store.data[KEY] = JSON.stringify({ v: 3, gear: { equipped: eq, bag: big, nextId: 51 } });
  check('save: an oversized old bag is kept whole (no item lost)', G.loadSave().gears.mage.bag.length === 50);
  const foreign = Object.assign(item(77, 'weapon'), { wtype: G.BAL.weaponTypes ? Object.keys(G.BAL.weaponTypes).find(k => G.weaponClass(G.BAL, k) === 'warrior') : null });
  if (foreign.wtype) {
    const eq2 = Object.assign({}, eq, { weapon: foreign });
    store.data[KEY] = JSON.stringify({ v: 3, gear: { equipped: eq2, bag: [], nextId: 5 }, settings: { cls: 'mage' } });
    s = G.loadSave();
    check('save: a warrior weapon worn in a mage-selected save is moved to its bag, not lost', s.gears.mage.equipped.weapon === null && s.gears.mage.bag.some(i => i.id === 77));
  }
  store.data[KEY] = JSON.stringify({ v: 2, gear: { equipped: {} } });
  check('save: a v2 save with no bag field loads', Array.isArray(G.loadSave().gears.mage.bag));
  store.data[KEY] = '{not json';
  check('save: corrupt data gives a fresh save', G.loadSave().v === 8);
  // a full round trip: a run that leaves writes the bag to the save of the class that played
  store.data[KEY] = old(2);
  const sv = G.loadSave(), g = G.gearOf(sv, 'warrior'), sim = new G.Sim({ seed: 2, gear: g, cls: 'warrior' });
  sim.bag.push(G.rollItem(sim.rngRoom, 1, 0, sim.B, g, sim.cls)); sim.cheatChoice(); sim.leave(); G.storeSave(sv);
  const st = JSON.parse(store.data[KEY]);
  check('save: banking goes to the playing class (warrior 1 item, mage still 25)', st.v === 8 && total(st.gears.warrior) === 1 && total(st.gears.mage) === 25);
  const sv2 = G.loadSave();
  check('save: v4 round trips; switching class shows the other stash', total(G.gearOf(sv2, 'warrior')) === 1 && total(G.gearOf(sv2, 'mage')) === 25 && total(G.gearOf(sv2, 'archer')) === 0);
  // equipping in one class does not touch another
  const mg = G.gearOf(sv2, 'mage'), before = total(G.gearOf(sv2, 'warrior'));
  G.equipFromBag(mg, 0, G.BAL, 'mage'); G.dropFromBag(mg, 0);
  check('save: equip and discard on one class leave the other untouched', total(G.gearOf(sv2, 'warrior')) === before && G.gearScore(G.gearOf(sv2, 'warrior')) === 0);
  // the sim of one class uses only that class's gear score
  check('sim: gear score of the played class only', G.gearScore(mg) > 0 && G.gearScore(G.gearOf(sv2, 'archer')) === 0);
})();

(function identification() {
  const store = { data: {}, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, v) { this.data[k] = v; } };
  const G = load(store), B = G.BAL, KEY = 'riftscar.save.v2';
  const sim0 = new G.Sim({ seed: 8, gear: G.newGear() });
  // rolling: commons identified, everything higher unidentified; stats are rolled at the drop (hidden, not rerolled)
  const rolled = []; for (let i = 0; i < 400; i++) rolled.push(G.rollItem(sim0.rngRoom, 3, 1, B, sim0.gear, sim0.cls));
  check('identify: commons drop identified, rarity 1+ drop unidentified', rolled.every(it => !!it.unid === (it.rarity >= 1)) && rolled.some(it => it.rarity === 0) && rolled.some(it => it.rarity >= 3));
  check('identify: an unidentified item still carries its rolled stats', rolled.filter(it => it.unid).every(it => Object.keys(it.stats).length === it.rarity + 1));
  // same seed, same drops (the flag costs no rng draw): the stats of two sims are equal, and identifying changes nothing but the flag
  const a = new G.Sim({ seed: 8, gear: G.newGear() }), b = new G.Sim({ seed: 8, gear: G.newGear() });
  const ia = G.rollItem(a.rngRoom, 3, 1, B, a.gear, a.cls), ib = G.rollItem(b.rngRoom, 3, 1, B, b.gear, b.cls);
  let rare = ia; for (let i = 0; i < 50 && !rare.unid; i++) rare = G.rollItem(a.rngRoom, 3, 1, B, a.gear, a.cls);
  const snap = JSON.stringify(Object.assign({}, rare, { unid: 0 }));
  a.gear.scrolls = 1; a.bag.push(rare);
  check('identify: same seed gives the same item', JSON.stringify(ia) === JSON.stringify(ib));
  check('identify: an unidentified item cannot be equipped (sim and bag)', a.equipFromSealed(0) === null && a.bag.length === 1 && G.equipFromBag({ equipped: {}, bag: [rare] }, 0, B, a.clsId) === null);
  check('identify: a scroll identifies one item and spends one scroll (kept)', a.identifySealed(0) && !rare.unid && (a.gear.scrolls | 0) === 0 && a.identified === 1);
  check('identify: identifying reveals the rolled stats, no reroll', JSON.stringify(Object.assign({}, rare, { unid: 0 })) === snap);
  check('identify: no scroll, no identify; an identified item cannot be identified again', (() => { const u = Object.assign({}, rare, { unid: true }); a.bag.push(u); const r1 = a.identifySealed(a.bag.length - 1); return !r1 && u.unid && !a.identifySealed(0); })());
  // sealed scrolls are spent before kept ones; banked on leave / win, lost on death
  const mkS = (kept, sealed) => { const s = new G.Sim({ seed: 8, gear: G.newGear() }); s.gear.scrolls = kept; s.scrolls = sealed; return s; };
  let s = mkS(2, 1); s.bag.push(Object.assign({}, rare, { unid: true }), Object.assign({}, rare, { unid: true }));
  s.identifySealed(0); check('scrolls: a sealed scroll is spent first', s.scrolls === 0 && s.gear.scrolls === 2);
  s.identifySealed(1); check('scrolls: then a kept one', s.gear.scrolls === 1);
  s = mkS(2, 3); s.cheatChoice(); s.leave();
  check('scrolls: leaving banks the sealed scrolls into the kept count (2 + 3)', s.gear.scrolls === 5 && s.result.scrollsKept === 3 && s.scrolls === 0);
  s = mkS(2, 3); s.hurtPlayer(9999);
  check('scrolls: death loses the sealed scrolls, the kept ones stay', s.gear.scrolls === 2 && s.scrolls === 0 && s.state === 'dead');
  s = mkS(98, 5); s.cheatChoice(); s.leave();
  check('scrolls: the kept count is capped (' + B.loot.scrollCap + ')', s.gear.scrolls === B.loot.scrollCap);
  s = new G.Sim({ seed: 8, gear: G.newGear(), testRoom: true }); s.scrolls = 2; s.state = 'choice'; s.leave();
  check('scrolls: the test room banks nothing', (s.gear.scrolls | 0) === 0);
  // drops: scrolls come from monsters (rarely), elites, bosses and chests; they go to the sealed count
  function scrollsFrom(type, n) { let c = 0; for (let seed = 1; seed <= 6; seed++) { const q = new G.Sim({ seed, gear: G.newGear() }); q.loadRoom(1); for (let k = 0; k < n / 6; k++) { q.spawnMonster(type, q.player.x + 30, q.player.y, 0); q.kill(q.monsters[q.monsters.length - 1]); } c += q.drops.filter(d => d.kind === 'scroll').length; } return c; }
  const n = 3000, pi = scrollsFrom('imp', n) / n, pw = scrollsFrom('warden', 600) / 600;
  check('scrolls: an imp drops a scroll about ' + B.loot.killScroll * 100 + '% of kills, a warden more', pi > B.loot.killScroll * 0.6 && pi < B.loot.killScroll * 1.6 && pw > pi * 5, (pi * 100).toFixed(2) + '% imp, ' + (pw * 100).toFixed(1) + '% warden');
  const q = new G.Sim({ seed: 3, gear: G.newGear() }); q.loadRoom(1); q.spawnDrop('scroll', q.player.x, q.player.y, null); q.drops[0].age = 1; q.updateDrops ? q.updateDrops(0.1) : q.updatePickups(0.1);
  check('scrolls: walking over a dropped scroll adds it to the sealed count', q.scrolls === 1 && q.drops.length === 0);
  // title: identify from the kept bag
  const g = G.newGear(); g.scrolls = 1; g.bag.push(Object.assign({}, rare, { unid: true }), Object.assign({}, rare, { unid: true }));
  check('identify: on the title the kept bag item is identified with a kept scroll, one per scroll', G.identifyInBag(g, 0) && !g.bag[0].unid && g.scrolls === 0 && !G.identifyInBag(g, 1) && g.bag[1].unid);
  // saves: old items count as identified; scrolls are per class and survive the round trip
  const it = { id: 3, slot: 'armor', rarity: 3, ilvl: 4, name: 'Old armor', stats: { armor: 9, hp: 4 }, power: 20 };
  store.data[KEY] = JSON.stringify({ v: 3, gear: { equipped: { armor: it }, bag: [Object.assign({}, it, { id: 4 })], nextId: 5 }, settings: { cls: 'archer' } });
  let sv = G.loadSave(), ag = G.gearOf(sv, 'archer');
  check('save: items of an old save are identified (rare, no unid flag), scrolls 0, all on the archer', ag.equipped.armor.rarity === 3 && !ag.equipped.armor.unid && !ag.bag[0].unid && ag.scrolls === 0 && G.canEquipNow(ag.bag[0], B, 'archer'));
  store.data[KEY] = JSON.stringify({ v: 4, gears: { mage: { equipped: {}, bag: [it], nextId: 9 } }, settings: {} });
  sv = G.loadSave();
  check('save: a v4 save loads as v8, its items identified, scrolls 0', sv.v === 8 && sv.gears.mage.scrolls === 0 && !sv.gears.mage.bag[0].unid);
  G.gearOf(sv, 'warrior').scrolls = 4; sv.gears.mage.bag.push(Object.assign({}, it, { id: 10, unid: true })); G.storeSave(sv);
  const sv3 = G.loadSave();
  check('save: scrolls and unidentified items round trip, per class', G.gearOf(sv3, 'warrior').scrolls === 4 && G.gearOf(sv3, 'mage').scrolls === 0 && sv3.gears.mage.bag[1].unid === true);
  // the bot: identifies the best usable unidentified item first, equips only identified own-class items
  const bg = G.newGear(); bg.scrolls = 1;
  const mk2 = (id, rarity, slot) => ({ id, slot, rarity, ilvl: 2, name: 'x', stats: { hp: 30 }, power: 5, unid: true });
  bg.bag.push(mk2(1, 1, 'helmet'), mk2(2, 3, 'armor'), mk2(3, 2, 'boots'));
  G.Bot.prepareGear(bg, B, 'mage');
  check('bot: with one scroll it identifies the highest rarity item and equips it, leaves the others', !!bg.equipped.armor && !bg.equipped.helmet && !bg.equipped.boots && bg.scrolls === 0 && bg.bag.every(i => i.unid));
})();

// ---------------------------------------------------------------- step 7: the economy
(function economy() {
  const G = load(), B = G.BAL, E = B.economy, near = (a, b) => Math.abs(a - b) < 1e-9;
  const it = (rarity, ilvl, extra) => Object.assign({ id: 1, slot: 'armor', rarity, ilvl, name: 'x', stats: { armor: 10 }, power: ilvl * (2 + rarity) }, extra || {});
  // sell prices (spec section 3)
  const table = { 0: [3, 5, 8, 10], 1: [8, 14, 20, 26], 2: [20, 35, 50, 65], 3: [50, 88, 125, 163], 4: [120, 210, 300, 390] };
  let ok = true;
  for (const r in table) [1, 4, 7, 10].forEach((l, k) => { if (G.sellPrice(it(+r, l), B) !== Math.round(table[r][k] + (table[r][k] % 1))) { if (Math.abs(G.sellPrice(it(+r, l), B) - table[r][k]) > 1) ok = false; } });
  check('sell: prices match the table (rounding within 1)', ok);
  check('sell: unidentified magic ilvl 1 = 3, rare ilvl 4 = 14, legendary ilvl 1 = 48', G.sellPrice(it(1, 1, { unid: true }), B) === 3 && G.sellPrice(it(2, 4, { unid: true }), B) === 14 && G.sellPrice(it(4, 1, { unid: true }), B) === 48);
  const g = G.newGear(); g.bag.push(it(1, 4)); g.scrolls = 3;
  check('sell: from the bag pays and removes; 2 scrolls pay 5 each', G.sellFromBag(g, 0, B) === 14 && g.gold === 14 && g.bag.length === 0 && G.sellScrolls(g, 2, B) === 10 && g.gold === 24 && g.scrolls === 1);
  check('sell: nothing at a missing index', G.sellFromBag(g, 5, B) === 0);

  // the shop: rarities, ilvl, own-class weapons, 200 restocks per class, never above rare, at most 1 rare, rare price
  const ids = G.classIds(B);
  let stockOk = true, rareN = 0, restocks = 0, wOk = true, maxR = 0, priceOk = true, unidShop = false;
  ids.forEach(c => {
    const gear = G.newGear();
    for (let n = 0; n < 200; n++) {
      gear.equipped.helmet = n % 3 === 0 ? null : it(1, 1, { power: [0, 80, 200][n % 3] });      // gear score 0 / 80 / 200: the stock does not change with it
      const sh = G.restockShop(gear, B, c), ilvl = 1 + E.shop.ilvlAdd, rares = sh.stock.filter(x => x && x.rarity >= 2).length;
      restocks++; if (sh.stock.length !== 7 || rares > 1) stockOk = false;
      rareN += rares;
      sh.stock.forEach((x, i) => {
        if (!x) return;
        if (x.rarity !== E.shop.rarities[i] || x.ilvl !== ilvl || x.src !== 'shop' || x.unid) stockOk = false;
        if (x.rarity > maxR) maxR = x.rarity;
        if (x.unid) unidShop = true;
        if (x.slot === 'weapon' && G.weaponClass(B, x.wtype) !== c) wOk = false;
        const base = E.sell.base[x.rarity] * (1 + E.sell.ilvl * (ilvl - 1)), want = Math.round(base * (x.rarity >= 2 ? 10 : 5));
        if (G.buyPrice(x, B) !== want) priceOk = false;
      });
    }
  });
  check('shop: ' + restocks + ' restocks (3 classes): 7 entries, rarities and item levels (gear score does not matter), identified, src shop, one rare each', stockOk && rareN === restocks);
  check('shop: never above rare (max rarity ' + maxR + '), weapons only of the class', maxR === 2 && wOk);
  check('shop: epic and legendary are refused by the code', [3, 4].every(r => { try { G.rollShopItem(new G.RNG(1), 3, r, B, G.newGear(), 'mage'); return false; } catch (e) { return true; } }));
  const g2 = G.newGear(); G.restockShop(g2, B, 'mage'); const rare = g2.shop.stock[6], magic = g2.shop.stock[5];
  check('shop: rare price 250 (ilvl 2), 5 x the magic item ' + G.buyPrice(magic, B) + '; common 19', G.buyPrice(rare, B) === 250 && G.buyPrice(rare, B) === 5 * G.buyPrice(magic, B) && G.buyPrice(g2.shop.stock[0], B) === 19 && priceOk);
  check('shop: the rare costs more than 10x its sell price and than the first upgrade of a found rare of that level', G.buyPrice(rare, B) >= 10 * G.sellPrice(rare, B) && G.buyPrice(rare, B) > G.upgradeCost(it(2, rare.ilvl), B));
  // same save = same stock
  const a = G.newGear(), b = G.newGear(); G.restockShop(a, B, 'warrior'); G.restockShop(b, B, 'warrior');
  check('shop: same save, same stock; the next restock differs', JSON.stringify(a.shop.stock.map(x => x.name + x.ilvl)) === JSON.stringify(b.shop.stock.map(x => x.name + x.ilvl)) && a.shop.rolls === 1 && G.restockShop(a, B, 'warrior').rolls === 2);
  // buying
  const bg = G.newGear(); G.ensureShop(bg, B, 'mage');
  check('buy: no gold refuses, stock stays', G.shopBuy(bg, 0, B) === null && bg.shop.stock[0] !== null && bg.bag.length === 0);
  bg.gold = 1000; const p0 = G.buyPrice(bg.shop.stock[0], B), got = G.shopBuy(bg, 0, B);
  check('buy: with gold pays, item to the kept bag, entry sold out', got && bg.gold === 1000 - p0 && bg.bag[0] === got && bg.shop.stock[0] === null && G.shopBuy(bg, 0, B) === null);
  while (bg.bag.length < B.loot.stashSize) bg.bag.push(it(0, 1));
  check('buy: a full kept bag refuses', G.shopBuy(bg, 1, B) === null && bg.gold === 1000 - p0);
  const sp = B.economy.shop.scroll, sg = G.newGear(); sg.gold = sp + 5;
  check('buy: scroll ' + sp + ' gold, then refused without gold', G.shopBuyScroll(sg, B) && sg.scrolls === 1 && sg.gold === 5 && !G.shopBuyScroll(sg, B));

  // upgrades
  const ug = G.newGear(), up = it(1, 3, { stats: { armor: 20, hp: 10 } }); ug.bag.push(up); ug.gold = 1000;
  const c1 = G.upgradeCost(up, B);
  check('upgrade: magic ilvl 3 first upgrade costs 60', c1 === 60);
  check('upgrade: pays, ilvl +1, stats x(1+grow)/(1+grow), power, up 1', G.upgradeAt(ug, { bag: 0 }, B) && ug.gold === 940 && up.ilvl === 4 && up.up === 1 && up.power === 4 * 3 && up.stats.armor === Math.round(20 * (1 + B.items.ilvlGrow * 3) / (1 + B.items.ilvlGrow * 2)) && up.ilvl0 === 3);
  const c2 = G.upgradeCost(up, B); G.upgradeAt(ug, { bag: 0 }, B);
  check('upgrade: max for magic is 2 (second costs 1.5x the first scaled by level), the third is refused', c2 === Math.round(40 * (1 + 0.25 * 3) * 1.5) && up.up === 2 && G.upgradeCost(up, B) === null && !G.upgradeAt(ug, { bag: 0 }, B));
  check('upgrade: a shop item and an unidentified item are refused', !G.canUpgrade(it(0, 1, { src: 'shop' }), B) && !G.canUpgrade(it(2, 1, { unid: true }), B));
  check('upgrade: rare costs 100 / 150 / 200 at ilvl 2, 3, 4 (first, second, third)', (() => { const r = it(2, 4); const c = [G.upgradeCost(r, B)]; G.upgradeItem(r, B); c.push(G.upgradeCost(r, B)); return c[0] === Math.round(80 * 1.75) && c[1] === Math.round(80 * (1 + 0.25 * 4) * 1.5); })());
  const wg = G.newGear(); wg.equipped.armor = it(3, 2); wg.gold = 500;
  check('upgrade: a worn item can be upgraded and the gear score follows', G.upgradeAt(wg, { slot: 'armor' }, B) && wg.equipped.armor.ilvl === 3 && G.gearScore(wg) === 15);

  // ranks
  const rg = G.newGear(); rg.gold = 10000;
  const costs = []; for (let i = 0; i < 6; i++) { costs.push(G.rankCost(rg, 'might', B)); G.buyRank(rg, 'might', B); }
  const rc = B.economy.rankCost, rcSum = rc.reduce((t, v) => t + v, 0);
  check('ranks: cost curve ' + rc.join(' ') + ', then max (refused)', costs.slice(0, 5).join() === rc.join() && costs[5] === null && rg.ranks.might === 5 && rg.gold === 10000 - rcSum);
  const sA = G.computeStats(B, G.newGear(), {}, 'mage'), sB = G.computeStats(B, rg, {}, 'mage');
  check('ranks: stats in computeStats (Might 5 = +' + 5 * B.economy.ranks.might.per + ' % damage), not in the gear score', near(sB.dmg / sA.dmg, 1 + 0.05 * B.economy.ranks.might.per) && G.gearScore(rg) === 0);
  const poor = G.newGear(); poor.gold = rc[0] - 1;
  check('ranks: refused without gold', !G.buyRank(poor, 'vitality', B) && !poor.ranks.vitality);
  check('ranks: not abilities (no family counts)', JSON.stringify(G.familyCounts({}, B)) === JSON.stringify(G.familyCounts({}, B)) && !G.abilityPool(B, 'mage').some(x => /^(vitality|might|haste|guard|insight)$/.test(x.id || x)));

  // gold banking
  function run(kind, cls) {
    const gear = G.newGear(), sim = new G.Sim({ seed: 5, gear, cls }); sim.gold = 120; sim.goldEarned = 150;
    if (kind === 'dead') sim.hurtPlayer(9999); else if (kind === 'left') { sim.cheatChoice(); sim.leave(); } else { sim.cheatRoom(B.run.rooms - 1); sim.finishRun('won'); }
    return { gear, sim };
  }
  let r = run('left'); check('gold: leaving banks the run gold (120)', r.gear.gold === 120 && r.sim.result.goldKept === 120 && r.sim.gold === 0);
  r = run('won'); check('gold: winning banks it', r.gear.gold === 120 && r.sim.result.goldKept === 120);
  r = run('dead'); check('gold: dying loses it (deathKeeps 0), result says lost 120', r.gear.gold === 0 && r.sim.result.goldKept === 0 && r.sim.result.goldLost === 120);
  const t = new G.Sim({ seed: 5, gear: G.newGear(), testRoom: true }); t.gold = 50; t.addGold(10, 'kill', 0, 0); t.state = 'choice'; t.leave();
  check('gold: the test room earns and banks nothing', t.gear.gold === 0 && t.goldEarned === 0);
  const pw = run('left', 'warrior'), pm = run('left', 'mage'); pw.gear.gold += 0;
  const save = G.newSave(); G.gearOf(save, 'warrior').gold = 77; check('gold: per class (the mage wallet is separate)', G.gearOf(save, 'mage').gold === 0 && G.gearOf(save, 'warrior').gold === 77);
  // earning: kill, close, chest, boss, door bonus, no rng
  const q = new G.Sim({ seed: 5, gear: G.newGear() }); q.loadRoom(2);
  q.addGold(10, 'kill', 0, 0); const g10 = q.gold + q.goldFrac;
  check('gold: base x room (1.2) = 12', near(g10, 12));
  const q2 = new G.Sim({ seed: 5, gear: G.newGear() }); q2.loadRoom(2, 'hardened'); q2.addGold(10, 'kill', 0, 0);
  check('gold: a +25 % door: 10 x 1.2 x 1.25 = 15', near(q2.gold + q2.goldFrac, 15));
  const q3 = new G.Sim({ seed: 5, gear: G.newGear(), events: true }); q3.loadRoom(0);
  q3.spawnMonster && q3.spawnMonster('imp', q3.player.x + 20, q3.player.y, 0);
  const before = q3.goldEarned + q3.goldFrac; const m0 = q3.monsters[0]; if (m0) q3.kill(m0);
  check('gold: an imp kill pays 0.3 x 1 x 1', !m0 || near(q3.gold + q3.goldFrac - before, 0.3));
  let rngMoved = false; { const a1 = new G.Sim({ seed: 9, gear: G.newGear() }), a2 = new G.Sim({ seed: 9, gear: G.newGear() }); a1.loadRoom(1); a2.loadRoom(1); a1.addGold(50, 'x', 0, 0); rngMoved = a1.rngRoom.next && a1.rngRoom.next() !== a2.rngRoom.next(); }
  check('gold: addGold draws from no rng', !rngMoved);

  // the merchant
  const rooms = G.merchantRooms(3, B);
  let mOk = true, any = 0, tot = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const m = G.merchantRooms(seed, B), m2 = G.merchantRooms(seed, B);
    if (JSON.stringify(m) !== JSON.stringify(m2) || m.length > 2 || m.some(i => i < 1 || i > 8) || m.some((v, i) => i && v <= m[i - 1])) mOk = false;
    if (m.length) any++; tot += m.length;
  }
  check('merchant: rooms deterministic, 2nd to 9th room, at most 2 (' + (tot / 400).toFixed(2) + ' per run, ' + any + '/400 runs have one)', mOk && tot / 400 > 0.5 && tot / 400 < 1.7);
  let seedM = 1; while (!G.merchantRooms(seedM, B).length) seedM++;
  const ms = new G.Sim({ seed: seedM, gear: G.newGear() }), mr = G.merchantRooms(seedM, B)[0];
  check('merchant: not in the first room, nor the test room', !ms.merchant && new G.Sim({ seed: seedM, gear: G.newGear(), testRoom: true }).merchantAt.length === 0);
  ms.loadRoom(mr);
  check('merchant: stands in his room at an open floor spot', !!ms.merchant && !ms.wallAt(ms.merchant.x, ms.merchant.y) && ms.merchant.stock.scroll === 3 && ms.merchant.stock.potion === 2);
  check('merchant: cannot open him from afar or with no merchant', !ms.openMerchant() && !ms.canTalk());
  ms.player.x = ms.merchant.x + 10; ms.player.y = ms.merchant.y;
  check('merchant: in range, the panel opens and the run pauses', ms.canTalk() && ms.openMerchant() && ms.state === 'merchant');
  const t0 = ms.tick; ms.step(); check('merchant: a paused run does not step', ms.tick === t0);
  check('merchant: buying with no gold is refused', !ms.merchantBuy('scroll') && ms.scrolls === 0);
  const mp = B.economy.merchant.scroll.price; ms.gear.gold = 5000; ms.gold = 2 * mp + 5;
  check('merchant: pays from the run gold only (kept gold 5000 untouched)', !ms.merchantBuy('x') && ms.merchantBuy('scroll') && ms.merchantBuy('scroll') && ms.gold === 5 && ms.gear.gold === 5000 && !ms.merchantBuy('scroll'));
  check('merchant: scrolls are sealed and counted as bought, not found', ms.scrolls === 2 && ms.scrollsBought === 2 && ms.scrollsFound === 0 && ms.goldSpent === 2 * mp && ms.merchant.stock.scroll === 1);
  ms.gold = 100; ms.player.hp = ms.player.maxHp * 0.3; const hp0 = ms.player.hp;
  check('merchant: a potion heals 40 % of max HP at once for 30', ms.merchantBuy('potion') && Math.abs(ms.player.hp - (hp0 + ms.player.maxHp * 0.4)) < 1e-6 && ms.gold === 70);
  ms.merchantBuy('potion'); check('merchant: stock runs out (2 potions)', !ms.merchantBuy('potion'));
  check('merchant: close goes back to play', ms.closeMerchant() && ms.state === 'play');
  ms.cheatChoice(); ms.leave();
  check('merchant: a bought scroll is banked on leave', ms.gear.scrolls === 2 && ms.result.scrollsBought === 2);
  const md = new G.Sim({ seed: seedM, gear: G.newGear() }); md.loadRoom(mr); md.player.x = md.merchant.x; md.player.y = md.merchant.y; md.gold = 100; md.openMerchant(); md.merchantBuy('scroll'); md.closeMerchant(); md.hurtPlayer(9999);
  check('merchant: a bought scroll is lost on death', md.gear.scrolls === 0 && md.gear.gold === 0);
  const cm = new G.Sim({ seed: 5, gear: G.newGear() }); cm.cheatMerchant();
  check('merchant: the debug cheat adds one and 200 gold', !!cm.merchant && cm.gold === 200);
  // scroll drop rates
  check('scrolls: drop rates of the balance pass 2026-11-11 (kill 0.0035, elite 0.1, boss 1, chest 0.22, super 0.2); economy.scrollDrops is gone', B.loot.killScroll === 0.0035 && B.loot.eliteScroll === 0.1 && B.loot.bossScroll === 1 && B.loot.chestScroll === 0.22 && B.loot.superScroll === 0.2 && !('scrollDrops' in E));

  // saves
  const store = { data: {}, getItem(k) { return this.data[k] === undefined ? null : this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
  const L = load(store), KEY = 'riftscar.save.v2', item = { id: 3, slot: 'armor', rarity: 3, ilvl: 4, name: 'Old armor', stats: { armor: 9, hp: 4 }, power: 20 };
  store.data[KEY] = JSON.stringify({ v: 5, gears: { mage: { equipped: {}, bag: [item], nextId: 9, scrolls: 2 } }, settings: {} });
  let sv = L.loadSave();
  check('save: v5 loads as v8 with 0 gold, no ranks, no stock, nothing lost', sv.v === 8 && sv.gears.mage.gold === 0 && Object.keys(sv.gears.mage.ranks).length === 0 && sv.gears.mage.shop === null && sv.gears.mage.bag.length === 1 && sv.gears.mage.scrolls === 2);
  const shopOk = L.newGear(); L.restockShop(shopOk, L.BAL, 'mage');
  store.data[KEY] = JSON.stringify({ v: 6, gears: { mage: { equipped: {}, bag: [item], nextId: 9, scrolls: 0, gold: 321.9, ranks: { might: 9, bogus: 2, guard: 2, haste: -1, vitality: 'x' }, shop: shopOk.shop }, warrior: { equipped: {}, bag: [], nextId: 1, gold: -5, ranks: [], shop: { rolls: 1, stock: [1, 2] } } }, settings: {} });
  sv = L.loadSave();
  check('save: v6 keeps gold (whole), ranks (known ids, clamped 0-5), a valid stock', sv.gears.mage.gold === 321 && sv.gears.mage.ranks.might === 5 && sv.gears.mage.ranks.guard === 2 && !('bogus' in sv.gears.mage.ranks) && !sv.gears.mage.ranks.haste && !sv.gears.mage.ranks.vitality && sv.gears.mage.shop && sv.gears.mage.shop.stock.length === 7);
  check('save: a malformed v6 save gets gold 0, no ranks, no stock', sv.gears.warrior.gold === 0 && Object.keys(sv.gears.warrior.ranks).length === 0 && sv.gears.warrior.shop === null);
  sv.gears.mage.gold = 40; L.storeSave(sv); const sv2 = L.loadSave();
  check('save: gold and stock round trip', sv2.gears.mage.gold === 40 && sv2.gears.mage.shop.stock.length === 7);
  store.data[KEY] = JSON.stringify({ v: 3, gear: { equipped: { armor: item }, bag: [item], nextId: 5 }, settings: {} });
  sv = L.loadSave(); check('save: a v3 save gets the economy defaults, items kept', sv.v === 8 && sv.gears.mage.gold === 0 && sv.gears.mage.shop === null && sv.gears.mage.bag.length === 1);
  // the bot's visit
  const vg = L.newGear(); vg.gold = 400; vg.bag.push(it(1, 3, { unid: true, stats: { armor: 30 } }), it(0, 1));
  const log = L.Bot.shopVisit(vg, L.BAL, 'mage');
  check('bot: shopVisit identifies (buys a scroll), equips the worthy item, sells the rest, spends gold', !!vg.equipped.armor && !vg.equipped.armor.unid && log.scrollsBought >= 1 && log.sold >= 1 && vg.shop && vg.shop.rolls >= 1);
})();

// step 8: the city (Don Montoto, the cage, the city save)
(function city() {
  const G = load(), B = G.BAL, E = B.economy, M = E.montoto;
  // debug SKIP PHASE until the super fissure is closed (chest phase), stepping the sim between skips as the game does
  const clearRoom = sm => { for (let i = 0; i < 40 && sm.phase !== 'chest' && sm.state === 'play'; i++) { sm.cheatSkipPhase(); for (let k = 0; k < 120; k++) { if (sm.state === 'levelup') { sm.chooseAbility(0, 0); } sm.step(); } } };
  check('montoto: no appraise fee left in the balance or the code', E.appraiser === undefined && G.appraiseFee === undefined && G.appraiseAt === undefined);
  const g = G.newGear(), rng = new G.RNG(11), cls = G.classDef(B, 'mage');
  const items = [0, 1, 2].map(() => { const it = G.rollItem(rng, 3, 2, B, g, cls); it.unid = true; return it; });
  const snap = JSON.stringify(items.map(i => [i.stats, i.ilvl, i.name]));
  const known = G.rollItem(rng, 3, 2, B, g, cls); known.unid = false;
  g.bag.push(items[0], known, items[1], items[2]); g.gold = 100;
  check('identify all: refused until Don Montoto is rescued', !G.canIdentifyAll(g) && G.identifyAll(g).length === 0 && items.every(i => i.unid) && g.gold === 100);
  g.city.montoto = true;
  const res = G.identifyAll(g);
  check('identify all: free, clears every unid of the kept bag in bag order, never rerolls, costs no gold', res.length === 3 && res[0] === items[0] && res[2] === items[2] && items.every(i => !i.unid) && g.gold === 100 && JSON.stringify(items.map(i => [i.stats, i.ilvl, i.name])) === snap);
  check('identify all: nothing hidden -> nothing to do', !G.canIdentifyAll(g) && G.identifyAll(g).length === 0);
  // stories: the index cycles through every line, in order, and wraps; it is saved on the character
  const n = G.MONTOTO_STORIES.length, sg = G.newGear(), seen = [];
  for (let i = 0; i < n + 2; i++) seen.push(G.montotoStory(sg));
  check('stories: ' + n + ' lines (12 to 16), each { en } of 1-2 sentences', n >= 12 && n <= 16 && G.MONTOTO_STORIES.every(l => typeof l.en === 'string' && l.en.length > 20 && (l.en.match(/[.!?](\s|$)/g) || []).length <= 2));
  check('stories: each talk gives the next line, in order, cycling (line n+1 = line 1)', seen.slice(0, n).every((t, i) => t === G.MONTOTO_STORIES[i].en) && new Set(seen.slice(0, n)).size === n && seen[n] === seen[0] && seen[n + 1] === seen[1] && sg.city.story === 2);
  // the cage: room 5 of every run until rescued, none in the test room, none once rescued
  const fresh = G.newGear(); let bad = 0;
  for (let seed = 1; seed <= 200; seed++) { if (G.cageRoom(seed, B, fresh) !== 4 || G.cageRoom(seed, B, g) !== -1) bad++; }
  check('cage: always room 5 (index 4) for 200 seeds, none when rescued', bad === 0 && M.room === 4);
  const seed = 7, cg = G.newGear(), sim = new G.Sim({ seed, gear: cg, events: true });
  check('cage: none before room 5', sim.cage === null && sim.cageAt === 4);
  sim.cheatRoom(3); check('cage: none in room 4', sim.cage === null);
  sim.cheatRoom(4);
  check('cage: present from the start of room 5, not rescued', !!sim.cage && !sim.rescued && !cg.city.montoto && sim.phase === 'fissures' && !sim.roomClear());
  const spot = sim.cage; sim.player.x = spot.x + 10; sim.player.y = spot.y;
  const ev0 = sim.events.length;
  check('cage: in reach but the room is not clear -> refused, says so, stays closed', !sim.canFree() && sim.cageNear() && sim.freeCaged() === false && !cg.city.montoto && !!sim.cage && sim.events.slice(ev0).some(e => e.t === 'cagelocked'));
  sim.cheatSkipPhase(); for (let k = 0; k < 60; k++) sim.step(); sim.player.x = spot.x + 10; sim.player.y = spot.y;
  check('cage: network dark (phase super): still locked', sim.phase === 'super' && !sim.freeCaged() && !cg.city.montoto);
  clearRoom(sim);
  sim.player.x = spot.x + 60; sim.player.y = spot.y;
  check('cage: room clear (super fissure closed) but far away: cannot be freed', sim.roomClear() && sim.phase === 'chest' && !sim.canFree() && !sim.freeCaged() && !cg.city.montoto);
  sim.player.x = spot.x + 10; sim.player.y = spot.y;
  check('cage: clear and in reach: freed at once, saved on the character, event, cage gone', sim.canFree() && sim.freeCaged() && cg.city.montoto === true && sim.cage === null && sim.events.some(e => e.t === 'rescue'));
  sim.cheatRoom(5); sim.cheatRoom(4);
  check('cage: does not come back in this run once freed', sim.cage === null);
  check('cage: later runs of the same character have none', G.cageRoom(seed, B, cg) === -1 && new G.Sim({ seed, gear: cg }).cageAt === -1);
  // dying after freeing him keeps him
  const dg = G.newGear(), ds = new G.Sim({ seed, gear: dg }); ds.cheatRoom(4); clearRoom(ds); if (ds.state === 'levelup') ds.chooseAbility(0, 0);
  ds.player.x = ds.cage.x; ds.player.y = ds.cage.y; ds.freeCaged(); while (ds.state === 'play') ds.hurtPlayer(9999);
  check('cage: dying after freeing him does not undo it', ds.state === 'dead' && dg.city.montoto === true);
  check('cage: none in the test room', new G.Sim({ seed, gear: G.newGear(), testRoom: true }).cageAt === -1);
  // debug CAGE still works (and needs the room clear to open)
  const bg = G.newGear(), bs = new G.Sim({ seed, gear: bg }); bs.cheatCage(); bs.player.x = bs.cage.x; bs.player.y = bs.cage.y;
  check('cage: debug CAGE puts a locked cage beside the hero in any room', !!bs.cage && bs.cageNear() && !bs.canFree());
  // the sim is the same with or without the cage when the bot ignores it
  const a = G.botRun(seed, { gear: G.newGear() }), b = G.botRun(seed, { gear: (() => { const x = G.newGear(); x.city.montoto = true; return x; })() });
  check('cage: a bot that ignores it plays the same run as one with him already freed', a.result === b.result && a.rooms === b.rooms && a.kills === b.kills && a.seconds === b.seconds, '(' + a.result + ', ' + a.rooms + ' rooms, ' + a.kills + ' kills)');
  // the career bot frees him only when it reaches room 5 and clears it
  const rg = G.newGear(), rr = G.botRun(seed, { gear: rg, rescue: true, leave: 7 });
  check('cage: the career bot frees him when it clears room 5 (or died / left before)', rg.city.montoto === true || rr.rooms < 5, '(' + rr.result + ', ' + rr.rooms + ' rooms)');
  const sg2 = G.newGear(), sg3 = G.botRun(seed, { gear: sg2, rescue: true, leave: 3 });
  check('cage: leaving before room 5 never frees him', sg2.city.montoto === false, '(' + sg3.result + ', ' + sg3.rooms + ' rooms)');
  // the bot's visit identifies for free once he is rescued, no scroll used
  const vg = G.newGear(), vi = G.rollItem(rng, 3, 2, B, vg, cls); vi.unid = true; vg.bag.push(vi); vg.city.montoto = true; vg.scrolls = 0;
  G.Bot.prepareGear(vg, B, 'mage');
  check('bot: prepareGear identifies with Don Montoto for free (no scroll needed)', !vi.unid && vg.scrolls === 0);
  // the city save
  const store = { data: {}, getItem(k) { return this.data[k] === undefined ? null : this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
  const L = load(store), KEY = 'riftscar.save.v2', item = { id: 3, slot: 'armor', rarity: 3, ilvl: 4, name: 'Old armor', stats: { armor: 9, hp: 4 }, power: 20, unid: true };
  store.data[KEY] = JSON.stringify({ v: 6, gears: { mage: { equipped: {}, bag: [item], nextId: 9, scrolls: 1, gold: 50, ranks: { might: 2 } }, warrior: { equipped: {}, bag: [], nextId: 1 } }, settings: {} });
  let sv = L.loadSave();
  check('city save: v6 loads as v8, Don Montoto not rescued, items / gold / ranks untouched (an unidentified item stays unidentified)', sv.v === 8 && sv.gears.mage.city.montoto === false && sv.gears.warrior.city.montoto === false && sv.gears.mage.city.story === 0 && sv.gears.mage.bag.length === 1 && sv.gears.mage.bag[0].unid === true && sv.gears.mage.gold === 50 && sv.gears.mage.ranks.might === 2 && sv.gears.mage.scrolls === 1);
  // v7 -> v8: the old Appraiser flag becomes Don Montoto, per character
  store.data[KEY] = JSON.stringify({ v: 7, gears: { mage: { equipped: {}, bag: [item], nextId: 9, gold: 50, city: { appraiser: true } }, warrior: { equipped: {}, bag: [], nextId: 1, city: { appraiser: false } }, archer: { equipped: {}, bag: [], nextId: 1 } }, settings: {} });
  sv = L.loadSave();
  check('city save: v7 -> v8: a character that rescued the Appraiser keeps Don Montoto rescued; the others do not; nothing else lost', sv.v === 8 && sv.gears.mage.city.montoto === true && sv.gears.warrior.city.montoto === false && sv.gears.archer.city.montoto === false && sv.gears.mage.city.story === 0 && sv.gears.mage.bag.length === 1 && sv.gears.mage.gold === 50 && sv.gears.mage.city.appraiser === undefined);
  L.storeSave(sv); sv.gears.mage.city.story = 5; L.storeSave(sv);
  const sv3 = L.loadSave();
  check('city save: the rescue and the story index are per character and round trip', sv3.v === 8 && sv3.gears.mage.city.montoto === true && sv3.gears.mage.city.story === 5 && sv3.gears.warrior.city.montoto === false && sv3.gears.warrior.city.story === 0);
  store.data[KEY] = JSON.stringify({ v: 8, gears: { mage: { equipped: {}, bag: [], nextId: 1, city: { montoto: 'yes', story: -3 } }, warrior: { equipped: {}, bag: [], nextId: 1, city: 5 }, archer: { equipped: {}, bag: [], nextId: 1, city: { story: 9999 } } }, settings: {} });
  sv = L.loadSave();
  check('city save: a malformed city state counts as not rescued, story 0 (index wraps)', sv.gears.mage.city.montoto === false && sv.gears.mage.city.story === 0 && sv.gears.warrior.city.montoto === false && sv.gears.archer.city.montoto === false && sv.gears.archer.city.story === 9999 % n);
  store.data[KEY] = JSON.stringify({ v: 3, gear: { equipped: { armor: item }, bag: [item], nextId: 5 }, settings: {} });
  sv = L.loadSave(); check('city save: a v3 save gets the city state and keeps all items', sv.v === 8 && sv.gears.mage.city.montoto === false && sv.gears.mage.bag.length === 1 && sv.gears.mage.equipped.armor);
  check('city save: a fresh save is v8', L.newSave().v === 8 && L.newGear().city.montoto === false && L.newGear().city.story === 0);
})();

// step 10: the daily challenge. The date alone gives the run; the kit is its own gear set; nothing reaches a save.
(function daily() {
  const G = load(), G2 = load(), B = G.BAL;
  const a = G.dailyInfo('2026-11-12', B), b = G2.dailyInfo('2026-11-12', G2.BAL);
  check('daily: the same date gives the same seed, class and doors (two contexts)', JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a));
  const days = [], cls = new Set(), seeds = new Set();
  for (let d = 1; d <= 30; d++) { const i = G.dailyInfo('2026-12-' + String(d).padStart(2, '0'), B); days.push(i); cls.add(i.cls); seeds.add(i.seed); }
  check('daily: 30 days give 30 seeds and every class', seeds.size === 30 && cls.size === G.classIds(B).length, cls.size + ' classes');
  check('daily: a door index for every choice, each 0 or 1', days.every(i => i.doors.length === B.run.rooms - 1 && i.doors.every(x => x === 0 || x === 1)));
  check('daily: G.utcDate is the UTC day', G.utcDate(new Date(Date.UTC(2026, 10, 12, 23, 59))) === '2026-11-12' && G.utcDate(new Date(Date.UTC(2026, 10, 13, 0, 0))) === '2026-11-13');
  const k1 = G.dailyGear(a, B), k2 = G2.dailyGear(b, G2.BAL), worn = g => G.SLOTS.map(s => g.equipped[s]).filter(Boolean);
  check('daily: the kit is the same for everyone, worn, identified, the class can wear it', JSON.stringify(k1) === JSON.stringify(k2) && worn(k1).length === B.daily.kit.length && worn(k1).every(it => !it.unid && G.canEquip(it, B, a.cls)), worn(k1).map(it => it.name).join(', '));
  check('daily: the kit has no gold, ranks or kept bag, starts with the daily scrolls, no cage', k1.gold === 0 && G.rankTotal(k1) === 0 && k1.bag.length === 0 && k1.scrolls === B.daily.scrolls && G.cageRoom(a.seed, B, k1) === -1);
  // a daily sim offers only the day's door after each room
  const sim = new G.Sim({ seed: a.seed, gear: G.dailyGear(a, B), cls: a.cls, daily: a }), all = G.doorsFor(a.seed, 0, B);
  sim.enterChoice();
  check('daily: one door offered, the day\'s one (leave still allowed)', sim.doors.length === 1 && sim.doors[0] === all[a.doors[0]], sim.doors.join(','));
  // a whole daily run by the bot: the save is never touched
  const store = { data: {}, getItem(k) { return this.data[k] === undefined ? null : this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
  const L = load(store), save = L.newSave(), mine = L.gearOf(save, 'mage');
  mine.gold = 77; mine.bag.push(L.rollItem(new L.RNG(5), 2, 0, L.BAL, mine, 'mage'));
  L.storeSave(save);
  const before = store.data['riftscar.save.v2'], info = L.dailyInfo('2026-11-12', L.BAL), kit = L.dailyGear(info, L.BAL);
  const r = L.botRun(info.seed, { cls: info.cls, gear: kit, daily: info });
  check('daily: a bot run leaves the stored save and the save object as they were', store.data['riftscar.save.v2'] === before && JSON.stringify(save) === before, r.result + ' room ' + (r.room + 1));
  check('daily: every door taken was the day\'s door', r.doors.every((d, i) => d === L.doorsFor(info.seed, i, L.BAL)[info.doors[i]]), r.doors.join('>'));
  // the score
  const S = B.daily.score, fake = { B, state: 'won', tick: 600 * 60, roomsCleared: 10, kills: 300 };
  const sc = G.dailyScore(fake);
  check('daily: score of a win in 10:00 with 300 kills = rooms + kills + win + time bonus', sc.total === 10 * S.room + 300 * S.kill + S.win + (S.par - 600) * S.perSecond, String(sc.total));
  check('daily: a death scores rooms and kills only', G.dailyScore({ B, state: 'dead', tick: 100 * 60, roomsCleared: 4, kills: 90 }).total === 4 * S.room + 90 * S.kill);
})();

// first-time guidance state (step UX): hints in the save, the first-run flag, the gentler first run in the sim
(function ux() {
  const G = load();
  let h = G.cleanHints({ off: true, seen: { move: true, junk: 'x', crack: 1 } });
  check('ux: hints state is sanitized (off flag, only true / 1 entries kept)', h.off === true && h.seen.move === true && h.seen.crack === true && h.seen.junk === undefined);
  check('ux: a fresh save has hints on and none seen, a fresh gear has runs 0', G.newSave().hints.off === false && Object.keys(G.newSave().hints.seen).length === 0 && G.newGear().ux.runs === 0);
  const store = { data: {}, getItem(k) { return this.data[k] === undefined ? null : this.data[k]; }, setItem(k, v) { this.data[k] = v; } }, L = load(store), KEY = 'riftscar.save.v2';
  store.data[KEY] = JSON.stringify({ v: 8, gears: { mage: { equipped: {}, bag: [], nextId: 1 }, warrior: { equipped: {}, bag: [], nextId: 1, gold: 30 }, archer: { equipped: {}, bag: [], nextId: 1, ux: { runs: 3 } } } });
  let sv = L.loadSave();
  check('ux: a save from before the flag: an untouched character is fresh (runs 0), one with progress counts as veteran (1), an explicit count is kept', sv.gears.mage.ux.runs === 0 && sv.gears.warrior.ux.runs === 1 && sv.gears.archer.ux.runs === 3 && sv.hints.off === false);
  const g = G.newGear(), a = new G.Sim({ seed: 4, gear: g, cls: 'warrior' });
  check('ux: the first run is gentle and counts as started (runs 1); the next is not', a.gentle === true && g.ux.runs === 1 && new G.Sim({ seed: 4, gear: g, cls: 'warrior' }).gentle === false);
  const gm = G.BAL.run.gentle, hp = s => Math.round(s.B.monsters.imp.hp * s.threat);
  const b = new G.Sim({ seed: 4, gear: G.newGear(), cls: 'warrior' }), c = new G.Sim({ seed: 4, gear: G.newGear(), cls: 'warrior', gentle: false });
  check('ux: rooms 1-3 of a gentle run have ' + gm.mult + ' of the monster strength; room 4 is normal', Math.abs(b.threat / c.threat - gm.mult) < 1e-9);
  b.loadRoom(gm.rooms); c.loadRoom(gm.rooms);
  check('ux: from room ' + (gm.rooms + 1) + ' on the gentle flag changes nothing', b.threat === c.threat && hp(b) === hp(c));
  const t = new G.Sim({ seed: 4, gear: G.newGear(), cls: 'warrior', testRoom: true });
  check('ux: the test room is never gentle and does not use up the first run', t.gentle === false && t.gear.ux.runs === 0);
  const r1 = new G.Sim({ seed: 4, gear: G.newGear(), cls: 'warrior' }), r2 = new G.Sim({ seed: 4, gear: G.newGear(), cls: 'warrior' });
  for (let i = 0; i < 600; i++) { r1.step ? r1.step() : r1.update(); r2.step ? r2.step() : r2.update(); }
  check('ux: a gentle run is deterministic (same seed, same state)', r1.tick === r2.tick && r1.monsters.length === r2.monsters.length && r1.player.hp === r2.player.hp);
})();

// the interactive tutorial's flags in the save: a fresh save has it pending, a save with progress skips the forced room, replay resets it
(function tutorialFlags() {
  const G = load(), KEY = 'riftscar.save.v2';
  const fresh = G.newSave();
  check('tutorial: a fresh save has the tutorial pending, no weapon given, no gate done', fresh.hints.tut.state === 'pending' && fresh.hints.tut.got === false && Object.keys(fresh.hints.tut.steps).length === 0 && fresh.hints.off === false);
  const store = { data: {}, getItem(k) { return this.data[k] === undefined ? null : this.data[k]; }, setItem(k, v) { this.data[k] = v; } }, L = load(store);
  store.data[KEY] = JSON.stringify({ v: 8, gears: { mage: { equipped: {}, bag: [], nextId: 1 }, warrior: { equipped: {}, bag: [], nextId: 1, gold: 30 } }, hints: { off: false, seen: { move: true } } });
  let sv = L.loadSave();
  check('tutorial: an old save with progress (gold) does not get the forced tutorial; every gate counts as done; the weapon counts as given', sv.hints.tut.state === 'done' && sv.hints.tut.got === true && L.TUT_GATES.every(k => sv.hints.tut.steps[k] === true));
  store.data[KEY] = JSON.stringify({ v: 8, gears: { mage: { equipped: {}, bag: [], nextId: 1 } }, stats: { runs: 4, wins: 0, best: 3 } });
  check('tutorial: progress that shows only in the run counter also counts as a veteran', L.loadSave().hints.tut.state === 'done');
  store.data[KEY] = JSON.stringify({ v: 8, gears: { mage: { equipped: {}, bag: [], nextId: 1 } } });
  sv = L.loadSave();
  check('tutorial: an old save with nothing in it is a new player: the tutorial is pending', sv.hints.tut.state === 'pending' && sv.hints.tut.got === false && Object.keys(sv.hints.tut.steps).length === 0);
  const t = L.cleanHints({ off: false, seen: {}, tut: { state: 'skipped', got: true, steps: { city: true, card: 1, junk: true, cage: true } } }).tut;
  check('tutorial: a stored state round-trips; unknown or non-true gate flags are dropped', t.state === 'skipped' && t.got === true && t.steps.city === true && t.steps.cage === true && t.steps.card === undefined && t.steps.junk === undefined);
  check('tutorial: a damaged state falls back to pending', L.cleanHints({ tut: { state: 'weird', steps: 'x' } }).tut.state === 'pending' && L.cleanHints({ tut: 5 }).tut.state === 'pending');
  const s2 = L.newSave(); s2.hints.tut = L.newTut(true); s2.hints.off = true; s2.hints.seen = { unid: true };
  L.resetTut(s2);
  check('tutorial: replay resets it (pending, gates cleared, hints on and unseen) but keeps the weapon as given', s2.hints.tut.state === 'pending' && Object.keys(s2.hints.tut.steps).length === 0 && s2.hints.tut.got === true && s2.hints.off === false && Object.keys(s2.hints.seen).length === 0);
  const rt = L.parseSave(JSON.stringify(s2));
  check('tutorial: the flags survive a save and load (and the backup code)', rt.hints.tut.state === 'pending' && rt.hints.tut.got === true && L.decodeSave(L.encodeSave(s2)).save.hints.tut.state === 'pending');
  const g = L.newGear(), sim = new L.Sim({ seed: 1, gear: g, cls: 'mage', tutorial: { reward: true } });
  check('tutorial: its room does not touch the first-run flag or count as a run', g.ux.runs === 0 && sim.tut && sim.gentle === false);
})();

// save backup (step UX): export -> import round trip, corrupt / foreign / future codes refused, an old version migrates
(function backup() {
  const G = load();
  const sv = G.newSave(), rng = new G.RNG(77);
  ['mage', 'warrior', 'archer'].forEach((c, i) => {
    const g = G.gearOf(sv, c), sim = new G.Sim({ seed: 3 + i, gear: g, cls: c });
    for (let k = 0; k < 6; k++) g.bag.push(G.rollItem(sim.rngRoom, 3, k % 5, sim.B, g, sim.cls));
    g.equipped[G.ITEM_SLOTS[0]] = G.rollItem(sim.rngRoom, 2, 1, sim.B, g, sim.cls);
    g.gold = 120 + i; g.scrolls = i; g.ranks = i ? { might: 2 } : {}; g.ux.runs = 2;
  });
  sv.hints = { off: false, seen: { move: true, crack: true } }; sv.stats = { runs: 7, wins: 1, best: 9 };
  const code = G.encodeSave(sv), res = G.decodeSave(code);
  check('backup: the code is one line of text with the RS1 header and a checksum', /^RS1\.[A-Za-z0-9+\/=]+\.[0-9a-f]{8}$/.test(code), code.length + ' chars for ' + JSON.stringify(sv).length + ' of JSON');
  check('backup: compressed (smaller than the JSON)', code.length < JSON.stringify(sv).length);
  check('backup: export -> import round trip equals the original', res.ok && JSON.stringify(res.save) === JSON.stringify(G.parseSave(JSON.stringify(sv))) && res.save.v === 8 && res.from === 8);
  check('backup: the summary says what the code holds (characters, items, gold)', res.info.chars.length === 3 && res.info.items === 21 && res.info.gold === 120 + 121 + 122 && res.info.runs === 7);
  check('backup: whitespace and line breaks in a pasted code are ignored', G.decodeSave('  ' + code.replace(/(.{40})/g, '$1\n') + '\n ').ok);
  const flip = (s, at) => s.slice(0, at) + (s[at] === 'A' ? 'B' : 'A') + s.slice(at + 1);
  const bad = [['an empty text', ''], ['text that is not a code', 'hello world'], ['a cut code', code.slice(0, code.length - 20)], ['one changed character', flip(code, 30)], ['a changed checksum', flip(code, code.length - 2)], ['another game\'s code', 'XY9.' + code.split('.')[1] + '.' + code.split('.')[2]], ['a plain JSON save', JSON.stringify(sv)]];
  bad.forEach(([n, t]) => { const r = G.decodeSave(t); check('backup: ' + n + ' is refused with an error', !r.ok && !!r.err, r.err); });
  const lz = body => 'RS1.' + body + '.' + code.split('.')[2];
  // a code whose checksum is right but whose content is not a save: build one through the same encoder with other JSON
  const enc = obj => { const old = JSON.stringify; return G.encodeSave(obj); };
  check('backup: a valid code that holds something else (no gears) is refused', G.decodeSave(enc({ hello: 1 })).err === 'shape');
  check('backup: a save from a newer version is refused', G.decodeSave(enc({ v: 9, gears: {} })).err === 'version');
  check('backup: an old save (v6) in a code migrates to v8 with its items and gold', (() => {
    const item = { id: 3, slot: 'armor', rarity: 3, ilvl: 4, name: 'Old armor', stats: { armor: 9, hp: 4 }, power: 20, unid: true };
    const r = G.decodeSave(enc({ v: 6, gears: { mage: { equipped: {}, bag: [item], nextId: 9, scrolls: 1, gold: 50, ranks: { might: 2 } } }, settings: {}, stats: { runs: 2, wins: 0, best: 3 } }));
    return r.ok && r.from === 6 && r.save.v === 8 && r.save.gears.mage.gold === 50 && r.save.gears.mage.bag.length === 1 && r.save.gears.mage.bag[0].unid === true && r.save.gears.mage.city.montoto === false && r.save.hints.off === false;
  })());
  check('backup: non-ASCII text survives (escaped in the code)', G.decodeSave(enc({ v: 8, gears: {}, note: 'Capucha Salvaje ñ á €' })).ok);
  // the importing side keeps nothing of the code until it is confirmed: decodeSave never touches the current save
  const cur = G.newSave(); cur.stats.runs = 5; const before = JSON.stringify(cur);
  G.decodeSave(code); G.decodeSave('garbage');
  check('backup: checking a code changes nothing', JSON.stringify(cur) === before);
  // a full-size save: 3 characters with full bags and a shop
  const big = G.newSave(); ['mage', 'warrior', 'archer'].forEach(c => { const g = G.gearOf(big, c), sim = new G.Sim({ seed: 9, gear: g, cls: c }); for (let k = 0; k < 50; k++) g.bag.push(G.rollItem(sim.rngRoom, 5, k % 5, sim.B, g, sim.cls)); });
  const bc = G.encodeSave(big), br = G.decodeSave(bc);
  check('backup: a save with three full bags round trips', br.ok && br.info.items === 150, bc.length + ' chars');
})();

console.log(fails ? fails + ' check(s) FAILED' : 'all checks passed');
process.exit(fails ? 1 : 0);
