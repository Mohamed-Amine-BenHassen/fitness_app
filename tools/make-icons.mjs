// Generates the PWA icons with no dependencies: a hand-rolled PNG encoder over
// node:zlib. Run with `node tools/make-icons.mjs` after changing the artwork.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [0x0f, 0x11, 0x16, 0xff];
const PLATE = [0xff, 0xb0, 0x20, 0xff];
const BAR = [0xee, 0xf1, 0xf6, 0xff];

// Dumbbell, in fractions of the content box.
const SHAPES = [
  { rect: [0.2, 0.455, 0.8, 0.545], color: BAR },
  { rect: [0.1, 0.34, 0.2, 0.66], color: PLATE },
  { rect: [0.22, 0.3, 0.34, 0.7], color: PLATE },
  { rect: [0.66, 0.3, 0.78, 0.7], color: PLATE },
  { rect: [0.8, 0.34, 0.9, 0.66], color: PLATE }
];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size, inset) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) pixels.set(BG, i * 4);

  const box = size * (1 - inset * 2);
  const origin = size * inset;

  for (const { rect, color } of SHAPES) {
    const [x0, y0, x1, y1] = rect;
    const left = Math.round(origin + x0 * box);
    const top = Math.round(origin + y0 * box);
    const right = Math.round(origin + x1 * box);
    const bottom = Math.round(origin + y1 * box);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        pixels.set(color, (y * size + x) * 4);
      }
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });

const icons = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  // Maskable icons get a wider safe zone: Android crops to a circle.
  ['icon-maskable-512.png', 512, 0.19]
];

for (const [name, size, inset] of icons) {
  const png = drawIcon(size, inset);
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`wrote icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
