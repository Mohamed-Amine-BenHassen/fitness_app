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
  trendOn,
  trendSeries,
  trendWeeklyChange,
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
  removeCalories,
  setGoal,
  setProfile
} from '../core/energy.js';
import { dayMacros } from '../core/nutrition.js';
import {
  MAX_CHECK_IN_STEP,
  SPLITS,
  applyCheckIn,
  checkInDue,
  dailyTargets,
  proposeCheckIn,
  setSplit
} from '../core/targets.js';
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
  const trend = trendOn(state, ui.dateKey);
  const change = trendWeeklyChange(state, ui.dateKey);
  const perKg = proteinPerKg(state);
  // Neutral on purpose: whether gaining or losing is good depends on your goal.
  const changeText = change === null ? '—' : `${signedKg(change)} / week`;
  const gap = trend ? Math.round((latest.kg - trend.trendKg) * 10) / 10 : 0;

  return card(null, [
    el('h3', {}, 'Trend'),
    el('dl', { class: 'stat-grid' }, [
      stat('Latest', `${latest.kg} kg`),
      stat('Trend weight', trend ? `${trend.trendKg.toFixed(1)} kg` : '—'),
      stat('Trend change', changeText),
      stat('7-day average', average === null ? '—' : `${average} kg`),
      stat('Protein target', perKg === null ? '—' : `${perKg} g/kg`)
    ]),
    el(
      'p',
      { class: 'meta', style: 'margin-top: 8px' },
      change === null
        ? 'The trend change needs weigh-ins at least a week apart.'
        : Math.abs(gap) >= 0.5
          ? `Today’s scale is ${signedKg(gap)} off the trend — mostly water and food in the gut, not fat.`
          : 'The trend smooths out day-to-day swings from water and food.'
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
  // Rates scale with the trend weight, so a water spike doesn't move the target.
  const trend = trendOn(state, ctx.ui.dateKey);
  const today = dailyTargets(state, ctx.ui.dateKey);
  if (!goal || !trend || !today) {
    return el('div', { style: 'margin-top: 12px' }, [
      buttons,
      el('p', { class: 'meta', style: 'margin-top: 8px' }, 'Pick a goal for a daily calorie target.')
    ]);
  }
  const target = calorieTarget(estimate.kcal, goal, trend.trendKg);
  const change =
    target.delta === 0
      ? 'Eat your burn to hold your weight.'
      : `Aiming ${target.delta > 0 ? '+' : '−'}${Math.abs(target.delta).toLocaleString()} kcal vs your burn, for about ${signedKg(target.weeklyChangeKg)} a week.`;
  const split =
    today.kcal === today.averageKcal
      ? ''
      : ` ${today.restDay ? 'Rest' : 'Training'} day: ${kcalText(today.kcal)} of a ${kcalText(today.averageKcal)} weekly average.`;
  const locked = today.provisional
    ? ' Check in to fix this target for the week.'
    : ` Set at your check-in ${formatRelative(today.checkIn.dateKey, ctx.ui.dateKey)}.`;
  return el('div', { style: 'margin-top: 12px' }, [
    buttons,
    checkInBox(ctx),
    el('dl', { class: 'stat-grid', style: 'margin-top: 12px' }, [
      stat('Today’s target', kcalText(today.kcal)),
      stat('Protein', `${today.protein} g`),
      stat('Fat', `${today.fat} g`),
      stat('Carbs', `${today.carbs} g`)
    ]),
    el('p', { class: 'meta', style: 'margin-top: 8px' }, `${change}${split}${locked}${trackText(estimate, target)}`),
    splitButtons(ctx)
  ]);
}

// Same calories every day, or more on training days and less on rest days.
function splitButtons(ctx) {
  const { state, actions } = ctx;
  const current = state.settings.calorieSplit;
  return el(
    'div',
    { class: 'add-row', role: 'group', 'aria-label': 'Calories across the week', style: 'margin-top: 12px' },
    Object.entries(SPLITS).map(([key, label]) =>
      el(
        'button',
        {
          type: 'button',
          class: key === current ? 'primary' : 'ghost',
          'aria-pressed': String(key === current),
          style: 'flex: 1',
          onclick: () => actions.change((s) => setSplit(s, key))
        },
        label
      )
    )
  );
}

// The weekly check-in: what changed since the last one, and the proposed target.
function checkInBox(ctx) {
  const { state, ui, actions } = ctx;
  if (!checkInDue(state, ui.dateKey)) return null;
  const proposal = proposeCheckIn(state, ui.dateKey);
  const previous = proposal.previous && proposal.previous.goal === proposal.goal ? proposal.previous : null;
  const diff = (now, before, unit) => {
    const d = Math.round((now - before) * 100) / 100;
    return d === 0 ? ' (no change)' : ` (${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString()}${unit})`;
  };
  const lines = [
    `Burn ${kcalText(proposal.burnKcal)}${previous ? diff(proposal.burnKcal, previous.burnKcal, '') : ''}`,
    `Trend weight ${proposal.trendKg.toFixed(1)} kg${previous ? diff(proposal.trendKg, previous.trendKg, ' kg') : ''}`,
    `New daily target ${kcalText(proposal.kcal)}${previous ? `, was ${kcalText(previous.kcal)}` : ''}`
  ];
  return el('div', { class: 'check-in', style: 'margin-top: 12px' }, [
    el('strong', {}, previous ? 'Weekly check-in' : 'First check-in'),
    el('ul', { class: 'check-in-list' }, lines.map((line) => el('li', {}, line))),
    proposal.capped
      ? el('p', { class: 'meta' }, `Moved ${MAX_CHECK_IN_STEP} kcal this week, not all the way — one week’s data is noisy.`)
      : null,
    el(
      'button',
      {
        type: 'button',
        class: 'primary wide',
        style: 'margin-top: 10px',
        onclick: () => {
          actions.change((s) => applyCheckIn(s, ui.dateKey));
          actions.toast(`Target set: ${kcalText(proposal.kcal)} a day until next week.`);
        }
      },
      'Apply new target'
    )
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
  const logged = dayMacros(state, ui.dateKey).kcal;
  const input = el('input', {
    type: 'number',
    id: 'calories-today',
    inputmode: 'numeric',
    min: '0',
    max: '15000',
    step: '10',
    placeholder: logged === null ? 'kcal' : String(logged),
    value: today === null ? '' : String(today)
  });
  const source =
    today !== null && logged !== null
      ? el('p', { class: 'meta', style: 'margin-top: 8px' }, [
          `Using your typed total instead of the food log (${kcalText(logged)}). `,
          el(
            'button',
            { type: 'button', class: 'ghost', onclick: () => actions.change((s) => removeCalories(s, ui.dateKey)) },
            'Use food log'
          )
        ])
      : el(
          'p',
          { class: 'meta', style: 'margin-top: 8px' },
          logged !== null
            ? `From your food log so far: ${kcalText(logged)}. Type a total only for a day you tracked somewhere else.`
            : 'Log food on the Food tab, or type the day’s total from another app. Skip days you didn’t track rather than guessing.'
        );

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
    source,
    estimateBlock(ctx),
    profileForm(ctx)
  ]);
}

function logCard(ctx) {
  const { state, ui, actions } = ctx;
  const entries = weighIns(state).slice(0, LOG_LIMIT);
  const trendBy = new Map(trendSeries(state).map((p) => [p.dateKey, p.trendKg]));
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
              el('span', { class: 'entry-grams' }, [
                `${kg} kg`,
                el('span', { class: 'entry-kcal' }, ` → ${trendBy.get(dateKey).toFixed(1)}`)
              ]),
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
