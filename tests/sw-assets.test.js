import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// A module missing from the precache list loads fine online but breaks the
// installed app offline — the failure only shows up on the phone, so catch it here.

const root = join(import.meta.dirname, '..');
const swSource = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = [...swSource.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);

function filesUnder(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [relative(root, join(root, path)).replaceAll('\\', '/')];
  });
}

test('every module under src/ is precached by the service worker', () => {
  const missing = filesUnder('src').filter((file) => !listed.includes(file));
  assert.deepEqual(missing, []);
});

test('every precached path exists', () => {
  const stale = listed.filter((file) => file && !existsSync(join(root, file)));
  assert.deepEqual(stale, []);
});
