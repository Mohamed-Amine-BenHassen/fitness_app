import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STALE_AFTER_MS,
  adjustTimer,
  formatClock,
  isDone,
  isStale,
  normalizeTimer,
  remainingMs,
  remainingRatio,
  startTimer
} from '../src/core/timer.js';

const T0 = 1_760_000_000_000;

test('a timer counts down from the rest time', () => {
  const timer = startTimer(90, T0, 'Leg Press');
  assert.equal(timer.label, 'Leg Press');
  assert.equal(remainingMs(timer, T0), 90_000);
  assert.equal(remainingMs(timer, T0 + 30_000), 60_000);
  assert.equal(isDone(timer, T0 + 89_999), false);
});

test('remaining time never goes negative and the timer is done at zero', () => {
  const timer = startTimer(60, T0);
  assert.equal(remainingMs(timer, T0 + 75_000), 0);
  assert.equal(isDone(timer, T0 + 60_000), true);
});

test('the countdown is based on the end time, so a long pause is caught up', () => {
  const timer = startTimer(120, T0);
  // Screen locked for 100 s: no ticks happened, the result is still right.
  assert.equal(remainingMs(timer, T0 + 100_000), 20_000);
});

test('+15 and −15 move the end and keep the progress ratio sensible', () => {
  const timer = startTimer(60, T0);
  const longer = adjustTimer(timer, 15, T0);
  assert.equal(remainingMs(longer, T0), 75_000);
  assert.equal(remainingRatio(longer, T0), 1);
  const shorter = adjustTimer(timer, -15, T0 + 10_000);
  assert.equal(remainingMs(shorter, T0 + 10_000), 35_000);
});

test('−15 near the end finishes the timer instead of going negative', () => {
  const timer = startTimer(60, T0);
  const adjusted = adjustTimer(timer, -15, T0 + 50_000);
  assert.equal(adjusted.endsAt, T0 + 50_000);
  assert.equal(isDone(adjusted, T0 + 50_000), true);
});

test('adjustTimer does not mutate the input', () => {
  const timer = startTimer(60, T0);
  const snapshot = JSON.stringify(timer);
  adjustTimer(timer, 15, T0);
  assert.equal(JSON.stringify(timer), snapshot);
});

test('a zero or negative rest still produces a usable one-second timer', () => {
  assert.equal(startTimer(0, T0).durationMs, 1000);
  assert.equal(startTimer(-5, T0).durationMs, 1000);
});

test('remainingRatio runs from 1 to 0', () => {
  const timer = startTimer(100, T0);
  assert.equal(remainingRatio(timer, T0), 1);
  assert.equal(remainingRatio(timer, T0 + 25_000), 0.75);
  assert.equal(remainingRatio(timer, T0 + 200_000), 0);
});

test('a timer is stale only well after it ended', () => {
  const timer = startTimer(60, T0);
  assert.equal(isStale(timer, T0 + 60_000 + STALE_AFTER_MS), false);
  assert.equal(isStale(timer, T0 + 60_001 + STALE_AFTER_MS), true);
});

test('formatClock rounds up to whole seconds', () => {
  assert.equal(formatClock(90_000), '1:30');
  assert.equal(formatClock(89_001), '1:30');
  assert.equal(formatClock(5_000), '0:05');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(-300), '0:00');
  assert.equal(formatClock(180_000), '3:00');
});

test('normalizeTimer accepts a stored timer and rejects junk', () => {
  const timer = startTimer(45, T0, 'Face Pull');
  assert.deepEqual(normalizeTimer(JSON.parse(JSON.stringify(timer))), timer);
  assert.equal(normalizeTimer(null), null);
  assert.equal(normalizeTimer('x'), null);
  assert.equal(normalizeTimer({ startedAt: T0, endsAt: 'soon', durationMs: 1 }), null);
  assert.equal(normalizeTimer({ startedAt: T0, endsAt: T0 - 1, durationMs: 1000 }), null);
  assert.equal(normalizeTimer({ ...timer, label: 7 }).label, '');
});
