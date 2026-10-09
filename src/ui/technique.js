// Technique dialog: how to perform an exercise. Content lives in
// src/core/techniques.js. The dialog is appended to <body>, outside #view, so a
// re-render of the tab underneath never closes it.

import { techniqueFor, videoSearchUrl } from '../core/techniques.js';
import { el } from './dom.js';

function section(title, items, ordered = false) {
  return el('section', { class: 'tech-section' }, [
    el('h3', {}, title),
    el(ordered ? 'ol' : 'ul', {}, items.map((item) => el('li', {}, item)))
  ]);
}

function body(exercise, technique) {
  if (!technique) {
    return [el('p', { class: 'empty-note' }, 'No technique notes for this exercise yet.')];
  }
  return [
    el('p', { class: 'tech-muscles' }, technique.muscles.join(' · ')),
    technique.variants
      ? el('section', { class: 'tech-section' }, [
          el('h3', {}, 'Options'),
          ...technique.variants.map((v) =>
            el('div', { class: 'tech-variant' }, [el('strong', {}, v.name), el('p', {}, v.text)])
          )
        ])
      : null,
    section('Setup', technique.setup),
    section('How to do it', technique.steps, true),
    section('Key cues', technique.cues),
    section('Common mistakes', technique.mistakes),
    el(
      'a',
      { class: 'tech-video', href: videoSearchUrl(exercise.name), target: '_blank', rel: 'noopener' },
      'Watch on YouTube ↗'
    )
  ];
}

export function openTechnique(exercise) {
  // Remove directly rather than only in the 'close' event, which Chromium does
  // not always deliver promptly — closed dialogs would otherwise pile up.
  const dismiss = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const dialog = el('dialog', { class: 'tech-dialog', 'aria-labelledby': 'tech-title' }, [
    el('div', { class: 'tech-head' }, [
      el('h2', { id: 'tech-title' }, exercise.name),
      el('button', { type: 'button', class: 'icon', 'aria-label': 'Close', onclick: dismiss }, '×')
    ]),
    el('div', { class: 'tech-body' }, body(exercise, techniqueFor(exercise.id)))
  ]);

  // Tapping the dimmed backdrop closes it; the click target is the dialog itself.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dismiss();
  });
  // Escape and the Android back gesture close the dialog natively.
  dialog.addEventListener('close', () => dialog.remove());
  for (const stale of document.querySelectorAll('dialog.tech-dialog')) stale.remove();

  document.body.append(dialog);
  dialog.showModal();
}
