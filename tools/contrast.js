#!/usr/bin/env node
// Accessibility check: WCAG contrast ratio of every (text colour, background) pair the HUD and
// panels use (UI.TEXT_PAIRS in src/view/ui.js) against the generated palette. Fails under 4.5:1.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const ctx = { G_ASSETS: { palette: JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'palette.json'), 'utf8')) }, Math, parseInt };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'view', 'ui.js'), 'utf8'), ctx);
const UI = ctx.G.UI, MIN = 4.5;
let bad = 0, worst = 99;
for (const [fg, bg] of UI.TEXT_PAIRS) {
  const r = UI.contrast(fg, bg);
  worst = Math.min(worst, r);
  if (r < MIN) { bad++; console.log(`FAIL ${fg} on ${bg}: ${r.toFixed(2)}:1`); }
  else if (process.argv.includes('-v')) console.log(`ok   ${fg} on ${bg}: ${r.toFixed(2)}:1`);
}
console.log(`${UI.TEXT_PAIRS.length} text/background pairs checked, lowest ${worst.toFixed(2)}:1, minimum ${MIN}:1, ${bad} failing`);
process.exit(bad ? 1 : 0);
