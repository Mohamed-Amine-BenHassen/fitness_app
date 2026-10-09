// Backup tab: download the whole state as JSON, restore it from a file.
// Validation and migration are pure and live in src/core/backup.js.

import { backupFilename, backupSummary, parseBackup, serializeBackup } from '../core/backup.js';
import { formatHuman } from '../core/dates.js';
import { card, clear, el } from './dom.js';

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stat(term, value) {
  return el('div', { class: 'stat' }, [el('dt', {}, term), el('dd', {}, value)]);
}

function summaryCard(ctx) {
  const summary = backupSummary(ctx.state);
  const span =
    summary.firstDate && summary.lastDate
      ? summary.firstDate === summary.lastDate
        ? formatHuman(summary.firstDate)
        : `${formatHuman(summary.firstDate)} – ${formatHuman(summary.lastDate)}`
      : '—';

  return card(null, [
    el('h3', {}, 'Your data'),
    el('dl', { class: 'stat-grid' }, [
      stat('Sessions', String(summary.sessions)),
      stat('Sets', String(summary.sets)),
      stat('Protein days', String(summary.nutritionDays)),
      stat('Weigh-ins', String(summary.weighIns)),
      stat('Stored', `${Math.max(1, Math.round(ctx.storageBytes() / 1024))} KB`)
    ]),
    el('p', { class: 'meta' }, `Logged span: ${span}`)
  ]);
}

function exportCard(ctx) {
  return card(null, [
    el('h3', {}, 'Export'),
    el(
      'p',
      { class: 'empty-note' },
      'Downloads every session, protein entry and setting as a single JSON file.'
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'primary wide',
        style: 'margin-top: 12px',
        onclick: () => {
          download(
            backupFilename(ctx.ui.dateKey),
            serializeBackup(ctx.state, new Date().toISOString())
          );
          ctx.actions.toast('Backup downloaded.');
        }
      },
      'Export backup'
    )
  ]);
}

function importCard(ctx) {
  const errorBox = el('div', { class: 'errors', hidden: true });

  const showErrors = (errors) => {
    clear(errorBox);
    errorBox.append(
      el('strong', {}, 'Import failed'),
      el('ul', {}, errors.map((message) => el('li', {}, message)))
    );
    errorBox.hidden = false;
  };

  const fileInput = el('input', {
    type: 'file',
    id: 'import-file',
    accept: 'application/json,.json'
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    errorBox.hidden = true;

    let text;
    try {
      text = await file.text();
    } catch (error) {
      showErrors([`Could not read the file: ${error.message}`]);
      return;
    }

    const result = parseBackup(text);
    if (!result.ok) {
      showErrors(result.errors);
      fileInput.value = '';
      return;
    }

    const summary = backupSummary(result.state);
    const confirmed = window.confirm(
      'Replace all current data with this backup?\n\n' +
        `${summary.sessions} sessions, ${summary.sets} sets, ${summary.nutritionDays} protein days.\n\n` +
        'This cannot be undone.'
    );
    fileInput.value = '';
    if (!confirmed) return;

    ctx.actions.replaceState(result.state);
  });

  return card(null, [
    el('h3', {}, 'Import'),
    el(
      'p',
      { class: 'empty-note' },
      'Restores from a backup file. This replaces everything currently stored.'
    ),
    el('div', { style: 'margin-top: 12px' }, [fileInput]),
    errorBox
  ]);
}

export function renderBackup(root, ctx) {
  clear(root);
  root.append(summaryCard(ctx), exportCard(ctx), importCard(ctx));
}
