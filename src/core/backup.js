// JSON backup: build, parse, validate, migrate. Pure module.

import { isDateKey } from './dates.js';
import {
  SCHEMA_VERSION,
  defaultSettings,
  defaultState,
  clampNonNegative,
  normalizeSet
} from './schema.js';

export function backupFilename(dateKey) {
  return `ppl-backup-${dateKey}.json`;
}

export function buildBackup(state, exportedAt) {
  return {
    app: 'ppl-fitness-tracker',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: exportedAt || null,
    settings: state.settings,
    sessions: state.sessions,
    nutrition: state.nutrition
  };
}

export function serializeBackup(state, exportedAt) {
  return JSON.stringify(buildBackup(state, exportedAt), null, 2);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBackup(data) {
  const errors = [];
  if (!isPlainObject(data)) {
    return { ok: false, errors: ['Backup is not a JSON object.'] };
  }
  if (data.app !== undefined && data.app !== 'ppl-fitness-tracker') {
    errors.push(`Backup is from a different app ("${data.app}").`);
  }
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
    errors.push('Missing or invalid schemaVersion.');
  } else if (data.schemaVersion > SCHEMA_VERSION) {
    errors.push(`Backup schema v${data.schemaVersion} is newer than this app (v${SCHEMA_VERSION}).`);
  }
  if (data.sessions !== undefined && !Array.isArray(data.sessions)) {
    errors.push('"sessions" must be an array.');
  }
  if (data.nutrition !== undefined && !isPlainObject(data.nutrition)) {
    errors.push('"nutrition" must be an object keyed by date.');
  }
  if (data.settings !== undefined && !isPlainObject(data.settings)) {
    errors.push('"settings" must be an object.');
  }
  return { ok: errors.length === 0, errors };
}

function normalizeSettings(raw) {
  const fallback = defaultSettings();
  if (!isPlainObject(raw)) return fallback;
  const target = Math.round(clampNonNegative(raw.proteinTargetG));
  const quickAdds = Array.isArray(raw.quickAdds)
    ? raw.quickAdds
        .filter(isPlainObject)
        .map((qa, i) => ({
          id: typeof qa.id === 'string' && qa.id ? qa.id : `qa-${i + 1}`,
          label: String(qa.label || '').trim() || 'Quick add',
          grams: Math.round(clampNonNegative(qa.grams))
        }))
    : fallback.quickAdds;
  return { proteinTargetG: target > 0 ? target : fallback.proteinTargetG, quickAdds };
}

function normalizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => isPlainObject(s) && isDateKey(s.dateKey) && typeof s.dayKey === 'string')
    .map((s) => ({
      dateKey: s.dateKey,
      dayKey: s.dayKey,
      entries: (Array.isArray(s.entries) ? s.entries : [])
        .filter((e) => isPlainObject(e) && typeof e.exerciseId === 'string' && Array.isArray(e.sets))
        .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map(normalizeSet) }))
        .filter((e) => e.sets.length > 0)
    }))
    .filter((s) => s.entries.length > 0)
    .sort((a, b) => (a.dateKey === b.dateKey ? a.dayKey.localeCompare(b.dayKey) : a.dateKey < b.dateKey ? -1 : 1));
}

function normalizeNutrition(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [dateKey, entries] of Object.entries(raw)) {
    if (!isDateKey(dateKey) || !Array.isArray(entries)) continue;
    const clean = entries
      .filter(isPlainObject)
      .map((e) => ({
        label: String(e.label || 'Protein').trim() || 'Protein',
        grams: Math.round(clampNonNegative(e.grams)),
        ts: Number.isFinite(e.ts) ? e.ts : 0
      }))
      .filter((e) => e.grams > 0);
    if (clean.length > 0) out[dateKey] = clean;
  }
  return out;
}

// Coerces any accepted backup (or a stored blob from an older schema) into the
// current state shape. Add a case here whenever SCHEMA_VERSION is bumped.
export function migrate(data) {
  if (!isPlainObject(data)) return defaultState();
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(data.settings),
    sessions: normalizeSessions(data.sessions),
    nutrition: normalizeNutrition(data.nutrition)
  };
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Not valid JSON: ${error.message}`], state: null };
  }
  const { ok, errors } = validateBackup(data);
  if (!ok) return { ok: false, errors, state: null };
  return { ok: true, errors: [], state: migrate(data) };
}

export function backupSummary(state) {
  const sessions = state.sessions;
  const nutritionDays = Object.keys(state.nutrition).length;
  return {
    sessions: sessions.length,
    sets: sessions.reduce((t, s) => t + s.entries.reduce((n, e) => n + e.sets.length, 0), 0),
    firstDate: sessions.length ? sessions[0].dateKey : null,
    lastDate: sessions.length ? sessions[sessions.length - 1].dateKey : null,
    nutritionDays
  };
}
