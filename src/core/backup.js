// JSON backup: build, parse, validate, migrate. Pure module.

import { isDateKey } from './dates.js';
import { REST_DAY_KEY, seedLibrary, seedPlan } from './program.js';
import { FOODS, normalizeCustomFood } from './foods.js';
import { isPlausibleWeight } from './bodyweight.js';
import {
  SCHEMA_VERSION,
  defaultSettings,
  defaultState,
  clampNonNegative,
  normalizeExercise,
  normalizeSet,
  normalizeSlot,
  roundWeight
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
    library: state.library,
    plans: state.plans,
    sessions: state.sessions,
    nutrition: state.nutrition,
    bodyweight: state.bodyweight
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
  if (data.library !== undefined && !isPlainObject(data.library)) {
    errors.push('"library" must be an object keyed by exercise id.');
  }
  if (data.plans !== undefined && !Array.isArray(data.plans)) {
    errors.push('"plans" must be an array.');
  }
  if (data.bodyweight !== undefined && !isPlainObject(data.bodyweight)) {
    errors.push('"bodyweight" must be an object keyed by date.');
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
  const step = roundWeight(clampNonNegative(raw.weightStepKg));
  const seenFoods = new Set(FOODS.map((f) => f.id));
  const customFoods = (Array.isArray(raw.customFoods) ? raw.customFoods : [])
    .map(normalizeCustomFood)
    .filter((f) => f && !seenFoods.has(f.id) && seenFoods.add(f.id));
  const recentFoodIds = (Array.isArray(raw.recentFoodIds) ? raw.recentFoodIds : [])
    .filter((id, i, all) => seenFoods.has(id) && all.indexOf(id) === i)
    .slice(0, 8);
  return {
    proteinTargetG: target > 0 ? target : fallback.proteinTargetG,
    quickAdds,
    activePlanId: typeof raw.activePlanId === 'string' ? raw.activePlanId : fallback.activePlanId,
    customFoods,
    recentFoodIds,
    weightStepKg: step >= 0.25 && step <= 50 ? step : fallback.weightStepKg
  };
}

// The built-in exercises are always present (they can be archived, never
// deleted), with the stored entries — renames, notes, custom exercises — on top.
// v1 data has no library, so it gets exactly the seed.
function normalizeLibrary(raw) {
  const out = seedLibrary();
  if (!isPlainObject(raw)) return out;
  for (const [id, entry] of Object.entries(raw)) {
    if (id && isPlainObject(entry)) out[id] = normalizeExercise(entry, id);
  }
  return out;
}

// One slot per exercise per session (see plans.js#addSlot); the first wins.
function dedupeSlots(slots) {
  const seen = new Set();
  return slots.filter((slot) => !seen.has(slot.exerciseId) && seen.add(slot.exerciseId));
}

function normalizePlanSessions(raw, library, usedKeys) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw) {
    // Keys must be unique across all plans; a duplicate would merge two
    // sessions' history, so the later one is dropped.
    if (!isPlainObject(s) || typeof s.key !== 'string' || !s.key || s.key === REST_DAY_KEY) continue;
    if (usedKeys.has(s.key)) continue;
    usedKeys.add(s.key);
    out.push({
      key: s.key,
      name: String(s.name || '').trim() || 'Session',
      focus: String(s.focus || '').trim(),
      archived: Boolean(s.archived),
      slots: dedupeSlots(
        (Array.isArray(s.slots) ? s.slots : [])
          .filter((slot) => isPlainObject(slot) && library[slot.exerciseId])
          .map(normalizeSlot)
      )
    });
  }
  return out;
}

function normalizePlans(raw, library) {
  const usedKeys = new Set();
  const usedIds = new Set();
  const plans = (Array.isArray(raw) ? raw : [])
    .filter((p) => {
      // Mark ids as seen while filtering, so only the first of a duplicate survives.
      if (!isPlainObject(p) || typeof p.id !== 'string' || !p.id || usedIds.has(p.id)) return false;
      usedIds.add(p.id);
      return true;
    })
    .map((p) => {
      const sessions = normalizePlanSessions(p.sessions, library, usedKeys);
      const live = new Set(sessions.filter((s) => !s.archived).map((s) => s.key));
      const schedule = Array.from({ length: 7 }, (_, i) => {
        const key = Array.isArray(p.schedule) ? p.schedule[i] : undefined;
        return live.has(key) ? key : REST_DAY_KEY;
      });
      return {
        id: p.id,
        name: String(p.name || '').trim() || 'Plan',
        archived: Boolean(p.archived),
        schedule,
        sessions
      };
    });
  return plans.length > 0 ? plans : [seedPlan()];
}

// Points activePlanId at a live plan, un-archiving the only one if it must.
function settleActivePlan(settings, plans) {
  const current = plans.find((p) => p.id === settings.activePlanId && !p.archived);
  if (current) return { settings, plans };
  const live = plans.find((p) => !p.archived);
  if (live) return { settings: { ...settings, activePlanId: live.id }, plans };
  const [first, ...rest] = plans;
  return {
    settings: { ...settings, activePlanId: first.id },
    plans: [{ ...first, archived: false }, ...rest]
  };
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

// Implausible weights are typos, not weigh-ins.
function normalizeBodyweight(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [dateKey, kg] of Object.entries(raw)) {
    if (isDateKey(dateKey) && isPlausibleWeight(kg)) out[dateKey] = roundWeight(kg);
  }
  return out;
}

// Coerces any accepted backup (or a stored blob from an older schema) into the
// current state shape. Add a case here whenever SCHEMA_VERSION is bumped.
//
// v1 → v2: v1 has no `library` or `plans`, so both are seeded with the default
// plan, whose session keys (pushA … legsB) match the keys v1 history was logged
// under. Sessions and nutrition are untouched.
// v2 → v3: adds an empty `bodyweight` and the default weight step.
export function migrate(data) {
  if (!isPlainObject(data)) return defaultState();
  const library = normalizeLibrary(data.library);
  const { settings, plans } = settleActivePlan(
    normalizeSettings(data.settings),
    normalizePlans(data.plans, library)
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    library,
    plans,
    sessions: normalizeSessions(data.sessions),
    nutrition: normalizeNutrition(data.nutrition),
    bodyweight: normalizeBodyweight(data.bodyweight)
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
    nutritionDays,
    weighIns: Object.keys(state.bodyweight).length
  };
}
