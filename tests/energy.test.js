import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { shiftDateKey } from '../src/core/dates.js';
import { logWeight } from '../src/core/bodyweight.js';
import { backupSummary, migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  caloriesOn,
  energyOfChange,
  calorieTarget,
  estimateTdee,
  formulaTdee,
  logCalories,
  normalizeProfile,
  removeCalories,
  setGoal,
  setProfile
} from '../src/core/energy.js';

const PROFILE = { sex: 'male', heightCm: 190, birthYear: 2004, activity: 'high' };

const TODAY = '2026-10-09';

// `days` days ending today: intake from kcalFor(i), a weigh-in every `weighEvery`
// days on a straight line that changes by kgPerWeek.
function history(days, { kcalFor = () => 2500, startKg = 82, kgPerWeek = 0, weighEvery = 1 } = {}) {
  let state = defaultState();
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDateKey(TODAY, i - days + 1);
    const kcal = kcalFor(i);
    if (kcal !== null) state = logCalories(state, dateKey, kcal);
    if (i % weighEvery === 0 || i === days - 1) state = logWeight(state, dateKey, startKg + (kgPerWeek / 7) * i);
  }
  return state;
}

test('one calorie total per day; logging again replaces it', () => {
  let state = logCalories(defaultState(), TODAY, 2300);
  state = logCalories(state, TODAY, 2450.4);
  assert.equal(caloriesOn(state, TODAY), 2450);
  assert.equal(caloriesOn(state, '2026-10-08'), null);
  state = removeCalories(state, TODAY);
  assert.equal(caloriesOn(state, TODAY), null);
  assert.equal(removeCalories(state, TODAY), state);
});

test('a fasting day of 0 kcal counts; impossible totals are refused', () => {
  const state = defaultState();
  assert.equal(caloriesOn(logCalories(state, TODAY, 0), TODAY), 0);
  assert.equal(logCalories(state, TODAY, -1), state);
  assert.equal(logCalories(state, TODAY, 15001), state);
  assert.equal(logCalories(state, TODAY, NaN), state);
});

test('weight change is converted asymmetrically: loss as fat, gain for less', () => {
  assert.equal(energyOfChange(-0.1), -770);
  assert.equal(energyOfChange(0.1), 500);
  assert.equal(energyOfChange(0), 0);
});

test('collecting until two weeks with 10 calorie days and 3 spread weigh-ins', () => {
  assert.deepEqual(estimateTdee(defaultState(), TODAY), { status: 'collecting', intakeDays: 0, weighIns: 0, days: 0 });
  assert.equal(estimateTdee(history(13), TODAY).status, 'collecting', 'only 13 days');
  assert.equal(estimateTdee(history(14, { kcalFor: (i) => (i < 9 ? 2500 : null) }), TODAY).status, 'collecting', '9 calorie days');
  const progress = estimateTdee(history(10, { weighEvery: 5 }), TODAY);
  assert.deepEqual(progress, { status: 'collecting', intakeDays: 10, weighIns: 3, days: 10 });
  assert.equal(estimateTdee(history(14), TODAY).status, 'ready');
});

test('steady weight means expenditure equals intake', () => {
  const estimate = estimateTdee(history(28), TODAY);
  assert.equal(estimate.status, 'ready');
  assert.equal(estimate.kcal, 2500);
  assert.equal(estimate.weeklyChangeKg, 0);
  assert.equal(estimate.intakeDays, 28);
  assert.equal(estimate.asOf, TODAY);
});

test('losing 0.5 kg a week on 2000 kcal means burning about 2550', () => {
  // 0.5 kg / 7 days × 7700 kcal/kg = 550 kcal a day from body stores.
  const estimate = estimateTdee(history(28, { kcalFor: () => 2000, kgPerWeek: -0.5 }), TODAY);
  assert.equal(estimate.kcal, 2550);
  assert.equal(estimate.weeklyChangeKg, -0.5);
});

test('gaining 0.25 kg a week on 3000 kcal means burning about 2820', () => {
  // 0.25 kg / 7 days × 5000 kcal/kg ≈ 179 kcal a day into body mass.
  const estimate = estimateTdee(history(28, { kcalFor: () => 3000, kgPerWeek: 0.25 }), TODAY);
  assert.equal(estimate.kcal, 2820);
});

test('only the last four weeks count', () => {
  // Eight weeks: 3000 kcal in the first four, 2500 in the last four, weight flat.
  const estimate = estimateTdee(history(56, { kcalFor: (i) => (i < 28 ? 3000 : 2500) }), TODAY);
  assert.equal(estimate.kcal, 2500);
  assert.equal(estimate.intakeDays, 28);
});

test('calories logged after the last weigh-in wait for the next one', () => {
  let state = history(28);
  const before = estimateTdee(state, TODAY);
  state = logCalories(state, shiftDateKey(TODAY, 1), 6000);
  const after = estimateTdee(state, shiftDateKey(TODAY, 1));
  assert.equal(after.kcal, before.kcal);
  assert.equal(after.asOf, TODAY);
});

test('the range is exact for perfect data and widens with noise', () => {
  const perfect = estimateTdee(history(28), TODAY);
  assert.equal(perfect.low, perfect.kcal);
  assert.equal(perfect.high, perfect.kcal);
  const noisy = estimateTdee(history(28, { kcalFor: (i) => 2500 + (i % 2 ? 400 : -400) }), TODAY);
  assert.ok(noisy.low < noisy.kcal && noisy.kcal < noisy.high);
});

test('the formula is Mifflin-St Jeor times the activity factor', () => {
  // Male, 190 cm, 102 kg, 22: 10·102 + 6.25·190 − 5·22 + 5 = 2102.5 resting.
  assert.equal(formulaTdee(PROFILE, 102, TODAY), 2102.5 * 1.725);
  assert.equal(formulaTdee({ ...PROFILE, sex: 'female', activity: 'light' }, 102, TODAY), 1936.5 * 1.375);
});

test('a profile needs every part, within plausible bounds', () => {
  assert.deepEqual(normalizeProfile({ ...PROFILE, heightCm: '190.4' }), PROFILE);
  assert.equal(normalizeProfile({ ...PROFILE, sex: 'x' }), null);
  assert.equal(normalizeProfile({ ...PROFILE, heightCm: 90 }), null);
  assert.equal(normalizeProfile({ ...PROFILE, birthYear: 1800 }), null);
  assert.equal(normalizeProfile({ ...PROFILE, activity: 'toString' }), null);
  assert.equal(normalizeProfile(undefined), null);
  const state = defaultState();
  assert.equal(setProfile(state, { sex: 'male' }), state);
});

test('with a profile, the formula gives an estimate from the first weigh-in', () => {
  const state = setProfile(logWeight(defaultState(), TODAY, 102), PROFILE);
  const estimate = estimateTdee(state, TODAY);
  assert.equal(estimate.status, 'formula');
  assert.equal(estimate.kcal, 3630);
  assert.equal(estimate.low, 3180);
  assert.equal(estimate.high, 4070);
  assert.equal(estimate.intakeDays, 0, 'still reports collecting progress');
  assert.equal(estimateTdee(setProfile(defaultState(), PROFILE), TODAY).status, 'collecting', 'needs a weight');
});

test('measured data takes over from the formula as it firms up', () => {
  const noisy = (i) => 2600 + (i % 2 ? 500 : -500);
  const twoWeeks = estimateTdee(setProfile(history(14, { kcalFor: noisy }), PROFILE), TODAY);
  const fourWeeks = estimateTdee(setProfile(history(28, { kcalFor: noisy }), PROFILE), TODAY);
  assert.equal(twoWeeks.status, 'ready');
  assert.ok(twoWeeks.formulaShare > fourWeeks.formulaShare && fourWeeks.formulaShare > 0);
  assert.ok(twoWeeks.kcal > fourWeeks.kcal && fourWeeks.kcal > 2600, 'pulled towards the higher formula, less over time');
  const perfect = estimateTdee(setProfile(history(28), PROFILE), TODAY);
  assert.equal(perfect.formulaShare, 0);
  assert.equal(perfect.kcal, 2500);
});

test('cut: 0.5% of body weight a week below the burn', () => {
  // 102 kg × 0.5% = 0.51 kg/week → 0.51 × 7700 / 7 = 561 kcal a day.
  assert.deepEqual(calorieTarget(3300, 'cut', 102), { kcal: 2740, delta: -560, weeklyChangeKg: -0.51 });
});

test('bulk: 0.25% of body weight a week above the burn', () => {
  // 102 kg × 0.25% = 0.255 kg/week → 0.255 × 5000 / 7 = 182 kcal a day.
  assert.deepEqual(calorieTarget(3300, 'bulk', 102), { kcal: 3480, delta: 180, weeklyChangeKg: 0.26 });
});

test('maintain eats the burn', () => {
  assert.deepEqual(calorieTarget(3300, 'maintain', 102), { kcal: 3300, delta: 0, weeklyChangeKg: 0 });
});

test('a cut never goes more than 25% below the burn, a bulk not 15% above', () => {
  // 150 kg wants 825 kcal/day off, but 25% of a 2000 burn is 500.
  assert.equal(calorieTarget(2000, 'cut', 150).delta, -500);
  assert.equal(calorieTarget(1000, 'bulk', 150).delta, 150);
});

test('the goal is a setting; unknown goals are refused', () => {
  const state = setGoal(defaultState(), 'cut');
  assert.equal(state.settings.goal, 'cut');
  assert.equal(setGoal(state, 'shred'), state);
  assert.equal(defaultState().settings.goal, null);
});

test('the profile and goal survive export and import', () => {
  const state = setGoal(setProfile(defaultState(), PROFILE), 'bulk');
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);
  assert.equal(migrate({ schemaVersion: 4 }).settings.profile, null);
});

test('calories survive export and import; junk is dropped; v4 data gets an empty log', () => {
  const state = logCalories(logCalories(defaultState(), TODAY, 2300), '2026-10-08', 0);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);
  assert.equal(backupSummary(state).calorieDays, 2);
  const cleaned = migrate({ schemaVersion: 5, calories: { [TODAY]: 2300.6, nope: 2000, '2026-10-02': -5, '2026-10-03': '2000' } });
  assert.deepEqual(cleaned.calories, { [TODAY]: 2301 });
  assert.deepEqual(migrate({ schemaVersion: 4 }).calories, {});
  assert.equal(parseBackup(JSON.stringify({ schemaVersion: 5, calories: [] })).ok, false);
});
