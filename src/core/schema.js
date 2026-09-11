// State shape, defaults and normalisation. Pure module.

export const SCHEMA_VERSION = 1;

// plan.md leaves the quick-add gram values blank; they are edited in-app.
export function defaultSettings() {
  return {
    proteinTargetG: 190,
    quickAdds: [
      { id: 'qa-1', label: 'Isoclear shake', grams: 0 },
      { id: 'qa-2', label: 'Quick add 2', grams: 0 },
      { id: 'qa-3', label: 'Quick add 3', grams: 0 }
    ]
  };
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
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
