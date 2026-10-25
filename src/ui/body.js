// Body tab: today's weigh-in, the weekly trend, calories and the expenditure
// estimate, and the log. Calculations live in src/core/bodyweight.js and
// src/core/energy.js.

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
import {
  ACTIVITY_LEVELS,
  GOALS,
  MIN_DAYS,
  MIN_INTAKE_DAYS,
  MIN_WEIGH_INS,
  calorieTarget,
  caloriesOn,
  estimateTdee,
  isPlausibleCalories,
  logCalories,
  normalizeGoal,
  normalizeProfile,
  setGoal,
  setProfile
} from '../core/energy.js';
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

const kcalText = (kcal) => `${kcal.toLocaleString()} kcal`;

function progressText(estimate) {
  const needs = [
    estimate.days < MIN_DAYS ? `${MIN_DAYS - estimate.days} more days` : null,
    estimate.intakeDays < MIN_INTAKE_DAYS ? `${MIN_INTAKE_DAYS - estimate.intakeDays} more days of calories` : null,
    estimate.weighIns < MIN_WEIGH_INS ? `${MIN_WEIGH_INS - estimate.weighIns} more weigh-ins` : null
  ].filter(Boolean);
  return needs.length ? `${needs.join(', ')} to go` : 'weigh in across at least a week';
}

function estimateStats(estimate, term) {
  return el('dl', { class: 'stat-grid', style: 'margin-top: 12px' }, [
    stat(term, `${kcalText(estimate.kcal)}/day`),
    stat('Likely range', `${estimate.low.toLocaleString()}–${estimate.high.toLocaleString()}`)
  ]);
}

const signedKg = (kg) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${Math.abs(kg)} kg`;

// Measured weekly change vs the goal's: within 0.2 kg a week counts as on
// track. Off track may just mean the goal is new, so the advice waits for that.
function trackText(estimate, target) {
  if (estimate.status !== 'ready') return '';
  const lately = signedKg(estimate.weeklyChangeKg);
  if (Math.abs(estimate.weeklyChangeKg - target.weeklyChangeKg) <= 0.2) return ` You’re on track: ${lately} a week.`;
  return ` Lately ${lately} a week. If you’ve eaten to this target for 2+ weeks and it’s still off, check your log is complete.`;
}

function goalBlock(ctx, estimate) {
  const { state, actions } = ctx;
  const goal = normalizeGoal(state.settings.goal);
  const buttons = el(
    'div',
    { class: 'add-row', role: 'group', 'aria-label': 'Goal' },
    Object.entries(GOALS).map(([key, { label }]) =>
      el(
        'button',
        {
          type: 'button',
          class: key === goal ? 'primary' : 'ghost',
          'aria-pressed': String(key === goal),
          style: 'flex: 1',
          onclick: () => actions.change((s) => setGoal(s, key))
        },
        label
      )
    )
  );
  const latest = latestWeight(state);
  if (!goal || !latest) {
    return el('div', { style: 'margin-top: 12px' }, [
      buttons,
      el('p', { class: 'meta', style: 'margin-top: 8px' }, 'Pick a goal for a daily calorie target.')
    ]);
  }
  const target = calorieTarget(estimate.kcal, goal, latest.kg);
  const change =
    target.delta === 0
      ? 'Eat your burn to hold your weight.'
      : `${target.delta > 0 ? '+' : '−'}${Math.abs(target.delta).toLocaleString()} kcal vs your burn, for about ${signedKg(target.weeklyChangeKg)} a week.`;
  return el('div', { style: 'margin-top: 12px' }, [
    buttons,
    el('dl', { class: 'stat-grid', style: 'margin-top: 12px' }, [stat('Daily target', kcalText(target.kcal))]),
    el('p', { class: 'meta', style: 'margin-top: 8px' }, `${change}${trackText(estimate, target)}`)
  ]);
}

function estimateBlock(ctx) {
  const { state, ui } = ctx;
  const todayKey = ui.dateKey;
  const estimate = estimateTdee(state, todayKey);
  if (estimate.status === 'collecting') {
    const hint = normalizeProfile(state.settings.profile)
      ? 'Weigh in to see a starting estimate.'
      : 'Fill in your details below for a starting estimate now.';
    return el(
      'p',
      { class: 'empty-note', style: 'margin-top: 12px' },
      `Measured burn appears after two weeks of calories and weigh-ins — ${progressText(estimate)}. ${hint}`
    );
  }
  if (estimate.status === 'formula') {
    return el('div', {}, [
      estimateStats(estimate, 'Starting estimate'),
      el(
        'p',
        { class: 'meta', style: 'margin-top: 8px' },
        `From your details and latest weight. Your log replaces it as data builds up — ${progressText(estimate)}.`
      ),
      goalBlock(ctx, estimate)
    ]);
  }
  const asOf = estimate.asOf === todayKey ? '' : ` Up to your last weigh-in, ${formatRelative(estimate.asOf, todayKey)}.`;
  const blend =
    estimate.formulaShare >= 0.05 ? ` Still ${Math.round(estimate.formulaShare * 100)}% from your starting estimate.` : '';
  return el('div', {}, [
    estimateStats(estimate, 'Estimated burn'),
    el(
      'p',
      { class: 'meta', style: 'margin-top: 8px' },
      `From ${estimate.intakeDays} days of calories and ${estimate.weighIns} weigh-ins in the last 4 weeks.${blend}${asOf}`
    ),
    goalBlock(ctx, estimate)
  ]);
}

function selectEl(id, options, selected) {
  return el(
    'select',
    { id },
    options.map(([value, label]) => el('option', { value, selected: value === selected }, label))
  );
}

function profileForm(ctx) {
  const { state, actions } = ctx;
  const profile = normalizeProfile(state.settings.profile);
  const sex = selectEl('profile-sex', [['male', 'Male'], ['female', 'Female']], profile?.sex ?? 'male');
  const height = el('input', {
    type: 'number',
    id: 'profile-height',
    inputmode: 'numeric',
    min: '120',
    max: '230',
    placeholder: 'cm',
    value: profile ? String(profile.heightCm) : ''
  });
  const birthYear = el('input', {
    type: 'number',
    id: 'profile-birth-year',
    inputmode: 'numeric',
    min: '1920',
    placeholder: 'e.g. 2004',
    value: profile ? String(profile.birthYear) : ''
  });
  const activity = selectEl(
    'profile-activity',
    Object.entries(ACTIVITY_LEVELS).map(([key, level]) => [key, level.label]),
    profile?.activity ?? 'moderate'
  );

  const save = () => {
    const raw = { sex: sex.value, heightCm: numberValue(height), birthYear: numberValue(birthYear), activity: activity.value };
    if (!normalizeProfile(raw)) {
      actions.toast('Enter your height in cm and the year you were born.');
      return;
    }
    actions.change((s) => setProfile(s, raw));
    actions.toast('Saved your details.');
  };

  const field = (id, label, input) => el('div', { class: 'field' }, [el('label', { for: id }, label), input]);
  return el('details', { class: 'profile-details', open: !profile, style: 'margin-top: 12px' }, [
    el('summary', {}, 'Your details (for the starting estimate)'),
    el('div', { class: 'add-row' }, [field('profile-sex', 'Sex', sex), field('profile-height', 'Height (cm)', height)]),
    el('div', { class: 'add-row' }, [
      field('profile-birth-year', 'Born in', birthYear),
      field('profile-activity', 'Activity', activity)
    ]),
    el('button', { type: 'button', class: 'primary wide', style: 'margin-top: 12px', onclick: save }, 'Save details')
  ]);
}

function energyCard(ctx) {
  const { state, ui, actions } = ctx;
  const today = caloriesOn(state, ui.dateKey);
  const input = el('input', {
    type: 'number',
    id: 'calories-today',
    inputmode: 'numeric',
    min: '0',
    max: '15000',
    step: '10',
    placeholder: 'kcal',
    value: today === null ? '' : String(today)
  });

  const submit = () => {
    const kcal = numberValue(input);
    if (kcal === null || !isPlausibleCalories(kcal)) {
      input.focus();
      actions.toast('Enter today’s calories in kcal.');
      return;
    }
    const next = actions.change((s) => logCalories(s, ui.dateKey, kcal));
    actions.toast(`Saved ${kcalText(next.calories[ui.dateKey])} for today.`);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  return card(null, [
    el('h3', {}, 'Energy'),
    el('div', { class: 'add-row', style: 'margin-top: 0' }, [
      el('div', { class: 'field' }, [el('label', { for: 'calories-today' }, 'Calories today (kcal)'), input]),
      el('button', { type: 'button', class: 'primary add-set', onclick: submit }, today === null ? 'Save' : 'Update')
    ]),
    el(
      'p',
      { class: 'meta', style: 'margin-top: 8px' },
      'Your day’s total from your food app or labels. Skip days you didn’t track rather than guessing.'
    ),
    estimateBlock(ctx),
    profileForm(ctx)
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
  root.append(todayCard(ctx), trendCard(ctx), energyCard(ctx), logCard(ctx));
}
