// Bodyweight log: one weigh-in per day, in kg, keyed by local date. Daily
// weight swings by a kilo or more, so the trend is read from 7-day averages
// rather than single days. Pure module — the caller passes today's date.

import { daysBetween, shiftDateKey } from './dates.js';
import { targetOf } from './nutrition.js';
import { roundWeight } from './schema.js';

export const MIN_KG = 20;
export const MAX_KG = 400;

export function isPlausibleWeight(kg) {
  return Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
}

// Logging again on the same day replaces that day's weigh-in.
export function logWeight(state, dateKey, kg) {
  if (!isPlausibleWeight(kg)) return state;
  return { ...state, bodyweight: { ...state.bodyweight, [dateKey]: roundWeight(kg) } };
}

export function removeWeight(state, dateKey) {
  if (!(dateKey in state.bodyweight)) return state;
  const bodyweight = { ...state.bodyweight };
  delete bodyweight[dateKey];
  return { ...state, bodyweight };
}

export function weighIns(state) {
  return Object.entries(state.bodyweight)
    .map(([dateKey, kg]) => ({ dateKey, kg }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

export function latestWeight(state) {
  return weighIns(state)[0] || null;
}

// Mean of the weigh-ins in the `days` days ending on endKey (inclusive).
export function averageOver(state, endKey, days = 7) {
  const values = weighIns(state)
    .filter(({ dateKey }) => {
      const age = daysBetween(dateKey, endKey);
      return age >= 0 && age < days;
    })
    .map(({ kg }) => kg);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// This week's average minus last week's; null until both weeks have a weigh-in.
export function weeklyChange(state, todayKey) {
  const thisWeek = averageOver(state, todayKey, 7);
  const lastWeek = averageOver(state, shiftDateKey(todayKey, -7), 7);
  if (thisWeek === null || lastWeek === null) return null;
  return Math.round((thisWeek - lastWeek) * 10) / 10;
}

// The protein target per kg of the latest weigh-in, e.g. 2.3.
export function proteinPerKg(state) {
  const latest = latestWeight(state);
  if (!latest) return null;
  return Math.round((targetOf(state) / latest.kg) * 10) / 10;
}
