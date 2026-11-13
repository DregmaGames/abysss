#!/usr/bin/env node
// The tutorial's sim (src/sim/tutorial.js) under Node: a scripted player walks the whole tutorial for every class.
//   node tools/check_tutorial.js
// Checks: every step waits (idle ticks do not advance a step that needs an action) and advances when the action is done; the run is deterministic;
// the hero never dies; nothing is banked (no exp, gold, kept items) except the weapon of the first run; a replay puts back the weapon that was worn;
// a normal run is untouched by the tutorial code (no `sim.tut`).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'lore.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/tutorial.js', 'sim/boss.js', 'sim/daily.js', 'qa/bot.js', 'save.js'];
const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
const G = ctx.G;
let fails = 0;
const check = (name, ok, detail) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : '  -> ' + detail)); };

// a player: what a person would do at each step, through the sim's own inputs
function play(cls, opts) {
  opts = opts || {};
  const gear = opts.gear || G.newGear(cls);      // a new character: its starter weapon worn
  const s = new G.Sim({ seed: opts.seed || 1, gear, cls, tutorial: { reward: opts.reward !== false }, events: true });
  const R = s.room.tut, log = [], idleBad = [];
  let idleDone = {}, ticks = 0, diedBelow1 = false;
  const toward = (x, y) => { const dx = x - s.player.x, dy = y - s.player.y, l = Math.hypot(dx, dy) || 1; return l < 3 ? { mx: 0, my: 0 } : { mx: dx / l, my: dy / l }; };
  const nearest = list => { let b = null, bd = 1e9; for (const m of list) { if (m.dead) continue; const d = Math.hypot(m.x - s.player.x, m.y - s.player.y); if (d < bd) { bd = d; b = m; } } return b; };
  let last = s.tutId(), lastTick = 0;
  while (!s.tut.done && ticks < 60 * 240) {
    const id = s.tutId(), t = s.tut, p = s.player;
    if (id !== last) { log.push([last, id, ticks - lastTick]); last = id; lastTick = ticks; }
    let inp = { mx: 0, my: 0, dodge: false, pulse: false };
    // idle test: when a step starts, 150 ticks of doing nothing must not advance it (steps that need a fight excepted)
    if (!idleDone[id]) {
      if (['move', 'dodge', 'cross', 'skill', 'chest', 'pickup', 'bag', 'identify', 'equip', 'exit'].indexOf(id) >= 0) {
        const before = s.tut.step;
        for (let i = 0; i < 150; i++) { s.input.mx = 0; s.input.my = 0; s.input.dodge = false; s.input.pulse = false; s.step(); ticks++; }
        if (s.tut.step !== before && !s.tut.done) idleBad.push(id + ' advanced while idle');
      }
      idleDone[id] = true;
      continue;
    }
    switch (id) {
      case 'move': inp = { mx: 0, my: -1 }; break;
      case 'attack': { const d = t.dummy; inp = Math.hypot(d.x - p.x, d.y - p.y) > 20 ? toward(d.x, d.y) : { mx: 0, my: 0 }; break; }
      case 'dodge': inp = { mx: 1, my: 0, dodge: true }; break;
      case 'cross': {
        const nearLip = p.y < R.crackY + 34 && Math.abs(p.x - R.spot.x) < 30;
        if (!nearLip) inp = toward(R.spot.x, R.crackY + 28); else inp = { mx: 0, my: -1, dodge: true };
        break;
      }
      case 'skill': inp = { mx: 0, my: 0, pulse: true }; break;
      case 'darken': case 'super': { const m = nearest(s.monsters); inp = m ? (Math.hypot(m.x - p.x, m.y - p.y) > (cls === 'warrior' ? 20 : 60) ? toward(m.x, m.y) : { mx: 0, my: 0 }) : toward(R.spot.x, R.crackY - 30); break; }
      case 'chest': inp = toward(s.chest.x, s.chest.y); break;
      case 'pickup': { const d = nearest(s.drops.map(x => ({ x: x.x, y: x.y }))); inp = d ? toward(d.x, d.y) : { mx: 0, my: 0 }; break; }
      case 'bag': s.tutNote('bag'); break;
      case 'identify': { const i = s.bag.indexOf(t.item); if (i >= 0) s.identifySealed(i); break; }
      case 'equip': { const i = s.bag.indexOf(t.item); if (i >= 0) s.equipFromSealed(i); break; }
      case 'exit': inp = toward(s.exit.x, s.exit.y + 4); break;
    }
    Object.assign(s.input, { mx: inp.mx || 0, my: inp.my || 0, dodge: !!inp.dodge, pulse: !!inp.pulse });
    s.step(); ticks++;
    if (s.player.hp < 1) diedBelow1 = true;
    if (s.state !== 'play') break;
  }
  return { s, gear, log, idleBad, ticks, diedBelow1 };
}

for (const cls of ['mage', 'warrior', 'archer']) {
  const r = play(cls), s = r.s;
  check(cls + ': the whole tutorial is played to the end (' + (r.ticks / 60).toFixed(0) + ' s)', s.tut.done && s.state === 'play', 'stuck at ' + s.tutId() + ' after ' + r.ticks + ' ticks');
  check(cls + ': all 13 steps were passed in order', r.log.map(l => l[0]).join() === G.TUT_STEPS.slice(0, 12).join(), r.log.map(l => l[0]).join());
  check(cls + ': no step advanced while the hero did nothing', r.idleBad.length === 0, r.idleBad.join('; '));
  check(cls + ': the hero never dropped below 1 HP and the run did not end', !r.diedBelow1 && s.result == null);
  check(cls + ': no exp, level, gold or scrolls from the tutorial; the kept bag holds only the starter weapon the tutorial one replaced', s.player.level === 1 && s.player.exp === 0 && s.gold === 0 && r.gear.gold === 0 && r.gear.bag.length === 1 && r.gear.bag[0].starter === true && r.gear.scrolls === 0, JSON.stringify(r.gear.bag));
  const w = r.gear.equipped.weapon;
  check(cls + ': the first time the tutorial weapon stays equipped, identified, of the hero\'s class, and it is better than the starter', !!w && w === s.tut.item && !w.unid && G.canEquip(w, s.B, cls) && G.itemValue(w, s.B) > G.itemValue(r.gear.bag[0], s.B), JSON.stringify(w));
  check(cls + ': the sealed bag and scrolls are empty at the end (nothing carried out)', s.bag.length === 0 && s.scrolls === 0);
  const r2 = play(cls);
  check(cls + ': deterministic (same ticks, same kills, same item)', r2.ticks === r.ticks && r2.s.kills === s.kills && JSON.stringify(r2.s.tut.item.stats) === JSON.stringify(s.tut.item.stats));
}
// a replay: the weapon that was worn comes back, the tutorial one is gone, nothing else changes
{
  const g = G.newGear();
  const worn = { id: 900, slot: 'weapon', rarity: 0, ilvl: 1, name: 'Worn Staff', stats: { dmgPct: 5 }, power: 2, wtype: 'staff' };
  g.equipped.weapon = worn; g.nextId = 901;
  const r = play('mage', { gear: g, reward: false });
  check('replay: the worn weapon is back after the tutorial and nothing was added to the kept bag', r.s.tut.done && g.equipped.weapon === worn && g.bag.length === 0, JSON.stringify(g.equipped.weapon));
  const g2 = G.newGear(); g2.equipped.weapon = worn;
  const r3 = play('mage', { gear: g2, reward: true });
  check('first time with a weapon already worn: the old one goes to the kept bag', r3.s.tut.done && g2.bag.length === 1 && g2.bag[0] === worn && g2.equipped.weapon === r3.s.tut.item);
}
// a character with no weapon at all (the starter was sold before a replay, or an old empty set): the item step still works
{
  const g = G.newGear(), r = play('archer', { gear: g, reward: true });
  check('no weapon worn at the start: the tutorial weapon is equipped and kept, the kept bag stays empty', r.s.tut.done && g.equipped.weapon === r.s.tut.item && g.bag.length === 0);
  const g2 = G.newGear('warrior'), st = g2.equipped.weapon, r2 = play('warrior', { gear: g2, reward: false });
  check('replay with the starter worn: the starter is back in the hand, the tutorial weapon is gone', r2.s.tut.done && g2.equipped.weapon === st && g2.bag.length === 0);
}
// a dropped tutorial item comes back
{
  const gear = G.newGear(), s = new G.Sim({ seed: 3, gear, cls: 'mage', tutorial: { reward: true }, events: true });
  // jump the director to the pickup step by hand
  s.tut.step = G.TUT_STEPS.indexOf('chest'); s.phase = 'exit'; s.tutChest(s.chest.x, s.chest.y);
  for (const d of s.drops.slice()) { s.player.x = d.x; s.player.y = d.y; for (let i = 0; i < 40; i++) s.step(); }
  check('pickup: the item and the scroll are picked up by standing on them', s.bag.length === 1 && s.scrolls === 1, s.bag.length + ' ' + s.scrolls);
  s.tut.step = G.TUT_STEPS.indexOf('bag');
  s.dropSealed(0); s.step();
  check('a tutorial item dropped from the bag comes back as a pickup (the step goes back)', s.tutId() === 'pickup' && s.drops.some(d => d.item === s.tut.item));
}
// stragglers: monsters that cannot be reached (held far away on the other side of the crack) must not hold a fight step for ever
for (const cls of ['mage', 'warrior', 'archer']) {
  for (const stepId of ['skill', 'darken', 'super']) {
    const s = new G.Sim({ seed: 5, gear: G.newGear(), cls, tutorial: { reward: true }, events: true });
    const R = s.room.tut;
    s.tut.step = G.TUT_STEPS.indexOf(stepId); s.tut.act = {}; s.tutEnter(); s.phase = stepId === 'super' ? 'super' : s.phase;
    if (stepId === 'super') { s.player.y = R.crackY - 40; const f = s.fissures[s.fissures.length - 1]; f.state = 'open'; f.spawnCd = 0.1; }
    else if (stepId === 'darken') s.player.y = R.crackY - 40;
    else s.player.y = R.crackY + 40;
    let ticks = 0;
    while (s.tutId() === stepId && ticks < 60 * 90) {
      for (const m of s.monsters) if (!m.dead) { m.x = 24; m.y = s.room.h * 16 - 24; }      // held in a far corner, out of reach
      s.input.mx = 0; s.input.my = 0; s.input.dodge = false; s.input.pulse = stepId === 'skill';
      s.step(); ticks++;
    }
    check(cls + ': a fight step (' + stepId + ') with unreachable monsters ends by itself (' + (ticks / 60).toFixed(0) + ' s)', s.tutId() !== stepId, 'still in ' + stepId);
  }
}
// the tutorial code is invisible to normal runs
{
  const s = new G.Sim({ seed: 1, gear: G.newGear(), cls: 'mage' });
  check('a normal run has no tutorial state and a generated room', s.tut === null && s.room.w !== G.BAL.tutorial.w + 100 && s.testRoom === -1);
}
console.log(fails ? '\n' + fails + ' check(s) FAILED' : '\nall checks passed');
process.exit(fails ? 1 : 0);
