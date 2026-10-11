// Stalls and deloads, worked out from logged sets — nothing extra is stored.
// Pure module.
//
// Each past session of an exercise gets one score: its best estimated 1RM, or
// its best reps for bodyweight work. Counting from the oldest, a session that
// beats every score before it is progress; a run of sessions that doesn't is a
// stall. The session being logged right now never counts: it isn't finished.

import { activePlan, liveSessions, resolveSession } from './plans.js';
import { weightStepOf } from './progression.js';
import { roundWeight, sessionId } from './schema.js';

export const STALL_SESSIONS = 3;
export const DELOAD_MIN_STALLED = 3;
const LIGHTER_SHARE = 0.9;

// Epley, uncapped: past 12 reps it's no good as a 1RM, but it still ranks two
// sessions of the same exercise correctly, which is all a stall check needs.
function scoreOf(sets, byReps) {
  let best = null;
  for (const set of sets) {
    const score = byReps ? set.reps : set.weightKg === null ? null : roundWeight(set.weightKg * (1 + set.reps / 30));
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}

function pastEntries(state, exerciseId, current) {
  const currentId = current?.dateKey ? sessionId(current.dateKey, current.dayKey) : null;
  return state.sessions
    .filter((s) => !current?.dateKey || (s.dateKey <= current.dateKey && sessionId(s.dateKey, s.dayKey) !== currentId))
    .map((s) => s.entries.find((e) => e.exerciseId === exerciseId))
    .filter((entry) => entry && entry.sets.length > 0);
}

// Sessions in a row, ending with the latest, that failed to beat the best before
// them. null with fewer than two scored sessions: there's nothing to beat yet.
export function sessionsSinceProgress(state, exercise, current) {
  const entries = pastEntries(state, exercise.id, current);
  const byReps = exercise.bodyweightOnly || entries.every((e) => e.sets.every((s) => s.weightKg === null));
  const scores = entries.map((e) => scoreOf(e.sets, byReps)).filter((score) => score !== null);
  if (scores.length < 2) return null;
  let best = scores[0];
  let since = 0;
  for (const score of scores.slice(1)) {
    if (score > best) {
      best = score;
      since = 0;
    } else since += 1;
  }
  return since;
}

// { sessions, lighterKg } when the exercise has stalled, else null. lighterKg is
// about 10% under last time's top weight, on the weight step; null for bodyweight.
export function stallFor(state, exercise, current) {
  const sessions = sessionsSinceProgress(state, exercise, current);
  if (sessions === null || sessions < STALL_SESSIONS) return null;
  const last = pastEntries(state, exercise.id, current).at(-1);
  const weights = last.sets.map((s) => s.weightKg).filter((kg) => kg !== null);
  if (exercise.bodyweightOnly || weights.length === 0) return { sessions, lighterKg: null };
  const top = Math.max(...weights);
  const step = weightStepOf(state);
  let lighterKg = roundWeight(Math.round((top * LIGHTER_SHARE) / step) * step);
  if (lighterKg >= top) lighterKg = roundWeight(top - step);
  return { sessions, lighterKg: lighterKg > 0 ? lighterKg : null };
}

// Every stalled lift in the active plan, each once, in plan order.
export function stalledLifts(state, current) {
  const seen = new Set();
  const stalled = [];
  for (const def of liveSessions(activePlan(state))) {
    for (const exercise of resolveSession(state, def.key).exercises) {
      if (seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      const stall = stallFor(state, exercise, current);
      if (stall) stalled.push({ id: exercise.id, name: exercise.name, sessions: stall.sessions });
    }
  }
  return stalled;
}

// Several lifts stuck at once points at fatigue more than at any one exercise.
export function deloadAdvice(state, current) {
  const lifts = stalledLifts(state, current);
  return lifts.length >= DELOAD_MIN_STALLED ? { lifts } : null;
}
