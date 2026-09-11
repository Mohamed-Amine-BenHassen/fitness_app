// Wiring only: owns the state object, hands it to the renderers, saves on change.
// No domain logic lives here — it belongs in src/core so node --test can reach it.

import { load, save, storageBytes } from './src/data/store.js';
import { dayKeyForWeekday, getSession } from './src/core/program.js';
import { formatHuman, localDateKey, weekdayOf } from './src/core/dates.js';
import { addSet, removeSet } from './src/core/sets.js';
import {
  addEntry,
  removeEntry,
  removeQuickAdd,
  setProteinTarget,
  upsertQuickAdd
} from './src/core/nutrition.js';
import { renderWorkout } from './src/ui/workout.js';
import { renderProtein } from './src/ui/protein.js';
import { renderBackup } from './src/ui/backup-ui.js';

const view = document.getElementById('view');
const titleEl = document.getElementById('app-title');
const dateEl = document.getElementById('app-date');
const toastEl = document.getElementById('toast');
const tabs = [...document.querySelectorAll('.tab')];

const TITLES = { protein: 'Protein', backup: 'Backup' };

let state = load();

const ui = {
  tab: 'workout',
  dateKey: localDateKey(new Date()),
  dayKey: 'rest',
  todayDayKey: 'rest',
  editingQuickAdds: false
};

function syncToday() {
  const dateKey = localDateKey(new Date());
  const todayDayKey = dayKeyForWeekday(weekdayOf(dateKey));
  const rolledOver = dateKey !== ui.dateKey;
  ui.dateKey = dateKey;
  ui.todayDayKey = todayDayKey;
  if (rolledOver || ui.dayKey === 'rest') ui.dayKey = todayDayKey;
  return rolledOver;
}

let toastTimer = 0;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function commit(next) {
  state = next;
  const result = save(state);
  if (!result.ok) toast('Could not save — device storage may be full.');
  render();
}

const actions = {
  toast,

  setDayKey(dayKey) {
    ui.dayKey = dayKey;
    render();
  },

  addSet(exerciseId, set) {
    commit(addSet(state, ui.dateKey, ui.dayKey, exerciseId, set));
  },

  removeSet(exerciseId, index) {
    commit(removeSet(state, ui.dateKey, ui.dayKey, exerciseId, index));
  },

  addProtein(entry) {
    commit(addEntry(state, ui.dateKey, entry, Date.now()));
  },

  removeProtein(index) {
    commit(removeEntry(state, ui.dateKey, index));
  },

  saveQuickAdd(quickAdd) {
    commit(upsertQuickAdd(state, quickAdd));
  },

  deleteQuickAdd(id) {
    commit(removeQuickAdd(state, id));
  },

  setTarget(grams) {
    commit(setProteinTarget(state, grams));
  },

  toggleQuickAddEditor() {
    ui.editingQuickAdds = !ui.editingQuickAdds;
    render();
  },

  replaceState(next) {
    commit(next);
    toast('Backup restored.');
  }
};

function render() {
  const ctx = { state, ui, actions, storageBytes };

  titleEl.textContent = ui.tab === 'workout' ? getSession(ui.dayKey).name : TITLES[ui.tab];
  dateEl.textContent = formatHuman(ui.dateKey);

  for (const tab of tabs) {
    if (tab.dataset.tab === ui.tab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  if (ui.tab === 'workout') renderWorkout(view, ctx);
  else if (ui.tab === 'protein') renderProtein(view, ctx);
  else renderBackup(view, ctx);
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (ui.tab === tab.dataset.tab) return;
    ui.tab = tab.dataset.tab;
    ui.editingQuickAdds = false;
    window.scrollTo(0, 0);
    render();
  });
}

// Coming back to the app after midnight must not keep logging into yesterday.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (syncToday()) render();
});

syncToday();
render();

if ('serviceWorker' in navigator) {
  // A worker was already in charge, so a change of controller means a new version
  // took over mid-session: reload once so the running JS matches the cached files.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed; the app still runs online.', error);
    });
  });
}
