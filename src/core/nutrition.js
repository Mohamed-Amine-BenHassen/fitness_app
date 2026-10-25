// Daily food log: protein against its target, plus calories, fat and carbs when
// known. Pure module — the caller supplies the date key and timestamp so
// nothing here reads the clock.
//
// An entry is { label, grams, ts } with `grams` the protein in grams (its name
// predates the other macros), plus `kcal`, `fatG` and `carbsG` when known.
// Quick adds and older entries carry protein only.

import { clampNonNegative } from './schema.js';

export function entriesFor(state, dateKey) {
  return state.nutrition[dateKey] || [];
}

export function dayTotal(state, dateKey) {
  return entriesFor(state, dateKey).reduce((sum, entry) => sum + entry.grams, 0);
}

export function targetOf(state) {
  return clampNonNegative(state.settings.proteinTargetG) || 190;
}

export function remaining(state, dateKey) {
  return Math.max(0, targetOf(state) - dayTotal(state, dateKey));
}

export function progressRatio(state, dateKey) {
  const target = targetOf(state);
  return target === 0 ? 0 : Math.min(1, dayTotal(state, dateKey) / target);
}

const MAX_ENTRY_KCAL = 10000;
const MAX_ENTRY_GRAMS = 2000;

const optionalAmount = (value, max) =>
  Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value) : null;

// A clean entry, or null when it has neither protein nor calories.
export function normalizeEntry(raw, ts) {
  const grams = Math.round(clampNonNegative(raw?.grams));
  const kcal = optionalAmount(raw?.kcal, MAX_ENTRY_KCAL);
  if (grams <= 0 && !kcal) return null;
  const entry = {
    label: String(raw?.label || 'Protein').trim() || 'Protein',
    grams,
    ts: Number.isFinite(ts) ? ts : 0
  };
  if (kcal === null) return entry;
  return {
    ...entry,
    kcal,
    fatG: optionalAmount(raw?.fatG, MAX_ENTRY_GRAMS) ?? 0,
    carbsG: optionalAmount(raw?.carbsG, MAX_ENTRY_GRAMS) ?? 0
  };
}

// The day's { protein, kcal, fat, carbs }. kcal, fat and carbs are null when no
// entry that day has calories (a protein-only day), so "nothing known" is never
// mistaken for "ate nothing".
export function dayMacros(state, dateKey) {
  const entries = entriesFor(state, dateKey);
  const withKcal = entries.filter((e) => Number.isFinite(e.kcal));
  const sum = (key) => withKcal.reduce((total, e) => total + (e[key] || 0), 0);
  return {
    protein: dayTotal(state, dateKey),
    kcal: withKcal.length ? sum('kcal') : null,
    fat: withKcal.length ? sum('fatG') : null,
    carbs: withKcal.length ? sum('carbsG') : null
  };
}

export function addEntry(state, dateKey, entry, ts) {
  const next = normalizeEntry(entry, ts);
  if (!next) return state;
  return {
    ...state,
    nutrition: { ...state.nutrition, [dateKey]: [...entriesFor(state, dateKey), next] }
  };
}

export function removeEntry(state, dateKey, index) {
  const entries = entriesFor(state, dateKey);
  if (index < 0 || index >= entries.length) return state;
  const remainingEntries = entries.filter((_, i) => i !== index);
  const nutrition = { ...state.nutrition };
  if (remainingEntries.length === 0) delete nutrition[dateKey];
  else nutrition[dateKey] = remainingEntries;
  return { ...state, nutrition };
}

export function nextQuickAddId(quickAdds) {
  const highest = quickAdds.reduce((max, qa) => {
    const n = Number(String(qa.id).replace(/^qa-/, ''));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `qa-${highest + 1}`;
}

export function upsertQuickAdd(state, quickAdd) {
  const quickAdds = state.settings.quickAdds;
  const clean = {
    id: quickAdd.id || nextQuickAddId(quickAdds),
    label: String(quickAdd.label || '').trim() || 'Quick add',
    grams: Math.round(clampNonNegative(quickAdd.grams))
  };
  const exists = quickAdds.some((qa) => qa.id === clean.id);
  const nextQuickAdds = exists
    ? quickAdds.map((qa) => (qa.id === clean.id ? clean : qa))
    : [...quickAdds, clean];
  return { ...state, settings: { ...state.settings, quickAdds: nextQuickAdds } };
}

export function removeQuickAdd(state, id) {
  return {
    ...state,
    settings: { ...state.settings, quickAdds: state.settings.quickAdds.filter((qa) => qa.id !== id) }
  };
}

export function setProteinTarget(state, grams) {
  const target = Math.round(clampNonNegative(grams));
  if (target <= 0) return state;
  return { ...state, settings: { ...state.settings, proteinTargetG: target } };
}
