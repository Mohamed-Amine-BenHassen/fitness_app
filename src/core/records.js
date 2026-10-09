// Personal records and estimated 1RM, worked out from logged sets — nothing
// extra is stored. Pure module.
//
// A set is compared with everything logged *before* the session it belongs to,
// so sets in the same session don't compete, and an old session viewed in
// history shows the PRs it set at the time.

import { roundWeight, sessionId } from './schema.js';

// Epley drifts badly past ~12 reps; higher-rep sets count as rep records instead.
export const E1RM_MAX_REPS = 12;

export function estimate1RM(set) {
  if (set.weightKg === null || set.reps < 1 || set.reps > E1RM_MAX_REPS) return null;
  if (set.reps === 1) return set.weightKg;
  return roundWeight(set.weightKg * (1 + set.reps / 30));
}

function isBefore(session, current) {
  if (!current?.dateKey) return true;
  if (sessionId(session.dateKey, session.dayKey) === sessionId(current.dateKey, current.dayKey)) return false;
  return session.dateKey <= current.dateKey;
}

function setsBefore(state, exerciseId, current) {
  const sets = [];
  for (const session of state.sessions) {
    if (!isBefore(session, current)) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) sets.push(...entry.sets);
  }
  return sets;
}

// Bests across sets: heaviest weight, best e1RM, most reps (any weight).
export function bestsOf(sets) {
  let heaviest = null;
  let e1rm = null;
  let mostReps = 0;
  for (const set of sets) {
    if (set.weightKg !== null && (heaviest === null || set.weightKg > heaviest)) heaviest = set.weightKg;
    const estimate = estimate1RM(set);
    if (estimate !== null && (e1rm === null || estimate > e1rm)) e1rm = estimate;
    if (set.reps > mostReps) mostReps = set.reps;
  }
  return { heaviest, e1rm, mostReps, count: sets.length };
}

export function bestsBefore(state, exerciseId, current) {
  return bestsOf(setsBefore(state, exerciseId, current));
}

// What record a set breaks, given the earlier sets: 'weight' (heaviest ever),
// 'e1rm' (best estimated 1RM), 'reps' (more reps than ever at this weight or
// heavier — how high-rep and bodyweight sets set records), or null.
// The first time an exercise is done is the baseline, never a PR.
export function recordFor(set, earlierSets) {
  if (earlierSets.length === 0 || set.reps < 1) return null;
  const bests = bestsOf(earlierSets);
  if (set.weightKg !== null) {
    if (bests.heaviest !== null && set.weightKg > bests.heaviest) return 'weight';
    const estimate = estimate1RM(set);
    if (estimate !== null && bests.e1rm !== null && estimate > bests.e1rm) return 'e1rm';
  }
  const comparable = earlierSets.filter((s) =>
    set.weightKg === null ? s.weightKg === null : s.weightKg !== null && s.weightKg >= set.weightKg
  );
  if (comparable.length === 0) return null;
  const repBest = Math.max(...comparable.map((s) => s.reps));
  return set.reps > repBest ? 'reps' : null;
}

// Records for every set an exercise has in one session, in set order.
export function recordsInSession(state, exerciseId, current, sets) {
  const earlier = setsBefore(state, exerciseId, current);
  return sets.map((set) => recordFor(set, earlier));
}

export const RECORD_LABELS = { weight: 'Heaviest', e1rm: 'Best e1RM', reps: 'Most reps' };

// Set i today against set i last time: 'up', 'same' or 'down'; null when there
// is nothing to compare. e1RM when both can be estimated, otherwise weight then reps.
export function compareSets(set, previous) {
  if (!previous) return null;
  const a = estimate1RM(set);
  const b = estimate1RM(previous);
  let diff;
  if (a !== null && b !== null) diff = a - b;
  else if ((set.weightKg ?? 0) !== (previous.weightKg ?? 0)) diff = (set.weightKg ?? 0) - (previous.weightKg ?? 0);
  else diff = set.reps - previous.reps;
  if (Math.abs(diff) < 0.005) return 'same';
  return diff > 0 ? 'up' : 'down';
}
