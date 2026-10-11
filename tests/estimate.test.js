import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_PROMPT, parseEstimate } from '../src/core/estimate.js';

test('the prompt asks for the exact line the parser reads', () => {
  assert.match(PHOTO_PROMPT, /PROTEIN: <food>, <portion in grams> g, <protein in grams> g/);
  const example = PHOTO_PROMPT.split('\n').find((line) => line.startsWith('Example: '));
  assert.equal(parseEstimate(example.replace('Example: ', '')).ok, true);
});

test('a clean one-line answer becomes one item per food', () => {
  assert.deepEqual(parseEstimate('PROTEIN: grilled chicken breast, 150 g, 46 g | white rice, 200 g, 5 g'), {
    ok: true,
    items: [
      { name: 'grilled chicken breast', grams: 150, protein: 46 },
      { name: 'white rice', grams: 200, protein: 5 }
    ],
    skipped: 0
  });
});

test('markdown, smart quotes and chatter around the line are ignored', () => {
  const answer = [
    'Sure! Here is my estimate:',
    '```',
    '**PROTEIN:** salmon fillet, ~180 g, 40 g | quinoa, 150g, 6g',
    '```',
    'Let me know if you’d like a breakdown, it may vary by 5, 10 g.'
  ].join('\n');
  const result = parseEstimate(answer);
  assert.deepEqual(
    result.items.map((item) => [item.name, item.grams, item.protein]),
    [
      ['salmon fillet', 180, 40],
      ['quinoa', 150, 6]
    ]
  );
});

test('decimal commas and ranges are read sensibly', () => {
  const { items } = parseEstimate('PROTEIN: greek yogurt, 170 g, 17,5 g | eggs, 100 g, 12-14 g');
  assert.deepEqual(items, [
    { name: 'greek yogurt', grams: 170, protein: 18 },
    { name: 'eggs', grams: 100, protein: 13 }
  ]);
});

test('a name with its own comma still parses, reading from the right', () => {
  const { items } = parseEstimate('PROTEIN: chicken, grilled, 150 g, 46 g');
  assert.deepEqual(items, [{ name: 'chicken, grilled', grams: 150, protein: 46 }]);
});

test('items on their own lines after an empty PROTEIN: line are read too', () => {
  const { items } = parseEstimate('PROTEIN:\n- tuna, 120 g, 30 g\n- bread, 60 g, 5 g');
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'tuna');
});

test('a portion can be missing; the protein still counts', () => {
  assert.deepEqual(parseEstimate('PROTEIN: protein shake, 25 g').items, [{ name: 'protein shake', grams: null, protein: 25 }]);
});

test('impossible items are skipped and counted', () => {
  // More protein than food, and an absurd portion.
  const result = parseEstimate('PROTEIN: chicken, 100 g, 150 g | rice, 9000 g, 20 g | beans, 200 g, 15 g');
  assert.deepEqual(result.items, [{ name: 'beans', grams: 200, protein: 15 }]);
  assert.equal(result.skipped, 2);
});

test('an answer with no food in it is an error, not an empty log', () => {
  for (const text of ['', 'I can’t see any food in this photo.', 'PROTEIN: none']) {
    const result = parseEstimate(text);
    assert.equal(result.ok, false);
    assert.match(result.error, /PROTEIN:/);
  }
});
