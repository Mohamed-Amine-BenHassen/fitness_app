import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { addSet } from '../src/core/sets.js';
import { upsertExercise } from '../src/core/plans.js';
import { exerciseLog, sessionDetail, sessionSummaries } from '../src/core/history.js';

function sample() {
  let state = defaultState();
  const log = (dateKey, dayKey, exerciseId, weightKg, reps) => {
    state = addSet(state, dateKey, dayKey, exerciseId, { weightKg, reps });
  };
  log('2026-09-07', 'pushA', 'incline-db-press', 30, 8);
  log('2026-09-07', 'pushA', 'triceps-pushdown', 25, 12);
  log('2026-09-10', 'pushB', 'incline-db-press', 30, 10);
  log('2026-09-10', 'pushB', 'incline-db-press', 32.5, 7);
  log('2026-09-09', 'legsA', 'hanging-leg-raise', null, 14);
  return state;
}

test('the session list is newest first with counts and PRs', () => {
  assert.deepEqual(sessionSummaries(sample()), [
    { dateKey: '2026-09-10', dayKey: 'pushB', name: 'Push B', exerciseCount: 1, setCount: 2, prCount: 2 },
    { dateKey: '2026-09-09', dayKey: 'legsA', name: 'Legs A', exerciseCount: 1, setCount: 1, prCount: 0 },
    { dateKey: '2026-09-07', dayKey: 'pushA', name: 'Push A', exerciseCount: 2, setCount: 2, prCount: 0 }
  ]);
});

test('an empty log has no sessions', () => {
  assert.deepEqual(sessionSummaries(defaultState()), []);
});

test('session detail lists exercises with names and per-set records', () => {
  const detail = sessionDetail(sample(), '2026-09-10', 'pushB');
  assert.equal(detail.name, 'Push B');
  assert.equal(detail.exercises.length, 1);
  assert.equal(detail.exercises[0].name, 'Incline DB Press');
  assert.deepEqual(detail.exercises[0].sets, [
    { weightKg: 30, reps: 10, record: 'e1rm' },
    { weightKg: 32.5, reps: 7, record: 'weight' }
  ]);
  assert.equal(sessionDetail(sample(), '2026-01-01', 'pushA'), null);
});

test('exercise names follow renames in the library', () => {
  const state = upsertExercise(sample(), { id: 'incline-db-press', name: 'Incline Press' });
  assert.equal(sessionDetail(state, '2026-09-07', 'pushA').exercises[0].name, 'Incline Press');
});

test('the exercise log spans sessions across plans, newest first, with bests', () => {
  const log = exerciseLog(sample(), 'incline-db-press');
  assert.equal(log.name, 'Incline DB Press');
  assert.deepEqual(log.sessions.map((s) => `${s.dateKey} ${s.sessionName}`), ['2026-09-10 Push B', '2026-09-07 Push A']);
  assert.equal(log.sessions[0].bests.heaviest, 32.5);
  assert.equal(log.allTime.heaviest, 32.5);
  assert.equal(log.allTime.e1rm, 40.08); // 32.5 × (1 + 7/30)
  assert.equal(log.sessions[1].sets[0].record, null, 'the first session is the baseline');
});

test('an exercise never done has an empty log', () => {
  const log = exerciseLog(sample(), 'cable-crunch');
  assert.deepEqual(log.sessions, []);
  assert.equal(log.allTime.count, 0);
});
