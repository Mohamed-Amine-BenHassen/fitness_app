// Rest timer. Stores the moment the rest ends rather than a ticking count, so it
// survives a locked screen, a backgrounded tab or a full reload. Pure module —
// the caller passes `now` (ms) so nothing here reads the clock.

const MIN_DURATION_MS = 1000;

// A rest that ended this long ago is history, not news: clear it without alerting.
export const STALE_AFTER_MS = 2 * 60 * 1000;

export function startTimer(restSec, now, label = '') {
  const durationMs = Math.max(MIN_DURATION_MS, Math.round(restSec * 1000));
  return { label: String(label), startedAt: now, endsAt: now + durationMs, durationMs };
}

export function remainingMs(timer, now) {
  return Math.max(0, timer.endsAt - now);
}

export function isDone(timer, now) {
  return remainingMs(timer, now) === 0;
}

export function isStale(timer, now) {
  return now - timer.endsAt > STALE_AFTER_MS;
}

// Fraction of the rest still to go, 1 → 0, for the progress bar.
export function remainingRatio(timer, now) {
  return Math.min(1, remainingMs(timer, now) / timer.durationMs);
}

// +15 / −15 buttons. Never moves the end into the past, so −15 on a nearly
// finished rest ends it now rather than producing a negative countdown.
export function adjustTimer(timer, deltaSec, now) {
  const endsAt = Math.max(now, timer.endsAt + deltaSec * 1000);
  const durationMs = Math.max(MIN_DURATION_MS, timer.durationMs + deltaSec * 1000);
  return { ...timer, endsAt, durationMs };
}

// 90500 ms → "1:31". Rounds up so the display reaches 0:00 exactly when done.
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Validates a timer read back from storage; anything malformed becomes null.
export function normalizeTimer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { startedAt, endsAt, durationMs } = raw;
  if (![startedAt, endsAt, durationMs].every(Number.isFinite)) return null;
  if (durationMs <= 0 || endsAt < startedAt) return null;
  return { label: typeof raw.label === 'string' ? raw.label : '', startedAt, endsAt, durationMs };
}
