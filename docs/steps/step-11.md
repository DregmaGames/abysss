# Step 11: Web release

Model: Sonnet 5.5. Branch: `step-11-web-release`.

Read `CLAUDE.md` and `docs/STATUS.md` first. Do only this step. Do not read the plan doc.

## Task

TASK: Prepare the public web build: loading screen, save versioning with migration, a short
first-run tutorial (move, dodge across a crack, leave or go on), an in-game feedback link, and
the page for itch.io. No analytics that send personal data, no third-party scripts.
VERIFY: node qa/session.js --minutes 10; node qa/screens.js both; node tools/contrast.js;
python3 tools/check_secrets.py --history. Then hand the build to the user for player tests.

## Notes

- Hide the debug button in the published build (`?debug=0` today; make it off by default).
- The user has not said where the web version is published. Ask before starting.

## Test budget

The seed counts in the task text above are from the first plan. This budget replaces them
(see `CLAUDE.md`): determinism check, at most 10 seeds in the Node sim, 3 seeds in the browser
once at the end, 2 screenshots (960x540 and 540x960).

## Done

One commit, English message. Update `docs/STATUS.md`. Report what was tested, the numbers, and
what is still rough.
