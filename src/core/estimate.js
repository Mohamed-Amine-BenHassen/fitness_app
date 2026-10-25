// Photo → calories and macros through whichever AI chat app the user already
// has. The app copies PHOTO_PROMPT; the chat app looks at the meal photo and
// answers in one line; parseEstimate reads that line back. Nothing is logged
// from here — the result only fills the review sheet. Pure module.
//
// Answers in the older protein-only format ("PROTEIN: chicken, 150 g, 46 g")
// still parse, with no calories.

export const PHOTO_PROMPT = [
  'Estimate the calories and macros in the meal in the attached photo.',
  'Reply with one line only, in exactly this format, and nothing else:',
  'FOOD: <food>, <portion> g, <kcal> kcal, <protein> g protein, <fat> g fat, <carbs> g carbs | <next food>, …',
  '- One entry per food you can see. Estimate the portion as eaten (cooked weight).',
  '- Every number is for that portion, not per 100 g. Count cooking oil and sauces.',
  '- Plain numbers only, no ranges. If something is unclear, give your best estimate.',
  'Example: FOOD: grilled chicken breast, 150 g, 248 kcal, 46 g protein, 5 g fat, 0 g carbs | white rice, 200 g, 260 kcal, 5 g protein, 1 g fat, 56 g carbs'
].join('\n');

const MAX_ITEMS = 15;
const MAX_NAME = 60;
const MAX_PORTION_G = 3000;
const MAX_PROTEIN_G = 300;
const MAX_KCAL = 5000;
const MAX_MACRO_G = 1000;

// "46", "46 g", "~46g", "≈ 46.5 g", "40-50 g" (a range becomes its midpoint).
function amountOf(text) {
  const match = String(text).match(/(\d+(?:\.\d+)?)(?:\s*[-–—]\s*(\d+(?:\.\d+)?))?/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  return (low + high) / 2;
}

// Chat apps wrap answers in markdown: drop fences, bold, bullets and smart quotes.
function plain(text) {
  return String(text)
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .join('\n');
}

// Read from the right — protein, then portion, then the name — so a name with
// its own comma ("chicken, grilled") still parses.
// Which macro a labelled number is ("248 kcal", "46 g protein", "P: 46"), or null.
const LABELS = [
  ['kcal', /\b(?:k?cals?|calories)\b/i],
  ['protein', /\bprotein\b|^p\b|\bp\s*[:=]/i],
  ['fat', /\bfats?\b|^f\b|\bf\s*[:=]/i],
  ['carbs', /\bcarb(?:ohydrate)?s?\b|^c\b|\bc\s*[:=]/i]
];
const labelOf = (part) => LABELS.find(([, pattern]) => pattern.test(part))?.[0] ?? null;

// "chicken, 150 g, 248 kcal, 46 g protein, 5 g fat, 0 g carbs": the name runs
// up to the first number, the first unlabelled number is the portion.
function labelledItem(parts) {
  const values = { kcal: null, protein: null, fat: null, carbs: null };
  const nameParts = [];
  let grams = null;
  for (const part of parts) {
    if (!/\d/.test(part)) {
      if (grams === null && Object.values(values).every((v) => v === null)) nameParts.push(part);
      continue;
    }
    const label = labelOf(part);
    if (label) values[label] = amountOf(part);
    else if (grams === null && nameParts.length > 0) grams = amountOf(part);
  }
  const name = nameParts.join(', ').replace(/[:\s]+$/, '').trim().slice(0, MAX_NAME);
  const { kcal, protein, fat, carbs } = values;
  if (!name || (protein === null && kcal === null)) return null;
  const within = (v, max) => v === null || (v >= 0 && v <= max);
  if (!within(protein, MAX_PROTEIN_G) || !within(kcal, MAX_KCAL) || !within(fat, MAX_MACRO_G) || !within(carbs, MAX_MACRO_G)) return null;
  if (grams !== null && (grams < 1 || grams > MAX_PORTION_G || (protein ?? 0) > grams)) return null;
  const round = (v) => (v === null ? null : Math.round(v));
  const item = { name, grams: round(grams), protein: round(protein) ?? 0 };
  if (kcal === null) return item;
  return { ...item, kcal: round(kcal), fat: round(fat) ?? 0, carbs: round(carbs) ?? 0 };
}

function itemOf(text) {
  // A decimal comma ("17,5 g") has no space after it; a separator does.
  const parts = text
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(',')
    .map((part) => part.trim());
  if (parts.some((part) => /\d/.test(part) && labelOf(part))) return labelledItem(parts);
  if (parts.length < 2 || !/\d/.test(parts.at(-1))) return null;
  const hasPortion = parts.length >= 3 && /\d/.test(parts.at(-2));
  const protein = amountOf(parts.at(-1));
  const grams = hasPortion ? amountOf(parts.at(-2)) : null;
  const name = parts
    .slice(0, hasPortion ? -2 : -1)
    .join(', ')
    .replace(/[:\s]+$/, '')
    .trim()
    .slice(0, MAX_NAME);
  if (!name || protein === null || protein < 0 || protein > MAX_PROTEIN_G) return null;
  if (grams !== null && (grams < 1 || grams > MAX_PORTION_G || protein > grams)) return null;
  return { name, grams: grams === null ? null : Math.round(grams), protein: Math.round(protein) };
}

function itemsIn(lines) {
  return lines.flatMap((line) => line.split('|')).map((part) => part.trim()).filter(Boolean);
}

// The line the answer starts with: "FOOD:" now, "PROTEIN:" from older prompts.
const START = /^(?:.*?\s)?(?:food|protein)\s*:/i;

// { ok: true, items: [{ name, grams, protein, kcal?, fat?, carbs? }], skipped }
// or { ok: false, error }; protein-only answers have no kcal, fat or carbs.
// With a "FOOD:" line, only that line counts (plus following lines if it is
// empty), so a chatty sentence after the answer can't turn into a food.
export function parseEstimate(text) {
  const lines = plain(text).split('\n').filter(Boolean);
  const at = lines.findIndex((line) => START.test(line));
  let raw;
  if (at === -1) raw = itemsIn(lines);
  else {
    const first = lines[at].replace(START, '');
    raw = itemsIn([first]);
    if (raw.length === 0) raw = itemsIn(lines.slice(at + 1));
  }

  const items = [];
  let skipped = 0;
  for (const part of raw) {
    const item = itemOf(part);
    if (item && items.length < MAX_ITEMS) items.push(item);
    else skipped += 1;
  }
  if (items.length === 0) {
    return { ok: false, error: 'Couldn’t find any food in that answer. Paste the line that starts with FOOD:.' };
  }
  return { ok: true, items, skipped };
}
