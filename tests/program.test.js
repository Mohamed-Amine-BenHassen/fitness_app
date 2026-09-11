import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSIONS,
  TRAINING_KEYS,
  WEEKLY_SCHEDULE,
  dayKeyForWeekday,
  exerciseById,
  formatPrescription,
  formatRest,
  getSession,
  sessionForWeekday
} from '../src/core/program.js';

test('the weekly schedule matches plan.md', () => {
  assert.equal(dayKeyForWeekday(1), 'pushA');
  assert.equal(dayKeyForWeekday(2), 'pullA');
  assert.equal(dayKeyForWeekday(3), 'legsA');
  assert.equal(dayKeyForWeekday(4), 'pushB');
  assert.equal(dayKeyForWeekday(5), 'pullB');
  assert.equal(dayKeyForWeekday(6), 'legsB');
  assert.equal(dayKeyForWeekday(0), 'rest');
  assert.equal(WEEKLY_SCHEDULE.length, 7);
});

test('Sunday resolves to an empty rest session', () => {
  const session = sessionForWeekday(0);
  assert.equal(session.name, 'Rest');
  assert.deepEqual(session.exercises, []);
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
  assert.equal(exerciseById('hanging-leg-raise').bodyweightOnly, true);
  assert.equal(exerciseById('bulgarian-split-squat').perSide, true);
  assert.equal(exerciseById('back-squat').bodyweightOnly, false);
});

test('exerciseById returns null for an unknown id', () => {
  assert.equal(exerciseById('nope'), null);
});

test('rest formatting stays readable', () => {
  assert.equal(formatRest(45), '45s');
  assert.equal(formatRest(90), '1.5m');
  assert.equal(formatRest(120), '2m');
  assert.equal(formatRest(150), '2.5m');
});

test('prescription line reads like the plan', () => {
  assert.equal(formatPrescription(exerciseById('back-squat')), '4 x 6-8 · rest 3m');
});

test('an unknown day key falls back to rest', () => {
  assert.equal(getSession('bogus').key, 'rest');
});
