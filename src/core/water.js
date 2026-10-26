// Daily water: one running total in ml per local date, against a goal. Pure
// module — the caller passes today's date.

import { trendOn } from './bodyweight.js';
import { isFiniteNumber } from './schema.js';

export const MAX_DAY_ML = 15000;
export const MIN_GOAL_ML = 500;
export const MAX_GOAL_ML = 8000;
// Common advice for active people: about 35 ml per kg of body weight a day,
// from all drinks. Without a weigh-in the goal falls back to 2.5 L.
export const ML_PER_KG = 35;
export const DEFAULT_GOAL_ML = 2500;
export const POURS = [250, 500, 750];

const toStep = (ml, step = 250) => Math.round(ml / step) * step;

export function waterOn(state, dateKey) {
  return state.water[dateKey] || 0;
}

// Adds (or with a negative amount, takes back) water; the day never goes below
// 0 or above 15 L. A day back at 0 is dropped rather than stored.
export function addWater(state, dateKey, ml) {
  if (!isFiniteNumber(ml) || ml === 0) return state;
  const next = Math.min(MAX_DAY_ML, Math.max(0, waterOn(state, dateKey) + Math.round(ml)));
  const water = { ...state.water };
  if (next === 0) delete water[dateKey];
  else water[dateKey] = next;
  return { ...state, water };
}

export function normalizeWaterGoal(raw) {
  if (!isFiniteNumber(raw)) return null;
  const ml = toStep(raw, 50);
  return ml >= MIN_GOAL_ML && ml <= MAX_GOAL_ML ? ml : null;
}

// A goal in ml, or null to go back to the one from body weight.
export function setWaterGoal(state, ml) {
  return { ...state, settings: { ...state.settings, waterGoalMl: ml === null ? null : normalizeWaterGoal(ml) } };
}

// { ml, fromWeight }: the set goal, else 35 ml per kg of trend weight to the
// nearest 250 ml.
export function waterGoal(state, todayKey) {
  const set = normalizeWaterGoal(state.settings.waterGoalMl);
  if (set !== null) return { ml: set, fromWeight: false };
  const trend = trendOn(state, todayKey);
  if (!trend) return { ml: DEFAULT_GOAL_ML, fromWeight: false };
  const ml = Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, toStep(trend.trendKg * ML_PER_KG)));
  return { ml, fromWeight: true };
}

// 0–1 for the bottle's fill; past the goal it stays full.
export function waterRatio(state, todayKey) {
  return Math.min(1, waterOn(state, todayKey) / waterGoal(state, todayKey).ml);
}

// "1.25 L" — litres with up to two decimals, no trailing zeros.
export function litres(ml) {
  return `${Math.round(ml / 10) / 100} L`;
}
