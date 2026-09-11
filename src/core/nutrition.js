// Daily protein tracking. Pure module — the caller supplies the date key and
// timestamp so nothing here reads the clock.

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

export function addEntry(state, dateKey, entry, ts) {
  const grams = Math.round(clampNonNegative(entry?.grams));
  if (grams <= 0) return state;
  const next = {
    label: String(entry?.label || 'Protein').trim() || 'Protein',
    grams,
    ts: Number.isFinite(ts) ? ts : 0
  };
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
