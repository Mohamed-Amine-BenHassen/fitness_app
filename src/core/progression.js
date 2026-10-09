// "What to aim for next time", by double progression over the plan's rep range:
// once every working set reaches the top of the range, add one weight step and
// go back to the bottom. Pure module.

import { lastPerformance } from './sets.js';
import { roundWeight } from './schema.js';

export const DEFAULT_WEIGHT_STEP_KG = 2.5;

export function weightStepOf(state) {
  const step = state.settings.weightStepKg;
  return Number.isFinite(step) && step > 0 ? step : DEFAULT_WEIGHT_STEP_KG;
}

// Accepts 0.25–50 kg; anything else leaves the setting unchanged.
export function setWeightStep(state, kg) {
  const step = roundWeight(Number(kg));
  if (!Number.isFinite(step) || step < 0.25 || step > 50) return state;
  return { ...state, settings: { ...state.settings, weightStepKg: step } };
}

// Returns { weightKg, reps, reason } or null when there is no history yet.
// `current` is the session being logged, so today's sets never count as "last time".
export function suggestNext(state, exercise, current) {
  const last = lastPerformance(state, exercise.id, current);
  if (!last) return null;
  const { min, max } = exercise.repRange;
  const weighted = last.sets.filter((s) => s.weightKg !== null);

  // Bodyweight (or logged without weight): there is no load to add, so reps it is.
  if (exercise.bodyweightOnly || weighted.length === 0) {
    const best = Math.max(...last.sets.map((s) => s.reps));
    return { weightKg: null, reps: best + 1, reason: `Beat your best set: ${best} reps` };
  }

  // Working sets are the ones at the heaviest weight used last time.
  const top = Math.max(...weighted.map((s) => s.weightKg));
  const working = weighted.filter((s) => s.weightKg === top);
  const lowest = Math.min(...working.map((s) => s.reps));

  if (working.length >= exercise.sets && lowest >= max) {
    return {
      weightKg: roundWeight(top + weightStepOf(state)),
      reps: min,
      reason: `You hit ${max} reps on every set — add weight`
    };
  }
  if (lowest < min) {
    return { weightKg: top, reps: min, reason: `Below ${min} reps last time — same weight` };
  }
  return { weightKg: top, reps: Math.min(max, lowest + 1), reason: 'Same weight, one more rep' };
}
