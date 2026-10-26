import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { logWeight } from '../src/core/bodyweight.js';
import { backupSummary, migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  addWater,
  litres,
  normalizeWaterGoal,
  setWaterGoal,
  waterGoal,
  waterOn,
  waterRatio
} from '../src/core/water.js';

const TODAY = '2026-10-26';

test('pours add up through the day and can be taken back', () => {
  let state = addWater(defaultState(), TODAY, 250);
  state = addWater(state, TODAY, 500);
  assert.equal(waterOn(state, TODAY), 750);
  state = addWater(state, TODAY, -250);
  assert.equal(waterOn(state, TODAY), 500);
  assert.equal(waterOn(state, '2026-10-25'), 0);
});

test('a day never goes below empty or above 15 L; back at 0 it is dropped', () => {
  let state = addWater(defaultState(), TODAY, 250);
  state = addWater(state, TODAY, -1000);
  assert.deepEqual(state.water, {});
  assert.equal(waterOn(addWater(defaultState(), TODAY, 99999), TODAY), 15000);
  const same = defaultState();
  assert.equal(addWater(same, TODAY, 0), same);
  assert.equal(addWater(same, TODAY, NaN), same);
});

test('the goal comes from body weight until one is set', () => {
  assert.deepEqual(waterGoal(defaultState(), TODAY), { ml: 2500, fromWeight: false });
  // 102 kg × 35 ml = 3570 ml → 3.5 L on the 250 ml step.
  const heavy = logWeight(defaultState(), TODAY, 102);
  assert.deepEqual(waterGoal(heavy, TODAY), { ml: 3500, fromWeight: true });
  const set = setWaterGoal(heavy, 3000);
  assert.deepEqual(waterGoal(set, TODAY), { ml: 3000, fromWeight: false });
  assert.deepEqual(waterGoal(setWaterGoal(set, null), TODAY), { ml: 3500, fromWeight: true });
});

test('goals are rounded to 50 ml and kept between 0.5 and 8 L', () => {
  assert.equal(normalizeWaterGoal(3333), 3350);
  assert.equal(normalizeWaterGoal(100), null);
  assert.equal(normalizeWaterGoal(9000), null);
  assert.equal(setWaterGoal(defaultState(), 100).settings.waterGoalMl, null);
});

test('the bottle fills to the goal and stays full past it', () => {
  let state = addWater(defaultState(), TODAY, 1250);
  assert.equal(waterRatio(state, TODAY), 0.5);
  state = addWater(state, TODAY, 2000);
  assert.equal(waterRatio(state, TODAY), 1);
});

test('litres read naturally', () => {
  assert.equal(litres(1250), '1.25 L');
  assert.equal(litres(3000), '3 L');
  assert.equal(litres(750), '0.75 L');
});

test('water survives export and import; junk is dropped; v6 data gets an empty log', () => {
  const state = setWaterGoal(addWater(defaultState(), TODAY, 1500), 3000);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);
  const cleaned = migrate({ schemaVersion: 7, water: { [TODAY]: 750.4, nope: 500, '2026-10-24': -5, '2026-10-23': '500' } });
  assert.deepEqual(cleaned.water, { [TODAY]: 750 });
  assert.deepEqual(migrate({ schemaVersion: 6 }).water, {});
  assert.equal(migrate({ schemaVersion: 6 }).settings.waterGoalMl, null);
  assert.equal(backupSummary(state).sessions, 0);
});
