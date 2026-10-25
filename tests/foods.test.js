import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/core/schema.js';
import { addEntry, dayMacros, dayTotal, entriesFor } from '../src/core/nutrition.js';
import { migrate, parseBackup, serializeBackup } from '../src/core/backup.js';
import {
  FOODS,
  addCustomFood,
  allFoods,
  entryLabel,
  foodById,
  logFood,
  macrosFor,
  nextFoodId,
  normalizeCustomFood,
  proteinFor,
  recentFoods,
  recordRecent,
  removeCustomFood,
  searchFoods
} from '../src/core/foods.js';

const seed = () => defaultState();
const DAY = '2026-10-09';
const TS = 1_760_000_000_000;

test('built-in foods have unique ids and sane values', () => {
  const ids = FOODS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(FOODS.length >= 50);
  for (const f of FOODS) {
    assert.ok(f.proteinPer100g > 0 && f.proteinPer100g <= 100, `${f.id} protein`);
    assert.ok(f.servingG > 0 && f.servingLabel, `${f.id} serving`);
  }
});

test('every built-in food has calories that match its macros', () => {
  // 4 kcal per g of protein and carbs, 9 per g of fat; fibre and rounding allow
  // some slack, more for low-calorie foods.
  for (const f of FOODS) {
    assert.ok(f.kcalPer100g > 0 && f.kcalPer100g <= 900, `${f.id} kcal`);
    assert.ok(f.fatPer100g >= 0 && f.carbsPer100g >= 0, `${f.id} fat/carbs`);
    const fromMacros = 4 * f.proteinPer100g + 4 * f.carbsPer100g + 9 * f.fatPer100g;
    assert.ok(Math.abs(fromMacros - f.kcalPer100g) <= Math.max(15, 0.12 * f.kcalPer100g), `${f.id}: ${f.kcalPer100g} vs ${fromMacros}`);
  }
});

test('protein is worked out from grams or servings and rounded', () => {
  const chicken = foodById(seed(), 'chicken-breast');
  assert.equal(proteinFor(chicken, { grams: 200 }), 62);
  assert.equal(proteinFor(chicken, { servings: 1 }), 47); // 150 g × 31 %
  const egg = foodById(seed(), 'egg');
  assert.equal(proteinFor(egg, { servings: 3 }), 19); // 150 g × 12.6 %
  assert.equal(proteinFor(egg, { servings: 0.5 }), 3);
  assert.equal(proteinFor(egg, { grams: -50 }), 0);
  assert.equal(proteinFor(egg, {}), 0);
});

test('entry labels say what and how much', () => {
  const egg = foodById(seed(), 'egg');
  assert.equal(entryLabel(egg, { servings: 3 }), 'Egg · 3 × large egg');
  assert.equal(entryLabel(egg, { servings: 1.5 }), 'Egg · 1.5 × large egg');
  assert.equal(entryLabel(foodById(seed(), 'rice'), { grams: 212.4 }), 'Rice (cooked) · 212 g');
});

test('logging a food records protein, calories, fat and carbs, and puts it first in recents', () => {
  let state = logFood(seed(), DAY, 'chicken-breast', { grams: 200 }, TS);
  state = logFood(state, DAY, 'egg', { servings: 2 }, TS + 1);
  state = logFood(state, DAY, 'chicken-breast', { servings: 1 }, TS + 2);
  assert.equal(dayTotal(state, DAY), 62 + 13 + 47);
  // 2 × 50 g egg: 143 kcal, 9.5 g fat, 0.7 g carbs per 100 g.
  assert.deepEqual(entriesFor(state, DAY)[1], {
    label: 'Egg · 2 × large egg',
    grams: 13,
    ts: TS + 1,
    kcal: 143,
    fatG: 10,
    carbsG: 1
  });
  assert.deepEqual(dayMacros(state, DAY), { protein: 122, kcal: 330 + 143 + 248, fat: 7 + 10 + 5, carbs: 0 + 1 + 0 });
  assert.deepEqual(recentFoods(state).map((f) => f.id), ['chicken-breast', 'egg']);
});

test('macros are worked out per amount; a food with calories but no protein still logs', () => {
  const rice = foodById(seed(), 'rice');
  assert.deepEqual(macrosFor(rice, { grams: 200 }), { protein: 5, kcal: 260, fat: 1, carbs: 56 });
  const state = logFood(seed(), DAY, 'broccoli', { grams: 10 }, TS);
  assert.deepEqual(dayMacros(state, DAY), { protein: 0, kcal: 4, fat: 0, carbs: 1 });
});

test('nothing is logged for an unknown food or an amount worth nothing', () => {
  const state = seed();
  assert.equal(logFood(state, DAY, 'nope', { grams: 100 }, TS), state);
  assert.equal(logFood(state, DAY, 'broccoli', { grams: 0 }, TS), state);
});

test('a protein-only day has no calories, not zero', () => {
  const state = addEntry(seed(), DAY, { label: 'Shake', grams: 27 }, TS);
  assert.deepEqual(dayMacros(state, DAY), { protein: 27, kcal: null, fat: null, carbs: null });
});

test('custom foods can carry calories, fat and carbs, or be protein-only as before', () => {
  const oil = normalizeCustomFood({ id: 'food-1', name: 'Olive oil', proteinPer100g: 0, kcalPer100g: 884, fatPer100g: 100 });
  assert.deepEqual(oil, {
    id: 'food-1',
    name: 'Olive oil',
    proteinPer100g: 0,
    servingG: 100,
    servingLabel: 'serving',
    kcalPer100g: 884,
    fatPer100g: 100,
    carbsPer100g: 0
  });
  const old = normalizeCustomFood({ id: 'food-2', name: 'Bar', proteinPer100g: 30 });
  assert.equal(old.kcalPer100g, undefined);
  assert.deepEqual(macrosFor(old, { grams: 50 }), { protein: 15, kcal: null, fat: null, carbs: null });
  assert.equal(normalizeCustomFood({ id: 'food-3', name: 'Water', proteinPer100g: 0 }), null);
  assert.equal(normalizeCustomFood({ id: 'food-4', name: 'Typo', proteinPer100g: 10, kcalPer100g: 5000 }).kcalPer100g, undefined);
});

test('macro entries survive a backup round trip; junk macros are dropped', () => {
  const state = logFood(seed(), DAY, 'rice', { grams: 200 }, TS);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state.nutrition, state.nutrition);
  const cleaned = migrate({ schemaVersion: 5, nutrition: { [DAY]: [{ label: 'X', grams: 10, kcal: -5, ts: 1 }, { label: 'Oil', grams: 0, kcal: 120, fatG: 14, ts: 2 }] } });
  assert.deepEqual(cleaned.nutrition[DAY], [
    { label: 'X', grams: 10, ts: 1 },
    { label: 'Oil', grams: 0, ts: 2, kcal: 120, fatG: 14, carbsG: 0 }
  ]);
});

test('recents keep the eight most recent, without duplicates', () => {
  let state = seed();
  for (const f of FOODS.slice(0, 10)) state = recordRecent(state, f.id);
  state = recordRecent(state, FOODS[5].id);
  const ids = state.settings.recentFoodIds;
  assert.equal(ids.length, 8);
  assert.equal(ids[0], FOODS[5].id);
  assert.equal(new Set(ids).size, 8);
});

test('search ignores case and accents and needs every word', () => {
  let state = addCustomFood(seed(), { id: 'food-1', name: 'Fromage blanc allégé', proteinPer100g: 8 });
  assert.deepEqual(searchFoods(state, 'ALLEGE').map((f) => f.id), ['food-1']);
  assert.deepEqual(searchFoods(state, 'greek yog').map((f) => f.id), ['greek-yogurt']);
  assert.ok(searchFoods(state, 'chicken').length >= 2);
  assert.equal(searchFoods(state, '  ').length, allFoods(state).length);
});

test('custom foods are normalised and refused when unusable', () => {
  assert.deepEqual(normalizeCustomFood({ id: 'food-1', name: ' Bar ', proteinPer100g: 33.33, servingG: 60, servingLabel: 'bar' }), {
    id: 'food-1',
    name: 'Bar',
    proteinPer100g: 33.3,
    servingG: 60,
    servingLabel: 'bar'
  });
  assert.equal(normalizeCustomFood({ id: 'food-1', name: 'X', proteinPer100g: 20 }).servingG, 100);
  assert.equal(normalizeCustomFood({ id: 'food-1', name: '', proteinPer100g: 20 }), null);
  assert.equal(normalizeCustomFood({ id: 'food-1', name: 'X', proteinPer100g: 0 }), null);
  assert.equal(normalizeCustomFood({ id: 'food-1', name: 'X', proteinPer100g: 120 }), null);
});

test('custom foods can be added, logged and removed', () => {
  let state = seed();
  const id = nextFoodId(state);
  assert.equal(id, 'food-1');
  state = addCustomFood(state, { id, name: 'Barebells bar', proteinPer100g: 36, servingG: 55, servingLabel: 'bar' });
  assert.equal(nextFoodId(state), 'food-2');
  assert.equal(addCustomFood(state, { id, name: 'dup', proteinPer100g: 1 }), state);
  state = logFood(state, DAY, id, { servings: 1 }, TS);
  assert.equal(dayTotal(state, DAY), 20);
  state = removeCustomFood(state, id);
  assert.equal(foodById(state, id), null);
  assert.deepEqual(state.settings.recentFoodIds, []);
  assert.equal(dayTotal(state, DAY), 20, 'already-logged entries stay');
});

test('food settings survive export and import, and junk is cleaned', () => {
  let state = addCustomFood(seed(), { id: 'food-1', name: 'Bar', proteinPer100g: 33, servingG: 60, servingLabel: 'bar' });
  state = logFood(state, DAY, 'food-1', { servings: 1 }, TS);
  state = logFood(state, DAY, 'egg', { servings: 2 }, TS);
  assert.deepEqual(parseBackup(serializeBackup(state, null)).state, state);

  const cleaned = migrate({
    schemaVersion: 2,
    settings: {
      customFoods: [{ id: 'food-1', name: 'Ok', proteinPer100g: 20 }, { id: 'egg', name: 'Clash', proteinPer100g: 5 }, { name: 'No id', proteinPer100g: 5 }],
      recentFoodIds: ['egg', 'gone', 'egg', 'food-1']
    }
  });
  assert.deepEqual(cleaned.settings.customFoods.map((f) => f.id), ['food-1']);
  assert.deepEqual(cleaned.settings.recentFoodIds, ['egg', 'food-1']);
});

test('food edits do not mutate the input state', () => {
  const before = addCustomFood(seed(), { id: 'food-1', name: 'Bar', proteinPer100g: 33 });
  const snapshot = JSON.stringify(before);
  logFood(before, DAY, 'egg', { servings: 1 }, TS);
  removeCustomFood(before, 'food-1');
  recordRecent(before, 'egg');
  assert.equal(JSON.stringify(before), snapshot);
});

test('the built-in list stays halal: no pork', () => {
  const pork = /pork|ham\b|bacon|schwein|speck|leberk/i;
  for (const f of FOODS) {
    if (f.id === 'turkey-ham') continue; // poultry, named after the cut
    assert.doesNotMatch(`${f.id} ${f.name} ${f.aliases}`, pork, f.id);
  }
});

test('German names find the English entries', () => {
  const ids = (q) => searchFoods(seed(), q).map((f) => f.id);
  assert.ok(ids('Hähnchenbrust').includes('chicken-breast'));
  assert.ok(ids('magerquark').includes('quark'));
  assert.ok(ids('thunfisch').includes('tuna-can'));
  assert.ok(ids('Putenschinken').includes('turkey-ham'));
});
