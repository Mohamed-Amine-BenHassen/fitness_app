// Local-calendar date helpers. Everything is derived from local date parts, never
// UTC, so an evening workout never lands on the following day. Pure module.

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateKey(value);
  return localDateKey(date) === value;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(key) {
  return parseDateKey(key).getDay();
}

export function shiftDateKey(key, days) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function daysBetween(fromKey, toKey) {
  const ms = parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime();
  return Math.round(ms / 86400000);
}

export function formatHuman(key) {
  const date = parseDateKey(key);
  return `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

// "today", "yesterday", "4 days ago" — used by the last-session reference line.
export function formatRelative(fromKey, todayKey) {
  const diff = daysBetween(fromKey, todayKey);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 0) return formatHuman(fromKey);
  if (diff < 14) return `${diff} days ago`;
  return formatHuman(fromKey);
}
