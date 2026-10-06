# PPL Tracker

An offline workout and protein tracker for one person and one phone. No accounts,
no sync, no network calls — it is a static site that installs to the Android home
screen and keeps everything in the browser's local storage.

## What it does

- **Today's workout** — picks the session from the 6-day Push/Pull/Legs split in
  [`plan.md`](plan.md) (Mon Push A → Sat Legs B, Sun rest). A picker lets you log a
  different session when you miss a day.
- **Set logger** — weight × reps per set, with the numbers from the last time you
  did that exercise shown above the inputs. The inputs prefill from your last set.
- **Protein counter** — a daily total against 190 g, with quick-add buttons you
  edit in the app (label and grams) plus free-text entries.
- **Backup** — export everything to a JSON file, restore it on any device.

Out of scope by design: charts, rest timers, accounts, sync, notifications.

## Running it locally

```bash
node --test              # 56 tests, no dependencies
node tools/serve.mjs     # http://localhost:8080
```

A plain `file://` open will not work: service workers need an origin.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Settings → Pages → Source: *Deploy from a branch*, branch `main` (or `master`),
   folder `/ (root)`.
3. Open `https://<user>.github.io/<repo>/` on the phone in Chrome.
4. Menu → *Add to Home screen*.

Every path in this project is relative, and `.nojekyll` is committed, so the app
works from a repo subpath without changes.

## Layout

```
index.html  styles.css  app.js      the shell and the wiring
manifest.webmanifest  sw.js         installability and offline cache
src/core/                           pure logic, no DOM — this is what the tests cover
src/data/store.js                   the only module that touches localStorage
src/ui/                             rendering
tests/                              node --test
tools/                              dev server and icon generator
```

