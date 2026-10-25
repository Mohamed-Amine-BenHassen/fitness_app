import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { addSet } from '../src/core/sets.js';
import { migrate } from '../src/core/backup.js';
import { resolveSession } from '../src/core/plans.js';
import { DEFAULT_WEIGHT_STEP_KG, setWeightStep, suggestNext, warmupSets, weightStepOf } from '../src/core/progression.js';

// Incline DB Press in Push A: 4 × 6-10.
const incline = resolveSession(defaultState(), 'pushA').exercises.find((e) => e.id === 'incline-db-press');
const legRaise = resolveSession(defaultState(), 'legsA').exercises.find((e) => e.id === 'hanging-leg-raise');
const TODAY = { dateKey: '2026-10-12', dayKey: 'pushA' };

function lastTime(sets, exerciseId = 'incline-db-press', state = defaultState(), dayKey = 'pushA') {
  for (const set of sets) state = addSet(state, '2026-10-05', dayKey, exerciseId, set);
  return state;
}

test('no history means no suggestion', () => {
  assert.equal(suggestNext(defaultState(), incline, TODAY), null);
});

test('top of the range on every set: add one step, back to the bottom', () => {
  const state = lastTime([30, 30, 30, 30].map((w) => ({ weightKg: w, reps: 10 })));
  assert.deepEqual(suggestNext(state, incline, TODAY), {
    weightKg: 32.5,
    reps: 6,
    reason: 'You hit 10 reps on every set — add weight'
  });
});

test('top of the range on fewer sets than prescribed: not yet', () => {
  const state = lastTime([30, 30, 30].map((w) => ({ weightKg: w, reps: 10 })));
  assert.equal(suggestNext(state, incline, TODAY).weightKg, 30);
});

test('in the range: same weight, one more rep than the weakest set', () => {
  const state = lastTime([{ weightKg: 30, reps: 9 }, { weightKg: 30, reps: 8 }, { weightKg: 30, reps: 7 }, { weightKg: 30, reps: 7 }]);
  assert.deepEqual(suggestNext(state, incline, TODAY), { weightKg: 30, reps: 8, reason: 'Same weight, one more rep' });
});

test('below the range: hold the weight and aim for the bottom', () => {
  const state = lastTime([{ weightKg: 32.5, reps: 6 }, { weightKg: 32.5, reps: 5 }]);
  assert.deepEqual(suggestNext(state, incline, TODAY), {
    weightKg: 32.5,
    reps: 6,
    reason: 'Below 6 reps last time — same weight'
  });
});

test('mixed weights: the heaviest are the working sets', () => {
  // A lighter back-off set at 25 kg doesn't count against the top sets.
  const state = lastTime([30, 30, 30, 30].map((w) => ({ weightKg: w, reps: 10 })).concat([{ weightKg: 25, reps: 6 }]));
  assert.equal(suggestNext(state, incline, TODAY).weightKg, 32.5);
});

test('bodyweight exercises aim for one more rep than the best set', () => {
  const state = lastTime([{ weightKg: null, reps: 12 }, { weightKg: null, reps: 14 }], 'hanging-leg-raise', defaultState(), 'legsA');
  assert.deepEqual(suggestNext(state, legRaise, { dateKey: '2026-10-12', dayKey: 'legsA' }), {
    weightKg: null,
    reps: 15,
    reason: 'Beat your best set: 14 reps'
  });
});

test("today's sets never count as last time", () => {
  let state = lastTime([30, 30, 30, 30].map((w) => ({ weightKg: w, reps: 8 })));
  state = addSet(state, TODAY.dateKey, TODAY.dayKey, 'incline-db-press', { weightKg: 40, reps: 10 });
  assert.equal(suggestNext(state, incline, TODAY).weightKg, 30);
});

test('the weight step is a setting, defaulting to 2.5 kg', () => {
  const state = lastTime([30, 30, 30, 30].map((w) => ({ weightKg: w, reps: 10 })));
  assert.equal(weightStepOf(state), DEFAULT_WEIGHT_STEP_KG);
  const two = { ...state, settings: { ...state.settings, weightStepKg: 2 } };
  assert.equal(suggestNext(two, incline, TODAY).weightKg, 32);
});

test('migrate keeps a sane weight step and drops nonsense', () => {
  assert.equal(migrate({ schemaVersion: 2 }).settings.weightStepKg, 2.5);
  assert.equal(migrate({ schemaVersion: 3, settings: { weightStepKg: 1.25 } }).settings.weightStepKg, 1.25);
  assert.equal(migrate({ schemaVersion: 3, settings: { weightStepKg: -1 } }).settings.weightStepKg, 2.5);
  assert.equal(migrate({ schemaVersion: 3, settings: { weightStepKg: 500 } }).settings.weightStepKg, 2.5);
});

test('setWeightStep accepts sensible steps and refuses the rest', () => {
  const state = defaultState();
  assert.equal(setWeightStep(state, 2).settings.weightStepKg, 2);
  assert.equal(setWeightStep(state, 1.25).settings.weightStepKg, 1.25);
  assert.equal(setWeightStep(state, 0), state);
  assert.equal(setWeightStep(state, 0.1), state);
  assert.equal(setWeightStep(state, 51), state);
  assert.equal(setWeightStep(state, NaN), state);
});

test('warm-ups ramp at about 40/60/80% for 8/5/3, rounded to the step', () => {
  assert.deepEqual(warmupSets(100, 2.5), [
    { weightKg: 40, reps: 8 },
    { weightKg: 60, reps: 5 },
    { weightKg: 80, reps: 3 }
  ]);
  assert.deepEqual(warmupSets(32.5, 2.5), [
    { weightKg: 12.5, reps: 8 },
    { weightKg: 20, reps: 5 },
    { weightKg: 25, reps: 3 }
  ]);
});

test('light targets drop repeats and anything at or above the target', () => {
  // 4 and 6 both round to 5 kg; 8 rounds to 7.5.
  assert.deepEqual(warmupSets(10, 2.5), [
    { weightKg: 5, reps: 8 },
    { weightKg: 7.5, reps: 3 }
  ]);
  // Every step rounds to 0 or to the target itself: no warm-up.
  assert.deepEqual(warmupSets(2.5, 2.5), []);
});

test('no target, or a bodyweight one, means no warm-up', () => {
  assert.deepEqual(warmupSets(null), []);
  assert.deepEqual(warmupSets(undefined), []);
  assert.deepEqual(warmupSets(0), []);
});

test('a bad step falls back to the default', () => {
  assert.deepEqual(warmupSets(100, 0), warmupSets(100, DEFAULT_WEIGHT_STEP_KG));
});
