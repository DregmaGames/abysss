# Riftscar: rules for coding agents

Read this before doing anything in this repository. `README.md` explains the layout and the QA commands.

## Security rules (always, no exceptions)

1. **Never commit, push, print or share credentials or key material.** That means API keys, tokens,
   passwords, `.env` files, SSH or PGP keys (public ones too), certificates, cookies, and URLs with a
   user and password in them. Do not read them either: you do not need them for this project.
2. **Before every commit and before every push, run `python3 tools/check_secrets.py`** (and
   `--history` before the first push of a branch). If it reports anything, stop and tell the user.
   The git hooks do this automatically once enabled: `git config core.hooksPath tools/hooks`.
3. **Never install packages.** No `npm install`, `npx`, `pip install`, `apt`, `brew` or similar.
   Work with what is installed; if something is missing, say which package and stop.
4. **Never run `sudo`, `curl`, `wget`, or pipe anything into `sh`/`bash`.** Public pages are read with
   the WebFetch tool only.
5. **Strip tracking parameters from every link** before fetching it, storing it or writing it into a
   file or a commit: `python3 tools/clean_url.py "<url>"` (or `require('./tools/clean_url').cleanUrl`).
   Any fetch script added to this repo must pass its URLs through that function first. The list of
   parameters is `tools/tracking_params.json`.
6. No credentials in the repo, in commit messages, in logs, in screenshots or in QA output.

These rules are enforced by `.claude/hooks/guard.py` (a PreToolUse hook registered in
`.claude/settings.json`) and by the git hooks in `tools/hooks/`. A blocked call means the rule
applies: do not look for another way to do the same thing; report it to the user instead.

## Working rules

- One system per session. Commit after each system, message in English, one commit per system.
- The sim (`src/sim/`, `src/mapgen.js`, `src/rng.js`) has no Phaser and must stay deterministic:
  same seed = same map and same run. Every number that can be tuned lives in `src/balance.js`.
- All art goes through `tools/pixelart.py` (or `tools/import_asset.py` for generated art): one pixel
  size for the whole game, the palette in `assets/palette.json`.
- After every change: `python3 tools/build.py`, then the checks in `README.md` > QA that cover what
  you touched. Look at the screenshots at 960x540 and 540x960. Do not say a system is done without
  the QA result, and say what you tested and what is still rough.
