import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, defaultState } from '../src/core/schema.js';
import { addSet, lastPerformance } from '../src/core/sets.js';
import { migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  activePlan,
  addSession,
  addSlot,
  archiveExercise,
  archivePlan,
  archiveSession,
  createPlan,
  duplicatePlan,
  exerciseIdFor,
  exerciseUsage,
  libraryList,
  moveSlot,
  nextPlanId,
  nextSessionKey,
  removeSlot,
  renamePlan,
  resolveSession,
  restorePlan,
  scheduledKey,
  searchLibrary,
  sessionName,
  setActivePlan,
  setSchedule,
  swapSlot,
  updateSession,
  updateSlot,
  upsertExercise
} from '../src/core/plans.js';

const seed = () => defaultState();
const P = 'plan-1';
const slotsOf = (state, planId, key) =>
  state.plans.find((p) => p.id === planId).sessions.find((s) => s.key === key).slots;

// ---------- reading the default plan ----------

test('the default plan schedules Push A on Monday and rest on Sunday', () => {
  const state = seed();
  assert.equal(scheduledKey(state, 1), 'pushA');
  assert.equal(scheduledKey(state, 6), 'legsB');
  assert.equal(scheduledKey(state, 0), 'rest');
});

test('resolveSession joins slots with the library', () => {
  const session = resolveSession(seed(), 'legsA');
  assert.equal(session.name, 'Legs A');
  assert.equal(session.exercises.length, 6);
  const hlr = session.exercises.find((e) => e.id === 'hanging-leg-raise');
  assert.equal(hlr.bodyweightOnly, true);
  assert.equal(hlr.name, 'Hanging Leg Raise');
  assert.deepEqual(hlr.repRange, { min: 10, max: 15 });
});

test('rest and unknown keys resolve to an empty rest session', () => {
  assert.deepEqual(resolveSession(seed(), 'rest').exercises, []);
  assert.equal(resolveSession(seed(), 'bogus').key, 'rest');
  assert.equal(sessionName(seed(), 'rest'), 'Rest');
});

// ---------- plans ----------

test('a new plan starts empty and all rest', () => {
  const id = nextPlanId(seed());
  assert.equal(id, 'plan-2');
  const state = createPlan(seed(), { id, name: '  Upper/Lower  ' });
  const plan = state.plans.find((p) => p.id === id);
  assert.equal(plan.name, 'Upper/Lower');
  assert.deepEqual(plan.sessions, []);
  assert.deepEqual(plan.schedule, Array(7).fill('rest'));
});

test('switching the active plan changes what is scheduled', () => {
  let state = createPlan(seed(), { id: 'plan-2', name: 'Full body' });
  state = addSession(state, 'plan-2', { key: 's-1', name: 'Full body A' });
  state = setSchedule(state, 'plan-2', 1, 's-1');
  assert.equal(scheduledKey(state, 1), 'pushA');
  state = setActivePlan(state, 'plan-2');
  assert.equal(activePlan(state).id, 'plan-2');
  assert.equal(scheduledKey(state, 1), 's-1');
  assert.equal(scheduledKey(state, 2), 'rest');
});

test('the active plan cannot be archived; another can, and comes back', () => {
  let state = createPlan(seed(), { id: 'plan-2', name: 'Spare' });
  assert.equal(archivePlan(state, P), state);
  state = archivePlan(state, 'plan-2');
  assert.equal(state.plans[1].archived, true);
  assert.equal(setActivePlan(state, 'plan-2'), state, 'an archived plan cannot be made active');
  state = restorePlan(state, 'plan-2');
  assert.equal(state.plans[1].archived, false);
});

test('duplicating a plan copies it with fresh session keys', () => {
  const state = duplicatePlan(seed(), P, { id: 'plan-2', name: 'PPL deload' });
  const copy = state.plans[1];
  assert.equal(copy.name, 'PPL deload');
  assert.equal(copy.sessions.length, 6);
  assert.deepEqual(copy.sessions.map((s) => s.key), ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6']);
  assert.deepEqual(copy.schedule, ['rest', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6']);
  assert.equal(copy.sessions[0].name, 'Push A');
  // Editing the copy leaves the original alone.
  const edited = updateSlot(state, 'plan-2', 's-1', 0, { sets: 2 });
  assert.equal(slotsOf(edited, P, 'pushA')[0].sets, 4);
  assert.equal(slotsOf(edited, 'plan-2', 's-1')[0].sets, 2);
});

test('renaming keeps the old name when the new one is blank', () => {
  assert.equal(renamePlan(seed(), P, 'My PPL').plans[0].name, 'My PPL');
  assert.equal(renamePlan(seed(), P, '   ').plans[0].name, 'PPL Build v3');
});

// ---------- sessions and schedule ----------

test('session keys are unique across plans', () => {
  let state = createPlan(seed(), { id: 'plan-2', name: 'B' });
  const key = nextSessionKey(state);
  state = addSession(state, 'plan-2', { key, name: 'Day 1' });
  assert.equal(nextSessionKey(state), 's-2');
  assert.equal(addSession(state, P, { key, name: 'clash' }), state);
  assert.equal(addSession(state, P, { key: 'rest', name: 'nope' }), state);
});

test('the schedule only accepts rest or a live session of that plan', () => {
  const state = seed();
  assert.equal(setSchedule(state, P, 0, 'pushA').plans[0].schedule[0], 'pushA');
  assert.equal(setSchedule(state, P, 0, 'bogus'), state);
  assert.equal(setSchedule(state, P, 9, 'pushA'), state);
  assert.equal(setSchedule(state, P, 1, 'rest').plans[0].schedule[1], 'rest');
});

test('archiving a session takes it off the schedule but keeps its name for history', () => {
  const state = archiveSession(seed(), P, 'pushB');
  assert.equal(state.plans[0].schedule[4], 'rest');
  assert.equal(scheduledKey(state, 4), 'rest');
  assert.equal(sessionName(state, 'pushB'), 'Push B');
});

test('updateSession renames and refocuses', () => {
  const state = updateSession(seed(), P, 'pushA', { name: 'Chest day', focus: ' heavy ' });
  const session = resolveSession(state, 'pushA');
  assert.equal(session.name, 'Chest day');
  assert.equal(session.focus, 'heavy');
});

// ---------- slots ----------

test('adding a slot appends a normalised prescription', () => {
  const state = addSlot(seed(), P, 'pushA', { exerciseId: 'face-pull', sets: 2.6, repRange: { min: 15, max: 12 }, restSec: 45 });
  const added = slotsOf(state, P, 'pushA').at(-1);
  assert.deepEqual(added, {
    exerciseId: 'face-pull',
    sets: 3,
    repRange: { min: 15, max: 15 },
    restSec: 45,
    note: '',
    anchor: false
  });
});

test('an exercise can appear only once per session', () => {
  const state = seed();
  assert.equal(addSlot(state, P, 'pullA', { exerciseId: 'face-pull' }), state);
  // Lat pulldown (slot 1 of Pull B) can't be swapped for Face Pull, which is slot 3.
  assert.equal(swapSlot(state, P, 'pullB', 1, 'face-pull'), state);
  // Swapping a slot for itself is a no-op, not a refusal of the whole session.
  assert.equal(swapSlot(state, P, 'pullB', 3, 'face-pull'), state);
});

test('out-of-range slot edits leave the state untouched', () => {
  const state = seed();
  assert.equal(updateSlot(state, P, 'pushA', 99, { sets: 1 }), state);
  assert.equal(removeSlot(state, P, 'pushA', 99), state);
  assert.equal(moveSlot(state, P, 'pushA', 5, 1), state);
});

test('a slot for an exercise that is not in the library is refused', () => {
  const state = seed();
  assert.equal(addSlot(state, P, 'pushA', { exerciseId: 'ghost' }), state);
});

test('updateSlot merges a partial change and keeps the exercise', () => {
  const state = updateSlot(seed(), P, 'legsA', 0, { repRange: { max: 10 }, note: 'belt' });
  const slot = slotsOf(state, P, 'legsA')[0];
  assert.equal(slot.exerciseId, 'back-squat');
  assert.deepEqual(slot.repRange, { min: 6, max: 10 });
  assert.equal(slot.note, 'belt');
  assert.equal(slot.sets, 4);
});

test('moveSlot reorders and ignores moves past either end', () => {
  const moved = moveSlot(seed(), P, 'pushA', 1, -1);
  assert.deepEqual(slotsOf(moved, P, 'pushA').slice(0, 2).map((s) => s.exerciseId), [
    'flat-db-machine-press',
    'incline-db-press'
  ]);
  const unchanged = moveSlot(seed(), P, 'pushA', 0, -1);
  assert.equal(slotsOf(unchanged, P, 'pushA')[0].exerciseId, 'incline-db-press');
});

test('removeSlot drops one exercise from the session', () => {
  const state = removeSlot(seed(), P, 'pullA', 3);
  const ids = slotsOf(state, P, 'pullA').map((s) => s.exerciseId);
  assert.equal(ids.length, 5);
  assert.ok(!ids.includes('face-pull'));
});

test('swapping keeps the prescription; history follows the exercise', () => {
  let state = addSet(seed(), '2026-09-07', 'pushA', 'incline-db-press', { weightKg: 30, reps: 9 });
  state = swapSlot(state, P, 'pushA', 0, 'machine-chest-press-dips');
  const slot = slotsOf(state, P, 'pushA')[0];
  assert.equal(slot.exerciseId, 'machine-chest-press-dips');
  assert.equal(slot.sets, 4);
  assert.equal(lastPerformance(state, 'machine-chest-press-dips'), null);
  assert.equal(lastPerformance(state, 'incline-db-press').sets[0].weightKg, 30);
});

test('plan edits never mutate the input state', () => {
  const before = seed();
  const snapshot = JSON.stringify(before);
  updateSlot(before, P, 'pushA', 0, { sets: 1 });
  moveSlot(before, P, 'pushA', 0, 1);
  swapSlot(before, P, 'pushA', 0, 'face-pull');
  setSchedule(before, P, 0, 'pushA');
  duplicatePlan(before, P, { id: 'plan-2' });
  archiveSession(before, P, 'pushA');
  upsertExercise(before, { id: 'face-pull', name: 'Rope Face Pull' });
  assert.equal(JSON.stringify(before), snapshot);
});

// ---------- library ----------

test('renaming an exercise keeps its id, so its history still shows', () => {
  let state = addSet(seed(), '2026-09-08', 'pullA', 'face-pull', { weightKg: 20, reps: 18 });
  state = upsertExercise(state, { id: 'face-pull', name: 'Rope Face Pull' });
  assert.equal(resolveSession(state, 'pullA').exercises[3].name, 'Rope Face Pull');
  assert.equal(lastPerformance(state, 'face-pull').sets[0].reps, 18);
});

test('a new exercise gets a slug id that never collides', () => {
  const state = seed();
  assert.equal(exerciseIdFor(state, 'Cable Fly'), 'cable-fly');
  assert.equal(exerciseIdFor(state, 'Face Pull'), 'face-pull-2');
  assert.equal(exerciseIdFor(state, 'Développé couché'), 'developpe-couche');
  assert.equal(exerciseIdFor(state, '!!!'), 'exercise');
  const added = upsertExercise(state, { name: 'Cable Fly', technique: 'Arms soft, hug a tree.' });
  assert.equal(added.library['cable-fly'].technique, 'Arms soft, hug a tree.');
  assert.equal(added.library['cable-fly'].archived, false);
});

test('archived exercises leave the picker but keep resolving in plans', () => {
  const state = archiveExercise(seed(), 'face-pull');
  assert.ok(!libraryList(state).some((e) => e.id === 'face-pull'));
  assert.ok(libraryList(state, { includeArchived: true }).some((e) => e.id === 'face-pull'));
  assert.ok(resolveSession(state, 'pullA').exercises.some((e) => e.id === 'face-pull'));
});

test('library search ignores case and accents', () => {
  const state = upsertExercise(seed(), { name: 'Développé couché' });
  assert.deepEqual(searchLibrary(state, 'DEVELOPPE').map((e) => e.id), ['developpe-couche']);
  assert.ok(searchLibrary(state, 'curl').length >= 4);
  assert.equal(searchLibrary(state, '  ').length, libraryList(state).length);
});

test('exerciseUsage counts live sessions in live plans', () => {
  assert.equal(exerciseUsage(seed(), 'face-pull'), 2);
  assert.equal(exerciseUsage(archiveSession(seed(), P, 'pullA'), 'face-pull'), 1);
  assert.equal(exerciseUsage(seed(), 'cable-crunch'), 1);
});

// ---------- schema v2 migration ----------

const v1Backup = {
  app: 'ppl-fitness-tracker',
  schemaVersion: 1,
  exportedAt: '2026-09-11T18:00:00.000Z',
  settings: { proteinTargetG: 200, quickAdds: [{ id: 'qa-1', label: 'Isoclear shake', grams: 27 }] },
  sessions: [
    { dateKey: '2026-09-07', dayKey: 'pushA', entries: [{ exerciseId: 'incline-db-press', sets: [{ weightKg: 30, reps: 9 }] }] },
    { dateKey: '2026-09-10', dayKey: 'pushB', entries: [{ exerciseId: 'incline-db-press', sets: [{ weightKg: 26, reps: 11 }] }] }
  ],
  nutrition: { '2026-09-07': [{ label: 'Isoclear', grams: 27, ts: 1757260000000 }] }
};

test('a v1 backup imports with its history intact and the default plan seeded', () => {
  const result = parseBackup(JSON.stringify(v1Backup));
  assert.equal(result.ok, true);
  const state = result.state;
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.settings.proteinTargetG, 200);
  assert.equal(state.settings.activePlanId, 'plan-1');
  assert.equal(state.plans.length, 1);
  assert.deepEqual(state.sessions.map((s) => s.dayKey), ['pushA', 'pushB']);
  assert.equal(sessionName(state, 'pushB'), 'Push B');
  assert.equal(lastPerformance(state, 'incline-db-press').sets[0].weightKg, 26);
  assert.deepEqual(state.nutrition, v1Backup.nutrition);
});

test('an edited v2 state round-trips through export and import', () => {
  let state = createPlan(seed(), { id: 'plan-2', name: 'Upper/Lower' });
  state = upsertExercise(state, { name: 'Cable Fly' });
  state = addSession(state, 'plan-2', { key: 's-1', name: 'Upper' });
  state = addSlot(state, 'plan-2', 's-1', { exerciseId: 'cable-fly', sets: 3, repRange: { min: 12, max: 15 }, restSec: 60 });
  state = setSchedule(state, 'plan-2', 2, 's-1');
  state = setActivePlan(state, 'plan-2');
  state = archiveSession(state, P, 'legsB');
  const result = parseBackup(serializeBackup(state, null));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state, state);
});

test('migrate repairs plans: bad slots, duplicate keys, dead schedule entries', () => {
  const state = migrate({
    schemaVersion: 2,
    settings: { activePlanId: 'gone' },
    library: { 'my-move': { name: 'My Move' } },
    plans: [
      {
        id: 'a',
        name: 'A',
        schedule: ['x', 'k1', 'archived', 7],
        sessions: [
          { key: 'k1', name: 'One', slots: [{ exerciseId: 'my-move', sets: 3 }, { exerciseId: 'ghost' }, 'junk', { exerciseId: 'my-move', sets: 5 }] },
          { key: 'archived', name: 'Old', archived: true, slots: [] }
        ]
      },
      { id: 'b', name: 'B', sessions: [{ key: 'k1', name: 'Dup key' }] },
      { id: 'a', name: 'Dup id' }
    ]
  });
  assert.equal(state.plans.length, 2);
  const [a, b] = state.plans;
  assert.deepEqual(a.schedule, ['rest', 'k1', 'rest', 'rest', 'rest', 'rest', 'rest']);
  assert.deepEqual(a.sessions[0].slots.map((s) => s.exerciseId), ['my-move']);
  assert.deepEqual(b.sessions, []);
  assert.equal(state.settings.activePlanId, 'a');
  assert.ok(state.library['back-squat'], 'built-in exercises are always present');
  assert.equal(state.library['my-move'].name, 'My Move');
});

test('if every plan is archived, migrate revives one to train from', () => {
  const state = migrate({ schemaVersion: 2, plans: [{ id: 'only', name: 'Only', archived: true, sessions: [] }] });
  assert.equal(state.plans[0].archived, false);
  assert.equal(state.settings.activePlanId, 'only');
});
