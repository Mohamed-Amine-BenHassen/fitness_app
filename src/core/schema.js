// State shape, defaults and normalisation. Pure module.

import { SEED_PLAN_ID, seedLibrary, seedPlan } from './program.js';

// v2 added the exercise library and editable plans (`library`, `plans`,
// `settings.activePlanId`). backup.js#migrate upgrades v1 data.
export const SCHEMA_VERSION = 2;

// plan.md leaves the quick-add gram values blank; they are edited in-app.
export function defaultSettings() {
  return {
    proteinTargetG: 190,
    quickAdds: [
      { id: 'qa-1', label: 'Isoclear shake', grams: 0 },
      { id: 'qa-2', label: 'Quick add 2', grams: 0 },
      { id: 'qa-3', label: 'Quick add 3', grams: 0 }
    ],
    activePlanId: SEED_PLAN_ID
  };
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    library: seedLibrary(),
    plans: [seedPlan()],
    sessions: [],
    nutrition: {}
  };
}

export function sessionId(dateKey, dayKey) {
  return `${dateKey}#${dayKey}`;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clampNonNegative(value) {
  return isFiniteNumber(value) && value > 0 ? value : 0;
}

// Rounds to 2dp so 2.5 kg jumps never accumulate float dust through export/import.
export function roundWeight(value) {
  return Math.round(value * 100) / 100;
}

export function normalizeSet(raw) {
  const weight = isFiniteNumber(raw?.weightKg) && raw.weightKg > 0 ? roundWeight(raw.weightKg) : null;
  const reps = Math.max(0, Math.round(clampNonNegative(raw?.reps)));
  return { weightKg: weight, reps };
}

const MAX_SETS = 20;
const MAX_REPS = 100;
const MAX_REST_SEC = 600;

function clampInt(value, min, max, fallback) {
  if (!isFiniteNumber(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// One exercise in a plan session. A max below the min is raised to the min, so
// a half-typed range never produces "8-6".
export function normalizeSlot(raw) {
  const min = clampInt(raw?.repRange?.min, 1, MAX_REPS, 8);
  const max = clampInt(raw?.repRange?.max, 1, MAX_REPS, 12);
  return {
    exerciseId: String(raw?.exerciseId || ''),
    sets: clampInt(raw?.sets, 1, MAX_SETS, 3),
    repRange: { min, max: Math.max(min, max) },
    restSec: clampInt(raw?.restSec, 0, MAX_REST_SEC, 90),
    note: String(raw?.note || '').trim(),
    anchor: Boolean(raw?.anchor)
  };
}

export function normalizeExercise(raw, id = raw?.id) {
  return {
    id: String(id),
    name: String(raw?.name || '').trim() || 'Exercise',
    bodyweightOnly: Boolean(raw?.bodyweightOnly),
    perSide: Boolean(raw?.perSide),
    technique: String(raw?.technique || '').trim(),
    archived: Boolean(raw?.archived)
  };
}
