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
- **Each session keeps its own history** — an exercise in two sessions (Incline
  DB Press in Push A and Push B) is tracked separately: last time, ▲ / = / ▼,
  the Next target and stalls only look at the same session. The first time in
  a new session is a fresh baseline. Personal records stay all-time.
- **Next target** (double progression) — top of the rep range on every set →
  add one weight step and drop to the bottom of the range; below the range →
  same weight; otherwise one more rep. The step is one setting for everything
  (default 2.5 kg, on the Plan tab).
- **Warm-up sets** — on anchor exercises, before the first working set: about
  40 / 60 / 80% of today's target for 8 / 5 / 3 reps, rounded to the weight
  step. Shown only, never logged, so they don't affect records or targets.
- **Personal records** — 🏆 on a set that beats everything before it: heaviest
  weight, best estimated 1RM (Epley, up to 12 reps), or most reps at that weight
  or heavier. ▲ / = / ▼ compares each set with the same set last time (weight
  first, then reps). Your first session of an exercise is the baseline.
- **Stalls and deloads** — an exercise whose best estimated 1RM (best reps for
  bodyweight) hasn't improved in 3 sessions shows a suggestion to go about 10%
  lighter and build back up. When 3 or more lifts in the active plan stall at
  once, a card above the exercises suggests a deload week. Advice only.
- **Rest timer** — *Start rest* counts down that exercise's rest, with −15 / +15
  / Skip. It vibrates and beeps at zero and keeps the screen on while it runs.
- **Technique notes** — tap an exercise name for muscles worked, setup, steps,
  cues and common mistakes (all 31 built-in exercises, plus your own notes).
- **Session time** — each set records when it was logged, so the workout shows
  when you started and how long you've been going (first set to latest), and
  History shows each session's length. Sessions logged before this have no time.
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

### Food
- Daily protein against your target (default 190 g), with the day's calories,
  fat and carbs — against today's targets once a goal is set on the Body tab.
- **Quick add** buttons you set up yourself (label and grams of protein).
- **Food list** — 123 common foods and takeaway dishes, halal (no pork), with German names in search
  (*Hähnchenbrust*, *Magerquark*, *Thunfisch* …); search, pick, enter grams or servings, and the
  protein, calories, fat and carbs are logged. Recent foods come first. Add your
  own (e.g. a branded bar) from its label per 100 g; a food can be calories only
  (oil, a drink). Built-in values are estimates from standard tables; each one's
  calories are checked against its macros (4/4/9 kcal per g).
- **Estimate from a photo** — through the AI app you already use (Gemini or
  Claude): *Copy prompt*, send it there with your meal photo, paste the one-line
  answer back. A review sheet lists each food with editable protein and
  calories; nothing is logged until you tap *Log*. The tracker itself makes no
  network call and needs no API key. Answers in the older protein-only format
  still work.
- Free-text entries (protein, calories or both), and today's log. Entries
  logged before calories were tracked keep their protein and count no calories.

### Body
- One weigh-in a day (logging again replaces it), with the latest weight, the
  **trend weight** and its weekly change, the 7-day average, and your protein
  target in g/kg. The trend moves 10% of the way to each daily weigh-in (gaps
  count as that many days), so a kilo of water moves it 0.1 kg; the log shows
  the trend next to each weigh-in.
- **Estimated burn (TDEE)** — calories come from the food log, or from a day's
  total typed in on the Body tab (for days tracked elsewhere; it wins over the
  log). After two weeks
  (10+ days of calories, 3+ weigh-ins spread over a week), the card shows what
  you burn per day with a likely range. Over the last 4 weeks it takes your
  average logged intake and corrects it by your weight trend (a least-squares
  line through the weigh-ins): weight lost counts as 7700 kcal/kg, weight gained
  as 5000 kcal/kg. The range (~80%) narrows as data builds up. Days after your
  last weigh-in wait for the next one. Untracked days are skipped, not guessed.
- **Starting estimate** — fill in *Your details* (sex, height, birth year,
  activity) and a formula estimate (Mifflin-St Jeor × activity factor) shows
  from the first weigh-in. Once the log has enough data the two are blended,
  each weighted by how certain it is, so the formula fades out as your own
  numbers firm up — there is no jump at day 14.
- **Goal: Cut / Maintain / Bulk** — sets a daily calorie target from the burn
  estimate. Rates scale with body weight: a cut aims to lose 0.5% of body weight
  a week (× 7700 kcal/kg), a lean bulk to gain 0.25% a week (× 5000 kcal/kg),
  maintain eats the burn. A cut is capped at 25% below the burn, a bulk at 15%
  above. Rates use the trend weight. Once the log has enough data it says
  whether your weight is moving as planned (within 0.2 kg a week).
- **Weekly check-in** — the target holds for a week. A check-in card shows the
  burn and trend weight against last time and proposes the next target;
  *Apply* fixes it until the next check-in, due a week later or as soon as the
  goal changes. With the same goal a check-in moves the target at most 200 kcal.
- **Macro targets** — protein is your protein target; fat is a quarter of
  calories but never under 0.6 g per kg; carbs fill the rest.
- **More on training days** — optional: rest days in the active plan get 15%
  less than the week's average and training days share the difference, so the
  week adds up the same. Fat stays put; carbs carry the change.

### Backup
- **Export** everything to a JSON file; **import** it on any device. Import
  replaces all data after a confirmation.
- **Backup reminder** — a card on the Workout tab when the last export from
  this phone is 14+ days old (or, never having exported, 14 days after the first
  thing you logged). *Back up now* downloads the file right there; *Not now*
  hides it for 3 days. Importing a backup also counts. Kept per device, like the
  rest timer, and not part of backups.

Out of scope by design: charts, accounts, sync, notifications.

## Your data

- Everything lives in this browser on this phone. Clearing the browser's site
  data deletes it, so **export a backup now and then**.
- Data carries a schema version (currently **6**). Older data and older backups
  are upgraded automatically on load or import, and history is never rewritten.
  A backup from a *newer* version of the app is refused rather than half-read.
- The rest timer is kept per device and is not part of backups.

## Development

No dependencies and no build step — plain ES modules.

```bash
node --test              # 230 tests
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
  energy.js  targets.js            burn (TDEE) estimate; check-ins, macro and day targets
  techniques.js  dates.js          technique notes; local-date helpers
src/data/store.js                  the only module that touches localStorage
src/ui/                            one renderer per tab or screen, plus dom.js helpers
fonts/                             Geist + Geist Mono (OFL), bundled so text renders offline
about/                             landing page (/about/); screenshots use example data
tests/                             node --test (core modules, plus the offline-cache check)
tools/                             dev server and icon generator
```
