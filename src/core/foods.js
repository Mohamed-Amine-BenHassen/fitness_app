// Built-in foods plus the user's own, and turning "200 g of chicken" or "3 eggs"
// into a log entry with protein, calories, fat and carbs. Pure module — the
// caller passes date and time.
//
// Values are per 100 g as eaten (meat and fish cooked, grains cooked unless
// marked dry), rounded from standard food-composition tables. Brands differ,
// so these are estimates; add exact products as custom foods.
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

const PROTEIN_LIST = [
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
  food('doner', 'Döner kebab (in bread)', 9, 400, 'kebab', 'Döner Kebab Dönertasche'),
  food('pizza-margherita', 'Pizza margherita', 10, 350, 'pizza', 'Pizza'),
  food('cheeseburger', 'Cheeseburger', 12.5, 120, 'burger', 'Burger Hamburger'),
  // Turkish (portions are typical German takeaway sizes)
  food('durum', 'Dürüm / Yufka döner wrap', 9, 450, 'wrap', 'Dürüm Yufka Döner Wrap Rollo'),
  food('doner-box', 'Döner box (with fries)', 7, 400, 'box', 'Dönerbox Döner Box Pommes'),
  food('doner-plate', 'Döner plate (with rice & salad)', 9, 500, 'plate', 'Dönerteller Döner Teller'),
  food('doner-meat', 'Döner meat only (chicken or beef)', 20, 150, 'portion', 'Dönerfleisch Hähnchendöner Döner Fleisch'),
  food('lahmacun', 'Lahmacun', 10, 180, 'lahmacun', 'Lahmacun türkische Pizza'),
  food('pide', 'Pide (meat or cheese)', 11, 300, 'pide', 'Pide'),
  food('kofte', 'Köfte (grilled)', 17, 150, 'portion', 'Köfte Frikadellen Kofte'),
  food('adana', 'Adana kebab', 17, 150, 'skewer', 'Adana Kebab Spieß'),
  food('borek', 'Börek (cheese or spinach)', 9, 150, 'piece', 'Börek Burek'),
  food('menemen', 'Menemen (Turkish eggs)', 7, 250, 'pan', 'Menemen Rührei'),
  // sushi
  food('nigiri', 'Sushi nigiri (salmon / tuna)', 9, 38, 'piece', 'Sushi Nigiri Lachs'),
  food('maki', 'Sushi maki (salmon / tuna)', 6, 25, 'piece', 'Sushi Maki Hosomaki'),
  food('inside-out-roll', 'Sushi inside-out / California roll', 4.5, 30, 'piece', 'Sushi California Roll Inside Out Uramaki'),
  food('sashimi', 'Sashimi (salmon / tuna)', 21, 15, 'slice', 'Sashimi Sushi roher Fisch'),
  // Asian
  food('buldak', 'Buldak ramen (Samyang, dry pack)', 9.3, 140, 'pack', 'Buldak Samyang Ramen Nudeln scharf'),
  food('instant-noodles', 'Instant noodles (dry pack)', 9, 80, 'pack', 'Instantnudeln Ramen Nudeln Yum Yum'),
  food('chicken-ramen', 'Chicken ramen (restaurant bowl)', 5, 600, 'bowl', 'Ramen Nudelsuppe'),
  food('pho', 'Pho with beef or chicken', 4.5, 650, 'bowl', 'Pho Nudelsuppe'),
  food('pad-thai', 'Pad thai with chicken', 8, 350, 'plate', 'Pad Thai gebratene Nudeln'),
  food('bibimbap', 'Bibimbap', 6, 450, 'bowl', 'Bibimbap'),
  food('butter-chicken', 'Butter chicken (curry only)', 12, 250, 'portion', 'Butter Chicken Curry Hähnchen'),
  food('biryani', 'Chicken biryani', 7, 400, 'plate', 'Biryani Reis'),
  // more takeaway
  food('burrito', 'Burrito with chicken', 9, 350, 'burrito', 'Burrito Wrap'),
  food('falafel-wrap', 'Falafel wrap', 6.5, 300, 'wrap', 'Falafel Dürüm Wrap'),
  food('chicken-schnitzel', 'Chicken schnitzel, breaded', 20, 180, 'schnitzel', 'Hähnchenschnitzel Putenschnitzel paniert Schnitzel')
];

// [kcal, fat g, carbs g] per 100 g for every food above, by id. Carbs include
// fibre (as on EU labels they would not), which is why fibre-rich foods such as
// nuts and beans add up to a little more than their kcal.
const MACROS = {
  'chicken-breast': [165, 3.6, 0],
  'chicken-thigh': [179, 8.2, 0],
  'chicken-drumstick': [150, 6, 0],
  'chicken-wings': [290, 19.5, 0],
  'chicken-nuggets': [295, 18, 16],
  'turkey-breast': [135, 1.5, 0],
  'turkey-mince': [205, 11, 0],
  'turkey-slices': [110, 1.5, 3],
  'beef-mince-lean': [175, 7, 0],
  'beef-mince-20': [270, 19, 0],
  'beef-steak': [210, 10, 0],
  lamb: [285, 21, 0],
  veal: [150, 3.5, 0],
  'turkey-ham': [115, 3.5, 2],
  'beef-salami': [370, 31, 1],
  sucuk: [390, 33, 2],
  'poultry-sausage': [220, 17, 3],
  'beef-jerky': [290, 8, 20],
  salmon: [206, 12, 0],
  'smoked-salmon': [130, 4.5, 0],
  'tuna-can': [110, 0.8, 0],
  'tuna-oil': [190, 8, 0],
  'tuna-steak': [135, 1.3, 0],
  cod: [105, 0.9, 0],
  trout: [150, 6.5, 0],
  'fish-fingers': [225, 10, 20],
  'pickled-herring': [250, 18, 6],
  prawns: [100, 1, 0],
  sardines: [205, 11.5, 0],
  mackerel: [250, 18, 0],
  egg: [143, 9.5, 0.7],
  'egg-white': [52, 0.2, 0.7],
  'greek-yogurt': [59, 0.4, 3.6],
  'natural-yogurt': [66, 3.5, 4.7],
  skyr: [63, 0.2, 4],
  quark: [67, 0.3, 4],
  'cottage-cheese': [98, 4.3, 3.4],
  'cream-cheese': [290, 28, 3.5],
  'protein-pudding': [75, 1.5, 6],
  'protein-drink': [60, 1, 5],
  milk: [47, 1.6, 4.8],
  buttermilk: [36, 0.5, 4.2],
  kefir: [60, 3.5, 4],
  cheddar: [403, 33, 1.3],
  gouda: [356, 27, 2],
  emmental: [380, 29, 0],
  harzer: [120, 0.5, 0],
  feta: [264, 21, 4],
  halloumi: [320, 25, 2],
  mozzarella: [250, 19, 1],
  parmesan: [400, 28, 0],
  whey: [390, 6, 6],
  'whey-isolate': [370, 1, 2],
  casein: [365, 2, 7],
  'pea-protein': [390, 7, 3],
  'protein-bar': [360, 12, 30],
  'protein-bread': [250, 13, 7],
  tofu: [145, 8.7, 2],
  tempeh: [195, 11, 7.6],
  seitan: [135, 2, 5],
  'soy-chunks': [335, 1, 30],
  edamame: [121, 5.2, 8.9],
  falafel: [333, 18, 32],
  lentils: [116, 0.4, 20],
  chickpeas: [164, 2.6, 27],
  'black-beans': [132, 0.5, 24],
  'kidney-beans': [127, 0.5, 22.8],
  'white-beans': [139, 0.4, 25],
  'green-peas': [84, 0.2, 15.6],
  hummus: [166, 9.6, 14],
  'soy-milk': [43, 1.8, 2.5],
  'peanut-butter': [588, 50, 20],
  peanuts: [567, 49, 16],
  almonds: [579, 50, 22],
  cashews: [553, 44, 30],
  walnuts: [654, 65, 14],
  'mixed-nuts': [607, 54, 21],
  'pumpkin-seeds': [559, 49, 11],
  'sunflower-seeds': [584, 51, 20],
  'hemp-seeds': [553, 49, 9],
  'chia-seeds': [486, 31, 42],
  oats: [372, 7, 59],
  muesli: [360, 6, 62],
  'bread-wholemeal': [247, 3.4, 41],
  'bread-rye': [220, 1.5, 44],
  'bread-white': [265, 3.2, 49],
  'bread-roll': [275, 2, 55],
  tortilla: [310, 8, 50],
  pasta: [158, 0.9, 31],
  rice: [130, 0.3, 28],
  couscous: [112, 0.2, 23],
  quinoa: [120, 1.9, 21],
  potato: [87, 0.1, 20],
  broccoli: [35, 0.4, 7],
  spinach: [23, 0.3, 3.8],
  doner: [215, 10, 22],
  'pizza-margherita': [250, 9, 31],
  cheeseburger: [263, 12, 26],
  durum: [210, 9, 22],
  'doner-box': [230, 13, 20],
  'doner-plate': [160, 7, 14],
  'doner-meat': [230, 15, 2],
  lahmacun: [230, 8, 30],
  pide: [260, 11, 28],
  kofte: [235, 16, 4],
  adana: [245, 18, 2],
  borek: [300, 17, 27],
  menemen: [112, 8, 4],
  nigiri: [150, 2.5, 22],
  maki: [143, 1.5, 27],
  'inside-out-roll': [175, 6, 25],
  sashimi: [155, 7, 0],
  buldak: [380, 12, 61],
  'instant-noodles': [450, 18, 60],
  'chicken-ramen': [77, 2.5, 9],
  pho: [65, 1.5, 8],
  'pad-thai': [180, 7, 21],
  bibimbap: [130, 4, 18],
  'butter-chicken': [160, 10, 5],
  biryani: [170, 6, 22],
  burrito: [200, 7, 25],
  'falafel-wrap': [230, 10, 28],
  'chicken-schnitzel': [245, 12, 13]
};

export const FOODS = PROTEIN_LIST.map((f) => {
  const [kcalPer100g, fatPer100g, carbsPer100g] = MACROS[f.id];
  return { ...f, kcalPer100g, fatPer100g, carbsPer100g };
});

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

// { protein, kcal, fat, carbs } eaten, whole numbers. A custom food saved before
// calories were tracked has no kcal/fat/carbs, and gives null for them.
export function macrosFor(food, amount) {
  const grams = gramsEaten(food, amount);
  const of = (per100) => (per100 === null || per100 === undefined ? null : Math.round((grams * per100) / 100));
  return { protein: proteinFor(food, amount), kcal: of(food.kcalPer100g), fat: of(food.fatPer100g), carbs: of(food.carbsPer100g) };
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

// Adds the entry for today and moves the food to the top of recents. Nothing is
// logged for an unknown food or an amount with neither protein nor calories.
export function logFood(state, dateKey, foodId, amount, ts) {
  const found = foodById(state, foodId);
  if (!found) return state;
  const { protein, kcal, fat, carbs } = macrosFor(found, amount);
  const entry = { label: entryLabel(found, amount), grams: protein, kcal, fatG: fat, carbsG: carbs };
  const next = addEntry(state, dateKey, entry, ts);
  return next === state ? state : recordRecent(next, foodId);
}

export function nextFoodId(state) {
  const highest = state.settings.customFoods.reduce((max, f) => {
    const m = String(f.id).match(/^food-(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `food-${highest + 1}`;
}

// A per-100 g value to one decimal, or null when not given; above `max` is a typo.
function per100Of(value, max) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 10) / 10;
}

// Normalises a custom food; null when it can't be logged (no name, or neither
// protein nor calories). Calories, fat and carbs are optional — foods saved
// before they were tracked have none.
export function normalizeCustomFood(raw) {
  const name = String(raw?.name || '').trim();
  const protein = per100Of(raw?.proteinPer100g, 100) ?? 0;
  const kcal = per100Of(raw?.kcalPer100g, 900);
  const kcalPer100g = kcal === null ? null : Math.round(kcal);
  if (!name || typeof raw?.id !== 'string' || !raw.id || (protein <= 0 && !kcalPer100g)) return null;
  const servingG = Math.round(clampNonNegative(raw?.servingG));
  const food = {
    id: raw.id,
    name,
    proteinPer100g: protein,
    servingG: servingG > 0 ? servingG : 100,
    servingLabel: String(raw?.servingLabel || '').trim() || 'serving'
  };
  if (kcalPer100g === null) return food;
  return { ...food, kcalPer100g, fatPer100g: per100Of(raw?.fatPer100g, 100) ?? 0, carbsPer100g: per100Of(raw?.carbsPer100g, 100) ?? 0 };
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
