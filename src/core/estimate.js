// Photo → protein through whichever AI chat app the user already has. The app
// copies PHOTO_PROMPT; the chat app looks at the meal photo and answers in one
// line; parseEstimate reads that line back. Nothing is logged from here — the
// result only fills the review sheet. Pure module.

export const PHOTO_PROMPT = [
  'Estimate the protein in the meal in the attached photo.',
  'Reply with one line only, in exactly this format, and nothing else:',
  'PROTEIN: <food>, <portion in grams> g, <protein in grams> g | <food>, <portion in grams> g, <protein in grams> g',
  '- One entry per food you can see. Estimate the portion as eaten (cooked weight).',
  '- Protein is the grams of protein in that portion, not per 100 g.',
  '- Plain numbers only, no ranges. If something is unclear, give your best estimate.',
  'Example: PROTEIN: grilled chicken breast, 150 g, 46 g | white rice, 200 g, 5 g'
].join('\n');

const MAX_ITEMS = 15;
const MAX_NAME = 60;
const MAX_PORTION_G = 3000;
const MAX_PROTEIN_G = 300;

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
function itemOf(text) {
  // A decimal comma ("17,5 g") has no space after it; a separator does.
  const parts = text
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(',')
    .map((part) => part.trim());
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

// { ok: true, items: [{ name, grams, protein }], skipped } or { ok: false, error }.
// With a "PROTEIN:" line, only that line counts (plus following lines if it is
// empty), so a chatty sentence after the answer can't turn into a food.
export function parseEstimate(text) {
  const lines = plain(text).split('\n').filter(Boolean);
  const at = lines.findIndex((line) => /protein\s*:/i.test(line));
  let raw;
  if (at === -1) raw = itemsIn(lines);
  else {
    const first = lines[at].replace(/^.*?protein\s*:/i, '');
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
    return { ok: false, error: 'Couldn’t find any food in that answer. Paste the line that starts with PROTEIN:.' };
  }
  return { ok: true, items, skipped };
}
