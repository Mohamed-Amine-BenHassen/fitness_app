// What to eat: the daily calorie and macro targets, from the burn estimate and
// goal (energy.js), held steady by a weekly check-in and optionally shifted
// towards training days. Pure module — the caller passes today's date.
//
// The target only changes at a check-in: once a week (or when the goal
// changes) the app proposes a new one from the current burn and trend weight,
// and it stands until the next. Between check-ins the burn estimate keeps
// updating underneath, so the next proposal starts from fresh numbers.

import { daysBetween, isDateKey, weekdayOf } from './dates.js';
import { trendOn } from './bodyweight.js';
import { calorieTarget, estimateTdee, normalizeGoal } from './energy.js';
import { targetOf } from './nutrition.js';
import { scheduledKey } from './plans.js';
import { REST_DAY_KEY } from './program.js';

export const CHECK_IN_DAYS = 7;
// With the same goal, one check-in moves the target by at most this much, so a
// noisy week can't swing it; a new goal starts from scratch.
export const MAX_CHECK_IN_STEP = 200;

// Fat: at least a quarter of calories, and never under 0.6 g per kg of body
// weight (hormones and fat-soluble vitamins). Carbs take what is left.
const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;

// "More on training days": rest days get 15% less than the daily average and
// training days share the difference, so the week adds up the same.
export const SPLITS = { even: 'Same every day', training: 'More on training days' };
const REST_DAY_CUT = 0.15;

const round5 = (g) => Math.max(0, Math.round(g / 5) * 5);

// { kcal, protein, fat, carbs } in grams for a day's calories. Protein is the
// app's protein target; if protein and the fat floor alone exceed the calories,
// fat gives way first and carbs are 0.
export function macroTargets(kcal, proteinG, kg) {
  const fatFloor = Math.max((FAT_SHARE * kcal) / 9, MIN_FAT_PER_KG * kg);
  const fat = Math.min(fatFloor, Math.max(0, (kcal - 4 * proteinG) / 9));
  const carbs = (kcal - 4 * proteinG - 9 * fat) / 4;
  return { kcal, protein: proteinG, fat: round5(fat), carbs: round5(carbs) };
}

export function normalizeSplit(raw) {
  return Object.hasOwn(SPLITS, raw ?? '') ? raw : 'even';
}

export function setSplit(state, split) {
  return { ...state, settings: { ...state.settings, calorieSplit: normalizeSplit(split) } };
}

function restDayCount(state) {
  return [0, 1, 2, 3, 4, 5, 6].filter((weekday) => scheduledKey(state, weekday) === REST_DAY_KEY).length;
}

// The calories for one day of the week, given the week's daily average.
export function dayCalories(state, averageKcal, dateKey) {
  const rest = restDayCount(state);
  if (normalizeSplit(state.settings.calorieSplit) === 'even' || rest === 0 || rest === 7) return averageKcal;
  const restKcal = averageKcal * (1 - REST_DAY_CUT);
  if (scheduledKey(state, weekdayOf(dateKey)) === REST_DAY_KEY) return Math.round(restKcal / 10) * 10;
  return Math.round((7 * averageKcal - rest * restKcal) / (7 - rest) / 10) * 10;
}

// ---------- check-ins ----------

// { dateKey, burnKcal, trendKg, goal, kcal } or null; kcal is the daily average.
export function normalizeCheckIn(raw) {
  const goal = normalizeGoal(raw?.goal);
  const kcal = Math.round(Number(raw?.kcal));
  const burnKcal = Math.round(Number(raw?.burnKcal));
  const trendKg = Math.round(Number(raw?.trendKg) * 100) / 100;
  if (!isDateKey(raw?.dateKey) || !goal || !(kcal > 0 && kcal <= 15000) || !(burnKcal > 0) || !(trendKg > 0)) return null;
  return { dateKey: raw.dateKey, burnKcal, trendKg, goal, kcal };
}

export function lastCheckIn(state, todayKey) {
  return state.checkIns.filter((c) => c.dateKey <= todayKey).at(-1) || null;
}

// The check-in the app would make today: { burnKcal, trendKg, goal, kcal,
// previous, capped }, or null without a goal, a burn estimate and a weigh-in.
export function proposeCheckIn(state, todayKey) {
  const goal = normalizeGoal(state.settings.goal);
  const estimate = estimateTdee(state, todayKey);
  const trend = trendOn(state, todayKey);
  if (!goal || !trend || (estimate.status !== 'ready' && estimate.status !== 'formula')) return null;
  const wanted = calorieTarget(estimate.kcal, goal, trend.trendKg).kcal;
  const previous = lastCheckIn(state, todayKey);
  const sameGoal = previous && previous.goal === goal;
  const kcal = sameGoal
    ? Math.min(previous.kcal + MAX_CHECK_IN_STEP, Math.max(previous.kcal - MAX_CHECK_IN_STEP, wanted))
    : wanted;
  return { burnKcal: estimate.kcal, trendKg: trend.trendKg, goal, kcal, previous, capped: kcal !== wanted };
}

// A check-in is due with a goal set and none yet, a week after the last, or
// as soon as the goal changes.
export function checkInDue(state, todayKey) {
  if (!proposeCheckIn(state, todayKey)) return false;
  const last = lastCheckIn(state, todayKey);
  if (!last) return true;
  return last.goal !== normalizeGoal(state.settings.goal) || daysBetween(last.dateKey, todayKey) >= CHECK_IN_DAYS;
}

// Records today's proposal; a second check-in the same day replaces the first.
export function applyCheckIn(state, todayKey) {
  const proposal = proposeCheckIn(state, todayKey);
  if (!proposal) return state;
  const { burnKcal, trendKg, goal, kcal } = proposal;
  const checkIns = [...state.checkIns.filter((c) => c.dateKey !== todayKey), { dateKey: todayKey, burnKcal, trendKg, goal, kcal }];
  checkIns.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  return { ...state, checkIns };
}

// ---------- today ----------

// Today's targets: { kcal, protein, fat, carbs, averageKcal, restDay, checkIn,
// provisional } or null without a goal. `provisional` means there is no
// check-in for the current goal yet, so the target follows the live estimate.
export function dailyTargets(state, todayKey) {
  const goal = normalizeGoal(state.settings.goal);
  if (!goal) return null;
  const last = lastCheckIn(state, todayKey);
  const checkIn = last && last.goal === goal ? last : null;
  let averageKcal;
  let kg;
  if (checkIn) {
    averageKcal = checkIn.kcal;
    kg = checkIn.trendKg;
  } else {
    const proposal = proposeCheckIn(state, todayKey);
    if (!proposal) return null;
    averageKcal = proposal.kcal;
    kg = proposal.trendKg;
  }
  const kcal = dayCalories(state, averageKcal, todayKey);
  const restDay = scheduledKey(state, weekdayOf(todayKey)) === REST_DAY_KEY;
  // Fat comes from the week's average so it stays put; carbs absorb the split.
  const weekly = macroTargets(averageKcal, targetOf(state), kg);
  const carbs = round5((kcal - 4 * weekly.protein - 9 * weekly.fat) / 4);
  return { kcal, protein: weekly.protein, fat: weekly.fat, carbs, averageKcal, restDay, checkIn, provisional: !checkIn };
}
