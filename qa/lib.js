// Shared helpers for the headless QA scripts (Playwright + Chromium, both preinstalled).
'use strict';
const path = require('path'), fs = require('fs');

function loadPlaywright() {
  const tries = ['playwright', process.env.PLAYWRIGHT_PATH, '/opt/npm-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright not found. Set PLAYWRIGHT_PATH to its module directory.');
}

const ROOT = path.dirname(__dirname);
const GAME = 'file://' + path.join(ROOT, 'dist', 'riftscar.html');
const OUT = path.join(ROOT, 'qa', 'out');
const SIZES = { landscape: { width: 960, height: 540 }, portrait: { width: 540, height: 960 } };

// GPU-driver chatter from headless WebGL is not a game error
const NOISE = [/GL Driver Message/, /GPU stall due to ReadPixels/, /WebGL: INVALID_OPERATION: readPixels/, /Automatic fallback to software WebGL/, /GroupMarkerNotSet/];

async function open(browser, query, size, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: SIZES[size] || size, hasTouch: !!opts.touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.some(r => r.test(m.text()))) errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('uncaught: ' + e.message));
  // the QA sizes are windows, not phones: no quarter turn (src/main.js) unless the test asks for it
  query = query || '';
  if (!/[?&]rotate=/.test(query)) query += (query.indexOf('?') < 0 ? '?' : '&') + 'rotate=0';
  await page.goto(GAME + query);
  await page.waitForFunction(() => window.G && G.ready, null, { timeout: 20000 });
  page.errors = errors;
  return page;
}
const state = page => page.evaluate(() => G.qa.state());
async function click(page, name) {
  const h = await page.evaluate(n => G.qa.hits[n], name);
  if (!h) throw new Error('no such control: ' + name);
  await page.mouse.click(h.x, h.y);
  await page.waitForTimeout(120);
}
async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file });
  return file;
}
async function launch() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
}
module.exports = { launch, open, state, click, shot, GAME, OUT, ROOT, SIZES };
