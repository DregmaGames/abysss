#!/usr/bin/env node
// One-off screenshot: node qa/shot.js <name> "<query>" [waitMs] [landscape|portrait|WxH] [touch]
'use strict';
const Q = require('./lib');
(async () => {
  const [name, query, wait, size, touch] = process.argv.slice(2);
  let sz = size || 'landscape';
  if (/^\d+x\d+$/.test(sz)) { const [w, h] = sz.split('x').map(Number); sz = { width: w, height: h }; }
  const b = await Q.launch(), page = await Q.open(b, query || '', sz, { touch: touch === 'touch' });
  await page.waitForTimeout(+wait || 1500);
  console.log(await Q.shot(page, name));
  const st = await Q.state(page);
  console.log(JSON.stringify(st.sim || st.screen), 'errors:', JSON.stringify(page.errors.concat(st.errors)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
