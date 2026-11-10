# QA report (build of 2026-11-10)

| Check | Result |
|---|---|
| Determinism (`tools/determinism.js 100`) | 1000 rooms generated twice in separate contexts: 0 mismatches, 1000 distinct layouts. Bot run of seed 3 twice: identical |
| Bot win rate, Node sim (`tools/sim_bot.js`, seeds 1-400, tier I, fresh save) | 124 wins / 400 = **31.0 %** (target 25-40 %). 0 softlocks, 0 timeouts, longest no-progress stretch 16 s (limit 400 s) |
| Deaths by room (same 400 runs) | 0, 1, 7, 23, 35, 30, 19, 26, 53, 82 |
| Bot in the real game (`qa/bot.js`, headless Chromium) | seed 3 clears 10/10 rooms, 0 console errors, no softlock, result identical to the Node sim. Seed 4 dies in room 10, also identical |
| Text contrast (`tools/contrast.js`) | 28 pairs, lowest 5.65:1 (minimum 4.5:1) |
| Screenshot tour (`qa/screens.js both`) | 27 screens at 960x540 and 27 at 540x960, 0 errors |
| Scripted session (`qa/session.js`) | 90-second trial passed. **The full 10-minute session and the 12-seed browser bot pass were not completed on this build** |

Per-chunk win rate of the 400 seeds: 29 % (1-100), 34 % (101-200), 30 % (201-300), 31 % (301-400).
