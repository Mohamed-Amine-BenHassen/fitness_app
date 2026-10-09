import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSIONS,
  TRAINING_KEYS,
  WEEKLY_SCHEDULE,
  formatPrescription,
  formatRest,
  seedLibrary,
  seedPlan
} from '../src/core/program.js';

// Seed lookups, the way the app saw the fixed program before plans were editable.
const seedExercise = (id) =>
  TRAINING_KEYS.flatMap((key) => SESSIONS[key].exercises).find((e) => e.id === id) || null;

test('the weekly schedule matches plan.md', () => {
  assert.deepEqual(WEEKLY_SCHEDULE, ['rest', 'pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB']);
});

test('every training session has six exercises and exactly one anchor', () => {
  for (const key of TRAINING_KEYS) {
    const session = SESSIONS[key];
    assert.equal(session.exercises.length, 6, `${key} exercise count`);
    assert.equal(session.exercises.filter((e) => e.anchor).length, 1, `${key} anchor count`);
  }
});

test('exercise ids are shared across sessions so history carries over', () => {
  const pushA = SESSIONS.pushA.exercises.map((e) => e.id);
  const pushB = SESSIONS.pushB.exercises.map((e) => e.id);
  assert.ok(pushA.includes('incline-db-press') && pushB.includes('incline-db-press'));
  assert.ok(SESSIONS.pullA.exercises.some((e) => e.id === 'face-pull'));
  assert.ok(SESSIONS.pullB.exercises.some((e) => e.id === 'face-pull'));
});

test('ids are unique within a session', () => {
  for (const key of TRAINING_KEYS) {
    const ids = SESSIONS[key].exercises.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${key} has duplicate ids`);
  }
});

test('bodyweight and per-side flags come from the plan notes', () => {
  assert.equal(seedExercise('hanging-leg-raise').bodyweightOnly, true);
  assert.equal(seedExercise('bulgarian-split-squat').perSide, true);
  assert.equal(seedExercise('back-squat').bodyweightOnly, false);
});

test('the seed library has every exercise once, with its flags', () => {
  const library = seedLibrary();
  const ids = new Set(TRAINING_KEYS.flatMap((key) => SESSIONS[key].exercises.map((e) => e.id)));
  assert.deepEqual(new Set(Object.keys(library)), ids);
  assert.equal(library['hanging-leg-raise'].bodyweightOnly, true);
  assert.equal(library['single-arm-db-row'].perSide, true);
  assert.equal(library['incline-db-press'].archived, false);
});

test('the seed plan keeps the v1 session keys and per-session prescriptions', () => {
  const plan = seedPlan();
  assert.deepEqual(plan.sessions.map((s) => s.key), TRAINING_KEYS);
  assert.deepEqual(plan.schedule, WEEKLY_SCHEDULE);
  // Incline DB Press is prescribed differently in Push A and Push B.
  const slot = (key) => plan.sessions.find((s) => s.key === key).slots.find((x) => x.exerciseId === 'incline-db-press');
  assert.equal(slot('pushA').sets, 4);
  assert.deepEqual(slot('pushB').repRange, { min: 8, max: 12 });
});

test('each seedPlan call returns an independent copy', () => {
  const a = seedPlan();
  a.sessions[0].slots[0].sets = 99;
  a.schedule[0] = 'pushA';
  assert.equal(seedPlan().sessions[0].slots[0].sets, 4);
  assert.equal(seedPlan().schedule[0], 'rest');
});

test('rest formatting stays readable', () => {
  assert.equal(formatRest(45), '45s');
  assert.equal(formatRest(90), '1.5m');
  assert.equal(formatRest(120), '2m');
  assert.equal(formatRest(150), '2.5m');
});

test('prescription line reads like the plan', () => {
  assert.equal(formatPrescription(seedExercise('back-squat')), '4 x 6-8 · rest 3m');
});
