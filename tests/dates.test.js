import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween,
  formatHuman,
  formatRelative,
  isDateKey,
  localDateKey,
  parseDateKey,
  shiftDateKey,
  weekdayOf
} from '../src/core/dates.js';

test('date keys are built from local parts, not UTC', () => {
  // 23:30 local on the 11th must stay the 11th even when UTC has rolled over.
  assert.equal(localDateKey(new Date(2026, 8, 11, 23, 30)), '2026-09-11');
  assert.equal(localDateKey(new Date(2026, 0, 5, 0, 15)), '2026-01-05');
});

test('round-trips through parseDateKey', () => {
  assert.equal(localDateKey(parseDateKey('2026-09-11')), '2026-09-11');
});

test('weekdayOf matches the calendar', () => {
  assert.equal(weekdayOf('2026-09-11'), 5); // a Friday
  assert.equal(weekdayOf('2026-09-13'), 0); // a Sunday
});

test('isDateKey rejects malformed and impossible dates', () => {
  assert.equal(isDateKey('2026-09-11'), true);
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(isDateKey('2026-9-11'), false);
  assert.equal(isDateKey('not a date'), false);
  assert.equal(isDateKey(20260911), false);
  assert.equal(isDateKey(null), false);
});

test('shifting crosses month and year boundaries', () => {
  assert.equal(shiftDateKey('2026-09-30', 1), '2026-10-01');
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
});

test('daysBetween is DST-proof', () => {
  // Spans a typical European DST change; still exactly 7 calendar days.
  assert.equal(daysBetween('2026-03-26', '2026-04-02'), 7);
  assert.equal(daysBetween('2026-09-11', '2026-09-11'), 0);
});

test('human and relative formatting', () => {
  assert.equal(formatHuman('2026-09-11'), 'Fri 11 Sep');
  assert.equal(formatRelative('2026-09-11', '2026-09-11'), 'today');
  assert.equal(formatRelative('2026-09-10', '2026-09-11'), 'yesterday');
  assert.equal(formatRelative('2026-09-07', '2026-09-11'), '4 days ago');
  assert.equal(formatRelative('2026-08-01', '2026-09-11'), 'Sat 1 Aug');
});
