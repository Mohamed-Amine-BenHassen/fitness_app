// The only module that talks to browser storage. Keep it thin: no logic here
// beyond load/save/migrate so src/core stays testable under node --test.

import { defaultState } from '../core/schema.js';
import { migrate } from '../core/backup.js';

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

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Clear failed.', error);
  }
}
