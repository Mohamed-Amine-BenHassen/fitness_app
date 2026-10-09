// Wiring only: owns the state object, hands it to the renderers, saves on change.
// No domain logic lives here — it belongs in src/core so node --test can reach it.

import { load, loadTimer, save, saveTimer, storageBytes } from './src/data/store.js';
import { adjustTimer, isStale, startTimer } from './src/core/timer.js';
import { REST_DAY_KEY } from './src/core/program.js';
import { activePlan, resolveSession, scheduledKey } from './src/core/plans.js';
import { formatHuman, localDateKey, weekdayOf } from './src/core/dates.js';
import { addSet, removeSet, setsFor } from './src/core/sets.js';
import { RECORD_LABELS, recordsInSession } from './src/core/records.js';
import {
  addEntry,
  dayTotal,
  removeEntry,
  removeQuickAdd,
  setProteinTarget,
  upsertQuickAdd
} from './src/core/nutrition.js';
import { logFood } from './src/core/foods.js';
import { renderWorkout } from './src/ui/workout.js';
import { renderProtein } from './src/ui/protein.js';
import { renderBackup } from './src/ui/backup-ui.js';
import { renderPlan } from './src/ui/plan.js';
import { renderHistory } from './src/ui/history.js';
import { createTimerBar, unlockAudio } from './src/ui/timer-bar.js';

const view = document.getElementById('view');
const titleEl = document.getElementById('app-title');
const dateEl = document.getElementById('app-date');
const toastEl = document.getElementById('toast');
const tabs = [...document.querySelectorAll('.tab')];

const TITLES = { plan: 'Plan', protein: 'Protein', backup: 'Backup' };

let state = load();

const ui = {
  tab: 'workout',
  dateKey: localDateKey(new Date()),
  dayKey: 'rest',
  todayDayKey: 'rest',
  editingQuickAdds: false,
  food: { selectedId: null, adding: false },
  // History inside the Workout tab: view is null (closed) | list | session | exercise.
  history: { view: null, dateKey: null, dayKey: null, exerciseId: null, from: null },
  // Where the Plan tab is: view is list | plan | session | pick | library | exercise.
  plan: { view: 'list', planId: null, sessionKey: null, mode: null, slotIndex: null, exerciseId: null }
};

function syncToday() {
  const dateKey = localDateKey(new Date());
  const todayDayKey = scheduledKey(state, weekdayOf(dateKey));
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

// rerender: false is for edits made in place, where the input already shows the
// new value and rebuilding the view would steal focus from the next field.
function commit(next, { rerender = true } = {}) {
  state = next;
  const result = save(state);
  if (!result.ok) toast('Could not save — device storage may be full.');
  reconcileDay();
  if (rerender) render();
}

// Plan edits can move today's session or switch plans entirely. Keep the
// Workout tab on a session of the active plan; a deliberate pick of another
// session in the same plan, or of rest, is left alone.
function reconcileDay() {
  ui.todayDayKey = scheduledKey(state, weekdayOf(ui.dateKey));
  if (ui.dayKey === REST_DAY_KEY) return;
  if (!activePlan(state).sessions.some((s) => s.key === ui.dayKey)) ui.dayKey = ui.todayDayKey;
}

// The rest timer is outside `state`: it is per-device, never backed up, and
// updating it must not re-render the view.
let restTimer = loadTimer();

const timerBar = createTimerBar(document.getElementById('timer-bar'), {
  onAdjust: (deltaSec) => setRestTimer(adjustTimer(restTimer, deltaSec, Date.now())),
  onSkip: () => setRestTimer(null),
  // The bar finished on its own and is showing "Rest over"; just forget it.
  onDone: () => {
    restTimer = null;
    saveTimer(null);
  }
});

function setRestTimer(next) {
  restTimer = next;
  saveTimer(restTimer);
  timerBar.show(restTimer);
}

const actions = {
  toast,

  startRest(exercise) {
    unlockAudio();
    setRestTimer(startTimer(exercise.restSec, Date.now(), exercise.name));
  },

  setDayKey(dayKey) {
    ui.dayKey = dayKey;
    render();
  },

  addSet(exerciseId, set) {
    commit(addSet(state, ui.dateKey, ui.dayKey, exerciseId, set));
    const sets = setsFor(state, ui.dateKey, ui.dayKey, exerciseId);
    const current = { dateKey: ui.dateKey, dayKey: ui.dayKey };
    const record = recordsInSession(state, exerciseId, current, sets).at(-1);
    if (record) toast(`🏆 New PR — ${RECORD_LABELS[record].toLowerCase()}`);
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

  saveQuickAdd(quickAdd, options) {
    commit(upsertQuickAdd(state, quickAdd), options);
  },

  deleteQuickAdd(id) {
    commit(removeQuickAdd(state, id));
  },

  setTarget(grams, options) {
    commit(setProteinTarget(state, grams), options);
  },

  selectFood(foodId) {
    ui.food = { selectedId: foodId, adding: false };
    render();
  },

  toggleFoodForm() {
    ui.food = { selectedId: null, adding: !ui.food.adding };
    render();
  },

  logFood(foodId, amount) {
    const before = dayTotal(state, ui.dateKey);
    ui.food = { selectedId: null, adding: false };
    commit(logFood(state, ui.dateKey, foodId, amount, Date.now()));
    toast(`+${dayTotal(state, ui.dateKey) - before} g protein`);
  },

  toggleQuickAddEditor() {
    ui.editingQuickAdds = !ui.editingQuickAdds;
    render();
  },

  // Applies a pure state → state edit (from src/core) and returns the new state,
  // so a field saved without re-rendering can show the normalised value.
  change(fn, options) {
    const next = fn(state);
    if (next !== state) commit(next, options);
    return state;
  },

  historyNav(patch) {
    Object.assign(ui.history, patch);
    render({ resetScroll: true });
  },

  planNav(patch) {
    Object.assign(ui.plan, patch);
    render({ resetScroll: true });
  },

  replaceState(next) {
    ui.plan.view = 'list';
    commit(next);
    toast('Backup restored.');
  }
};

// Re-rendering replaces the whole view, which collapses the page height and drops
// the scroll position to 0. Logging a set halfway down a session must not throw you
// back to the top, so restore the offset unless the caller asked for a reset.
function render({ resetScroll = false } = {}) {
  const scrollY = window.scrollY;
  const ctx = { state, ui, actions, storageBytes };

  if (ui.tab === 'workout') {
    titleEl.textContent = ui.history.view ? 'History' : resolveSession(state, ui.dayKey).name;
  } else titleEl.textContent = TITLES[ui.tab];
  dateEl.textContent = formatHuman(ui.dateKey);

  for (const tab of tabs) {
    if (tab.dataset.tab === ui.tab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  if (ui.tab === 'workout' && ui.history.view) renderHistory(view, ctx);
  else if (ui.tab === 'workout') renderWorkout(view, ctx);
  else if (ui.tab === 'plan') renderPlan(view, ctx);
  else if (ui.tab === 'protein') renderProtein(view, ctx);
  else renderBackup(view, ctx);

  window.scrollTo(0, resetScroll ? 0 : scrollY);
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    // Tapping Workout while in History goes back to today's workout.
    if (ui.tab === tab.dataset.tab) {
      if (ui.tab === 'workout' && ui.history.view) actions.historyNav({ view: null });
      return;
    }
    ui.tab = tab.dataset.tab;
    ui.editingQuickAdds = false;
    render({ resetScroll: true });
  });
}

// Coming back to the app after midnight must not keep logging into yesterday.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (syncToday()) render();
});

syncToday();
render();

// A rest that ended while the app was closed: alert if it was recent,
// otherwise drop it quietly.
if (restTimer && isStale(restTimer, Date.now())) setRestTimer(null);
else timerBar.show(restTimer);

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
