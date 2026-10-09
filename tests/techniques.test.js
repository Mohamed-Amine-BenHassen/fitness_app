import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSIONS, TRAINING_KEYS } from '../src/core/program.js';
import { TECHNIQUES, techniqueFor, videoSearchUrl } from '../src/core/techniques.js';

const programIds = new Set(TRAINING_KEYS.flatMap((key) => SESSIONS[key].exercises.map((e) => e.id)));
const FIELDS = ['muscles', 'setup', 'steps', 'cues', 'mistakes'];

test('every exercise in the program has technique notes', () => {
  const missing = [...programIds].filter((id) => !techniqueFor(id));
  assert.deepEqual(missing, []);
});

test('no technique entry is orphaned from the program', () => {
  const orphans = Object.keys(TECHNIQUES).filter((id) => !programIds.has(id));
  assert.deepEqual(orphans, []);
});

test('every technique section is a non-empty list of non-empty strings', () => {
  for (const [id, technique] of Object.entries(TECHNIQUES)) {
    for (const field of FIELDS) {
      const items = technique[field];
      assert.ok(Array.isArray(items) && items.length > 0, `${id}.${field} is empty`);
      assert.ok(items.every((s) => typeof s === 'string' && s.trim()), `${id}.${field} has a blank item`);
    }
  }
});

test('"A / B" exercises describe both options', () => {
  for (const key of TRAINING_KEYS) {
    for (const exercise of SESSIONS[key].exercises) {
      if (!exercise.name.includes(' / ')) continue;
      const { variants } = techniqueFor(exercise.id);
      assert.equal(variants?.length, 2, `${exercise.id} should have two variants`);
      assert.ok(variants.every((v) => v.name && v.text));
    }
  }
});

test('techniqueFor returns null for an unknown id', () => {
  assert.equal(techniqueFor('nope'), null);
});

test('the video link is an encoded YouTube search', () => {
  assert.equal(
    videoSearchUrl('DB / Cable Curl'),
    'https://www.youtube.com/results?search_query=DB%20%2F%20Cable%20Curl%20exercise%20technique'
  );
});
