// Read-only views over logged sessions: the session list, one session in full,
// and one exercise across time. Pure module.

import { sessionName } from './plans.js';
import { bestsOf, recordsInSession } from './records.js';

function exerciseName(state, exerciseId) {
  return state.library[exerciseId]?.name || exerciseId;
}

function withRecords(state, session, entry) {
  const records = recordsInSession(state, entry.exerciseId, session, entry.sets);
  return entry.sets.map((set, i) => ({ ...set, record: records[i] }));
}

// Newest first, with the counts the list shows.
export function sessionSummaries(state) {
  return state.sessions
    .slice()
    .reverse()
    .map((session) => {
      const prCount = session.entries.reduce(
        (n, entry) => n + withRecords(state, session, entry).filter((s) => s.record).length,
        0
      );
      return {
        dateKey: session.dateKey,
        dayKey: session.dayKey,
        name: sessionName(state, session.dayKey),
        exerciseCount: session.entries.length,
        setCount: session.entries.reduce((n, e) => n + e.sets.length, 0),
        prCount
      };
    });
}

export function sessionDetail(state, dateKey, dayKey) {
  const session = state.sessions.find((s) => s.dateKey === dateKey && s.dayKey === dayKey);
  if (!session) return null;
  return {
    dateKey,
    dayKey,
    name: sessionName(state, dayKey),
    exercises: session.entries.map((entry) => ({
      id: entry.exerciseId,
      name: exerciseName(state, entry.exerciseId),
      bodyweightOnly: Boolean(state.library[entry.exerciseId]?.bodyweightOnly),
      sets: withRecords(state, session, entry)
    }))
  };
}

// Every session that included the exercise, newest first, plus all-time bests.
export function exerciseLog(state, exerciseId) {
  const sessions = [];
  const allSets = [];
  for (const session of state.sessions) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    allSets.push(...entry.sets);
    sessions.push({
      dateKey: session.dateKey,
      dayKey: session.dayKey,
      sessionName: sessionName(state, session.dayKey),
      sets: withRecords(state, session, entry),
      bests: bestsOf(entry.sets)
    });
  }
  return {
    id: exerciseId,
    name: exerciseName(state, exerciseId),
    bodyweightOnly: Boolean(state.library[exerciseId]?.bodyweightOnly),
    allTime: bestsOf(allSets),
    sessions: sessions.reverse()
  };
}
