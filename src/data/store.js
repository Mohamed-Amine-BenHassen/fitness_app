// The only module that talks to browser storage. Keep it thin: no logic here
// beyond load/save/migrate so src/core stays testable under node --test.

import { defaultState } from '../core/schema.js';
import { migrate } from '../core/backup.js';
import { normalizeTimer } from '../core/timer.js';

export const STORAGE_KEY = 'ppl-tracker-state';

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (error) {
    console.warn('Could not read saved data, starting fresh.', error);
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    // Quota or private-mode failure: surface it rather than losing sets silently.
    console.error('Save failed.', error);
    return { ok: false, error };
  }
}

export function storageBytes() {
  try {
    return (localStorage.getItem(STORAGE_KEY) || '').length;
  } catch {
    return 0;
  }
}

// The running rest timer lives under its own key: it is per-device, short-lived
// and deliberately left out of backups.
export const TIMER_KEY = 'ppl-tracker-timer';

export function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? normalizeTimer(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn('Could not read the rest timer.', error);
    return null;
  }
}

export function saveTimer(timer) {
  try {
    if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_KEY);
  } catch (error) {
    // Losing the timer on reload is harmless; the countdown still runs in memory.
    console.warn('Could not save the rest timer.', error);
  }
}

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Clear failed.', error);
  }
}
