// Editable training plans and the exercise library. Every function takes a state
// object and returns a new one — no mutation, no DOM, no storage. Callers pick
// new ids with the next*/exerciseIdFor helpers so the UI knows where it lands.
//
// Plans, sessions and exercises are archived, never deleted: logged history
// refers to session keys and exercise ids, and must keep resolving to names.

import { REST_DAY_KEY } from './program.js';
import { normalizeExercise, normalizeSlot } from './schema.js';

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sun, as Date#getDay()
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const REST_SESSION = Object.freeze({ key: REST_DAY_KEY, name: 'Rest', focus: '', exercises: [] });

// ---------- reading ----------

export function planById(state, planId) {
  return state.plans.find((p) => p.id === planId) || null;
}

export function activePlan(state) {
  return planById(state, state.settings.activePlanId) || state.plans.find((p) => !p.archived) || state.plans[0];
}

export function livePlans(state) {
  return state.plans.filter((p) => !p.archived);
}

export function liveSessions(plan) {
  return plan.sessions.filter((s) => !s.archived);
}

// Looks across every plan, archived ones included, so old history still finds
// the session it was logged under.
function findSessionDef(state, key) {
  for (const plan of state.plans) {
    const found = plan.sessions.find((s) => s.key === key);
    if (found) return found;
  }
  return null;
}

export function sessionName(state, key) {
  if (key === REST_DAY_KEY) return REST_SESSION.name;
  return findSessionDef(state, key)?.name || key;
}

export function exerciseFor(state, exerciseId) {
  return state.library[exerciseId] || null;
}

// A session joined with the library into the flat shape the workout tab renders:
// { key, name, focus, exercises: [{ id, name, sets, repRange, restSec, … }] }.
export function resolveSession(state, key) {
  const def = key === REST_DAY_KEY ? null : findSessionDef(state, key);
  if (!def) return REST_SESSION;
  return {
    key: def.key,
    name: def.name,
    focus: def.focus,
    exercises: def.slots
      .filter((slot) => state.library[slot.exerciseId])
      .map((slot) => {
        const ex = state.library[slot.exerciseId];
        return {
          id: ex.id,
          name: ex.name,
          bodyweightOnly: ex.bodyweightOnly,
          perSide: ex.perSide,
          technique: ex.technique,
          sets: slot.sets,
          repRange: { ...slot.repRange },
          restSec: slot.restSec,
          note: slot.note,
          anchor: slot.anchor
        };
      })
  };
}

// The active plan's session for a weekday (Date#getDay()). A key that no longer
// points at a live session in that plan reads as rest.
export function scheduledKey(state, weekday) {
  const plan = activePlan(state);
  const key = plan.schedule[weekday] ?? REST_DAY_KEY;
  return liveSessions(plan).some((s) => s.key === key) ? key : REST_DAY_KEY;
}

export function libraryList(state, { includeArchived = false } = {}) {
  return Object.values(state.library)
    .filter((e) => includeArchived || !e.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Accent- and case-insensitive substring match on the exercise name.
export function searchLibrary(state, query) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = fold(query.trim());
  const list = libraryList(state);
  return q ? list.filter((e) => fold(e.name).includes(q)) : list;
}

// ---------- ids ----------

function nextNumbered(prefix, ids) {
  const highest = ids.reduce((max, id) => {
    const m = String(id).match(new RegExp(`^${prefix}-(\\d+)$`));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${prefix}-${highest + 1}`;
}

export function nextPlanId(state) {
  return nextNumbered('plan', state.plans.map((p) => p.id));
}

// Session keys are unique across all plans: logged sessions store only the key.
export function nextSessionKey(state) {
  return nextNumbered('s', state.plans.flatMap((p) => p.sessions.map((s) => s.key)));
}

export function exerciseIdFor(state, name) {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'exercise';
  let id = base;
  for (let n = 2; state.library[id]; n += 1) id = `${base}-${n}`;
  return id;
}

// ---------- plans ----------

// Returns the same state object when nothing changed, so a refused edit is a
// no-op the caller can detect.
function mapPlan(state, planId, fn) {
  const plan = planById(state, planId);
  if (!plan) return state;
  const next = fn(plan);
  if (next === plan) return state;
  return { ...state, plans: state.plans.map((p) => (p.id === planId ? next : p)) };
}

const cleanName = (name, fallback) => String(name || '').trim() || fallback;

export function createPlan(state, { id, name }) {
  if (planById(state, id)) return state;
  const plan = {
    id,
    name: cleanName(name, 'New plan'),
    archived: false,
    schedule: Array(7).fill(REST_DAY_KEY),
    sessions: []
  };
  return { ...state, plans: [...state.plans, plan] };
}

// The copy gets fresh session keys so its history stays separate from the
// original's; exercise ids are shared, so "last time" still carries over.
export function duplicatePlan(state, sourceId, { id, name }) {
  const source = planById(state, sourceId);
  if (!source || planById(state, id)) return state;
  const used = state.plans.flatMap((p) => p.sessions.map((s) => s.key));
  const rekey = {};
  for (const s of source.sessions) {
    rekey[s.key] = nextNumbered('s', used);
    used.push(rekey[s.key]);
  }
  const copy = {
    id,
    name: cleanName(name, `${source.name} (copy)`),
    archived: false,
    schedule: source.schedule.map((key) => rekey[key] || REST_DAY_KEY),
    sessions: source.sessions.map((s) => ({
      ...s,
      key: rekey[s.key],
      slots: s.slots.map((slot) => ({ ...slot, repRange: { ...slot.repRange } }))
    }))
  };
  return { ...state, plans: [...state.plans, copy] };
}

export function renamePlan(state, planId, name) {
  return mapPlan(state, planId, (p) => ({ ...p, name: cleanName(name, p.name) }));
}

export function setActivePlan(state, planId) {
  const plan = planById(state, planId);
  if (!plan || plan.archived) return state;
  return { ...state, settings: { ...state.settings, activePlanId: planId } };
}

// The active plan can't be archived — there must always be one to train from.
export function archivePlan(state, planId) {
  if (activePlan(state).id === planId) return state;
  return mapPlan(state, planId, (p) => ({ ...p, archived: true }));
}

export function restorePlan(state, planId) {
  return mapPlan(state, planId, (p) => ({ ...p, archived: false }));
}

export function setSchedule(state, planId, weekday, key) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return state;
  return mapPlan(state, planId, (p) => {
    const valid = key === REST_DAY_KEY || liveSessions(p).some((s) => s.key === key);
    if (!valid) return p;
    const schedule = p.schedule.slice();
    schedule[weekday] = key;
    return { ...p, schedule };
  });
}

// ---------- sessions ----------

function mapSession(state, planId, key, fn) {
  return mapPlan(state, planId, (p) => {
    const session = p.sessions.find((s) => s.key === key);
    if (!session) return p;
    const next = fn(session);
    return next === session ? p : { ...p, sessions: p.sessions.map((s) => (s.key === key ? next : s)) };
  });
}

export function addSession(state, planId, { key, name, focus = '' }) {
  if (findSessionDef(state, key) || key === REST_DAY_KEY) return state;
  const session = { key, name: cleanName(name, 'New session'), focus: String(focus).trim(), archived: false, slots: [] };
  return mapPlan(state, planId, (p) => ({ ...p, sessions: [...p.sessions, session] }));
}

export function updateSession(state, planId, key, { name, focus }) {
  return mapSession(state, planId, key, (s) => ({
    ...s,
    name: name === undefined ? s.name : cleanName(name, s.name),
    focus: focus === undefined ? s.focus : String(focus).trim()
  }));
}

// Archiving also takes the session off the weekly schedule.
export function archiveSession(state, planId, key) {
  const next = mapSession(state, planId, key, (s) => ({ ...s, archived: true }));
  return mapPlan(next, planId, (p) => ({
    ...p,
    schedule: p.schedule.map((k) => (k === key ? REST_DAY_KEY : k))
  }));
}

export function restoreSession(state, planId, key) {
  return mapSession(state, planId, key, (s) => ({ ...s, archived: false }));
}

// ---------- slots ----------

// fn gets a copy of the slots; returning that copy untouched is a no-op.
function mapSlots(state, planId, key, fn) {
  return mapSession(state, planId, key, (s) => {
    const copy = s.slots.slice();
    const slots = fn(copy);
    const same = slots.length === s.slots.length && slots.every((slot, i) => slot === s.slots[i]);
    return same ? s : { ...s, slots };
  });
}

const inRange = (slots, index) => Number.isInteger(index) && index >= 0 && index < slots.length;

// An exercise appears at most once per session: logged sets are stored per
// exercise, so two slots would share — and double-count — the same sets.
function sessionHas(slots, exerciseId, exceptIndex = -1) {
  return slots.some((slot, i) => i !== exceptIndex && slot.exerciseId === exerciseId);
}

export function addSlot(state, planId, key, slot) {
  if (!exerciseFor(state, slot?.exerciseId)) return state;
  return mapSlots(state, planId, key, (slots) =>
    sessionHas(slots, slot.exerciseId) ? slots : [...slots, normalizeSlot(slot)]
  );
}

// Partial update: { sets }, { repRange: { min } }, { note }, … merged then normalised.
export function updateSlot(state, planId, key, index, patch) {
  return mapSlots(state, planId, key, (slots) => {
    if (!inRange(slots, index)) return slots;
    const current = slots[index];
    slots[index] = normalizeSlot({
      ...current,
      ...patch,
      exerciseId: current.exerciseId,
      repRange: { ...current.repRange, ...(patch.repRange || {}) }
    });
    return slots;
  });
}

export function removeSlot(state, planId, key, index) {
  return mapSlots(state, planId, key, (slots) => slots.filter((_, i) => i !== index));
}

export function moveSlot(state, planId, key, index, delta) {
  return mapSlots(state, planId, key, (slots) => {
    const target = index + delta;
    if (!inRange(slots, index) || !inRange(slots, target)) return slots;
    [slots[index], slots[target]] = [slots[target], slots[index]];
    return slots;
  });
}

// Swapping keeps the prescription and points the slot at another exercise,
// whose history then shows instead.
export function swapSlot(state, planId, key, index, exerciseId) {
  if (!exerciseFor(state, exerciseId)) return state;
  return mapSlots(state, planId, key, (slots) => {
    if (!inRange(slots, index) || slots[index].exerciseId === exerciseId) return slots;
    if (sessionHas(slots, exerciseId, index)) return slots;
    slots[index] = { ...slots[index], exerciseId };
    return slots;
  });
}

// ---------- library ----------

// Renaming keeps the id, so the exercise's history follows it.
export function upsertExercise(state, exercise) {
  const id = exercise?.id || exerciseIdFor(state, String(exercise?.name || ''));
  const merged = normalizeExercise({ ...state.library[id], ...exercise }, id);
  return { ...state, library: { ...state.library, [id]: merged } };
}

export function archiveExercise(state, exerciseId) {
  if (!exerciseFor(state, exerciseId)) return state;
  return upsertExercise(state, { id: exerciseId, archived: true });
}

export function restoreExercise(state, exerciseId) {
  if (!exerciseFor(state, exerciseId)) return state;
  return upsertExercise(state, { id: exerciseId, archived: false });
}

// How many live sessions in live plans use the exercise — shown before archiving.
export function exerciseUsage(state, exerciseId) {
  return livePlans(state)
    .flatMap((p) => liveSessions(p))
    .filter((s) => s.slots.some((slot) => slot.exerciseId === exerciseId)).length;
}
