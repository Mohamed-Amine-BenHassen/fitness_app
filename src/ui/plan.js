// Plan tab: plans → plan (schedule, sessions) → session (exercises) → exercise
// picker, plus the exercise library. Navigation lives in ui.plan; every edit is
// a pure function from src/core/plans.js applied through ctx.actions.change.
//
// Typed fields save on 'change' without re-rendering (rerender: false) — a
// re-render on blur would destroy the field the user just tapped. Structural
// edits (add, remove, reorder) re-render.

import { REST_DAY_KEY, formatPrescription } from '../core/program.js';
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  activePlan,
  addSession,
  addSlot,
  archiveExercise,
  archivePlan,
  archiveSession,
  createPlan,
  duplicatePlan,
  exerciseFor,
  exerciseIdFor,
  exerciseUsage,
  libraryList,
  liveSessions,
  livePlans,
  moveSlot,
  nextPlanId,
  nextSessionKey,
  planById,
  removeSlot,
  renamePlan,
  restoreExercise,
  restorePlan,
  restoreSession,
  resolveSession,
  searchLibrary,
  setActivePlan,
  setSchedule,
  swapSlot,
  updateSession,
  updateSlot,
  upsertExercise
} from '../core/plans.js';
import { setWeightStep, weightStepOf } from '../core/progression.js';
import { card, clear, el, numberValue } from './dom.js';
import { openTechnique } from './technique.js';

const QUIET = { rerender: false };
const NEW_SLOT = { sets: 3, repRange: { min: 8, max: 12 }, restSec: 90 };

// ---------- small building blocks ----------

function backButton(label, onclick) {
  return el('button', { type: 'button', class: 'ghost back', onclick }, `‹ ${label}`);
}

function field(label, input) {
  return el('div', { class: 'field' }, [el('label', { for: input.id }, label), input]);
}

function textInput(id, value, onCommit, props = {}) {
  const input = el('input', { type: 'text', id, value, autocomplete: 'off', ...props });
  input.addEventListener('change', () => onCommit(input.value));
  return input;
}

function checkbox(id, label, checked, onToggle) {
  const input = el('input', { type: 'checkbox', id, checked });
  input.addEventListener('change', () => onToggle(input.checked));
  return el('label', { class: 'check', for: id }, [input, label]);
}

// A text field plus an Add button; Enter submits too.
function addForm(id, placeholder, buttonLabel, onSubmit) {
  const input = el('input', { type: 'text', id, placeholder, autocomplete: 'off', 'aria-label': placeholder });
  const submit = () => {
    const value = input.value.trim();
    if (value) onSubmit(value);
    else input.focus();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  return el('div', { class: 'quick-edit-row' }, [
    input,
    el('button', { type: 'button', class: 'primary', onclick: submit }, buttonLabel)
  ]);
}

// Filters a rendered list in place — typing must not re-render the page.
function searchBox(ctx, id, list) {
  const input = el('input', { type: 'search', id, placeholder: 'Search exercises', autocomplete: 'off', 'aria-label': 'Search exercises' });
  input.addEventListener('input', () => {
    const matches = new Set(searchLibrary(ctx.state, input.value).map((e) => e.id));
    for (const item of list.children) item.hidden = !matches.has(item.dataset.id);
  });
  return input;
}

// ---------- plan list ----------

function progressionCard(ctx) {
  const { state, actions } = ctx;
  const input = el('input', {
    type: 'number',
    id: 'weight-step',
    inputmode: 'decimal',
    min: '0.25',
    step: '0.25',
    value: String(weightStepOf(state))
  });
  input.addEventListener('change', () => {
    const value = numberValue(input);
    const next = actions.change((s) => setWeightStep(s, value ?? 0), QUIET);
    input.value = String(weightStepOf(next)); // show what was kept if the value was refused
  });
  return card(null, [
    el('h3', {}, 'Progression'),
    el('div', { class: 'quick-edit-row' }, [el('label', { for: 'weight-step', class: 'entry-label' }, 'Weight step (kg)'), input]),
    el('p', { class: 'meta' }, 'When you hit the top of the rep range on every set, the Workout tab suggests adding this much.')
  ]);
}

function renderPlanList(root, ctx) {
  const { state, actions } = ctx;
  const active = activePlan(state);
  const archived = state.plans.filter((p) => p.archived);

  root.append(
    card(null, [
      el('h3', {}, 'Plans'),
      el(
        'ul',
        { class: 'entry-list' },
        livePlans(state).map((plan) =>
          el('li', { class: 'entry-row' }, [
            el('span', { class: 'entry-label' }, [
              plan.name,
              el('span', { class: 'entry-time' }, ` · ${liveSessions(plan).length} sessions`)
            ]),
            plan.id === active.id
              ? el('span', { class: 'badge' }, 'active')
              : el(
                  'button',
                  { type: 'button', class: 'ghost', onclick: () => actions.change((s) => setActivePlan(s, plan.id)) },
                  'Use'
                ),
            el('button', { type: 'button', onclick: () => actions.planNav({ view: 'plan', planId: plan.id }) }, 'Edit')
          ])
        )
      )
    ]),
    card(null, [
      el('h3', {}, 'New plan'),
      addForm('new-plan-name', 'Plan name', 'Create', (name) => {
        const id = nextPlanId(state);
        actions.change((s) => createPlan(s, { id, name }));
        actions.planNav({ view: 'plan', planId: id });
      })
    ]),
    progressionCard(ctx),
    card(null, [
      el('h3', {}, 'Exercise library'),
      el('p', { class: 'empty-note' }, 'Rename exercises, add your own, and write technique notes.'),
      el(
        'button',
        { type: 'button', class: 'wide', style: 'margin-top: 10px', onclick: () => actions.planNav({ view: 'library' }) },
        `Open library (${libraryList(state).length})`
      )
    ]),
    archived.length
      ? card(null, [
          el('h3', {}, 'Archived plans'),
          el(
            'ul',
            { class: 'entry-list' },
            archived.map((plan) =>
              el('li', { class: 'entry-row' }, [
                el('span', { class: 'entry-label' }, plan.name),
                el('button', { type: 'button', class: 'ghost', onclick: () => actions.change((s) => restorePlan(s, plan.id)) }, 'Restore')
              ])
            )
          )
        ])
      : null
  );
}

// ---------- one plan ----------

const editSession = (ctx, plan, key) => () => ctx.actions.planNav({ view: 'session', planId: plan.id, sessionKey: key });

// The session's exercises as read-only lines: name, prescription, anchor.
function exerciseLines(ctx, key) {
  const { exercises } = resolveSession(ctx.state, key);
  if (exercises.length === 0) return el('p', { class: 'empty-note' }, 'No exercises yet.');
  return el(
    'ul',
    { class: 'day-exercises' },
    exercises.map((e) =>
      el('li', {}, [
        el('span', { class: 'day-ex-name' }, [e.name, e.anchor ? el('span', { class: 'badge' }, 'anchor') : null]),
        el('span', { class: 'day-ex-rx' }, formatPrescription(e))
      ])
    )
  );
}

// The week, day by day: pick each day's session and see its exercises in place.
function weekCard(ctx, plan) {
  const sessions = liveSessions(plan);
  return card(null, [
    el('h3', {}, 'Week'),
    ...WEEKDAY_ORDER.map((weekday) => {
      const key = plan.schedule[weekday];
      const isRest = key === REST_DAY_KEY;
      const select = el(
        'select',
        {
          id: `schedule-${weekday}`,
          autocomplete: 'off',
          'aria-label': `${WEEKDAY_LABELS[weekday]} session`,
          // Re-render so the exercise list under the day follows the choice.
          onchange: (e) => ctx.actions.change((s) => setSchedule(s, plan.id, weekday, e.target.value))
        },
        [...sessions.map((s) => el('option', { value: s.key }, s.focus ? `${s.name} — ${s.focus}` : s.name)), el('option', { value: REST_DAY_KEY }, 'Rest')]
      );
      select.value = key;
      return el('section', { class: isRest ? 'day-block rest' : 'day-block' }, [
        el('div', { class: 'day-head' }, [
          el('label', { for: select.id, class: 'day-label' }, WEEKDAY_LABELS[weekday]),
          select,
          isRest ? null : el('button', { type: 'button', onclick: editSession(ctx, plan, key) }, 'Edit')
        ]),
        isRest ? null : exerciseLines(ctx, key)
      ]);
    })
  ]);
}

// Sessions that aren't on any day, plus adding a new one.
function otherSessionsCard(ctx, plan) {
  const { state, actions } = ctx;
  const scheduled = new Set(plan.schedule);
  const unscheduled = liveSessions(plan).filter((s) => !scheduled.has(s.key));
  return card(null, [
    el('h3', {}, 'Not on the schedule'),
    unscheduled.length === 0
      ? el('p', { class: 'empty-note' }, 'Every session is on a day.')
      : el(
          'ul',
          { class: 'entry-list' },
          unscheduled.map((session) =>
            el('li', { class: 'entry-row' }, [
              el('span', { class: 'entry-label' }, [
                session.name,
                el('span', { class: 'entry-time' }, ` · ${session.slots.length} exercises`)
              ]),
              el('button', { type: 'button', onclick: editSession(ctx, plan, session.key) }, 'Edit')
            ])
          )
        ),
    el('div', { style: 'margin-top: 10px' }, [
      addForm('new-session-name', 'New session name', 'Add', (name) => {
        const key = nextSessionKey(state);
        actions.change((s) => addSession(s, plan.id, { key, name }));
        actions.planNav({ view: 'session', planId: plan.id, sessionKey: key });
      })
    ])
  ]);
}

function renderPlanScreen(root, ctx, plan) {
  const { state, actions } = ctx;
  const isActive = activePlan(state).id === plan.id;
  const archivedSessions = plan.sessions.filter((s) => s.archived);

  root.append(
    backButton('Plans', () => actions.planNav({ view: 'list' })),
    card(null, [
      field('Plan name', textInput('plan-name', plan.name, (v) => actions.change((s) => renamePlan(s, plan.id, v), QUIET))),
      isActive
        ? el('p', { class: 'meta', style: 'margin-top: 10px' }, 'This is your active plan — the Workout tab follows it.')
        : el(
            'button',
            { type: 'button', class: 'primary wide', style: 'margin-top: 12px', onclick: () => actions.change((s) => setActivePlan(s, plan.id)) },
            'Make this my active plan'
          )
    ]),
    weekCard(ctx, plan),
    otherSessionsCard(ctx, plan),
    archivedSessions.length
      ? card(null, [
          el('h3', {}, 'Archived sessions'),
          el(
            'ul',
            { class: 'entry-list' },
            archivedSessions.map((session) =>
              el('li', { class: 'entry-row' }, [
                el('span', { class: 'entry-label' }, session.name),
                el(
                  'button',
                  { type: 'button', class: 'ghost', onclick: () => actions.change((s) => restoreSession(s, plan.id, session.key)) },
                  'Restore'
                )
              ])
            )
          )
        ])
      : null,
    card(null, [
      el('div', { class: 'button-row' }, [
        el(
          'button',
          {
            type: 'button',
            onclick: () => {
              const id = nextPlanId(state);
              actions.change((s) => duplicatePlan(s, plan.id, { id, name: `${plan.name} (copy)` }));
              actions.planNav({ view: 'plan', planId: id });
            }
          },
          'Duplicate'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'danger-text',
            disabled: isActive,
            onclick: () => {
              actions.change((s) => archivePlan(s, plan.id));
              actions.planNav({ view: 'list' });
              actions.toast('Plan archived. Restore it from the plan list.');
            }
          },
          'Archive plan'
        )
      ]),
      isActive ? el('p', { class: 'meta' }, 'Make another plan active before archiving this one.') : null
    ])
  );
}

// ---------- one session ----------

function slotCard(ctx, plan, session, slot, index) {
  const { state, actions } = ctx;
  const exercise = exerciseFor(state, slot.exerciseId);
  const id = (name) => `slot-${index}-${name}`;
  const num = (name, value, props = {}) =>
    el('input', { type: 'number', id: id(name), inputmode: 'numeric', min: '0', step: '1', value: String(value), ...props });

  const sets = num('sets', slot.sets, { min: '1' });
  const min = num('min', slot.repRange.min, { min: '1' });
  const max = num('max', slot.repRange.max, { min: '1' });
  const rest = num('rest', slot.restSec, { step: '15' });
  const note = el('input', { type: 'text', id: id('note'), value: slot.note, placeholder: 'e.g. per leg', autocomplete: 'off' });

  // Show the normalised values after a save (a max below the min is raised, …).
  const sync = (next) => {
    const saved = planById(next, plan.id).sessions.find((s) => s.key === session.key).slots[index];
    sets.value = saved.sets;
    min.value = saved.repRange.min;
    max.value = saved.repRange.max;
    rest.value = saved.restSec;
    note.value = saved.note;
  };
  const save = (patch) => sync(actions.change((s) => updateSlot(s, plan.id, session.key, index, patch), QUIET));
  // A blank number field means "not finished typing": put the saved value back.
  const onNumber = (input, toPatch) =>
    input.addEventListener('change', () => {
      const value = numberValue(input);
      if (value === null) sync(ctx.actions.change((s) => s, QUIET));
      else save(toPatch(value));
    });

  onNumber(sets, (v) => ({ sets: v }));
  onNumber(min, (v) => ({ repRange: { min: v } }));
  onNumber(max, (v) => ({ repRange: { max: v } }));
  onNumber(rest, (v) => ({ restSec: v }));
  note.addEventListener('change', () => save({ note: note.value }));

  const last = session.slots.length - 1;
  const structural = (fn) => actions.change((s) => fn(s));

  return card('slot-card', [
    el('div', { class: 'card-head' }, [
      el('h2', {}, [
        el(
          'button',
          {
            type: 'button',
            class: 'name-link',
            'aria-haspopup': 'dialog',
            onclick: () => openTechnique(resolveSession(state, session.key).exercises[index] || exercise)
          },
          exercise ? exercise.name : slot.exerciseId
        )
      ]),
      checkbox(id('anchor'), 'Anchor', slot.anchor, (on) => save({ anchor: on }))
    ]),
    el('div', { class: 'slot-grid' }, [
      field('Sets', sets),
      field('Reps min', min),
      field('Reps max', max),
      field('Rest (s)', rest)
    ]),
    el('div', { style: 'margin-top: 8px' }, [field('Note', note)]),
    el('div', { class: 'button-row' }, [
      el(
        'button',
        { type: 'button', 'aria-label': `Move ${exercise?.name} up`, disabled: index === 0, onclick: () => structural((s) => moveSlot(s, plan.id, session.key, index, -1)) },
        '↑'
      ),
      el(
        'button',
        { type: 'button', 'aria-label': `Move ${exercise?.name} down`, disabled: index === last, onclick: () => structural((s) => moveSlot(s, plan.id, session.key, index, 1)) },
        '↓'
      ),
      el(
        'button',
        { type: 'button', onclick: () => actions.planNav({ view: 'pick', mode: 'swap', slotIndex: index }) },
        'Swap'
      ),
      el(
        'button',
        { type: 'button', class: 'danger-text', onclick: () => structural((s) => removeSlot(s, plan.id, session.key, index)) },
        'Remove'
      )
    ])
  ]);
}

function renderSessionScreen(root, ctx, plan, session) {
  const { actions } = ctx;
  root.append(
    backButton(plan.name, () => actions.planNav({ view: 'plan' })),
    card(null, [
      el('div', { class: 'add-row', style: 'margin-top: 0' }, [
        field('Session name', textInput('session-name', session.name, (v) => actions.change((s) => updateSession(s, plan.id, session.key, { name: v }), QUIET))),
        field('Focus', textInput('session-focus', session.focus, (v) => actions.change((s) => updateSession(s, plan.id, session.key, { focus: v }), QUIET), { placeholder: 'e.g. chest-led' }))
      ])
    ]),
    ...session.slots.map((slot, index) => slotCard(ctx, plan, session, slot, index)),
    session.slots.length === 0 ? card(null, [el('p', { class: 'empty-note' }, 'No exercises yet.')]) : null,
    el(
      'button',
      { type: 'button', class: 'primary wide', onclick: () => actions.planNav({ view: 'pick', mode: 'add', slotIndex: null }) },
      '+ Add exercise'
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'ghost wide danger-text',
        style: 'margin-top: 10px',
        onclick: () => {
          actions.change((s) => archiveSession(s, plan.id, session.key));
          actions.planNav({ view: 'plan' });
          actions.toast('Session archived. Its history is kept.');
        }
      },
      'Archive session'
    )
  );
}

// ---------- exercise picker (add / swap) ----------

function renderPicker(root, ctx, plan, session) {
  const { state, ui, actions } = ctx;
  const swapping = ui.plan.mode === 'swap';
  const current = swapping ? session.slots[ui.plan.slotIndex] : null;
  const back = () => actions.planNav({ view: 'session' });

  // Adding or swapping in one state change, then back to the session.
  const choose = (exerciseId, extra = (s) => s) => {
    actions.change((s) => {
      const withExercise = extra(s);
      return swapping
        ? swapSlot(withExercise, plan.id, session.key, ui.plan.slotIndex, exerciseId)
        : addSlot(withExercise, plan.id, session.key, { exerciseId, ...NEW_SLOT });
    });
    back();
  };

  // Exercises already in this session can't be added twice (sets are stored per
  // exercise); the one being swapped out is marked as current.
  const inSession = new Set(session.slots.map((slot) => slot.exerciseId));
  const list = el(
    'ul',
    { class: 'pick-list' },
    libraryList(state).map((exercise) => {
      const isCurrent = exercise.id === current?.exerciseId;
      const taken = inSession.has(exercise.id) && !isCurrent;
      return el('li', { dataset: { id: exercise.id } }, [
        el(
          'button',
          {
            type: 'button',
            class: isCurrent ? 'current' : null,
            disabled: taken || isCurrent,
            onclick: () => choose(exercise.id)
          },
          [
            exercise.name,
            taken || isCurrent ? el('span', { class: 'entry-time' }, isCurrent ? ' · current' : ' · in this session') : null
          ]
        )
      ]);
    })
  );

  const nameInput = el('input', { type: 'text', id: 'new-exercise-name', placeholder: 'Exercise name', autocomplete: 'off', 'aria-label': 'New exercise name' });
  let bodyweightOnly = false;
  let perSide = false;

  root.append(
    backButton(session.name, back),
    card(null, [
      el('h3', {}, swapping ? `Swap ${exerciseFor(state, current?.exerciseId)?.name || 'exercise'} for…` : 'Add an exercise'),
      searchBox(ctx, 'pick-search', list),
      list
    ]),
    card(null, [
      el('h3', {}, 'Not in the list? Create it'),
      nameInput,
      el('div', { class: 'button-row' }, [
        checkbox('new-bodyweight', 'Bodyweight only', false, (on) => (bodyweightOnly = on)),
        checkbox('new-per-side', 'Per side', false, (on) => (perSide = on))
      ]),
      el(
        'button',
        {
          type: 'button',
          class: 'primary wide',
          style: 'margin-top: 10px',
          onclick: () => {
            const name = nameInput.value.trim();
            if (!name) {
              nameInput.focus();
              actions.toast('Give the exercise a name.');
              return;
            }
            const id = exerciseIdFor(state, name);
            choose(id, (s) => upsertExercise(s, { id, name, bodyweightOnly, perSide }));
          }
        },
        swapping ? 'Create and swap in' : 'Create and add'
      )
    ])
  );
}

// ---------- exercise library ----------

function renderLibrary(root, ctx) {
  const { state, actions } = ctx;
  const list = el(
    'ul',
    { class: 'pick-list' },
    libraryList(state, { includeArchived: true }).map((exercise) =>
      el('li', { dataset: { id: exercise.id } }, [
        el(
          'button',
          { type: 'button', class: exercise.archived ? 'archived' : null, onclick: () => actions.planNav({ view: 'exercise', exerciseId: exercise.id }) },
          [exercise.name, exercise.archived ? el('span', { class: 'entry-time' }, ' · archived') : null]
        )
      ])
    )
  );

  root.append(
    backButton('Plans', () => actions.planNav({ view: 'list' })),
    card(null, [
      el('h3', {}, 'New exercise'),
      addForm('library-new-name', 'Exercise name', 'Create', (name) => {
        const id = exerciseIdFor(state, name);
        actions.change((s) => upsertExercise(s, { id, name }));
        actions.planNav({ view: 'exercise', exerciseId: id });
      })
    ]),
    card(null, [el('h3', {}, 'All exercises'), searchBox(ctx, 'library-search', list), list])
  );
}

function renderExerciseScreen(root, ctx, exercise) {
  const { state, actions } = ctx;
  const save = (patch) => actions.change((s) => upsertExercise(s, { id: exercise.id, ...patch }), QUIET);
  const notes = el('textarea', {
    id: 'exercise-notes',
    rows: 6,
    value: exercise.technique,
    placeholder: 'Your own cues, set-up, machine settings… One point per line.'
  });
  notes.addEventListener('change', () => save({ technique: notes.value }));
  const nameInput = textInput('exercise-name', exercise.name, (v) => save({ name: v }));
  const usage = exerciseUsage(state, exercise.id);

  root.append(
    backButton('Library', () => actions.planNav({ view: 'library' })),
    card(null, [
      field('Name', nameInput),
      el('p', { class: 'meta' }, 'Renaming keeps this exercise’s history.'),
      el('div', { class: 'button-row' }, [
        checkbox('exercise-bodyweight', 'Bodyweight only', exercise.bodyweightOnly, (on) => save({ bodyweightOnly: on })),
        checkbox('exercise-per-side', 'Per side', exercise.perSide, (on) => save({ perSide: on }))
      ])
    ]),
    card(null, [
      field('Your technique notes', notes),
      el(
        'button',
        { type: 'button', class: 'ghost', style: 'margin-top: 8px', onclick: () => openTechnique({ ...exercise, name: nameInput.value, technique: notes.value.trim() }) },
        'Preview technique'
      )
    ]),
    card(null, [
      el('p', { class: 'meta', style: 'margin: 0 0 10px' }, usage ? `Used in ${usage} session${usage === 1 ? '' : 's'}.` : 'Not used in any active plan.'),
      exercise.archived
        ? el('button', { type: 'button', class: 'wide', onclick: () => actions.change((s) => restoreExercise(s, exercise.id)) }, 'Restore exercise')
        : el(
            'button',
            {
              type: 'button',
              class: 'wide danger-text',
              onclick: () => {
                actions.change((s) => archiveExercise(s, exercise.id));
                actions.toast('Archived. It stays in existing sessions but leaves the picker.');
              }
            },
            'Archive exercise'
          )
    ])
  );
}

// ---------- entry point ----------

export function renderPlan(root, ctx) {
  const { state, ui } = ctx;
  const nav = ui.plan;
  clear(root);

  // Anything the nav points at may have vanished (e.g. a restored backup); fall
  // back one level at a time rather than rendering a broken screen.
  const plan = nav.planId ? planById(state, nav.planId) : null;
  const session = plan && nav.sessionKey ? plan.sessions.find((s) => s.key === nav.sessionKey) : null;
  const exercise = nav.exerciseId ? exerciseFor(state, nav.exerciseId) : null;

  if (nav.view === 'library') return renderLibrary(root, ctx);
  if (nav.view === 'exercise' && exercise) return renderExerciseScreen(root, ctx, exercise);
  if (nav.view === 'pick' && session) return renderPicker(root, ctx, plan, session);
  if ((nav.view === 'session' || nav.view === 'pick') && session) return renderSessionScreen(root, ctx, plan, session);
  if (plan && nav.view !== 'list') return renderPlanScreen(root, ctx, plan);
  return renderPlanList(root, ctx);
}
