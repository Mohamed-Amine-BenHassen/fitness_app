// Workout tab: session picker, today's exercises, set logging with a last-time
// reference line. All calculations come from src/core; this file only renders.

import { formatPrescription, formatRest } from '../core/program.js';
import { activePlan, liveSessions, resolveSession, sessionName } from '../core/plans.js';
import { formatRelative } from '../core/dates.js';
import { formatSet, formatSets, lastPerformance, setsFor } from '../core/sets.js';
import { RECORD_LABELS, compareSets, recordsInSession } from '../core/records.js';
import { suggestNext } from '../core/progression.js';
import { sessionId } from '../core/schema.js';
import { card, clear, el, numberValue } from './dom.js';
import { openTechnique } from './technique.js';

function sessionPicker(ctx) {
  const { state, ui, actions } = ctx;
  const keys = liveSessions(activePlan(state)).map((s) => s.key);
  // A session picked before it was archived (or from another plan) stays listed
  // so the select can still show it.
  if (ui.dayKey !== 'rest' && !keys.includes(ui.dayKey)) keys.push(ui.dayKey);
  const options = [...keys, 'rest'].map((key) => {
    const session = resolveSession(state, key);
    const label = session.focus ? `${session.name} — ${session.focus}` : session.name;
    const suffix = key === ui.todayDayKey ? ' (today)' : '';
    return el('option', { value: key }, `${label}${suffix}`);
  });

  const select = el(
    'select',
    {
      id: 'session-select',
      // Chrome restores form state across reloads; without this the picker can
      // drift away from ui.dayKey after a refresh.
      autocomplete: 'off',
      onchange: (event) => actions.setDayKey(event.target.value)
    },
    options
  );
  // Set after insertion so the selection is the rendered state, not a hint.
  select.value = ui.dayKey;

  return el('div', { class: 'picker' }, [el('label', { for: 'session-select' }, 'Session'), select]);
}

function restCard(ctx) {
  const { state, ui } = ctx;
  const isRest = ui.dayKey === 'rest';
  const planEmpty = liveSessions(activePlan(state)).length === 0;
  let message = 'No exercises in this session yet. Add them in the Plan tab.';
  if (isRest && planEmpty) message = 'This plan has no sessions yet. Build one in the Plan tab.';
  else if (isRest && ui.dayKey === ui.todayDayKey) {
    message = 'Nothing scheduled. Pick a session above to log a make-up workout.';
  } else if (isRest) message = 'Pick a session above to log a workout.';
  return card('rest-card', [el('h2', {}, isRest ? 'Rest day' : 'Empty session'), el('p', {}, message)]);
}

function lastLine(exercise, ctx) {
  const { state, ui } = ctx;
  const last = lastPerformance(state, exercise.id, { dateKey: ui.dateKey, dayKey: ui.dayKey });
  if (!last) {
    return el('p', { class: 'last empty' }, 'No history yet — this is the baseline.');
  }
  const when = formatRelative(last.dateKey, ui.dateKey);
  const where = sessionName(state, last.dayKey);
  return el('p', { class: 'last' }, [
    `Last time (${when}, ${where}): `,
    el('strong', {}, formatSets(last.sets, exercise.bodyweightOnly))
  ]);
}

// Double-progression target for today, from last time's sets.
function nextLine(exercise, ctx) {
  const { state, ui } = ctx;
  const next = suggestNext(state, exercise, { dateKey: ui.dateKey, dayKey: ui.dayKey });
  if (!next) return null;
  const target = next.weightKg === null ? `${next.reps} reps` : `${next.weightKg} kg × ${next.reps}`;
  return el('p', { class: 'next' }, [el('strong', {}, `Next: ${target}`), ` · ${next.reason}`]);
}

const TREND = { up: ['▲', 'better than last time'], same: ['=', 'same as last time'], down: ['▼', 'below last time'] };

function loggedSets(exercise, ctx) {
  const { state, ui, actions } = ctx;
  const sets = setsFor(state, ui.dateKey, ui.dayKey, exercise.id);
  if (sets.length === 0) return null;

  const current = { dateKey: ui.dateKey, dayKey: ui.dayKey };
  const records = recordsInSession(state, exercise.id, current, sets);
  const previous = lastPerformance(state, exercise.id, current)?.sets || [];

  return el(
    'ul',
    { class: 'set-list' },
    sets.map((set, index) => {
      const trend = compareSets(set, previous[index]);
      const record = records[index];
      return el('li', { class: 'set-row' }, [
        el('span', { class: 'set-index' }, index + 1),
        el('span', { class: 'set-value' }, [
          formatSet(set, exercise.bodyweightOnly),
          trend
            ? el('span', { class: `trend ${trend}`, title: TREND[trend][1], 'aria-label': TREND[trend][1] }, ` ${TREND[trend][0]}`)
            : null
        ]),
        record ? el('span', { class: 'pr', title: RECORD_LABELS[record] }, `🏆 ${RECORD_LABELS[record]}`) : null,
        el(
          'button',
          {
            type: 'button',
            class: 'icon',
            'aria-label': `Delete set ${index + 1} of ${exercise.name}`,
            onclick: () => actions.removeSet(exercise.id, index)
          },
          '×'
        )
      ]);
    })
  );
}

// Prefill from today's last set if there is one (repeat or nudge it), otherwise
// from the progression suggestion for this session.
function prefillFor(exercise, ctx) {
  const { state, ui } = ctx;
  const today = setsFor(state, ui.dateKey, ui.dayKey, exercise.id);
  if (today.length > 0) return today[today.length - 1];
  const next = suggestNext(state, exercise, { dateKey: ui.dateKey, dayKey: ui.dayKey });
  if (next) return next;
  return { weightKg: null, reps: null };
}

function addRow(exercise, ctx) {
  const prefill = prefillFor(exercise, ctx);
  const shown = (value) => (value === null || value === undefined ? '' : String(value));

  const repsInput = el('input', {
    type: 'number',
    id: `reps-${exercise.id}`,
    inputmode: 'numeric',
    min: '0',
    step: '1',
    placeholder: String(exercise.repRange.min),
    value: shown(prefill.reps)
  });

  const weightInput = exercise.bodyweightOnly
    ? null
    : el('input', {
        type: 'number',
        id: `weight-${exercise.id}`,
        inputmode: 'decimal',
        min: '0',
        step: '0.5',
        placeholder: 'kg',
        value: shown(prefill.weightKg)
      });

  const inputs = [weightInput, repsInput].filter(Boolean);
  const markDirty = (event) => {
    event.target.dataset.dirty = '';
  };
  for (const input of inputs) input.addEventListener('input', markDirty);

  const submit = () => {
    const reps = numberValue(repsInput);
    if (reps === null || reps <= 0) {
      repsInput.focus();
      ctx.actions.toast('Enter reps first.');
      return;
    }
    // Logged values are no longer a draft; the re-render prefills from this set.
    for (const input of inputs) delete input.dataset.dirty;
    ctx.actions.addSet(exercise.id, {
      weightKg: weightInput ? numberValue(weightInput) : null,
      reps
    });
  };

  const onEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  repsInput.addEventListener('keydown', onEnter);
  if (weightInput) weightInput.addEventListener('keydown', onEnter);

  return el('div', { class: 'add-row' }, [
    weightInput
      ? el('div', { class: 'field' }, [el('label', { for: weightInput.id }, 'Weight'), weightInput])
      : null,
    el('div', { class: 'field' }, [el('label', { for: repsInput.id }, 'Reps'), repsInput]),
    el('button', { type: 'button', class: 'primary add-set', onclick: submit }, 'Add set')
  ]);
}

function exerciseCard(exercise, ctx) {
  const logged = setsFor(ctx.state, ctx.ui.dateKey, ctx.ui.dayKey, exercise.id).length;
  const meta = [formatPrescription(exercise), logged > 0 ? `${logged} logged` : null]
    .filter(Boolean)
    .join(' · ');

  return card(null, [
    el('div', { class: 'card-head' }, [
      el('h2', {}, [
        el(
          'button',
          {
            type: 'button',
            class: 'name-link',
            'aria-haspopup': 'dialog',
            onclick: () => openTechnique(exercise)
          },
          exercise.name
        )
      ]),
      exercise.anchor ? el('span', { class: 'badge' }, 'anchor') : null
    ]),
    el('p', { class: 'meta' }, [
      meta,
      exercise.note ? el('span', { class: 'note' }, ` · ${exercise.note}`) : null
    ]),
    lastLine(exercise, ctx),
    nextLine(exercise, ctx),
    loggedSets(exercise, ctx),
    addRow(exercise, ctx),
    el(
      'button',
      { type: 'button', class: 'ghost wide rest-start', onclick: () => ctx.actions.startRest(exercise) },
      `Start rest · ${formatRest(exercise.restSec)}`
    )
  ]);
}

// Every render rebuilds all cards, so numbers typed into one exercise but not yet
// logged would reset when a set is added to another. Carry those drafts over —
// but only within the same session, so they never leak into a different day.
function captureDrafts(root, key) {
  if (root.dataset.session !== key) return [];
  return [...root.querySelectorAll('input[data-dirty]')].map((input) => [input.id, input.value]);
}

function restoreDrafts(drafts) {
  for (const [id, value] of drafts) {
    const input = document.getElementById(id);
    if (!input) continue;
    input.value = value;
    input.dataset.dirty = '';
  }
}

export function renderWorkout(root, ctx) {
  const key = sessionId(ctx.ui.dateKey, ctx.ui.dayKey);
  const drafts = captureDrafts(root, key);
  clear(root);
  root.dataset.session = key;
  root.append(sessionPicker(ctx));

  const session = resolveSession(ctx.state, ctx.ui.dayKey);
  if (session.exercises.length === 0) {
    root.append(restCard(ctx));
    return;
  }

  for (const exercise of session.exercises) {
    root.append(exerciseCard(exercise, ctx));
  }
  restoreDrafts(drafts);
}
