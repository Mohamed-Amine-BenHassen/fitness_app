// Built-in protein foods plus the user's own, and turning "200 g of chicken" or
// "3 eggs" into a protein entry. Pure module — the caller passes date and time.
//
// Values are protein per 100 g as eaten (meat and fish cooked, grains cooked
// unless marked dry), rounded from standard food-composition tables. Brands
// differ, so these are estimates; add exact products as custom foods.
// The list is kept halal: no pork or pork products.

import { addEntry } from './nutrition.js';
import { clampNonNegative } from './schema.js';

// `aliases` are extra search words (German names, other spellings); never shown.
const food = (id, name, proteinPer100g, servingG, servingLabel, aliases = '') => ({
  id,
  name,
  proteinPer100g,
  servingG,
  servingLabel,
  aliases
});

export const FOODS = [
  // poultry
  food('chicken-breast', 'Chicken breast (cooked)', 31, 150, 'breast', 'Hähnchenbrust Hühnerbrust Hähnchen Huhn'),
  food('chicken-thigh', 'Chicken thigh, skinless (cooked)', 25, 100, 'thigh', 'Hähnchenschenkel Hähnchenoberschenkel'),
  food('chicken-drumstick', 'Chicken drumstick, skinless (cooked)', 24, 75, 'drumstick', 'Hähnchenunterschenkel Keule'),
  food('chicken-wings', 'Chicken wings (cooked, with skin)', 27, 30, 'wing', 'Chicken Wings Hähnchenflügel'),
  food('chicken-nuggets', 'Chicken nuggets', 15, 100, '6 nuggets', 'Nuggets'),
  food('turkey-breast', 'Turkey breast (cooked)', 29, 150, 'portion', 'Putenbrust Pute Truthahn'),
  food('turkey-mince', 'Turkey mince (cooked)', 27, 125, 'portion', 'Putenhack Putenhackfleisch'),
  food('turkey-slices', 'Turkey slices (deli)', 22, 30, '2 slices', 'Putenbrust Aufschnitt Putenaufschnitt'),
  // red meat and halal deli (no pork anywhere in the list)
  food('beef-mince-lean', 'Lean beef mince 5% (cooked)', 27, 125, 'portion', 'Rinderhack Tatar Hackfleisch'),
  food('beef-mince-20', 'Beef mince 20% (cooked)', 25, 125, 'portion', 'Rinderhackfleisch Hackfleisch'),
  food('beef-steak', 'Beef steak (cooked)', 29, 200, 'steak', 'Rindersteak Rind Steak Rumpsteak'),
  food('lamb', 'Lamb (cooked)', 25, 150, 'portion', 'Lamm Lammfleisch'),
  food('veal', 'Veal escalope (cooked)', 30, 150, 'escalope', 'Kalb Kalbsschnitzel Schnitzel'),
  food('turkey-ham', 'Turkey ham, sliced', 19, 25, 'slice', 'Putenschinken Geflügelschinken Schinken'),
  food('beef-salami', 'Beef salami', 22, 10, 'slice', 'Rindersalami Salami'),
  food('sucuk', 'Sucuk (beef sausage)', 22, 50, 'portion', 'Sucuk Knoblauchwurst Rindswurst'),
  food('poultry-sausage', 'Chicken / turkey sausage', 13, 50, 'sausage', 'Geflügelwürstchen Geflügel-Wiener Hähnchenwurst Wurst'),
  food('beef-jerky', 'Beef jerky', 33, 30, 'small bag', 'Trockenfleisch'),
  // fish and seafood
  food('salmon', 'Salmon (cooked)', 25, 125, 'fillet', 'Lachs Lachsfilet'),
  food('smoked-salmon', 'Smoked salmon', 23, 50, 'portion', 'Räucherlachs'),
  food('tuna-can', 'Tuna in water (drained)', 25, 100, 'can', 'Thunfisch Dose'),
  food('tuna-oil', 'Tuna in oil (drained)', 27, 100, 'can', 'Thunfisch in Öl'),
  food('tuna-steak', 'Tuna steak (cooked)', 29, 150, 'steak', 'Thunfischsteak'),
  food('cod', 'Cod / white fish (cooked)', 23, 150, 'fillet', 'Kabeljau Seelachs Alaska-Seelachs Fisch Dorsch'),
  food('trout', 'Trout (cooked)', 24, 125, 'fillet', 'Forelle'),
  food('fish-fingers', 'Fish fingers (baked)', 13, 28, 'finger', 'Fischstäbchen'),
  food('pickled-herring', 'Herring, pickled / Matjes', 16, 50, 'fillet', 'Matjes Hering Bismarckhering'),
  food('prawns', 'Prawns / shrimp (cooked)', 24, 100, 'portion', 'Garnelen Shrimps Krabben'),
  food('sardines', 'Sardines, canned (drained)', 25, 90, 'can', 'Sardinen'),
  food('mackerel', 'Mackerel (cooked)', 20, 100, 'fillet', 'Makrele'),
  // eggs and dairy
  food('egg', 'Egg', 12.6, 50, 'large egg', 'Ei Eier'),
  food('egg-white', 'Egg whites', 10.9, 33, 'egg white', 'Eiweiß Eiklar'),
  food('greek-yogurt', 'Greek yogurt, 0%', 10, 170, 'pot', 'Griechischer Joghurt'),
  food('natural-yogurt', 'Natural yogurt', 4, 150, 'pot', 'Naturjoghurt Joghurt'),
  food('skyr', 'Skyr', 11, 150, 'pot', 'Skyr'),
  food('quark', 'Quark, low fat', 12.5, 250, 'tub', 'Magerquark Speisequark'),
  food('cottage-cheese', 'Cottage cheese', 11, 150, 'bowl', 'Hüttenkäse körniger Frischkäse'),
  food('cream-cheese', 'Cream cheese', 6, 30, '2 tbsp', 'Frischkäse'),
  food('protein-pudding', 'High-protein pudding', 10, 200, 'pot', 'Proteinpudding Eiweißpudding'),
  food('protein-drink', 'Protein shake, ready to drink', 8, 330, 'bottle', 'Proteinshake Proteindrink Eiweißshake'),
  food('milk', 'Milk, semi-skimmed', 3.5, 250, 'glass', 'Milch'),
  food('buttermilk', 'Buttermilk', 3.3, 250, 'glass', 'Buttermilch'),
  food('kefir', 'Kefir', 3.6, 250, 'glass', 'Kefir'),
  food('cheddar', 'Cheddar', 25, 30, 'slice', 'Käse'),
  food('gouda', 'Gouda', 25, 25, 'slice', 'Gouda Käse'),
  food('emmental', 'Emmental', 28, 25, 'slice', 'Emmentaler Käse'),
  food('harzer', 'Harzer Käse (sour milk cheese)', 29, 50, 'portion', 'Harzer Roller Handkäse Sauermilchkäse'),
  food('feta', 'Feta', 16, 50, 'portion', 'Schafskäse Hirtenkäse'),
  food('halloumi', 'Halloumi', 21, 80, 'portion', 'Grillkäse'),
  food('mozzarella', 'Mozzarella', 18, 125, 'ball', 'Mozzarella'),
  food('parmesan', 'Parmesan', 35, 10, 'tbsp grated', 'Parmesan Hartkäse'),
  // supplements and protein products
  food('whey', 'Whey protein powder', 78, 30, 'scoop', 'Eiweißpulver Proteinpulver Whey'),
  food('whey-isolate', 'Whey isolate / clear whey', 88, 25, 'scoop', 'Clear Whey Isolat'),
  food('casein', 'Casein protein powder', 78, 30, 'scoop', 'Casein Kasein'),
  food('pea-protein', 'Pea protein powder', 80, 30, 'scoop', 'Erbsenprotein veganes Proteinpulver'),
  food('protein-bar', 'Protein bar (typical)', 33, 60, 'bar', 'Proteinriegel Eiweißriegel'),
  food('protein-bread', 'Protein bread (low-carb)', 22, 50, 'slice', 'Eiweißbrot Proteinbrot'),
  // plant protein
  food('tofu', 'Tofu, firm', 15, 100, 'portion', 'Tofu'),
  food('tempeh', 'Tempeh', 19, 100, 'portion', 'Tempeh'),
  food('seitan', 'Seitan', 25, 100, 'portion', 'Seitan'),
  food('soy-chunks', 'Soy chunks / TVP (dry)', 50, 30, 'portion', 'Sojaschnetzel Sojagranulat'),
  food('edamame', 'Edamame', 11, 100, 'portion', 'Sojabohnen'),
  food('falafel', 'Falafel', 13, 60, '3 balls', 'Falafel'),
  food('lentils', 'Lentils (cooked)', 9, 200, 'cup', 'Linsen'),
  food('chickpeas', 'Chickpeas (cooked)', 8, 120, 'half can', 'Kichererbsen'),
  food('black-beans', 'Black beans (cooked)', 8.9, 170, 'cup', 'schwarze Bohnen'),
  food('kidney-beans', 'Kidney beans (cooked)', 8.7, 120, 'half can', 'Kidneybohnen rote Bohnen'),
  food('white-beans', 'White beans (cooked)', 9.7, 120, 'half can', 'weiße Bohnen Cannellini'),
  food('green-peas', 'Green peas (cooked)', 5.4, 80, 'portion', 'Erbsen'),
  food('hummus', 'Hummus', 7.9, 30, '2 tbsp', 'Hummus'),
  food('soy-milk', 'Soy milk', 3.3, 250, 'glass', 'Sojamilch Sojadrink'),
  // nuts and seeds
  food('peanut-butter', 'Peanut butter', 25, 16, 'tbsp', 'Erdnussbutter Erdnussmus'),
  food('peanuts', 'Peanuts', 26, 30, 'handful', 'Erdnüsse'),
  food('almonds', 'Almonds', 21, 30, 'handful', 'Mandeln'),
  food('cashews', 'Cashews', 18, 30, 'handful', 'Cashewkerne'),
  food('walnuts', 'Walnuts', 15, 30, 'handful', 'Walnüsse'),
  food('mixed-nuts', 'Mixed nuts', 20, 30, 'handful', 'Nussmischung Nüsse'),
  food('pumpkin-seeds', 'Pumpkin seeds', 30, 15, 'tbsp', 'Kürbiskerne'),
  food('sunflower-seeds', 'Sunflower seeds', 21, 15, 'tbsp', 'Sonnenblumenkerne'),
  food('hemp-seeds', 'Hemp seeds, hulled', 32, 15, 'tbsp', 'Hanfsamen'),
  food('chia-seeds', 'Chia seeds', 17, 15, 'tbsp', 'Chiasamen'),
  // grains, bread and carbs that still count
  food('oats', 'Oats (dry)', 13, 50, 'portion', 'Haferflocken Hafer'),
  food('muesli', 'Muesli (dry)', 10, 60, 'bowl', 'Müsli'),
  food('bread-wholemeal', 'Bread, wholemeal', 10, 38, 'slice', 'Vollkornbrot'),
  food('bread-rye', 'Bread, rye mixed', 6.5, 45, 'slice', 'Roggenmischbrot Mischbrot Graubrot'),
  food('bread-white', 'Bread, white', 8, 36, 'slice', 'Weißbrot Toast Toastbrot'),
  food('bread-roll', 'Bread roll', 9, 60, 'roll', 'Brötchen Semmel Schrippe'),
  food('tortilla', 'Tortilla wrap', 8.5, 60, 'wrap', 'Wrap'),
  food('pasta', 'Pasta (cooked)', 5.8, 220, 'portion', 'Nudeln Spaghetti'),
  food('rice', 'Rice (cooked)', 2.7, 180, 'portion', 'Reis Basmati'),
  food('couscous', 'Couscous (cooked)', 3.8, 180, 'portion', 'Couscous'),
  food('quinoa', 'Quinoa (cooked)', 4.4, 185, 'portion', 'Quinoa'),
  food('potato', 'Potatoes (boiled)', 2, 200, 'portion', 'Kartoffeln Salzkartoffeln'),
  // vegetables
  food('broccoli', 'Broccoli (cooked)', 2.4, 100, 'portion', 'Brokkoli'),
  food('spinach', 'Spinach (cooked)', 3, 100, 'portion', 'Spinat'),
  // common meals (rough: recipes vary a lot)
  food('doner', 'Döner kebab (in bread)', 9, 400, 'kebab', 'Döner Dürüm Kebab'),
  food('pizza-margherita', 'Pizza margherita', 10, 350, 'pizza', 'Pizza'),
  food('cheeseburger', 'Cheeseburger', 12.5, 120, 'burger', 'Burger Hamburger')
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

// Accent- and case-insensitive; every word of the query must appear in the name
// or its aliases, so "Hähnchen" or "Magerquark" finds the English entry.
export function searchFoods(state, query) {
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const foods = allFoods(state);
  if (words.length === 0) return foods;
  return foods.filter((f) => {
    const text = fold(`${f.name} ${f.aliases || ''}`);
    return words.every((w) => text.includes(w));
  });
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
