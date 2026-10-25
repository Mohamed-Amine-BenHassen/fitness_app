import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { setProteinTarget } from '../src/core/nutrition.js';
import { backupSummary, migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  averageOver,
  latestWeight,
  logWeight,
  proteinPerKg,
  removeWeight,
  trendOn,
  trendSeries,
  trendWeeklyChange,
  weeklyChange,
  weighIns
} from '../src/core/bodyweight.js';
import { shiftDateKey } from '../src/core/dates.js';

const TODAY = '2026-10-09';

function withWeights(entries) {
  let state = defaultState();
  for (const [dateKey, kg] of entries) state = logWeight(state, dateKey, kg);
  return state;
}

test('one weigh-in per day; logging again replaces it', () => {
  let state = logWeight(defaultState(), TODAY, 82.4);
  state = logWeight(state, TODAY, 82.1);
  assert.deepEqual(weighIns(state), [{ dateKey: TODAY, kg: 82.1 }]);
});

test('implausible weights are refused', () => {
  const state = defaultState();
  assert.equal(logWeight(state, TODAY, 0), state);
  assert.equal(logWeight(state, TODAY, 19.9), state);
  assert.equal(logWeight(state, TODAY, 401), state);
  assert.equal(logWeight(state, TODAY, NaN), state);
});

test('weigh-ins list newest first and can be removed', () => {
  let state = withWeights([['2026-10-01', 83], [TODAY, 82], ['2026-10-05', 82.5]]);
  assert.deepEqual(weighIns(state).map((w) => w.dateKey), [TODAY, '2026-10-05', '2026-10-01']);
  assert.deepEqual(latestWeight(state), { dateKey: TODAY, kg: 82 });
  state = removeWeight(state, TODAY);
  assert.equal(latestWeight(state).dateKey, '2026-10-05');
  assert.equal(removeWeight(state, '2020-01-01'), state);
  assert.equal(latestWeight(defaultState()), null);
});

test('the 7-day average covers today and the six days before', () => {
  const state = withWeights([['2026-10-09', 82], ['2026-10-03', 83], ['2026-10-02', 99]]);
  assert.equal(averageOver(state, TODAY, 7), 82.5);
  assert.equal(averageOver(defaultState(), TODAY, 7), null);
});

test('weekly change compares this week with last week', () => {
  const state = withWeights([
    ['2026-10-09', 82.0], ['2026-10-06', 82.4], // this week: 82.2
    ['2026-10-01', 82.8], ['2026-09-28', 83.0] // last week: 82.9
  ]);
  assert.equal(weeklyChange(state, TODAY), -0.7);
  assert.equal(weeklyChange(withWeights([[TODAY, 82]]), TODAY), null, 'needs both weeks');
});

test('protein per kg uses the target and the latest weigh-in', () => {
  let state = withWeights([[TODAY, 82.6]]);
  assert.equal(proteinPerKg(state), 2.3);
  state = setProteinTarget(state, 165);
  assert.equal(proteinPerKg(state), 2);
  assert.equal(proteinPerKg(defaultState()), null);
});

test('the trend moves 10% of the way towards each daily weigh-in', () => {
  const state = withWeights([['2026-10-07', 82], ['2026-10-08', 83], ['2026-10-09', 82]]);
  // 82 → 82 + 0.1 × 1 = 82.1 → 82.1 + 0.1 × (82 − 82.1) = 82.09.
  assert.deepEqual(trendSeries(state), [
    { dateKey: '2026-10-07', kg: 82, trendKg: 82 },
    { dateKey: '2026-10-08', kg: 83, trendKg: 82.1 },
    { dateKey: '2026-10-09', kg: 82, trendKg: 82.09 }
  ]);
  assert.deepEqual(trendOn(state, '2026-10-08'), { dateKey: '2026-10-08', kg: 83, trendKg: 82.1 });
  assert.equal(trendOn(defaultState(), TODAY), null);
});

test('a gap of days moves the trend as far as that many daily weigh-ins', () => {
  // Three days later: 1 − 0.9³ = 27.1% of the way from 80 to 90.
  const state = withWeights([['2026-10-06', 80], [TODAY, 90]]);
  assert.equal(trendOn(state, TODAY).trendKg, 82.71);
});

test('a one-off spike barely moves the trend', () => {
  const steady = Array.from({ length: 14 }, (_, i) => [shiftDateKey(TODAY, i - 14), 82]);
  const state = withWeights([...steady, [TODAY, 84]]);
  assert.equal(trendOn(state, TODAY).trendKg, 82.2);
});

test('trend weekly change needs a week of weigh-ins', () => {
  // Losing 0.1 kg a day for four weeks: the trend settles onto −0.7 kg a week.
  const losing = Array.from({ length: 28 }, (_, i) => [shiftDateKey(TODAY, i - 27), 90 - 0.1 * i]);
  const change = trendWeeklyChange(withWeights(losing), TODAY);
  assert.ok(change < -0.6 && change > -0.75, String(change));
  assert.equal(trendWeeklyChange(withWeights([['2026-10-05', 82], [TODAY, 81]]), TODAY), null);
});

test('bodyweight survives export and import; junk is dropped', () => {
  const state = withWeights([[TODAY, 82.4], ['2026-10-02', 83.1]]);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);
  assert.equal(backupSummary(state).weighIns, 2);
  const cleaned = migrate({ schemaVersion: 3, bodyweight: { [TODAY]: 82, 'nope': 80, '2026-10-02': 5, '2026-10-03': '81' } });
  assert.deepEqual(cleaned.bodyweight, { [TODAY]: 82 });
  assert.deepEqual(migrate({ schemaVersion: 2 }).bodyweight, {});
});
