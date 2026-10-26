// Water card on the Food tab: a bottle that fills towards the day's goal, with
// pour buttons. Calculations live in src/core/water.js.
//
// The view is rebuilt on every change, so motion is handed across renders by
// hand: the bottle is drawn at the level last shown, then moved to the new
// level on the next frame, and a pour made in the last moment adds bubbles,
// a slosh and a count-up of the litres.

import { POURS, addWater, litres, setWaterGoal, waterGoal, waterOn } from '../core/water.js';
import { card, el, numberValue } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const POUR_FRESH_MS = 1500;
const COUNT_MS = 700;

// Bottle geometry (viewBox 0 0 120 240): water runs from y = 238 (empty —
// below the base, so not even the wave crests show) up to y = 64 (full, just
// under the shoulders).
const BODY =
  'M48 24 H72 V40 C72 52 102 58 102 80 V212 Q102 232 82 232 H38 Q18 232 18 212 V80 C18 58 48 52 48 40 Z';
const EMPTY_Y = 238;
const FULL_Y = 64;
// Two periods of a gentle wave, wide enough to slide one period sideways.
const WAVE = 'M0 0 Q15 -5 30 0 T60 0 T90 0 T120 0 T150 0 T180 0 T210 0 T240 0 V200 H0 Z';

// What the last render showed, and when the last pour happened, so the next
// render can animate from there.
let shown = { dateKey: null, ml: 0, ratio: 0 };
let lastPour = { at: 0, crossedGoal: false };

const svg = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
};

const levelY = (ratio) => EMPTY_Y - ratio * (EMPTY_Y - FULL_Y);

function nextFrame(fn) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(fn));
  else fn();
}

function bottle(fromRatio, toRatio, poured, full) {
  // Three layers, each with its own transform: the level rises, the group of
  // waves swells on a pour, and each wave drifts sideways.
  const water = svg('g', { class: 'water-level', style: `transform: translateY(${levelY(fromRatio)}px)` }, [
    svg('g', { class: 'waves' }, [
      svg('path', { class: 'wave wave-back', d: WAVE }),
      svg('path', { class: 'wave wave-front', d: WAVE })
    ])
  ]);
  const bubbles = poured
    ? Array.from({ length: 7 }, (_, i) =>
        svg('circle', {
          class: 'bubble',
          cx: String(30 + ((i * 37) % 60)),
          cy: '224',
          r: String(1.5 + (i % 3)),
          style: `animation-delay: ${i * 90}ms`
        })
      )
    : [];
  const ticks = [0.25, 0.5, 0.75].map((r) =>
    svg('line', { class: 'bottle-tick', x1: '90', x2: '98', y1: String(levelY(r)), y2: String(levelY(r)) })
  );
  const node = svg(
    'svg',
    {
      class: `bottle${poured ? ' poured' : ''}${full ? ' full' : ''}`,
      viewBox: '0 0 120 240',
      'aria-hidden': 'true'
    },
    [
      svg('defs', {}, [
        svg('clipPath', { id: 'bottle-clip' }, [svg('path', { d: BODY })]),
        svg('linearGradient', { id: 'water-fill', x1: '0', y1: '0', x2: '0', y2: '1' }, [
          svg('stop', { offset: '0', class: 'water-top' }),
          svg('stop', { offset: '1', class: 'water-deep' })
        ])
      ]),
      svg('rect', { class: 'bottle-cap', x: '44', y: '6', width: '32', height: '18', rx: '4' }),
      svg('path', { class: 'bottle-glass', d: BODY }),
      svg('g', { 'clip-path': 'url(#bottle-clip)' }, [water, ...bubbles]),
      ...ticks,
      svg('path', { class: 'bottle-shine', d: 'M28 92 Q26 150 30 206' }),
      svg('path', { class: 'bottle-outline', d: BODY })
    ]
  );
  nextFrame(() => {
    water.style.transform = `translateY(${levelY(toRatio)}px)`;
  });
  return node;
}

// The litres counting up (or down) from what was shown to the new amount.
function countUp(node, from, to) {
  if (from === to || typeof requestAnimationFrame !== 'function') {
    node.textContent = litres(to);
    return;
  }
  node.textContent = litres(from);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / COUNT_MS);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = litres(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function buzz(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

function goalEditor(ctx, goal) {
  const { actions } = ctx;
  const input = el('input', {
    type: 'number',
    id: 'water-goal',
    inputmode: 'decimal',
    min: '0.5',
    max: '8',
    step: '0.25',
    placeholder: 'L',
    value: String(goal.ml / 1000)
  });
  const save = () => {
    const l = numberValue(input);
    const next = l === null ? null : actions.change((s) => setWaterGoal(s, l * 1000));
    if (!next || next.settings.waterGoalMl === null) {
      actions.toast('Enter a goal between 0.5 and 8 litres.');
      return;
    }
    actions.toast(`Water goal: ${litres(next.settings.waterGoalMl)}.`);
  };
  return el('details', { class: 'profile-details', style: 'margin-top: 12px' }, [
    el('summary', {}, `Goal ${litres(goal.ml)}${goal.fromWeight ? ' · from your weight (35 ml per kg)' : ''}`),
    el('div', { class: 'add-row' }, [
      el('div', { class: 'field' }, [el('label', { for: 'water-goal' }, 'Daily goal (litres)'), input]),
      el('button', { type: 'button', class: 'primary add-set', onclick: save }, 'Save')
    ]),
    goal.fromWeight
      ? null
      : el(
          'button',
          { type: 'button', class: 'ghost', style: 'margin-top: 8px', onclick: () => actions.change((s) => setWaterGoal(s, null)) },
          'Use the goal from my weight'
        )
  ]);
}

export function waterCard(ctx) {
  const { state, ui, actions } = ctx;
  const ml = waterOn(state, ui.dateKey);
  const goal = waterGoal(state, ui.dateKey);
  const ratio = Math.min(1, ml / goal.ml);
  const full = ml >= goal.ml;
  const poured = Date.now() - lastPour.at < POUR_FRESH_MS;
  const from = shown.dateKey === ui.dateKey ? shown : { ml, ratio };

  const amount = el('div', { class: 'water-amount' });
  countUp(amount, from.ml, ml);
  shown = { dateKey: ui.dateKey, ml, ratio };

  // The pour is recorded before the change, because the change re-renders at
  // once and that render is the one that shows the bubbles and splash.
  const pour = (delta) => {
    const before = waterOn(state, ui.dateKey);
    const after = waterOn(addWater(state, ui.dateKey, delta), ui.dateKey);
    if (after === before) return;
    const crossed = before < goal.ml && after >= goal.ml;
    lastPour = { at: delta > 0 ? Date.now() : 0, crossedGoal: crossed };
    buzz(crossed ? [20, 60, 30] : 12);
    actions.change((s) => addWater(s, ui.dateKey, delta));
    if (crossed) actions.toast('Water goal reached 💧');
  };

  const left = Math.max(0, goal.ml - ml);
  const splash =
    poured && lastPour.crossedGoal
      ? el('div', { class: 'splash', 'aria-hidden': 'true' }, Array.from({ length: 8 }, () => el('span')))
      : null;
  return card(full ? 'water-card full' : 'water-card', [
    el('div', { class: 'water-layout' }, [
      el('div', { class: 'bottle-wrap' }, [bottle(from.ratio, ratio, poured, full), splash]),
      el('div', { class: 'water-side' }, [
        el('h3', {}, 'Water'),
        amount,
        el('p', { class: 'water-sub' }, full ? `Goal reached · ${litres(goal.ml)}` : `of ${litres(goal.ml)} · ${litres(left)} to go`),
        el('div', { class: 'pour-grid' }, [
          ...POURS.map((p) =>
            el('button', { type: 'button', class: 'pour', onclick: () => pour(p), 'aria-label': `Add ${p} ml of water` }, [
              el('span', { class: 'pour-plus' }, '+'),
              `${p} ml`
            ])
          ),
          el(
            'button',
            { type: 'button', class: 'pour ghost', onclick: () => pour(-250), disabled: ml === 0, 'aria-label': 'Take back 250 ml' },
            '−250'
          )
        ])
      ])
    ]),
    el('p', { class: 'sr-only', 'aria-live': 'polite' }, `${litres(ml)} of ${litres(goal.ml)} water today`),
    goalEditor(ctx, goal)
  ]);
}
