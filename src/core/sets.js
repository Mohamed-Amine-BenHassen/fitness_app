// Workout logging. Every function takes a state object and returns a new one —
// no mutation, no DOM, no storage. Sessions stay sorted ascending by date.

import { normalizeSet, sessionId } from './schema.js';

function sortSessions(sessions) {
  return sessions.slice().sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
    return a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0;
  });
}

export function findSession(state, dateKey, dayKey) {
  const id = sessionId(dateKey, dayKey);
  return state.sessions.find((s) => sessionId(s.dateKey, s.dayKey) === id) || null;
}

export function setsFor(state, dateKey, dayKey, exerciseId) {
  const session = findSession(state, dateKey, dayKey);
  if (!session) return [];
  const entry = session.entries.find((e) => e.exerciseId === exerciseId);
  return entry ? entry.sets : [];
}

function withSession(state, dateKey, dayKey, mutate) {
  const existing = findSession(state, dateKey, dayKey);
  const session = existing
    ? { ...existing, entries: existing.entries.map((e) => ({ ...e, sets: e.sets.slice() })) }
    : { dateKey, dayKey, entries: [] };
  mutate(session);
  const others = state.sessions.filter((s) => !(s.dateKey === dateKey && s.dayKey === dayKey));
  const keep = session.entries.some((e) => e.sets.length > 0);
  return { ...state, sessions: sortSessions(keep ? [...others, session] : others) };
}

function entryFor(session, exerciseId) {
  let entry = session.entries.find((e) => e.exerciseId === exerciseId);
  if (!entry) {
    entry = { exerciseId, sets: [] };
    session.entries.push(entry);
  }
  return entry;
}

// `ts` is when the set was logged; it drives the session's duration.
export function addSet(state, dateKey, dayKey, exerciseId, set, ts) {
  return withSession(state, dateKey, dayKey, (session) => {
    entryFor(session, exerciseId).sets.push(normalizeSet(ts === undefined ? set : { ...set, ts }));
  });
}

export function updateSet(state, dateKey, dayKey, exerciseId, index, set) {
  return withSession(state, dateKey, dayKey, (session) => {
    const entry = entryFor(session, exerciseId);
    // Fixing a typo doesn't move the set in time: keep when it was logged.
    if (index >= 0 && index < entry.sets.length) {
      entry.sets[index] = normalizeSet({ ...set, ts: entry.sets[index].ts });
    }
  });
}

export function removeSet(state, dateKey, dayKey, exerciseId, index) {
  return withSession(state, dateKey, dayKey, (session) => {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry || index < 0 || index >= entry.sets.length) return;
    entry.sets.splice(index, 1);
    if (entry.sets.length === 0) {
      session.entries = session.entries.filter((e) => e.exerciseId !== exerciseId);
    }
  });
}

// The most recent time this exercise was performed in the same session type
// (`current.dayKey`), ignoring the session being logged right now. Scoped on
// purpose: Incline DB Press in Push A (chest-led, heavy) and in Push B (after
// shoulders) are run at different weights, so each follows its own history.
// Without a dayKey, any session counts.
export function lastPerformance(state, exerciseId, current = {}) {
  const currentId = current.dateKey ? sessionId(current.dateKey, current.dayKey) : null;
  for (let i = state.sessions.length - 1; i >= 0; i -= 1) {
    const session = state.sessions[i];
    if (currentId && sessionId(session.dateKey, session.dayKey) === currentId) continue;
    if (current.dayKey && session.dayKey !== current.dayKey) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) {
      return { dateKey: session.dateKey, dayKey: session.dayKey, sets: entry.sets };
    }
  }
  return null;
}

export function formatSet(set, bodyweightOnly = false) {
  if (bodyweightOnly || set.weightKg === null) return `${set.reps}`;
  return `${set.weightKg} kg x ${set.reps}`;
}

export function formatSets(sets, bodyweightOnly = false) {
  if (!sets || sets.length === 0) return '';
  if (bodyweightOnly || sets.every((s) => s.weightKg === null)) {
    return `${sets.map((s) => s.reps).join(', ')} reps`;
  }
  return sets.map((s) => formatSet(s)).join(', ');
}

// A session runs from its first logged set to its last. A span over five hours
// means two sittings were logged into one session, so it gets no duration.
const MAX_SESSION_MS = 5 * 60 * 60 * 1000;

// { startedAt, minutes } from the sets' timestamps, or null when none have one.
// `minutes` is null until there are two timestamped sets.
export function sessionTiming(session) {
  const stamps = (session?.entries ?? [])
    .flatMap((entry) => entry.sets.map((set) => set.ts))
    .filter((ts) => Number.isFinite(ts));
  if (stamps.length === 0) return null;
  const startedAt = Math.min(...stamps);
  const span = Math.max(...stamps) - startedAt;
  const minutes = stamps.length > 1 && span <= MAX_SESSION_MS ? Math.round(span / 60000) : null;
  return { startedAt, minutes };
}

export function loggedSetCount(state, dateKey, dayKey) {
  const session = findSession(state, dateKey, dayKey);
  if (!session) return 0;
  return session.entries.reduce((total, entry) => total + entry.sets.length, 0);
}
