# PPL Fitness Tracker

Offline-first PWA for a single user, one Android phone. Installed to the home
screen, deployed as static files to GitHub Pages.

## Non-negotiable constraints

- No frameworks. No npm dependencies. No build step. `package.json` exists only
  for `"type": "module"` and the scripts — `dependencies` stays empty.
- Plain HTML/CSS/JS, native ES modules, served exactly as committed.
- All paths relative (`./`). The site lives under a repo subpath on GitHub Pages;
  a leading `/` will 404.

## Architecture rules

- `src/core/**` is pure: no `document`, `window`, `localStorage`, `fetch`, or
  `Date.now()`. The current date and any timestamp are passed in as arguments.
  This is what lets the tests run under `node --test` with no DOM shim.
- `src/data/store.js` is the only module that touches browser storage.
- `src/ui/**` owns the DOM. It calls core functions; it never reimplements them.
- `app.js` is wiring only: it holds the state object, passes `{ state, ui, actions }`
  to the renderers, and saves after every change.
- Core functions take a state object and return a **new** one. They never mutate
  their arguments — several tests assert this.
- State is one JSON object under one localStorage key, with a `schemaVersion`.
  Any shape change bumps `SCHEMA_VERSION` in `src/core/schema.js` and adds a case
  to `migrate()` in `src/core/backup.js`. `migrate()` also runs on every read, so
  it must tolerate junk: it drops impossible dates, empty sets and bad numbers.

## Source of truth

`plan.md` defines the program. Exercise names, sets, rep ranges, rest times and
notes in `src/core/program.js` must match it. Change `plan.md` first, then mirror
it in the seed data, then update `tests/program.test.js`.

Exercise ids are shared across sessions on purpose: `incline-db-press` appears in
both Push A and Push B, and the last-performance lookup is deliberately not scoped
to one day-key, so the most recent numbers always show. Do not "fix" this by
namespacing ids per session.

## Testing

- `node --test` before every commit. New core logic ships with its test.
- Tests use `node:test` and `node:assert/strict` only.
- UI modules are not unit-tested. Keep logic out of them so that stays true.
- `grep -rE "document|window|localStorage" src/core/` must return nothing.

## Service worker

- Bump `CACHE_NAME` in `sw.js` on **every** change to a precached file, or the
  installed app keeps serving the old bundle.
- New files must be added to the `ASSETS` precache list.
- Chrome will not reinstall a byte-identical `sw.js`. When testing locally, a
  cleared cache does **not** repopulate on reload — use a fresh browser profile
  or change `sw.js` to force a real install.
- `app.js` reloads the page once on `controllerchange` when a worker was already
  in charge, so a running session cannot keep old JS against a new cache.

## Commands

- `node --test` — run all tests
- `node tools/serve.mjs` — serve on http://localhost:8080 (service workers need
  an origin; localhost counts as a secure context)
- `node tools/make-icons.mjs` — regenerate the PWA icons

To test on the phone over USB: open `chrome://inspect` on the desktop, use port
forwarding for 8080, then load `http://localhost:8080` on the device.

## Scope — v1 is exactly four features

Today's workout from the split (with a manual session picker) · set logger showing
last session's numbers per exercise · protein counter toward 190 g with editable
quick-add buttons · JSON export/import.

Explicitly out: charts, rest timers, accounts, sync, notifications, automatic
progression. The progression rules at the bottom of `plan.md` are reference only.
Rest times are displayed as text; there is no timer. Do not add features that
were not asked for.
