import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import {
  addSet,
  findSession,
  formatSets,
  lastPerformance,
  loggedSetCount,
  removeSet,
  setsFor,
  updateSet
} from '../src/core/sets.js';

const seed = () => defaultState();

test('adding a set creates the session and entry', () => {
  const state = addSet(seed(), '2026-09-11', 'pullB', 'hammer-curl', { weightKg: 14, reps: 12 });
  assert.equal(state.sessions.length, 1);
  assert.deepEqual(setsFor(state, '2026-09-11', 'pullB', 'hammer-curl'), [{ weightKg: 14, reps: 12 }]);
});

test('addSet does not mutate the input state', () => {
  const before = seed();
  const snapshot = JSON.stringify(before);
  addSet(before, '2026-09-11', 'pullB', 'hammer-curl', { weightKg: 14, reps: 12 });
  assert.equal(JSON.stringify(before), snapshot);
});

test('two sessions on the same date are kept apart by day key', () => {
  let state = seed();
  state = addSet(state, '2026-09-13', 'pushA', 'triceps-pushdown', { weightKg: 30, reps: 12 });
  state = addSet(state, '2026-09-13', 'pullA', 'face-pull', { weightKg: 20, reps: 18 });
  assert.equal(state.sessions.length, 2);
  assert.equal(setsFor(state, '2026-09-13', 'pushA', 'face-pull').length, 0);
  assert.equal(setsFor(state, '2026-09-13', 'pullA', 'face-pull').length, 1);
});

test('sessions stay sorted by date regardless of insertion order', () => {
  let state = seed();
  state = addSet(state, '2026-09-11', 'pullB', 'face-pull', { weightKg: 20, reps: 18 });
  state = addSet(state, '2026-09-07', 'pullA', 'face-pull', { weightKg: 18, reps: 20 });
  state = addSet(state, '2026-09-09', 'legsA', 'back-squat', { weightKg: 100, reps: 6 });
  assert.deepEqual(state.sessions.map((s) => s.dateKey), ['2026-09-07', '2026-09-09', '2026-09-11']);
});

test('last performance finds the exercise across different session types', () => {
  let state = seed();
  state = addSet(state, '2026-09-07', 'pushA', 'incline-db-press', { weightKg: 30, reps: 9 });
  state = addSet(state, '2026-09-10', 'pushB', 'incline-db-press', { weightKg: 32.5, reps: 8 });
  const last = lastPerformance(state, 'incline-db-press', { dateKey: '2026-09-14', dayKey: 'pushA' });
  assert.equal(last.dateKey, '2026-09-10');
  assert.equal(last.dayKey, 'pushB');
  assert.deepEqual(last.sets, [{ weightKg: 32.5, reps: 8 }]);
});

test('last performance ignores the session being logged right now', () => {
  let state = seed();
  state = addSet(state, '2026-09-07', 'pushA', 'triceps-pushdown', { weightKg: 30, reps: 12 });
  state = addSet(state, '2026-09-11', 'pushB', 'triceps-pushdown', { weightKg: 32.5, reps: 12 });
  const last = lastPerformance(state, 'triceps-pushdown', { dateKey: '2026-09-11', dayKey: 'pushB' });
  assert.equal(last.dateKey, '2026-09-07');
});

test('last performance is null on a first-ever session', () => {
  const state = seed();
  assert.equal(lastPerformance(state, 'back-squat', { dateKey: '2026-09-11', dayKey: 'legsA' }), null);
});

test('sets are normalised: weight rounded, reps integral, junk coerced', () => {
  let state = seed();
  state = addSet(state, '2026-09-11', 'legsA', 'leg-press', { weightKg: 100.005, reps: 10.6 });
  state = addSet(state, '2026-09-11', 'legsA', 'leg-press', { weightKg: -5, reps: 'x' });
  assert.deepEqual(setsFor(state, '2026-09-11', 'legsA', 'leg-press'), [
    { weightKg: 100.01, reps: 11 },
    { weightKg: null, reps: 0 }
  ]);
});

test('bodyweight sets keep a null weight', () => {
  const state = addSet(seed(), '2026-09-09', 'legsA', 'hanging-leg-raise', { weightKg: null, reps: 14 });
  assert.deepEqual(setsFor(state, '2026-09-09', 'legsA', 'hanging-leg-raise'), [{ weightKg: null, reps: 14 }]);
});

test('updating a set replaces it in place', () => {
  let state = addSet(seed(), '2026-09-11', 'pushA', 'cable-lateral-raise', { weightKg: 7.5, reps: 15 });
  state = addSet(state, '2026-09-11', 'pushA', 'cable-lateral-raise', { weightKg: 7.5, reps: 14 });
  state = updateSet(state, '2026-09-11', 'pushA', 'cable-lateral-raise', 0, { weightKg: 10, reps: 12 });
  assert.deepEqual(setsFor(state, '2026-09-11', 'pushA', 'cable-lateral-raise'), [
    { weightKg: 10, reps: 12 },
    { weightKg: 7.5, reps: 14 }
  ]);
});

test('removing the last set drops the entry and then the session', () => {
  let state = addSet(seed(), '2026-09-11', 'pushA', 'triceps-pushdown', { weightKg: 30, reps: 12 });
  state = removeSet(state, '2026-09-11', 'pushA', 'triceps-pushdown', 0);
  assert.equal(findSession(state, '2026-09-11', 'pushA'), null);
  assert.equal(state.sessions.length, 0);
});

test('out-of-range edits are ignored', () => {
  const state = addSet(seed(), '2026-09-11', 'pushA', 'triceps-pushdown', { weightKg: 30, reps: 12 });
  const removed = removeSet(state, '2026-09-11', 'pushA', 'triceps-pushdown', 9);
  const updated = updateSet(state, '2026-09-11', 'pushA', 'triceps-pushdown', 9, { weightKg: 1, reps: 1 });
  assert.equal(loggedSetCount(removed, '2026-09-11', 'pushA'), 1);
  assert.equal(loggedSetCount(updated, '2026-09-11', 'pushA'), 1);
});

test('formatting a reference line', () => {
  assert.equal(formatSets([{ weightKg: 32.5, reps: 9 }, { weightKg: 30, reps: 8 }]), '32.5 kg x 9, 30 kg x 8');
  assert.equal(formatSets([{ weightKg: null, reps: 14 }, { weightKg: null, reps: 12 }]), '14, 12 reps');
  assert.equal(formatSets([]), '');
});
