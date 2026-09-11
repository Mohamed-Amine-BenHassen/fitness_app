// Protein tab: today's total against the target, editable quick-add buttons,
// manual entry, and today's log. Calculations live in src/core/nutrition.js.

import { dayTotal, entriesFor, progressRatio, remaining, targetOf } from '../core/nutrition.js';
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
    const commit = () =>
      actions.saveQuickAdd({ id: qa.id, label: label.value, grams: numberValue(grams) ?? 0 });

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
  targetInput.addEventListener('change', () => actions.setTarget(numberValue(targetInput)));

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
  root.append(totalCard(ctx), quickAddCard(ctx), manualCard(ctx), logCard(ctx));
}
