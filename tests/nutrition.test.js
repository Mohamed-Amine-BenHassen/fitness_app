import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import {
  addEntry,
  dayTotal,
  entriesFor,
  nextQuickAddId,
  progressRatio,
  remaining,
  removeEntry,
  removeQuickAdd,
  setProteinTarget,
  upsertQuickAdd
} from '../src/core/nutrition.js';

const DAY = '2026-09-11';

test('an untouched day is empty and 190 g short', () => {
  const state = defaultState();
  assert.deepEqual(entriesFor(state, DAY), []);
  assert.equal(dayTotal(state, DAY), 0);
  assert.equal(remaining(state, DAY), 190);
  assert.equal(progressRatio(state, DAY), 0);
});

test('entries accumulate within a day and stay separate across days', () => {
  let state = addEntry(defaultState(), DAY, { label: 'Shake', grams: 30 }, 1);
  state = addEntry(state, DAY, { label: 'Chicken', grams: 45 }, 2);
  state = addEntry(state, '2026-09-12', { label: 'Shake', grams: 30 }, 3);
  assert.equal(dayTotal(state, DAY), 75);
  assert.equal(dayTotal(state, '2026-09-12'), 30);
  assert.equal(remaining(state, DAY), 115);
});

test('addEntry does not mutate the input state', () => {
  const before = defaultState();
  const snapshot = JSON.stringify(before);
  addEntry(before, DAY, { label: 'Shake', grams: 30 }, 1);
  assert.equal(JSON.stringify(before), snapshot);
});

test('zero, negative and non-numeric grams are rejected', () => {
  let state = defaultState();
  state = addEntry(state, DAY, { label: 'Nothing', grams: 0 }, 1);
  state = addEntry(state, DAY, { label: 'Negative', grams: -20 }, 2);
  state = addEntry(state, DAY, { label: 'Junk', grams: 'lots' }, 3);
  assert.equal(entriesFor(state, DAY).length, 0);
});

test('an unlabelled entry gets a default label', () => {
  const state = addEntry(defaultState(), DAY, { grams: 25 }, 1);
  assert.equal(entriesFor(state, DAY)[0].label, 'Protein');
});

test('going over target clamps remaining at zero and the ratio at one', () => {
  const state = addEntry(defaultState(), DAY, { label: 'Big day', grams: 220 }, 1);
  assert.equal(remaining(state, DAY), 0);
  assert.equal(progressRatio(state, DAY), 1);
});

test('removing the last entry clears the day key entirely', () => {
  let state = addEntry(defaultState(), DAY, { label: 'Shake', grams: 30 }, 1);
  state = removeEntry(state, DAY, 0);
  assert.equal(Object.hasOwn(state.nutrition, DAY), false);
});

test('removing an out-of-range index is a no-op', () => {
  const state = addEntry(defaultState(), DAY, { label: 'Shake', grams: 30 }, 1);
  assert.equal(dayTotal(removeEntry(state, DAY, 5), DAY), 30);
});

test('quick-adds ship as three editable placeholders at 0 g', () => {
  const { quickAdds } = defaultState().settings;
  assert.equal(quickAdds.length, 3);
  assert.equal(quickAdds[0].label, 'Isoclear shake');
  assert.ok(quickAdds.every((qa) => qa.grams === 0));
});

test('editing a quick-add updates it in place', () => {
  const state = upsertQuickAdd(defaultState(), { id: 'qa-1', label: 'Isoclear', grams: 27 });
  assert.deepEqual(state.settings.quickAdds[0], { id: 'qa-1', label: 'Isoclear', grams: 27 });
  assert.equal(state.settings.quickAdds.length, 3);
});

test('a quick-add without an id is appended with a fresh id', () => {
  const state = upsertQuickAdd(defaultState(), { label: 'Greek yoghurt', grams: 20 });
  assert.equal(state.settings.quickAdds.length, 4);
  assert.equal(state.settings.quickAdds[3].id, 'qa-4');
});

test('fresh ids do not collide after a deletion', () => {
  let state = removeQuickAdd(defaultState(), 'qa-2');
  assert.equal(nextQuickAddId(state.settings.quickAdds), 'qa-4');
  state = upsertQuickAdd(state, { label: 'Cottage cheese', grams: 22 });
  const ids = state.settings.quickAdds.map((qa) => qa.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the protein target is editable but never zero or negative', () => {
  assert.equal(setProteinTarget(defaultState(), 210).settings.proteinTargetG, 210);
  assert.equal(setProteinTarget(defaultState(), 0).settings.proteinTargetG, 190);
  assert.equal(setProteinTarget(defaultState(), -5).settings.proteinTargetG, 190);
});
