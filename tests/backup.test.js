import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, SCHEMA_VERSION } from '../src/core/schema.js';
import { addSet } from '../src/core/sets.js';
import { addEntry } from '../src/core/nutrition.js';
import {
  backupFilename,
  backupSummary,
  buildBackup,
  migrate,
  parseBackup,
  serializeBackup,
  validateBackup
} from '../src/core/backup.js';

function populated() {
  let state = defaultState();
  state = addSet(state, '2026-09-07', 'pushA', 'incline-db-press', { weightKg: 30, reps: 9 });
  state = addSet(state, '2026-09-07', 'pushA', 'incline-db-press', { weightKg: 30, reps: 8 });
  state = addSet(state, '2026-09-09', 'legsA', 'hanging-leg-raise', { weightKg: null, reps: 14 });
  state = addEntry(state, '2026-09-07', { label: 'Isoclear', grams: 27 }, 1757260000000);
  return state;
}

test('export then import round-trips the whole state', () => {
  const state = populated();
  const result = parseBackup(serializeBackup(state, '2026-09-11T18:00:00.000Z'));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state, state);
});

test('the backup carries app and schema markers', () => {
  const backup = buildBackup(populated(), null);
  assert.equal(backup.app, 'ppl-fitness-tracker');
  assert.equal(backup.schemaVersion, SCHEMA_VERSION);
});

test('the filename is dated', () => {
  assert.equal(backupFilename('2026-09-11'), 'ppl-backup-2026-09-11.json');
});

test('malformed JSON is rejected with a readable error', () => {
  const result = parseBackup('{ not json');
  assert.equal(result.ok, false);
  assert.equal(result.state, null);
  assert.match(result.errors[0], /Not valid JSON/);
});

test('a backup from another app is rejected', () => {
  const result = parseBackup(JSON.stringify({ app: 'other-tracker', schemaVersion: 1 }));
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /different app/);
});

test('a newer schema version is refused rather than silently mangled', () => {
  const { ok, errors } = validateBackup({ app: 'ppl-fitness-tracker', schemaVersion: 99 });
  assert.equal(ok, false);
  assert.match(errors[0], /newer than this app/);
});

test('non-object and wrong-typed fields are reported', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup([]).ok, false);
  assert.equal(validateBackup({ schemaVersion: 1, sessions: {} }).ok, false);
  assert.equal(validateBackup({ schemaVersion: 1, nutrition: [] }).ok, false);
});

test('migrate drops sessions with impossible dates and empty entries', () => {
  const state = migrate({
    schemaVersion: 1,
    sessions: [
      { dateKey: '2026-02-30', dayKey: 'pushA', entries: [{ exerciseId: 'x', sets: [{ weightKg: 1, reps: 1 }] }] },
      { dateKey: '2026-09-07', dayKey: 'pushA', entries: [] },
      { dateKey: '2026-09-08', dayKey: 'pullA', entries: [{ exerciseId: 'face-pull', sets: [] }] },
      { dateKey: '2026-09-09', dayKey: 'legsA', entries: [{ exerciseId: 'back-squat', sets: [{ weightKg: 100, reps: 6 }] }] }
    ]
  });
  assert.deepEqual(state.sessions.map((s) => s.dateKey), ['2026-09-09']);
});

test('migrate drops nutrition entries that are not real grams', () => {
  const state = migrate({
    schemaVersion: 1,
    nutrition: {
      '2026-09-07': [{ label: 'Shake', grams: 30 }, { label: 'Bad', grams: -1 }],
      'yesterday': [{ label: 'Shake', grams: 30 }],
      '2026-09-08': []
    }
  });
  assert.deepEqual(Object.keys(state.nutrition), ['2026-09-07']);
  assert.equal(state.nutrition['2026-09-07'].length, 1);
});

test('migrate restores defaults for missing settings', () => {
  const state = migrate({ schemaVersion: 1 });
  assert.equal(state.settings.proteinTargetG, 190);
  assert.equal(state.settings.quickAdds.length, 3);
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.nutrition, {});
});

test('migrate always stamps the current schema version', () => {
  assert.equal(migrate({ schemaVersion: 1 }).schemaVersion, SCHEMA_VERSION);
  assert.equal(migrate(undefined).schemaVersion, SCHEMA_VERSION);
});

test('imported sessions come back sorted', () => {
  const state = migrate({
    schemaVersion: 1,
    sessions: [
      { dateKey: '2026-09-11', dayKey: 'pullB', entries: [{ exerciseId: 'face-pull', sets: [{ weightKg: 20, reps: 18 }] }] },
      { dateKey: '2026-09-07', dayKey: 'pushA', entries: [{ exerciseId: 'triceps-pushdown', sets: [{ weightKg: 30, reps: 12 }] }] }
    ]
  });
  assert.deepEqual(state.sessions.map((s) => s.dateKey), ['2026-09-07', '2026-09-11']);
});

test('summary counts what the backup screen shows', () => {
  const summary = backupSummary(populated());
  assert.deepEqual(summary, {
    sessions: 2,
    sets: 3,
    firstDate: '2026-09-07',
    lastDate: '2026-09-09',
    nutritionDays: 1,
    weighIns: 0
  });
});
