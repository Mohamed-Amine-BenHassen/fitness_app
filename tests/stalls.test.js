import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { addSet } from '../src/core/sets.js';
import { resolveSession } from '../src/core/plans.js';
import { shiftDateKey } from '../src/core/dates.js';
import { deloadAdvice, sessionsSinceProgress, stallFor, stalledLifts } from '../src/core/stalls.js';

const pushA = resolveSession(defaultState(), 'pushA').exercises;
const incline = pushA.find((e) => e.id === 'incline-db-press');
const legRaise = resolveSession(defaultState(), 'legsA').exercises.find((e) => e.id === 'hanging-leg-raise');
const TODAY = { dateKey: '2026-10-12', dayKey: 'pushA' };

// One top set per weekly session, oldest first, ending the week before TODAY.
function history(state, exerciseId, sets, dayKey = 'pushA') {
  sets.forEach(([weightKg, reps], i) => {
    const dateKey = shiftDateKey(TODAY.dateKey, -7 * (sets.length - i));
    state = addSet(state, dateKey, dayKey, exerciseId, { weightKg, reps });
  });
  return state;
}

test('a lift that keeps improving has no stall', () => {
  const state = history(defaultState(), 'incline-db-press', [[30, 8], [30, 9], [30, 10], [32.5, 7]]);
  assert.equal(sessionsSinceProgress(state, incline, TODAY), 0);
  assert.equal(stallFor(state, incline, TODAY), null);
});

test('three sessions without beating the best is a stall', () => {
  const state = history(defaultState(), 'incline-db-press', [[32.5, 9], [32.5, 8], [32.5, 9], [32.5, 8]]);
  assert.equal(sessionsSinceProgress(state, incline, TODAY), 3);
  // 10% under 32.5 kg is 29.25, which lands on 30 kg at a 2.5 kg step.
  assert.deepEqual(stallFor(state, incline, TODAY), { sessions: 3, lighterKg: 30 });
});

test('two flat sessions are not a stall yet', () => {
  const state = history(defaultState(), 'incline-db-press', [[32.5, 9], [32.5, 8], [32.5, 9]]);
  assert.equal(sessionsSinceProgress(state, incline, TODAY), 2);
  assert.equal(stallFor(state, incline, TODAY), null);
});

test('one session has nothing to compare with', () => {
  const state = history(defaultState(), 'incline-db-press', [[32.5, 9]]);
  assert.equal(sessionsSinceProgress(state, incline, TODAY), null);
});

test('today’s unfinished session never counts toward a stall', () => {
  let state = history(defaultState(), 'incline-db-press', [[32.5, 9], [32.5, 8], [32.5, 9]]);
  state = addSet(state, TODAY.dateKey, TODAY.dayKey, 'incline-db-press', { weightKg: 30, reps: 5 });
  assert.equal(sessionsSinceProgress(state, incline, TODAY), 2);
});

test('bodyweight lifts stall on reps and get no lighter weight', () => {
  const state = history(defaultState(), 'hanging-leg-raise', [[null, 15], [null, 14], [null, 15], [null, 13]], 'legsA');
  assert.deepEqual(stallFor(state, legRaise, { dateKey: TODAY.dateKey, dayKey: 'legsA' }), { sessions: 3, lighterKg: null });
});

test('the lighter weight always ends up below last time’s top set', () => {
  // 10% under 5 kg rounds back to 5 kg, so it steps down instead.
  const lateral = pushA.find((e) => e.id === 'cable-lateral-raise');
  const state = history(defaultState(), 'cable-lateral-raise', [[5, 15], [5, 14], [5, 15], [5, 14]]);
  assert.deepEqual(stallFor(state, lateral, TODAY), { sessions: 3, lighterKg: 2.5 });
});

test('the same exercise stalls separately in each session type', () => {
  // Flat in Push A, climbing in Push B: only Push A has stalled.
  let state = history(defaultState(), 'incline-db-press', [[32.5, 9], [32.5, 8], [32.5, 9], [32.5, 8]]);
  state = history(state, 'incline-db-press', [[25, 8], [25, 9], [25, 10], [27.5, 8]], 'pushB');
  const pushBIncline = resolveSession(state, 'pushB').exercises.find((e) => e.id === 'incline-db-press');
  assert.deepEqual(stallFor(state, incline, TODAY), { sessions: 3, lighterKg: 30 });
  assert.equal(stallFor(state, pushBIncline, { dateKey: TODAY.dateKey, dayKey: 'pushB' }), null);
  assert.deepEqual(
    stalledLifts(state, TODAY).map((lift) => [lift.id, lift.dayKey, lift.sessionName]),
    [['incline-db-press', 'pushA', 'Push A']]
  );
});

test('a deload is suggested once three lifts in the plan stall together', () => {
  const flat = [[30, 9], [30, 8], [30, 9], [30, 8]];
  let state = history(defaultState(), 'incline-db-press', flat);
  state = history(state, 'flat-db-machine-press', flat);
  assert.equal(stalledLifts(state, TODAY).length, 2);
  assert.equal(deloadAdvice(state, TODAY), null);

  state = history(state, 'seated-db-shoulder-press', flat);
  const advice = deloadAdvice(state, TODAY);
  assert.deepEqual(
    advice.lifts.map((lift) => lift.id),
    ['incline-db-press', 'flat-db-machine-press', 'seated-db-shoulder-press']
  );
});
