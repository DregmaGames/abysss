#!/usr/bin/env node
// Daily challenge in the real game (step 10), at 960x540 and 540x960, the bot playing (fast-forwarded):
//   1. title -> DAILY RIFT -> START: the day's class and seed, only the day's door after each room, the run ends (win, death or leave);
//      the result shows the score; it must equal the same daily in the Node sim; COPY puts the share text on the clipboard;
//   2. the manual-copy fallback: with no clipboard (as in an iframe) COPY shows the share text in a selected text box;
//   3. BACK TO CITY -> the daily board beside the portal -> READ -> START: the same run again, the same result;
//   4. the save is the same before and after (no run counted, no gear, gold or items kept). 0 console / page errors.
//   node qa/daily.js [--date 2026-11-12] [--speed 12]   screenshots: /tmp/step10_daily_result_<size>.png and qa/out/daily/
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const Q = require('./lib');

const argv = process.argv, opt = k => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : null; };
const DATE = opt('date') || '2026-11-12', SPEED = +(opt('speed') || 12);

// the same day in the Node sim
function nodeDaily(date) {
  const SIM = ['balance.js', 'lore.js', 'rng.js', 'mapgen.js', 'sim/items.js', 'sim/economy.js', 'sim/abilities.js', 'sim/core.js', 'sim/effects.js', 'sim/combat.js', 'sim/fissures.js', 'sim/boss.js', 'sim/daily.js', 'qa/bot.js', 'save.js'];
  const ctx = { Math, console, Uint8Array, Int16Array, Object, JSON, Array };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of SIM) vm.runInContext(fs.readFileSync(path.join(Q.ROOT, 'src', f), 'utf8'), ctx, { filename: f });
  const G = ctx.G, info = G.dailyInfo(date, G.BAL);
  const r = G.botRun(info.seed, { cls: info.cls, gear: G.dailyGear(info, G.BAL), daily: info });
  return { info, r };
}

(async () => {
  const dir = path.join(Q.OUT, 'daily');
  fs.mkdirSync(dir, { recursive: true });
  const N = nodeDaily(DATE);
  console.log(`node: daily ${DATE} seed ${N.info.seed} ${N.info.cls}: ${N.r.result}, ${N.r.rooms} rooms, ${N.r.kills} kills, ${N.r.seconds} s, doors ${N.r.doors.join('>')}`);
  const browser = await Q.launch();
  const fails = [];
  let checks = 0;
  const ok = (cond, what) => { checks++; if (!cond) fails.push(what); };
  const waitScreen = async (page, scr, ms) => { const t0 = Date.now(); for (;;) { const s = await Q.state(page); if (s.screen === scr) return s; if (Date.now() - t0 > ms) return s; await page.waitForTimeout(300); } };

  for (const size of ['landscape', 'portrait']) {
    const page = await Q.open(browser, `?fresh=1&bot=1&speed=${SPEED}&daily=${DATE}`, size);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const saveBefore = await page.evaluate(() => { const c = JSON.parse(JSON.stringify(G.save)); delete c.hints; return JSON.stringify(c); });
    // 1. from the title
    await page.waitForTimeout(500);
    await Q.click(page, 'title_daily');
    let st = await Q.state(page);
    ok(st.panel === 'daily', `${size}: the title button opens the daily board`);
    await Q.shot(page, `daily/board_title_${size}`);
    await Q.click(page, 'daily_start');
    st = await waitScreen(page, 'result', 600000);
    ok(st.screen === 'result', `${size}: the daily run from the title ended (${st.screen})`);
    const s1 = st.sim;
    const res = s1.state === 'won' ? 'win' : s1.state;
    ok(s1.daily && s1.daily.seed === N.info.seed && s1.daily.cls === N.info.cls, `${size}: the day's seed and class`);
    ok(res === N.r.result && s1.rooms === N.r.rooms && s1.kills === N.r.kills && s1.level === N.r.level, `${size}: the browser run matches Node (${res} ${s1.rooms} ${s1.kills} ${s1.level} vs ${N.r.result} ${N.r.rooms} ${N.r.kills} ${N.r.level})`);
    ok(st.panel === 'result' && s1.daily.score > 0 && /\d/.test(s1.daily.share) && s1.daily.share.indexOf(String(s1.daily.score)) >= 0, `${size}: result with a score and a share text`);
    await page.screenshot({ path: `/tmp/step10_daily_result_${size}.png` });
    await Q.click(page, 'daily_copy');
    await page.waitForTimeout(400);
    const copied = await page.evaluate(() => G.lastCopied);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
    ok(copied === s1.daily.share, `${size}: COPY put the share text on the clipboard (${copied})`);
    if (clip !== null) ok(clip === s1.daily.share, `${size}: the clipboard holds the share text (${clip})`);
    // 2. no clipboard (an iframe without permission): the manual-copy box
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
      document.execCommand = () => false;
    });
    await Q.click(page, 'daily_copy');
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => { const b = document.getElementById('manual_copy'); if (!b) return null; const r = b.getBoundingClientRect(), ta = b.querySelector('textarea');
      return { text: ta.value, selected: ta.selectionEnd - ta.selectionStart, focused: document.activeElement === ta, x: r.x, y: r.y, w: r.width, h: r.height, label: b.firstChild.textContent }; });
    const V = Q.SIZES[size];
    ok(box && box.text === s1.daily.share && box.selected === box.text.length && box.focused, `${size}: manual-copy box with the share text, selected (${JSON.stringify(box)})`);
    ok(box && box.x >= 0 && box.y >= 0 && box.x + box.w <= V.width && box.y + box.h <= V.height, `${size}: manual-copy box inside the view`);
    await Q.shot(page, `daily/manual_copy_${size}`);
    await page.click('#manual_copy button');
    ok(await page.evaluate(() => !document.getElementById('manual_copy')), `${size}: the manual-copy box closes`);
    // 3. back to the city, the board beside the portal
    await Q.click(page, 'res_city');
    st = await waitScreen(page, 'city', 10000);
    ok(st.screen === 'city' && st.city && st.city.board, `${size}: back in the city, the daily board is there`);
    await page.evaluate(() => { const c = G.city, o = c.boardOwner; c.px = o.front.x; c.py = o.front.y; c.follow(true); });
    await page.waitForTimeout(400);
    st = await Q.state(page);
    ok(st.city.near === 'daily' && st.city.tag && st.city.tag.text === (await page.evaluate(() => G.t('city.read'))), `${size}: at the board the prompt says READ (${st.city.near}, ${st.city.tag && st.city.tag.text})`);
    await Q.shot(page, `daily/board_city_${size}`);
    await Q.click(page, 'city_talk');
    st = await Q.state(page);
    ok(st.panel === 'daily', `${size}: READ opens the daily board`);
    await Q.click(page, 'daily_start');
    st = await waitScreen(page, 'result', 600000);
    const s2 = st.sim;
    ok(st.screen === 'result' && s2.daily && s2.daily.score === s1.daily.score && s2.kills === s1.kills && s2.tick === s1.tick && s2.daily.share === s1.daily.share, `${size}: the run from the city is the same day's run (${s2.daily && s2.daily.score} vs ${s1.daily.score})`);
    await Q.shot(page, `daily/result_city_${size}`);
    // 4. the save did not change
    const saveAfter = await page.evaluate(() => { const c = JSON.parse(JSON.stringify(G.save)); delete c.hints; return JSON.stringify(c); });      // hint 'seen' flags are UI state, not progress
    ok(saveAfter === saveBefore, `${size}: the save is unchanged after two daily runs`);
    await Q.click(page, 'res_city');
    await page.waitForTimeout(300);
    const errs = page.errors.concat((await Q.state(page)).errors);
    ok(!errs.length, `${size}: no console or page errors (${errs.slice(0, 3).join(' | ')})`);
    console.log(`${size}: ${res}, rooms ${s1.rooms}, kills ${s1.kills}, score ${s1.daily.score}; share: ${s1.daily.share}`);
    await page.context().close();
  }
  await browser.close();
  console.log(`${checks} checks, ${fails.length} failing`);
  fails.forEach(f => console.log('FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
