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

export function addSet(state, dateKey, dayKey, exerciseId, set) {
  return withSession(state, dateKey, dayKey, (session) => {
    entryFor(session, exerciseId).sets.push(normalizeSet(set));
  });
}

export function updateSet(state, dateKey, dayKey, exerciseId, index, set) {
  return withSession(state, dateKey, dayKey, (session) => {
    const entry = entryFor(session, exerciseId);
    if (index >= 0 && index < entry.sets.length) entry.sets[index] = normalizeSet(set);
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

// The most recent time this exercise was performed, ignoring the session being
// logged right now. Deliberately not scoped to the same day-key: Incline DB Press
// appears in both Push A and Push B, and the newer numbers are the useful ones.
export function lastPerformance(state, exerciseId, current = {}) {
  const currentId = current.dateKey ? sessionId(current.dateKey, current.dayKey) : null;
  for (let i = state.sessions.length - 1; i >= 0; i -= 1) {
    const session = state.sessions[i];
    if (currentId && sessionId(session.dateKey, session.dayKey) === currentId) continue;
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

export function loggedSetCount(state, dateKey, dayKey) {
  const session = findSession(state, dateKey, dayKey);
  if (!session) return 0;
  return session.entries.reduce((total, entry) => total + entry.sets.length, 0);
}
