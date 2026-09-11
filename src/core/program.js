// Seed data for the training program. Source of truth is plan.md — change that
// file first, then mirror it here. Pure module: no DOM, no storage, no clock.

const ex = (id, name, sets, min, max, restSec, opts = {}) => ({
  id,
  name,
  sets,
  repRange: { min, max },
  restSec,
  note: opts.note || '',
  anchor: Boolean(opts.anchor),
  bodyweightOnly: Boolean(opts.bodyweightOnly),
  perSide: Boolean(opts.perSide)
});

export const REST_DAY_KEY = 'rest';

export const SESSIONS = {
  pushA: {
    key: 'pushA',
    name: 'Push A',
    focus: 'chest-led',
    exercises: [
      ex('incline-db-press', 'Incline DB Press', 4, 6, 10, 120, { anchor: true }),
      ex('flat-db-machine-press', 'Flat DB / Machine Press', 3, 8, 12, 90),
      ex('seated-db-shoulder-press', 'Seated DB Shoulder Press', 3, 8, 12, 90),
      ex('cable-lateral-raise', 'Cable Lateral Raise', 4, 12, 20, 60, { note: 'side-delt priority' }),
      ex('overhead-triceps-extension', 'Overhead Triceps Extension', 3, 10, 15, 60),
      ex('triceps-pushdown', 'Triceps Pushdown', 3, 12, 15, 60)
    ]
  },
  pullA: {
    key: 'pullA',
    name: 'Pull A',
    focus: 'width-led',
    exercises: [
      ex('pullup-wide-lat-pulldown', 'Pull-up / Wide Lat Pulldown', 4, 6, 10, 120, { anchor: true }),
      ex('chest-supported-row', 'Chest-Supported Row', 3, 8, 12, 90),
      ex('seated-cable-row-wide', 'Seated Cable Row (wide)', 3, 10, 12, 90),
      ex('face-pull', 'Face Pull', 3, 15, 20, 45),
      ex('rear-delt-fly', 'Rear-Delt Fly', 3, 15, 20, 45),
      ex('db-cable-curl', 'DB / Cable Curl', 3, 10, 15, 60)
    ]
  },
  legsA: {
    key: 'legsA',
    name: 'Legs A',
    focus: 'quad-led',
    exercises: [
      ex('back-squat', 'Back Squat', 4, 6, 8, 180, { anchor: true }),
      ex('leg-press', 'Leg Press', 3, 10, 12, 120),
      ex('bulgarian-split-squat', 'Bulgarian Split Squat', 3, 10, 12, 90, { note: 'per leg', perSide: true }),
      ex('leg-extension', 'Leg Extension', 3, 12, 15, 60),
      ex('standing-calf-raise', 'Standing Calf Raise', 4, 12, 15, 45),
      ex('hanging-leg-raise', 'Hanging Leg Raise', 3, 10, 15, 60, { note: 'bodyweight, log reps only', bodyweightOnly: true })
    ]
  },
  pushB: {
    key: 'pushB',
    name: 'Push B',
    focus: 'delt-led',
    exercises: [
      ex('seated-db-shoulder-press', 'Seated DB Shoulder Press', 4, 8, 12, 120, { anchor: true }),
      ex('incline-db-press', 'Incline DB Press', 3, 8, 12, 90),
      ex('cable-lateral-raise', 'Cable Lateral Raise', 4, 12, 20, 60, { note: 'side-delt priority' }),
      ex('machine-chest-press-dips', 'Machine Chest Press / Dips', 3, 10, 12, 90),
      ex('db-lateral-raise', 'DB Lateral Raise', 3, 15, 20, 45, { note: 'side-delt priority' }),
      ex('triceps-pushdown', 'Triceps Pushdown', 3, 12, 15, 60)
    ]
  },
  pullB: {
    key: 'pullB',
    name: 'Pull B',
    focus: 'thickness-led',
    exercises: [
      ex('barbell-chest-supported-row', 'Barbell / Chest-Supported Row', 4, 6, 10, 120, { anchor: true }),
      ex('lat-pulldown-neutral', 'Lat Pulldown (neutral)', 3, 8, 12, 90),
      ex('single-arm-db-row', 'Single-Arm DB Row', 3, 10, 12, 90, { note: 'per arm', perSide: true }),
      ex('face-pull', 'Face Pull', 3, 15, 20, 45),
      ex('incline-db-curl', 'Incline DB Curl', 3, 10, 12, 60),
      ex('hammer-curl', 'Hammer Curl', 3, 12, 15, 60)
    ]
  },
  legsB: {
    key: 'legsB',
    name: 'Legs B',
    focus: 'hinge-led',
    exercises: [
      ex('romanian-trap-bar-deadlift', 'Romanian / Trap-Bar Deadlift', 4, 6, 10, 150, { anchor: true }),
      ex('lying-leg-curl', 'Lying Leg Curl', 4, 10, 15, 75),
      ex('hip-thrust-back-extension', 'Hip Thrust / Back Extension', 3, 10, 15, 90),
      ex('leg-press-feet-high', 'Leg Press (feet high)', 3, 12, 15, 90),
      ex('seated-calf-raise', 'Seated Calf Raise', 4, 15, 20, 45),
      ex('cable-crunch', 'Cable Crunch', 3, 12, 15, 60)
    ]
  },
  rest: { key: 'rest', name: 'Rest', focus: '', exercises: [] }
};

// Indexed by Date#getDay(): 0 = Sunday .. 6 = Saturday.
export const WEEKLY_SCHEDULE = ['rest', 'pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB'];

export const TRAINING_KEYS = ['pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB'];

export function dayKeyForWeekday(weekday) {
  return WEEKLY_SCHEDULE[weekday] ?? REST_DAY_KEY;
}

export function getSession(dayKey) {
  return SESSIONS[dayKey] || SESSIONS.rest;
}

export function sessionForWeekday(weekday) {
  return getSession(dayKeyForWeekday(weekday));
}

export function exerciseById(exerciseId) {
  for (const key of TRAINING_KEYS) {
    const found = SESSIONS[key].exercises.find((e) => e.id === exerciseId);
    if (found) return found;
  }
  return null;
}

export function formatRest(restSec) {
  if (restSec < 60) return `${restSec}s`;
  const minutes = restSec / 60;
  return Number.isInteger(minutes) ? `${minutes}m` : `${minutes.toFixed(1)}m`;
}

export function formatPrescription(exercise) {
  const { sets, repRange, restSec } = exercise;
  return `${sets} x ${repRange.min}-${repRange.max} · rest ${formatRest(restSec)}`;
}
