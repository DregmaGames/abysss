#!/usr/bin/env node
// Step 6 sim checks (Node, no browser): what happens to the sealed bag when a run is died, left or won; the doors and their
// modifiers; the save migration. Prints one line per check and exits 1 on the first group with a failure.
//   node tools/check_bag.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/boss.js', 'qa/bot.js', 'save.js'];
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
  check('save: v2 loads as v5, gear goes to mage (default), 24 items + 1 worn, junk dropped', s.v === 5 && total(s.gears.mage) === 25 && s.gears.mage.bag[0].name === 'Old helmet' && !s.gear);
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
  check('save: corrupt data gives a fresh save', G.loadSave().v === 5);
  // a full round trip: a run that leaves writes the bag to the save of the class that played
  store.data[KEY] = old(2);
  const sv = G.loadSave(), g = G.gearOf(sv, 'warrior'), sim = new G.Sim({ seed: 2, gear: g, cls: 'warrior' });
  sim.bag.push(G.rollItem(sim.rngRoom, 1, 0, sim.B, g, sim.cls)); sim.cheatChoice(); sim.leave(); G.storeSave(sv);
  const st = JSON.parse(store.data[KEY]);
  check('save: banking goes to the playing class (warrior 1 item, mage still 25)', st.v === 5 && total(st.gears.warrior) === 1 && total(st.gears.mage) === 25);
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
  check('save: a v4 save loads as v5, its items identified, scrolls 0', sv.v === 5 && sv.gears.mage.scrolls === 0 && !sv.gears.mage.bag[0].unid);
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

console.log(fails ? fails + ' check(s) FAILED' : 'all checks passed');
process.exit(fails ? 1 : 0);
