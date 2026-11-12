#!/usr/bin/env node
// Language checks (step 8b, Node, no browser): the English and Spanish tables have the same keys and placeholders, no key is unused,
// every character is in the bitmap font, English item / door / ability texts equal what the sim builds, Spanish item names assemble, and
// no English string is left hardcoded in src/view (the list is printed; anything not on the allow list fails).
//   node tools/check_i18n.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const SIM = ['balance.js', 'lore.js', 'i18n.js', 'i18n_ux.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/boss.js', 'save.js'];
const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx, { filename: f });
const G = ctx.G, en = G.LANG.en, es = G.LANG.es;
let fails = 0;
function check(name, ok, extra) { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f);

// 1. same keys
const ek = Object.keys(en), sk = Object.keys(es);
check('both tables have the same keys (' + ek.length + ' keys)', ek.length === sk.length && ek.every(k => k in es), 'missing in es: ' + ek.filter(k => !(k in es)).join(',') + ' | extra in es: ' + sk.filter(k => !(k in en)).join(','));
check('no empty text', ek.every(k => en[k] !== undefined && es[k] !== undefined && (en[k] !== '' || k.startsWith('x'))));
// 2. placeholders
const ph = s => (s.match(/\{[^}]+\}/g) || []).sort().join(' ');
const badPh = ek.filter(k => es[k] !== undefined && ph(en[k]) !== ph(es[k]));
check('same {placeholders} in both languages', !badPh.length, badPh.join(','));
// 3. unused keys: a key counts as used when its literal appears in the code (outside the tables) or its prefix is built in the code
const i18n = read('src/i18n.js'), code = walk('src/view').concat(walk('src/sim'), ['src/main.js']).map(read).join('\n') + i18n.slice(i18i(i18n));
function i18i(s) { return s.indexOf('G.LANG = {'); }
const dyn = new Set(); for (const m of code.matchAll(/'([a-z]+)\.'\s*\+/g)) dyn.add(m[1] + '.'); for (const m of code.matchAll(/'([a-z]+)\.'\)/g)) dyn.add(m[1] + '.');
dyn.add('items.');
const unused = ek.filter(k => !code.includes("'" + k + "'") && ![...dyn].some(p => k.startsWith(p)));
check('no unused keys', !unused.length, unused.join(','));
// dynamic prefixes must be complete for the data they index
const need = [];
Object.keys(G.BAL.abilities).forEach(a => need.push('ab.' + a + '.name', 'ab.' + a + '.desc'));
Object.keys(G.BAL.families).forEach(f => need.push('fam.' + f + '.name', 'fam.' + f + '.t2', 'fam.' + f + '.t4'));
Object.keys(G.BAL.doors.mods).forEach(d => need.push('door.' + d));
Object.keys(G.BAL.monsters).forEach(m => need.push('mob.' + m));
Object.keys(G.BAL.classes).forEach(c => need.push('cls.' + c, 'skill.' + c));
Object.keys(G.BAL.economy.ranks).forEach(r => need.push('rank.' + r + '.name', 'rank.' + r + '.text'));
G.BAL.loot.weaponTypes.forEach(w => need.push('wt.' + w.id, 'wbase.' + w.id));
G.ITEM_SLOTS.forEach(s => need.push('slot.' + s, 'base.' + s));
Object.keys(G.BAL.items.stat).forEach(s => need.push('stat.' + s, 'adj.' + s));
for (let i = 0; i < 5; i++) need.push('rar.' + i);
['fissures', 'super', 'chest', 'exit'].forEach(p => need.push('phase.' + p, 'obj.' + (p === 'super' ? 'super' : p)));
need.push('obj.boss', 'obj.gate');
check('every ability, family, door, monster, class, rank, slot, stat and rarity has a key in both languages', need.every(k => k in en && k in es), need.filter(k => !(k in en) || !(k in es)).join(','));
// 4. fonts
const font = JSON.parse(read('assets/font.json'));
const texts = ek.map(k => es[k]).concat(ek.map(k => en[k]), G.MONTOTO_STORIES.map(s => s.es), G.MONTOTO_STORIES.map(s => s.en), ['ENGLISH', 'ESPAÑOL']);
for (const c of Object.keys(G.BAL.classes)) texts.push(G.classLabel ? '' : '');
const missing = new Set(); texts.forEach(t => { for (const ch of t) { if (!font.font.chars[ch.charCodeAt(0)] || !font.fontbig.chars[ch.charCodeAt(0)]) missing.add(ch); } });
check('every character of every text is in both bitmap fonts', !missing.size, [...missing].join(' '));
// upper-casing used by the UI (class names, buttons) must stay inside the font too
const up = new Set(); Object.keys(G.BAL.classes).forEach(c => { for (const l of G.LANGS) { G.setLang(l); for (const ch of G.classLabel(c).toUpperCase()) if (!font.font.chars[ch.charCodeAt(0)]) up.add(ch); } });
G.setLang('en');
check('upper-cased class names stay in the font', !up.size, [...up].join(' '));
// 5. stories
check('16 stories, each with en and es', G.MONTOTO_STORIES.length === 16 && G.MONTOTO_STORIES.every(s => s.en && s.es && s.es.length > 20));
// 6. English texts equal what the sim builds
const bal = G.BAL; let bad = [];
Object.keys(bal.abilities).forEach(id => { for (let r = 1; r <= bal.abilities[id].max; r++) { const a = G.abilityInfo(id, bal, r, 'mage'), b = G.abilityText(id, bal, r, 'mage'); if (a.desc !== b.desc || a.name !== b.name || a.famName !== b.famName) bad.push(id + r); } });
check('English ability name, family and description = the sim card (all ranks)', !bad.length, bad.slice(0, 5).join(','));
bad = []; Object.keys(bal.doors.mods).forEach(d => { if (G.doorLines(bal, d).join('|').toLowerCase() !== G.doorEffects(bal, d).join('|').toLowerCase()) bad.push(d); });
check('English door lines = G.doorEffects', !bad.length, bad.join(','));
// items: English name = the stored name; Spanish names assemble
const gear = G.newGear(), rng = new G.RNG(99); bad = []; const esNames = new Set(), samples = {};
for (let i = 0; i < 600; i++) {
  const cls = ['mage', 'warrior', 'archer'][i % 3], it = G.rollItem(rng, 1 + (i % 5), 0.5, bal, gear, cls);
  G.setLang('en'); if (G.itemName(it) !== it.name) bad.push(it.name + ' != ' + G.itemName(it));
  G.setLang('es'); const n = G.itemName(it); esNames.add(n); if (!/^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü ]+$/.test(n)) bad.push('es? ' + n);
  samples[it.slot + (it.wtype || '') + it.rarity] = n + ' / ' + G.itemType(it);
}
G.setLang('en');
check('English item names assembled = the names the sim stores (600 items)', !bad.length, bad.slice(0, 3).join(' | '));
check('Spanish item names: ' + esNames.size + ' distinct, letters only', esNames.size > 50);
['helmet1', 'boots2', 'gloves3', 'weaponsword2', 'weaponbow2', 'weaponhammer1', 'weaponmace0', 'weaponstaff0', 'armor0', 'weaponbow0'].forEach(k => { const s = Object.keys(samples).find(x => x.startsWith(k)); if (s) console.log('       ' + s + ': ' + samples[s]); });
// agreement unit tests
const A = G.agree; check('Spanish agreement: Raro/Rara/Raros/Raras, Veloz/Veloces, Ágil/Ágiles, Sanador/Sanadora/Sanadoras, Común/Comunes',
  A('Raro', 'ms') === 'Raro' && A('Raro', 'fs') === 'Rara' && A('Raro', 'mp') === 'Raros' && A('Raro', 'fp') === 'Raras' && A('Veloz', 'fp') === 'Veloces' && A('Ágil', 'mp') === 'Ágiles' && A('Sanador', 'fs') === 'Sanadora' && A('Sanador', 'fp') === 'Sanadoras' && A('Común', 'fp') === 'Comunes');
// 7. hardcoded English in the view
const ALLOW = new Set(['ONE', 'TWO', 'THREE', 'RIFTSCAR', 'ENGLISH', 'ESPAÑOL', 'DBG', 'asset failed to decode: ']);      // names and developer messages
const left = [];
walk('src/view').forEach(f => {
  read(f).split('\n').forEach((line, i) => {
    const l = line.replace(/\/\/.*$/, '');
    for (const m of l.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      const s = m[1];
      if (!/[A-Za-z]{3}/.test(s) || ALLOW.has(s)) continue;
      if (/^[a-z0-9_]+$/i.test(s) && !/^[A-Z]{4,}$/.test(s)) continue;          // identifiers: frames, palette keys, names
      if (/^[a-z0-9_.|:%-]+$/i.test(s) && /[._-]/.test(s) && !/\s/.test(s)) continue;   // keys: 'obj.fissures', 'ui_text', 'monto_ok'
      if (/^(pointer|keydown|key|btn|viewchange|shutdown|camerafade|resize|font|atlas|tiles|px|void)/.test(s)) continue;
      if (!/\s/.test(s) && !/^[A-Z]{4,}$/.test(s)) continue;
      left.push(f + ':' + (i + 1) + ' ' + JSON.stringify(s));
    }
  });
});
check('no English string left hardcoded in src/view', !left.length, left.length ? '\n       ' + left.join('\n       ') : '');
console.log(fails ? fails + ' check(s) failed' : 'all checks passed');
process.exit(fails ? 1 : 0);
