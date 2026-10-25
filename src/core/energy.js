// Daily calorie log and the energy-expenditure (TDEE) estimate it feeds. Pure
// module — the caller passes today's date.
//
// The estimate is energy balance run backwards: what you burn is what you ate
// minus what went into (or came out of) body mass. Over the last four weeks,
// average intake is taken from the logged days, and weight change from a
// least-squares line through the weigh-ins — no single day's water swing can
// move it much. How well that line and that average are pinned down gives the
// range shown around the estimate.

import { daysBetween, shiftDateKey } from './dates.js';
import { weighIns } from './bodyweight.js';

export const MAX_KCAL = 15000;

// A logged 0 is a real fasting day; an unlogged day is simply absent.
export function isPlausibleCalories(kcal) {
  return Number.isFinite(kcal) && kcal >= 0 && kcal <= MAX_KCAL;
}

export function logCalories(state, dateKey, kcal) {
  if (!isPlausibleCalories(kcal)) return state;
  return { ...state, calories: { ...state.calories, [dateKey]: Math.round(kcal) } };
}

export function removeCalories(state, dateKey) {
  if (!(dateKey in state.calories)) return state;
  const calories = { ...state.calories };
  delete calories[dateKey];
  return { ...state, calories };
}

export function caloriesOn(state, dateKey) {
  return dateKey in state.calories ? state.calories[dateKey] : null;
}

// Lost weight is mostly fat (~7700 kcal/kg). Weight gained while eating in a
// surplus is partly lean tissue, glycogen and the water stored with it, which
// hold far less energy per kg, so gains count for less.
export const KCAL_PER_KG_LOSS = 7700;
export const KCAL_PER_KG_GAIN = 5000;

// Four weeks is long enough for water swings to average out and short enough
// to follow a real change in activity. Below that, the estimate waits for two
// weeks with 10+ days of calories and 3+ weigh-ins spread over a week.
export const WINDOW_DAYS = 28;
export const MIN_DAYS = 14;
export const MIN_INTAKE_DAYS = 10;
export const MIN_WEIGH_INS = 3;
const MIN_WEIGH_IN_SPAN = 7;

// The range is about an 80% interval: estimate ± 1.28 standard errors.
const RANGE_Z = 1.28;

// Before there is data — and while there is little — a formula gives the
// starting point: Mifflin-St Jeor resting burn times an activity factor.
// For one person it is typically within ~350 kcal; that spread is how much it
// is trusted when blended with what the log measures.
export const ACTIVITY_LEVELS = {
  light: { factor: 1.375, label: 'Light — training 1–3 days a week' },
  moderate: { factor: 1.55, label: 'Moderate — training 3–5 days a week' },
  high: { factor: 1.725, label: 'High — training 6–7 days a week' },
  very: { factor: 1.9, label: 'Very high — hard daily training plus a physical job' }
};
const FORMULA_ERROR_KCAL = 350;

const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 230;
const MIN_BIRTH_YEAR = 1920;

// { sex, heightCm, birthYear, activity } or null if any part is missing or implausible.
export function normalizeProfile(raw) {
  const sex = raw?.sex === 'male' || raw?.sex === 'female' ? raw.sex : null;
  const heightCm = Math.round(Number(raw?.heightCm));
  const birthYear = Math.round(Number(raw?.birthYear));
  const activity = Object.hasOwn(ACTIVITY_LEVELS, raw?.activity ?? '') ? raw.activity : null;
  const plausible =
    heightCm >= MIN_HEIGHT_CM && heightCm <= MAX_HEIGHT_CM && birthYear >= MIN_BIRTH_YEAR && birthYear <= new Date().getFullYear();
  if (!sex || !activity || !plausible) return null;
  return { sex, heightCm, birthYear, activity };
}

export function setProfile(state, raw) {
  const profile = normalizeProfile(raw);
  if (!profile) return state;
  return { ...state, settings: { ...state.settings, profile } };
}

// Goals set a weekly rate of weight change as a share of body weight, so the
// same goal scales to the person: a cut loses ~0.5% a week (fast enough to see,
// slow enough to keep strength and muscle), a lean bulk gains ~0.25% a week
// (more mostly adds fat). The daily target is the burn plus the energy of that
// change, capped so a cut never goes beyond a quarter below the burn and a
// bulk never beyond 15% above it.
export const GOALS = {
  cut: { label: 'Cut', weeklyPct: -0.5, maxShare: 0.25 },
  maintain: { label: 'Maintain', weeklyPct: 0, maxShare: 0 },
  bulk: { label: 'Bulk', weeklyPct: 0.25, maxShare: 0.15 }
};

export function normalizeGoal(raw) {
  return Object.hasOwn(GOALS, raw ?? '') ? raw : null;
}

export function setGoal(state, goal) {
  const clean = normalizeGoal(goal);
  if (!clean) return state;
  return { ...state, settings: { ...state.settings, goal: clean } };
}

// { kcal, delta, weeklyChangeKg }: the daily calories for `goal` given a burn
// estimate and body weight, how far that is from the burn, and the weekly
// change it should produce.
export function calorieTarget(burnKcal, goal, kg) {
  const { weeklyPct, maxShare } = GOALS[goal];
  const wanted = energyOfChange((kg * weeklyPct) / 100 / 7);
  const delta = Math.max(-maxShare * burnKcal, Math.min(maxShare * burnKcal, wanted));
  const density = delta < 0 ? KCAL_PER_KG_LOSS : KCAL_PER_KG_GAIN;
  return {
    kcal: round10(burnKcal + delta),
    delta: round10(delta),
    weeklyChangeKg: Math.round(((delta * 7) / density) * 100) / 100
  };
}

// Age is taken from the year alone, so it can be a year high before a birthday.
export function formulaTdee(profile, kg, todayKey) {
  const age = Number(todayKey.slice(0, 4)) - profile.birthYear;
  const resting = 10 * kg + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  return resting * ACTIVITY_LEVELS[profile.activity].factor;
}

export function energyOfChange(kgPerDay) {
  return kgPerDay * (kgPerDay < 0 ? KCAL_PER_KG_LOSS : KCAL_PER_KG_GAIN);
}

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Least-squares weight change (kg/day) through the weigh-ins, with its standard error.
function fitSlope(points) {
  const xs = points.map((p) => daysBetween(points[0].dateKey, p.dateKey));
  const meanX = mean(xs);
  const meanY = mean(points.map((p) => p.kg));
  const sxx = xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  const slope = points.reduce((a, p, i) => a + (xs[i] - meanX) * (p.kg - meanY), 0) / sxx;
  const residuals = points.map((p, i) => p.kg - (meanY + slope * (xs[i] - meanX)));
  const variance = residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, points.length - 2);
  return { slope, error: Math.sqrt(variance / sxx) };
}

function standardError(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1) / values.length);
}

const round10 = (kcal) => Math.round(kcal / 10) * 10;

// What the log measures: { status: 'collecting', intakeDays, weighIns, days }
// while there is too little data (counts over the window, `days` since the
// first weigh-in in it); then { status: 'ready', kcal, low, high, intakeDays,
// weighIns, weeklyChangeKg, asOf, error }. The window ends at the last weigh-in,
// not today: calories logged after it wait for the next weigh-in, since until
// then their effect on weight is unknown.
function measureTdee(state, todayKey) {
  const all = weighIns(state).filter((w) => w.dateKey <= todayKey);
  const endKey = all.length ? all[0].dateKey : todayKey;
  const startKey = shiftDateKey(endKey, -(WINDOW_DAYS - 1));
  const inWindow = (dateKey) => dateKey >= startKey && dateKey <= endKey;

  const weights = all.filter((w) => inWindow(w.dateKey)).reverse();
  const intake = Object.keys(state.calories).filter(inWindow).map((k) => state.calories[k]);
  const days = weights.length ? daysBetween(weights[0].dateKey, endKey) + 1 : 0;
  const span = weights.length ? daysBetween(weights[0].dateKey, weights[weights.length - 1].dateKey) : 0;

  const enough =
    days >= MIN_DAYS && intake.length >= MIN_INTAKE_DAYS && weights.length >= MIN_WEIGH_INS && span >= MIN_WEIGH_IN_SPAN;
  if (!enough) return { status: 'collecting', intakeDays: intake.length, weighIns: weights.length, days };

  const { slope, error } = fitSlope(weights);
  const density = slope < 0 ? KCAL_PER_KG_LOSS : KCAL_PER_KG_GAIN;
  const kcal = mean(intake) - energyOfChange(slope);
  const spread = RANGE_Z * Math.hypot(standardError(intake), density * error);
  return {
    status: 'ready',
    kcal: round10(kcal),
    low: round10(kcal - spread),
    high: round10(kcal + spread),
    intakeDays: intake.length,
    weighIns: weights.length,
    weeklyChangeKg: Math.round(slope * 7 * 100) / 100,
    asOf: endKey,
    exact: kcal,
    error: spread / RANGE_Z
  };
}

// The measured estimate, blended with the formula when a profile is set: each
// is weighted by how sure it is, so the formula carries the first weeks and
// fades as the log builds up. `formulaShare` is the formula's weight (0–1).
// Without enough data the formula alone gives status 'formula'; without a
// profile either, the result is the measured 'collecting' progress.
export function estimateTdee(state, todayKey) {
  const measured = measureTdee(state, todayKey);
  const { exact, error, ...shown } = measured;
  const profile = normalizeProfile(state.settings.profile);
  const latest = weighIns(state).find((w) => w.dateKey <= todayKey);
  if (!profile || !latest) return measured.status === 'ready' ? { ...shown, formulaShare: 0 } : measured;

  const formula = formulaTdee(profile, latest.kg, todayKey);
  if (measured.status !== 'ready') {
    const spread = RANGE_Z * FORMULA_ERROR_KCAL;
    return {
      ...measured,
      status: 'formula',
      kcal: round10(formula),
      low: round10(formula - spread),
      high: round10(formula + spread)
    };
  }

  const formulaShare = error === 0 ? 0 : error ** 2 / (error ** 2 + FORMULA_ERROR_KCAL ** 2);
  const kcal = formulaShare * formula + (1 - formulaShare) * exact;
  const spread = RANGE_Z * Math.sqrt(formulaShare) * FORMULA_ERROR_KCAL;
  return {
    ...shown,
    kcal: round10(kcal),
    low: round10(kcal - spread),
    high: round10(kcal + spread),
    formulaShare: Math.round(formulaShare * 100) / 100
  };
}
