import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { shiftDateKey } from '../src/core/dates.js';
import { logWeight } from '../src/core/bodyweight.js';
import { logCalories, setGoal } from '../src/core/energy.js';
import { migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  applyCheckIn,
  checkInDue,
  dailyTargets,
  dayCalories,
  macroTargets,
  proposeCheckIn,
  setSplit
} from '../src/core/targets.js';

// 2026-10-25 is a Sunday: the default plan's rest day.
const SUNDAY = '2026-10-25';
const MONDAY = '2026-10-26';

// Four weeks at 2500 kcal and a flat 82 kg, ending on `endKey`: a burn of 2500.
function steady(endKey = SUNDAY) {
  let state = defaultState();
  for (let i = 0; i < 28; i++) {
    const dateKey = shiftDateKey(endKey, i - 27);
    state = logWeight(logCalories(state, dateKey, 2500), dateKey, 82);
  }
  return state;
}

test('macros: protein target, a quarter of calories as fat, carbs fill the rest', () => {
  // 2700 kcal, 190 g protein: fat 2700 × 25% / 9 = 75 g; carbs (2700 − 760 − 675) / 4 ≈ 315 g.
  assert.deepEqual(macroTargets(2700, 190, 102), { kcal: 2700, protein: 190, fat: 75, carbs: 315 });
});

test('macros: fat never drops under 0.6 g/kg, unless protein leaves no room', () => {
  // 1800 kcal at 120 kg: 25% is 50 g, but 0.6 × 120 = 72 g wins.
  assert.equal(macroTargets(1800, 150, 120).fat, 70);
  // 1200 kcal with 190 g protein leaves 440 kcal: fat takes it all, carbs are 0.
  assert.deepEqual(macroTargets(1200, 190, 102), { kcal: 1200, protein: 190, fat: 50, carbs: 0 });
});

test('training-day split keeps the weekly total and puts less on rest days', () => {
  const even = defaultState();
  assert.equal(dayCalories(even, 2700, SUNDAY), 2700);
  const split = setSplit(defaultState(), 'training');
  // One rest day at 85%: 2295; six training days share the rest: (18900 − 2295) / 6 ≈ 2768.
  assert.equal(dayCalories(split, 2700, SUNDAY), 2300);
  assert.equal(dayCalories(split, 2700, MONDAY), 2770);
  assert.equal(setSplit(defaultState(), 'nonsense').settings.calorieSplit, 'even');
});

test('no goal, no targets', () => {
  assert.equal(dailyTargets(steady(), SUNDAY), null);
  assert.equal(checkInDue(steady(), SUNDAY), false);
});

test('with a goal but no check-in yet, the target is provisional and a check-in is due', () => {
  const state = setGoal(steady(), 'cut');
  // Cut at 82 kg: 0.41 kg a week × 7700 / 7 ≈ 451 kcal under a 2500 burn.
  const today = dailyTargets(state, SUNDAY);
  assert.equal(today.kcal, 2050);
  assert.equal(today.provisional, true);
  assert.equal(checkInDue(state, SUNDAY), true);
});

test('a check-in fixes the target until the next one, a week later', () => {
  let state = applyCheckIn(setGoal(steady(), 'cut'), SUNDAY);
  assert.deepEqual(state.checkIns, [{ dateKey: SUNDAY, burnKcal: 2500, trendKg: 82, goal: 'cut', kcal: 2050 }]);
  const today = dailyTargets(state, SUNDAY);
  assert.equal(today.provisional, false);
  assert.deepEqual([today.kcal, today.protein, today.fat, today.carbs], [2050, 190, 55, 200]);
  assert.equal(checkInDue(state, MONDAY), false);
  assert.equal(checkInDue(state, shiftDateKey(SUNDAY, 7)), true);
  // Checking in again the same day replaces, never duplicates.
  state = applyCheckIn(state, SUNDAY);
  assert.equal(state.checkIns.length, 1);
});

test('a check-in moves the target at most 200 kcal for the same goal', () => {
  let state = setGoal(steady(), 'cut');
  state = { ...state, checkIns: [{ dateKey: shiftDateKey(SUNDAY, -7), burnKcal: 2950, trendKg: 82, goal: 'cut', kcal: 2500 }] };
  const proposal = proposeCheckIn(state, SUNDAY);
  assert.equal(proposal.kcal, 2300);
  assert.equal(proposal.capped, true);
});

test('changing goal makes a check-in due at once, starting fresh', () => {
  let state = applyCheckIn(setGoal(steady(), 'cut'), SUNDAY);
  state = setGoal(state, 'bulk');
  assert.equal(checkInDue(state, MONDAY), true);
  // Bulk at 82 kg: 0.205 kg a week × 5000 / 7 ≈ 146 kcal over the burn, uncapped.
  const proposal = proposeCheckIn(state, MONDAY);
  assert.equal(proposal.kcal, 2650);
  assert.equal(proposal.capped, false);
  assert.equal(dailyTargets(state, MONDAY).provisional, true, 'the cut check-in no longer applies');
});

test('on a split, carbs carry the difference between training and rest days', () => {
  const state = applyCheckIn(setSplit(setGoal(steady(), 'maintain'), 'training'), SUNDAY);
  const rest = dailyTargets(state, SUNDAY);
  const training = dailyTargets(state, MONDAY);
  assert.equal(rest.restDay, true);
  assert.equal(rest.kcal, 2130);
  assert.equal(training.kcal, 2560);
  assert.equal(rest.fat, training.fat);
  assert.ok(training.carbs > rest.carbs);
});

test('check-ins and the split survive a backup; junk check-ins are dropped', () => {
  const state = applyCheckIn(setSplit(setGoal(steady(), 'cut'), 'training'), SUNDAY);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);
  const cleaned = migrate({
    schemaVersion: 6,
    checkIns: [{ dateKey: SUNDAY, burnKcal: 2500, trendKg: 82, goal: 'shred', kcal: 2000 }, { dateKey: 'x' }]
  });
  assert.deepEqual(cleaned.checkIns, []);
  assert.equal(migrate({ schemaVersion: 5 }).settings.calorieSplit, 'even');
});
