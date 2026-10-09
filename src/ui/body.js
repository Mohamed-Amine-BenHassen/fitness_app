// Body tab: today's weigh-in, the weekly trend and the log. Calculations live
// in src/core/bodyweight.js.

import {
  averageOver,
  isPlausibleWeight,
  latestWeight,
  logWeight,
  proteinPerKg,
  removeWeight,
  weeklyChange,
  weighIns
} from '../core/bodyweight.js';
import { formatHuman, formatRelative } from '../core/dates.js';
import { card, clear, el, numberValue } from './dom.js';

const LOG_LIMIT = 30;

function todayCard(ctx) {
  const { state, ui, actions } = ctx;
  const today = state.bodyweight[ui.dateKey];
  const latest = latestWeight(state);
  const input = el('input', {
    type: 'number',
    id: 'weigh-in',
    inputmode: 'decimal',
    min: '20',
    max: '400',
    step: '0.1',
    placeholder: latest ? String(latest.kg) : 'kg',
    value: today === undefined ? '' : String(today)
  });

  const submit = () => {
    const kg = numberValue(input);
    if (!isPlausibleWeight(kg)) {
      input.focus();
      actions.toast('Enter your weight in kg.');
      return;
    }
    const next = actions.change((s) => logWeight(s, ui.dateKey, kg));
    actions.toast(`Saved ${next.bodyweight[ui.dateKey]} kg for today.`);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  return card(null, [
    el('h3', {}, 'Today’s weigh-in'),
    el('div', { class: 'add-row', style: 'margin-top: 0' }, [
      el('div', { class: 'field' }, [el('label', { for: 'weigh-in' }, 'Weight (kg)'), input]),
      el('button', { type: 'button', class: 'primary add-set', onclick: submit }, today === undefined ? 'Save' : 'Update')
    ]),
    el(
      'p',
      { class: 'meta', style: 'margin-top: 8px' },
      'Same time each day is best — morning, after the bathroom, before eating.'
    )
  ]);
}

function stat(term, value) {
  return el('div', { class: 'stat' }, [el('dt', {}, term), el('dd', {}, value)]);
}

function trendCard(ctx) {
  const { state, ui } = ctx;
  const latest = latestWeight(state);
  if (!latest) {
    return card(null, [el('h3', {}, 'Trend'), el('p', { class: 'empty-note' }, 'Log a few weigh-ins to see your trend.')]);
  }
  const average = averageOver(state, ui.dateKey, 7);
  const change = weeklyChange(state, ui.dateKey);
  const perKg = proteinPerKg(state);
  // Neutral on purpose: whether gaining or losing is good depends on your goal.
  const changeText = change === null ? '—' : `${change > 0 ? '+' : ''}${change} kg`;

  return card(null, [
    el('h3', {}, 'Trend'),
    el('dl', { class: 'stat-grid' }, [
      stat('Latest', `${latest.kg} kg`),
      stat('7-day average', average === null ? '—' : `${average} kg`),
      stat('vs last week', changeText),
      stat('Protein target', perKg === null ? '—' : `${perKg} g/kg`)
    ]),
    el(
      'p',
      { class: 'meta', style: 'margin-top: 8px' },
      change === null
        ? 'The weekly change needs a weigh-in in each of the last two weeks.'
        : 'Averages smooth out day-to-day swings from water and food.'
    )
  ]);
}

function logCard(ctx) {
  const { state, ui, actions } = ctx;
  const entries = weighIns(state).slice(0, LOG_LIMIT);
  return card(null, [
    el('h3', {}, 'Log'),
    entries.length === 0
      ? el('p', { class: 'empty-note' }, 'No weigh-ins yet.')
      : el(
          'ul',
          { class: 'entry-list' },
          entries.map(({ dateKey, kg }) => {
            const when = formatRelative(dateKey, ui.dateKey);
            return el('li', { class: 'entry-row' }, [
              el('span', { class: 'entry-label' }, [
                formatHuman(dateKey),
                when === formatHuman(dateKey) ? null : el('span', { class: 'entry-time' }, ` · ${when}`)
              ]),
              el('span', { class: 'entry-grams' }, `${kg} kg`),
              el(
                'button',
                {
                  type: 'button',
                  class: 'icon',
                  'aria-label': `Delete weigh-in for ${formatHuman(dateKey)}`,
                  onclick: () => actions.change((s) => removeWeight(s, dateKey))
                },
                '×'
              )
            ]);
          })
        )
  ]);
}

export function renderBody(root, ctx) {
  clear(root);
  root.append(todayCard(ctx), trendCard(ctx), logCard(ctx));
}
