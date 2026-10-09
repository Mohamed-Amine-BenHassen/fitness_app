// History, inside the Workout tab and read-only: sessions newest first → one
// session's sets → one exercise across time. Data comes from src/core/history.js.

import { exerciseLog, sessionDetail, sessionSummaries } from '../core/history.js';
import { RECORD_LABELS } from '../core/records.js';
import { formatHuman, formatRelative } from '../core/dates.js';
import { formatSet } from '../core/sets.js';
import { card, clear, el } from './dom.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "· 3 days ago" for recent sessions; older ones already read fine as a date.
function relative(dateKey, todayKey) {
  const text = formatRelative(dateKey, todayKey);
  return text === formatHuman(dateKey) ? null : el('span', { class: 'entry-time' }, ` · ${text}`);
}

function backButton(label, onclick) {
  return el('button', { type: 'button', class: 'ghost back', onclick }, `‹ ${label}`);
}

function setList(sets, bodyweightOnly) {
  return el(
    'ul',
    { class: 'set-list' },
    sets.map((set, index) =>
      el('li', { class: 'set-row' }, [
        el('span', { class: 'set-index' }, index + 1),
        el('span', { class: 'set-value' }, formatSet(set, bodyweightOnly)),
        set.record ? el('span', { class: 'pr' }, `🏆 ${RECORD_LABELS[set.record]}`) : null
      ])
    )
  );
}

function renderList(root, ctx) {
  const { state, ui, actions } = ctx;
  const sessions = sessionSummaries(state);
  root.append(backButton('Today’s workout', () => actions.historyNav({ view: null })));

  if (sessions.length === 0) {
    root.append(card(null, [el('p', { class: 'empty-note' }, 'Nothing logged yet. Your sessions will show up here.')]));
    return;
  }
  root.append(
    el(
      'ul',
      { class: 'history-list' },
      sessions.map((s) =>
        el('li', {}, [
          el(
            'button',
            { type: 'button', onclick: () => actions.historyNav({ view: 'session', dateKey: s.dateKey, dayKey: s.dayKey }) },
            [
              el('span', { class: 'history-date' }, [formatHuman(s.dateKey), relative(s.dateKey, ui.dateKey)]),
              el('span', { class: 'history-name' }, s.name),
              el('span', { class: 'meta' }, [
                `${plural(s.exerciseCount, 'exercise')} · ${plural(s.setCount, 'set')}`,
                s.prCount ? el('span', { class: 'note' }, ` · 🏆 ${s.prCount}`) : null
              ])
            ]
          )
        ])
      )
    )
  );
}

function renderSession(root, ctx) {
  const { state, ui, actions } = ctx;
  const detail = sessionDetail(state, ui.history.dateKey, ui.history.dayKey);
  if (!detail) return renderList(root, ctx);

  root.append(
    backButton('History', () => actions.historyNav({ view: 'list' })),
    card(null, [el('h2', {}, detail.name), el('p', { class: 'meta' }, formatHuman(detail.dateKey))]),
    ...detail.exercises.map((exercise) =>
      card(null, [
        el('h2', {}, [
          el(
            'button',
            {
              type: 'button',
              class: 'name-link',
              onclick: () => actions.historyNav({ view: 'exercise', exerciseId: exercise.id, from: 'session' })
            },
            exercise.name
          )
        ]),
        setList(exercise.sets, exercise.bodyweightOnly)
      ])
    )
  );
}

function stat(term, value) {
  return el('div', { class: 'stat' }, [el('dt', {}, term), el('dd', {}, value)]);
}

function renderExercise(root, ctx) {
  const { state, ui, actions } = ctx;
  const log = exerciseLog(state, ui.history.exerciseId);
  const fromSession = ui.history.from === 'session';
  const { allTime } = log;

  root.append(
    backButton(fromSession ? 'Session' : 'History', () => actions.historyNav({ view: fromSession ? 'session' : 'list' })),
    card(null, [
      el('h2', {}, log.name),
      el('dl', { class: 'stat-grid', style: 'margin-top: 10px' }, [
        log.bodyweightOnly ? null : stat('Heaviest', allTime.heaviest === null ? '—' : `${allTime.heaviest} kg`),
        // e1RM only exists for sets of 12 reps or fewer; high-rep exercises skip it.
        allTime.e1rm === null ? null : stat('Best e1RM', `${allTime.e1rm} kg`),
        stat('Most reps', String(allTime.mostReps)),
        stat('Sessions', String(log.sessions.length))
      ])
    ]),
    ...log.sessions.map((s) =>
      card(null, [
        el('p', { class: 'history-date' }, [
          formatHuman(s.dateKey),
          el('span', { class: 'entry-time' }, ` · ${s.sessionName}`)
        ]),
        setList(s.sets, log.bodyweightOnly)
      ])
    )
  );
}

export function renderHistory(root, ctx) {
  clear(root);
  const { view } = ctx.ui.history;
  if (view === 'session') return renderSession(root, ctx);
  if (view === 'exercise') return renderExercise(root, ctx);
  return renderList(root, ctx);
}
