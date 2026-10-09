# PPL Tracker

A workout and protein tracker for one person and one phone. It is a static site
that installs to the Android home screen, works fully offline, and keeps
everything in the browser's local storage. No accounts, no sync, no network calls.

**Live:** <https://mohamed-amine-benhassen.github.io/fitness_app/>

## Install on your phone

1. Open the link above in Chrome on Android.
2. Menu → *Add to Home screen*.
3. Open it once while online; after that it works without a connection.

Updates arrive the next time you open the app online — it downloads the new
version in the background and reloads itself.

## What's in each tab

### Workout
- **Today's session** from your active plan's weekly schedule. The *Session*
  picker logs a different one when you miss a day.
- **Set logger** — weight × reps per set. Above the inputs: what you did last
  time, and a **Next** target. The inputs prefill with that target, then with
  your last set once you've started the exercise.
- **Next target** (double progression) — top of the rep range on every set →
  add one weight step and drop to the bottom of the range; below the range →
  same weight; otherwise one more rep. The step is one setting for everything
  (default 2.5 kg, on the Plan tab).
- **Personal records** — 🏆 on a set that beats everything before it: heaviest
  weight, best estimated 1RM (Epley, up to 12 reps), or most reps at that weight
  or heavier. ▲ / = / ▼ compares each set with the same set last time (weight
  first, then reps). Your first session of an exercise is the baseline.
- **Rest timer** — *Start rest* counts down that exercise's rest, with −15 / +15
  / Skip. It vibrates and beeps at zero and keeps the screen on while it runs.
- **Technique notes** — tap an exercise name for muscles worked, setup, steps,
  cues and common mistakes (all 31 built-in exercises, plus your own notes).
- **History** — past sessions newest first, each session's sets with its PRs,
  and each exercise across time with its all-time bests. Read-only.

### Plan
- Several named plans, one active. The plan screen shows the **week day by day**:
  pick each day's session and see its exercises underneath.
- Edit a session: add, remove, reorder or swap exercises; sets, rep range, rest,
  note and anchor. An exercise appears at most once per session.
- **Exercise library** — rename exercises, create your own, write technique
  notes. History follows the exercise: renaming keeps it; swapping in a different
  exercise shows that one's.
- Plans, sessions and exercises are **archived, never deleted**, so old logs
  keep their names. Restore them from the same screens.
- The default plan is the 6-day split in [`plan.md`](plan.md).

### Protein
- Daily total against your target (default 190 g).
- **Quick add** buttons you set up yourself (label and grams).
- **Food list** — 53 common foods; search, pick, enter grams or servings, and the
  protein is logged. Recent foods come first. Add your own (e.g. a branded bar)
  with its protein per 100 g. Built-in values are estimates from standard tables.
- Free-text entries, and today's log.

### Body
- One weigh-in a day (logging again replaces it), with the latest weight, 7-day
  average, change against the previous 7 days, and your protein target in g/kg.

### Backup
- **Export** everything to a JSON file; **import** it on any device. Import
  replaces all data after a confirmation.

Out of scope by design: charts, accounts, sync, notifications.

## Your data

- Everything lives in this browser on this phone. Clearing the browser's site
  data deletes it, so **export a backup now and then**.
- Data carries a schema version (currently **3**). Older data and older backups
  are upgraded automatically on load or import, and history is never rewritten.
  A backup from a *newer* version of the app is refused rather than half-read.
- The rest timer is kept per device and is not part of backups.

## Development

No dependencies and no build step — plain ES modules.

```bash
node --test              # 150 tests
node tools/serve.mjs     # http://localhost:8080
```

A plain `file://` open will not work: service workers need an origin.

Rules that keep the app working offline:

- **Bump `CACHE_NAME` in `sw.js` on every change to a cached file**, or installed
  apps keep serving the old version.
- **Add every new module under `src/` to `ASSETS` in `sw.js`.** A missing entry
  works online but breaks the installed app offline; `tests/sw-assets.test.js`
  fails if you forget.
- **When the saved data changes shape**, bump `SCHEMA_VERSION` in
  `src/core/schema.js` and teach `migrate()` in `src/core/backup.js` to upgrade
  the previous version.

### Deploying

GitHub Pages serves the `master` branch from the repository root. Push to
`master` and the site updates within a minute or two. Every path is relative and
`.nojekyll` is committed, so the app works from the `/fitness_app/` subpath.

## Layout

```
index.html  styles.css  app.js     shell and wiring: owns the state, saves, renders
manifest.webmanifest  sw.js        installability and offline cache
plan.md                            the default plan, seeded on first install

src/core/                          pure logic, no DOM — what the tests cover
  schema.js  backup.js             state shape, defaults, validation, migration
  program.js                       default plan (seed)
  plans.js                         plans, sessions, schedule, exercise library
  sets.js  records.js              set logging; PRs and estimated 1RM
  progression.js  history.js       next-target suggestions; read-only history
  nutrition.js  foods.js           protein entries, quick adds; food list
  bodyweight.js  timer.js          weigh-ins and averages; rest timer maths
  techniques.js  dates.js          technique notes; local-date helpers
src/data/store.js                  the only module that touches localStorage
src/ui/                            one renderer per tab or screen, plus dom.js helpers
tests/                             node --test (core modules, plus the offline-cache check)
tools/                             dev server and icon generator
```
