// Protein tab: today's total against the target, editable quick-add buttons,
// the food list, manual entry, and today's log. Calculations live in
// src/core/nutrition.js and src/core/foods.js.

import { dayTotal, entriesFor, progressRatio, remaining, targetOf } from '../core/nutrition.js';
import {
  FOODS,
  addCustomFood,
  foodById,
  nextFoodId,
  proteinFor,
  recentFoods,
  removeCustomFood,
  searchFoods
} from '../core/foods.js';
import { card, clear, el, numberValue } from './dom.js';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function totalCard(ctx) {
  const { state, ui } = ctx;
  const total = dayTotal(state, ui.dateKey);
  const target = targetOf(state);
  const left = remaining(state, ui.dateKey);
  const ratio = progressRatio(state, ui.dateKey);
  const done = left === 0;

  return card('protein-total', [
    el('div', { class: 'protein-number' }, [String(total), el('span', {}, ` / ${target} g`)]),
    el(
      'p',
      { class: done ? 'protein-sub done' : 'protein-sub' },
      done ? 'Target hit.' : `${left} g to go`
    ),
    el('div', { class: 'bar', role: 'img', 'aria-label': `${total} of ${target} grams` }, [
      el('div', { class: done ? 'done' : null, style: `width: ${Math.round(ratio * 100)}%` })
    ])
  ]);
}

function quickAddButtons(ctx) {
  const { state, actions } = ctx;
  const quickAdds = state.settings.quickAdds;

  if (quickAdds.length === 0) {
    return el('p', { class: 'empty-note' }, 'No quick-add buttons. Tap Edit to create one.');
  }

  return el(
    'div',
    { class: 'quick-grid' },
    quickAdds.map((qa) =>
      el(
        'button',
        {
          type: 'button',
          class: qa.grams === 0 ? 'unset' : null,
          onclick: () =>
            qa.grams === 0
              ? actions.toast('Set this button’s grams in Edit first.')
              : actions.addProtein({ label: qa.label, grams: qa.grams })
        },
        [
          el('span', {}, qa.label),
          el('span', { class: 'grams' }, qa.grams === 0 ? 'tap Edit to set grams' : `+${qa.grams} g`)
        ]
      )
    )
  );
}

function quickAddEditor(ctx) {
  const { state, actions } = ctx;

  const rows = state.settings.quickAdds.map((qa) => {
    const label = el('input', {
      type: 'text',
      name: `${qa.id}-label`,
      value: qa.label,
      'aria-label': `${qa.label} label`
    });
    const grams = el('input', {
      type: 'number',
      name: `${qa.id}-grams`,
      inputmode: 'numeric',
      min: '0',
      step: '1',
      value: String(qa.grams),
      'aria-label': `${qa.label} grams`
    });
    // Save without re-rendering: 'change' fires on blur, so a re-render here would
    // destroy the field the user just tapped. The buttons refresh on Done.
    const commit = () =>
      actions.saveQuickAdd(
        { id: qa.id, label: label.value, grams: numberValue(grams) ?? 0 },
        { rerender: false }
      );

    label.addEventListener('change', commit);
    grams.addEventListener('change', commit);

    return el('div', { class: 'quick-edit-row' }, [
      label,
      grams,
      el(
        'button',
        {
          type: 'button',
          class: 'icon',
          'aria-label': `Delete ${qa.label}`,
          onclick: () => actions.deleteQuickAdd(qa.id)
        },
        '×'
      )
    ]);
  });

  const newLabel = el('input', {
    type: 'text',
    name: 'new-quick-add-label',
    placeholder: 'New button label',
    'aria-label': 'New button label'
  });
  const newGrams = el('input', {
    type: 'number',
    name: 'new-quick-add-grams',
    inputmode: 'numeric',
    min: '0',
    step: '1',
    placeholder: 'g',
    'aria-label': 'New button grams'
  });

  const addRow = el('div', { class: 'quick-edit-row' }, [
    newLabel,
    newGrams,
    el(
      'button',
      {
        type: 'button',
        onclick: () => {
          const grams = numberValue(newGrams);
          if (!newLabel.value.trim() || grams === null || grams <= 0) {
            actions.toast('Give the button a label and grams.');
            return;
          }
          actions.saveQuickAdd({ label: newLabel.value, grams });
        }
      },
      'Add'
    )
  ]);

  const targetInput = el('input', {
    type: 'number',
    id: 'target-input',
    inputmode: 'numeric',
    min: '1',
    step: '5',
    value: String(targetOf(state))
  });
  targetInput.addEventListener('change', () =>
    actions.setTarget(numberValue(targetInput), { rerender: false })
  );

  return el('div', { class: 'stack' }, [
    ...rows,
    addRow,
    el('div', { class: 'quick-edit-row' }, [
      el('label', { for: 'target-input', class: 'entry-label' }, 'Daily target (g)'),
      targetInput
    ])
  ]);
}

function quickAddCard(ctx) {
  const { ui, actions } = ctx;
  return card(null, [
    el('div', { class: 'card-head' }, [
      el('h3', {}, 'Quick add'),
      el(
        'button',
        { type: 'button', class: 'ghost', onclick: () => actions.toggleQuickAddEditor() },
        ui.editingQuickAdds ? 'Done' : 'Edit'
      )
    ]),
    ui.editingQuickAdds ? quickAddEditor(ctx) : quickAddButtons(ctx)
  ]);
}

// ---------- food list ----------

const MAX_RESULTS = 8;

function foodMeta(food) {
  return `${food.proteinPer100g} g per 100 g · 1 ${food.servingLabel} = ${food.servingG} g`;
}

function foodResults(ctx, query) {
  const { state, actions } = ctx;
  const searching = query.trim() !== '';
  const recents = recentFoods(state);
  const foods = searching ? searchFoods(state, query) : recents.length ? recents : FOODS.slice(0, MAX_RESULTS);

  if (foods.length === 0) {
    return [el('p', { class: 'empty-note' }, 'No match. Tap + Own food to add it.')];
  }
  return [
    searching ? null : el('p', { class: 'meta', style: 'margin: 0 0 6px' }, recents.length ? 'Recent' : 'Common'),
    el(
      'ul',
      { class: 'pick-list' },
      foods.slice(0, MAX_RESULTS).map((food) =>
        el('li', {}, [
          el('button', { type: 'button', onclick: () => actions.selectFood(food.id) }, [
            food.name,
            el('span', { class: 'entry-time' }, ` · ${food.proteinPer100g} g/100 g`)
          ])
        ])
      )
    )
  ];
}

function selectedFoodPanel(ctx, food) {
  const { actions } = ctx;
  const amount = el('input', {
    type: 'number',
    id: 'food-amount',
    inputmode: 'decimal',
    min: '0',
    step: 'any',
    value: '1'
  });
  const unit = el('select', { id: 'food-unit', autocomplete: 'off', 'aria-label': 'Unit' }, [
    el('option', { value: 'servings' }, `× ${food.servingLabel}`),
    el('option', { value: 'grams' }, 'grams')
  ]);
  const preview = el('p', { class: 'food-preview', 'aria-live': 'polite' });

  const currentAmount = () => {
    const value = numberValue(amount) ?? 0;
    return unit.value === 'grams' ? { grams: value } : { servings: value };
  };
  const update = () => {
    preview.textContent = `= ${proteinFor(food, currentAmount())} g protein`;
  };
  // Switching unit converts the number so the amount eaten stays the same.
  unit.addEventListener('change', () => {
    const value = numberValue(amount) ?? 0;
    amount.value = unit.value === 'grams' ? Math.round(value * food.servingG) : Math.round((value / food.servingG) * 100) / 100;
    update();
  });
  amount.addEventListener('input', update);
  const submit = () => {
    const grams = proteinFor(food, currentAmount());
    if (grams <= 0) {
      amount.focus();
      actions.toast('Enter how much you ate.');
      return;
    }
    actions.logFood(food.id, currentAmount());
  };
  amount.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  update();

  return el('div', { class: 'food-selected' }, [
    el('div', { class: 'card-head' }, [
      el('strong', {}, food.name),
      el('button', { type: 'button', class: 'ghost', onclick: () => actions.selectFood(null) }, 'Change')
    ]),
    el('p', { class: 'meta' }, foodMeta(food)),
    el('div', { class: 'add-row' }, [
      el('div', { class: 'field' }, [el('label', { for: 'food-amount' }, 'Amount'), amount]),
      el('div', { class: 'field' }, [el('label', { for: 'food-unit' }, 'Unit'), unit])
    ]),
    el('div', { class: 'add-row', style: 'align-items: center' }, [
      preview,
      el('button', { type: 'button', class: 'primary add-set', onclick: submit }, 'Add')
    ]),
    food.custom
      ? el(
          'button',
          {
            type: 'button',
            class: 'ghost danger-text',
            onclick: () => {
              actions.change((s) => removeCustomFood(s, food.id));
              actions.selectFood(null);
            }
          },
          'Delete this food'
        )
      : null
  ]);
}

function customFoodForm(ctx) {
  const { state, actions } = ctx;
  const name = el('input', { type: 'text', id: 'cf-name', placeholder: 'e.g. Barebells bar', autocomplete: 'off' });
  const per100 = el('input', { type: 'number', id: 'cf-protein', inputmode: 'decimal', min: '0', step: 'any', placeholder: 'g' });
  const servingG = el('input', { type: 'number', id: 'cf-serving', inputmode: 'decimal', min: '0', step: 'any', placeholder: '100' });
  const servingLabel = el('input', { type: 'text', id: 'cf-label', placeholder: 'bar, scoop…', autocomplete: 'off' });
  const field = (label, input) => el('div', { class: 'field' }, [el('label', { for: input.id }, label), input]);

  const save = () => {
    const id = nextFoodId(state);
    const next = actions.change((s) =>
      addCustomFood(s, {
        id,
        name: name.value,
        proteinPer100g: numberValue(per100) ?? 0,
        servingG: numberValue(servingG) ?? 0,
        servingLabel: servingLabel.value
      })
    );
    if (!foodById(next, id)) {
      actions.toast('Give the food a name and its protein per 100 g.');
      return;
    }
    actions.selectFood(id);
  };

  return el('div', { class: 'stack food-form' }, [
    field('Name', name),
    el('div', { class: 'add-row' }, [field('Protein per 100 g', per100), field('Serving (g)', servingG)]),
    field('Serving name', servingLabel),
    el('div', { class: 'button-row' }, [
      el('button', { type: 'button', class: 'ghost', onclick: () => actions.toggleFoodForm() }, 'Cancel'),
      el('button', { type: 'button', class: 'primary', onclick: save }, 'Save food')
    ])
  ]);
}

function foodCard(ctx) {
  const { state, ui, actions } = ctx;
  const selected = ui.food.selectedId ? foodById(state, ui.food.selectedId) : null;

  if (ui.food.adding) {
    return card(null, [el('h3', {}, 'Your own food'), customFoodForm(ctx)]);
  }
  if (selected) {
    return card(null, [el('h3', {}, 'Add food'), selectedFoodPanel(ctx, selected)]);
  }

  // The result list re-renders in place as you type; the page does not.
  const results = el('div', { class: 'food-results' }, foodResults(ctx, ''));
  const search = el('input', {
    type: 'search',
    id: 'food-search',
    placeholder: `Search ${FOODS.length}+ foods`,
    autocomplete: 'off',
    'aria-label': 'Search foods'
  });
  search.addEventListener('input', () => {
    clear(results);
    results.append(...foodResults(ctx, search.value).filter(Boolean));
  });

  return card(null, [
    el('div', { class: 'card-head' }, [
      el('h3', {}, 'Add food'),
      el('button', { type: 'button', class: 'ghost', onclick: () => actions.toggleFoodForm() }, '+ Own food')
    ]),
    search,
    results
  ]);
}

function manualCard(ctx) {
  const { actions } = ctx;
  const gramsInput = el('input', {
    type: 'number',
    id: 'manual-grams',
    inputmode: 'numeric',
    min: '0',
    step: '1',
    placeholder: 'g'
  });
  const labelInput = el('input', {
    type: 'text',
    id: 'manual-label',
    placeholder: 'Chicken, eggs…'
  });

  const submit = () => {
    const grams = numberValue(gramsInput);
    if (grams === null || grams <= 0) {
      gramsInput.focus();
      actions.toast('Enter grams of protein.');
      return;
    }
    actions.addProtein({ label: labelInput.value.trim() || 'Protein', grams });
  };

  gramsInput.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  labelInput.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  return card(null, [
    el('h3', {}, 'Add manually'),
    el('div', { class: 'add-row' }, [
      el('div', { class: 'field' }, [el('label', { for: 'manual-grams' }, 'Grams'), gramsInput]),
      el('div', { class: 'field' }, [el('label', { for: 'manual-label' }, 'Label'), labelInput]),
      el('button', { type: 'button', class: 'primary add-set', onclick: submit }, 'Add')
    ])
  ]);
}

function logCard(ctx) {
  const { state, ui, actions } = ctx;
  const entries = entriesFor(state, ui.dateKey);

  return card(null, [
    el('h3', {}, 'Today'),
    entries.length === 0
      ? el('p', { class: 'empty-note' }, 'Nothing logged yet.')
      : el(
          'ul',
          { class: 'entry-list' },
          entries.map((entry, index) =>
            el('li', { class: 'entry-row' }, [
              el('span', { class: 'entry-label' }, [
                entry.label,
                entry.ts ? el('span', { class: 'entry-time' }, ` · ${formatTime(entry.ts)}`) : null
              ]),
              el('span', { class: 'entry-grams' }, `${entry.grams} g`),
              el(
                'button',
                {
                  type: 'button',
                  class: 'icon',
                  'aria-label': `Delete ${entry.label}`,
                  onclick: () => actions.removeProtein(index)
                },
                '×'
              )
            ])
          )
        )
  ]);
}

export function renderProtein(root, ctx) {
  clear(root);
  root.append(totalCard(ctx), quickAddCard(ctx), foodCard(ctx), manualCard(ctx), logCard(ctx));
}
