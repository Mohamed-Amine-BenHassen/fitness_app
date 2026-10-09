// Built-in protein foods plus the user's own, and turning "200 g of chicken" or
// "3 eggs" into a protein entry. Pure module — the caller passes date and time.
//
// Values are protein per 100 g as eaten (meat and fish cooked, grains cooked
// unless marked dry), rounded from standard food-composition tables. Brands
// differ, so these are estimates; add exact products as custom foods.

import { addEntry } from './nutrition.js';
import { clampNonNegative } from './schema.js';

const food = (id, name, proteinPer100g, servingG, servingLabel) => ({ id, name, proteinPer100g, servingG, servingLabel });

export const FOODS = [
  // meat
  food('chicken-breast', 'Chicken breast (cooked)', 31, 150, 'breast'),
  food('chicken-thigh', 'Chicken thigh, skinless (cooked)', 25, 100, 'thigh'),
  food('turkey-breast', 'Turkey breast (cooked)', 29, 150, 'portion'),
  food('turkey-slices', 'Turkey slices (deli)', 22, 30, '2 slices'),
  food('beef-mince-lean', 'Lean beef mince 5% (cooked)', 27, 125, 'portion'),
  food('beef-steak', 'Beef steak (cooked)', 29, 200, 'steak'),
  food('pork-loin', 'Pork loin (cooked)', 27, 150, 'portion'),
  food('ham', 'Ham, sliced', 18, 25, 'slice'),
  food('beef-jerky', 'Beef jerky', 33, 30, 'small bag'),
  // fish
  food('salmon', 'Salmon (cooked)', 25, 125, 'fillet'),
  food('smoked-salmon', 'Smoked salmon', 23, 50, 'portion'),
  food('tuna-can', 'Tuna in water (drained)', 25, 100, 'can'),
  food('cod', 'Cod / white fish (cooked)', 23, 150, 'fillet'),
  food('prawns', 'Prawns / shrimp (cooked)', 24, 100, 'portion'),
  food('sardines', 'Sardines, canned (drained)', 25, 90, 'can'),
  food('mackerel', 'Mackerel (cooked)', 20, 100, 'fillet'),
  // eggs and dairy
  food('egg', 'Egg', 12.6, 50, 'large egg'),
  food('egg-white', 'Egg whites', 10.9, 33, 'egg white'),
  food('greek-yogurt', 'Greek yogurt, 0%', 10, 170, 'pot'),
  food('skyr', 'Skyr', 11, 150, 'pot'),
  food('quark', 'Quark, low fat', 12.5, 250, 'tub'),
  food('cottage-cheese', 'Cottage cheese', 11, 150, 'bowl'),
  food('protein-pudding', 'High-protein pudding', 10, 200, 'pot'),
  food('milk', 'Milk, semi-skimmed', 3.5, 250, 'glass'),
  food('kefir', 'Kefir', 3.6, 250, 'glass'),
  food('cheddar', 'Cheddar', 25, 30, 'slice'),
  food('mozzarella', 'Mozzarella', 18, 125, 'ball'),
  food('parmesan', 'Parmesan', 35, 10, 'tbsp grated'),
  // supplements
  food('whey', 'Whey protein powder', 78, 30, 'scoop'),
  food('whey-isolate', 'Whey isolate / clear whey', 88, 25, 'scoop'),
  food('pea-protein', 'Pea protein powder', 80, 30, 'scoop'),
  food('protein-bar', 'Protein bar (typical)', 33, 60, 'bar'),
  // plant protein
  food('tofu', 'Tofu, firm', 15, 100, 'portion'),
  food('tempeh', 'Tempeh', 19, 100, 'portion'),
  food('seitan', 'Seitan', 25, 100, 'portion'),
  food('edamame', 'Edamame', 11, 100, 'portion'),
  food('lentils', 'Lentils (cooked)', 9, 200, 'cup'),
  food('chickpeas', 'Chickpeas (cooked)', 8, 120, 'half can'),
  food('black-beans', 'Black beans (cooked)', 8.9, 170, 'cup'),
  food('kidney-beans', 'Kidney beans (cooked)', 8.7, 120, 'half can'),
  food('hummus', 'Hummus', 7.9, 30, '2 tbsp'),
  food('soy-milk', 'Soy milk', 3.3, 250, 'glass'),
  // nuts
  food('peanut-butter', 'Peanut butter', 25, 16, 'tbsp'),
  food('peanuts', 'Peanuts', 26, 30, 'handful'),
  food('almonds', 'Almonds', 21, 30, 'handful'),
  // carbs that still count
  food('oats', 'Oats (dry)', 13, 50, 'portion'),
  food('bread-wholemeal', 'Bread, wholemeal', 10, 38, 'slice'),
  food('bread-white', 'Bread, white', 8, 36, 'slice'),
  food('pasta', 'Pasta (cooked)', 5.8, 220, 'portion'),
  food('rice', 'Rice (cooked)', 2.7, 180, 'portion'),
  food('quinoa', 'Quinoa (cooked)', 4.4, 185, 'portion'),
  food('potato', 'Potatoes (boiled)', 2, 200, 'portion'),
  food('broccoli', 'Broccoli (cooked)', 2.4, 100, 'portion')
];

const MAX_RECENTS = 8;

export function allFoods(state) {
  return [...FOODS, ...state.settings.customFoods.map((f) => ({ ...f, custom: true }))];
}

export function foodById(state, foodId) {
  return allFoods(state).find((f) => f.id === foodId) || null;
}

export function recentFoods(state) {
  return state.settings.recentFoodIds.map((id) => foodById(state, id)).filter(Boolean);
}

// Accent- and case-insensitive; every word of the query must appear in the name.
export function searchFoods(state, query) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const foods = allFoods(state);
  if (words.length === 0) return foods;
  return foods.filter((f) => words.every((w) => fold(f.name).includes(w)));
}

// amount: { grams } or { servings }. Returns whole grams of protein.
export function gramsEaten(food, amount) {
  if (amount?.servings !== undefined) return clampNonNegative(amount.servings) * food.servingG;
  return clampNonNegative(amount?.grams);
}

export function proteinFor(food, amount) {
  return Math.round((gramsEaten(food, amount) * food.proteinPer100g) / 100);
}

const trimNumber = (n) => String(Math.round(n * 100) / 100);

// "Chicken breast (cooked) · 200 g" or "Egg · 3 × large egg".
export function entryLabel(food, amount) {
  if (amount?.servings !== undefined) {
    const count = clampNonNegative(amount.servings);
    return `${food.name} · ${trimNumber(count)} × ${food.servingLabel}`;
  }
  return `${food.name} · ${Math.round(gramsEaten(food, amount))} g`;
}

export function recordRecent(state, foodId) {
  const recentFoodIds = [foodId, ...state.settings.recentFoodIds.filter((id) => id !== foodId)].slice(0, MAX_RECENTS);
  return { ...state, settings: { ...state.settings, recentFoodIds } };
}

// Adds the protein entry for today and moves the food to the top of recents.
// Nothing is logged for an unknown food or an amount that rounds to 0 g.
export function logFood(state, dateKey, foodId, amount, ts) {
  const found = foodById(state, foodId);
  if (!found) return state;
  const grams = proteinFor(found, amount);
  if (grams <= 0) return state;
  return recordRecent(addEntry(state, dateKey, { label: entryLabel(found, amount), grams }, ts), foodId);
}

export function nextFoodId(state) {
  const highest = state.settings.customFoods.reduce((max, f) => {
    const m = String(f.id).match(/^food-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `food-${highest + 1}`;
}

// Normalises a custom food; null when it can't be logged (no name or protein).
export function normalizeCustomFood(raw) {
  const name = String(raw?.name || '').trim();
  const per100 = Math.round(clampNonNegative(raw?.proteinPer100g) * 10) / 10;
  if (!name || per100 <= 0 || per100 > 100 || typeof raw?.id !== 'string' || !raw.id) return null;
  const servingG = Math.round(clampNonNegative(raw?.servingG));
  return {
    id: raw.id,
    name,
    proteinPer100g: per100,
    servingG: servingG > 0 ? servingG : 100,
    servingLabel: String(raw?.servingLabel || '').trim() || 'serving'
  };
}

export function addCustomFood(state, raw) {
  const clean = normalizeCustomFood(raw);
  if (!clean || foodById(state, clean.id)) return state;
  return { ...state, settings: { ...state.settings, customFoods: [...state.settings.customFoods, clean] } };
}

export function removeCustomFood(state, foodId) {
  const customFoods = state.settings.customFoods.filter((f) => f.id !== foodId);
  if (customFoods.length === state.settings.customFoods.length) return state;
  const recentFoodIds = state.settings.recentFoodIds.filter((id) => id !== foodId);
  return { ...state, settings: { ...state.settings, customFoods, recentFoodIds } };
}
