import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { addSet } from '../src/core/sets.js';
import {
  bestsBefore,
  bestsOf,
  compareSets,
  estimate1RM,
  recordFor,
  recordsInSession
} from '../src/core/records.js';

const s = (weightKg, reps) => ({ weightKg, reps });

function logged(...days) {
  let state = defaultState();
  for (const [dateKey, dayKey, exerciseId, sets] of days) {
    for (const set of sets) state = addSet(state, dateKey, dayKey, exerciseId, set);
  }
  return state;
}

test('estimated 1RM uses Epley and is only trusted up to 12 reps', () => {
  assert.equal(estimate1RM(s(100, 1)), 100);
  assert.equal(estimate1RM(s(100, 5)), 116.67);
  assert.equal(estimate1RM(s(60, 12)), 84);
  assert.equal(estimate1RM(s(60, 13)), null);
  assert.equal(estimate1RM(s(null, 10)), null);
  assert.equal(estimate1RM(s(60, 0)), null);
});

test('bests are heaviest weight, best e1RM and most reps', () => {
  assert.deepEqual(bestsOf([s(100, 5), s(110, 1), s(80, 15)]), {
    heaviest: 110,
    e1rm: 116.67,
    mostReps: 15,
    count: 3
  });
  assert.deepEqual(bestsOf([]), { heaviest: null, e1rm: null, mostReps: 0, count: 0 });
});

test('the first time an exercise is done is the baseline, not a PR', () => {
  assert.equal(recordFor(s(100, 5), []), null);
});

test('a heavier weight than ever is a weight record', () => {
  assert.equal(recordFor(s(102.5, 3), [s(100, 5)]), 'weight');
});

test('same weight with more reps beats the e1RM', () => {
  assert.equal(recordFor(s(100, 6), [s(100, 5)]), 'e1rm');
  assert.equal(recordFor(s(100, 5), [s(100, 5)]), null);
});

test('high-rep sets set rep records at their weight or heavier', () => {
  // 60 × 15 can't be estimated, but beats 60 × 14 and 62.5 × 13.
  assert.equal(recordFor(s(60, 15), [s(60, 14), s(62.5, 13), s(100, 5)]), 'reps');
  // 15 reps at 60 doesn't beat 16 reps at 65.
  assert.equal(recordFor(s(60, 15), [s(65, 16), s(100, 5)]), null);
  // Lighter and fewer reps than a heavier earlier set: no record.
  assert.equal(recordFor(s(25, 20), [s(30, 25)]), null);
});

test('bodyweight sets compare reps against other bodyweight sets', () => {
  assert.equal(recordFor(s(null, 15), [s(null, 12), s(null, 14)]), 'reps');
  assert.equal(recordFor(s(null, 14), [s(null, 14)]), null);
});

test('PRs are judged against sessions before this one only', () => {
  const state = logged(
    ['2026-09-07', 'pushA', 'incline-db-press', [s(30, 8)]],
    ['2026-09-10', 'pushB', 'incline-db-press', [s(30, 10), s(32.5, 8)]],
    ['2026-09-14', 'pushA', 'incline-db-press', [s(32.5, 8)]]
  );
  // Sept 10: both sets beat Sept 7; they don't compete with each other.
  assert.deepEqual(
    recordsInSession(state, 'incline-db-press', { dateKey: '2026-09-10', dayKey: 'pushB' }, [s(30, 10), s(32.5, 8)]),
    ['e1rm', 'weight']
  );
  // Sept 14 repeats Sept 10's best: no PR.
  assert.deepEqual(
    recordsInSession(state, 'incline-db-press', { dateKey: '2026-09-14', dayKey: 'pushA' }, [s(32.5, 8)]),
    [null]
  );
  // Looking at Sept 7 later still shows it as the baseline.
  assert.equal(bestsBefore(state, 'incline-db-press', { dateKey: '2026-09-07', dayKey: 'pushA' }).count, 0);
});

test('compareSets says up, same or down against last time', () => {
  assert.equal(compareSets(s(30, 9), s(30, 8)), 'up');
  assert.equal(compareSets(s(30, 8), s(30, 8)), 'same');
  assert.equal(compareSets(s(27.5, 8), s(30, 8)), 'down');
  assert.equal(compareSets(s(32.5, 6), s(30, 10)), 'up'); // heavier counts, even with fewer reps
  assert.equal(compareSets(s(27.5, 12), s(30, 8)), 'down');
  assert.equal(compareSets(s(null, 14), s(null, 12)), 'up');
  assert.equal(compareSets(s(60, 15), s(60, 14)), 'up');
  assert.equal(compareSets(s(30, 8), undefined), null);
});
