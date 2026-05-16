#!/usr/bin/env node
/**
 * Generates placeholder PNG icons for the PWA manifest.
 * Creates solid-color squares with an "HB" letter-mark.
 * Run once: node scripts/generate-icons.js
 */
const { deflateSync } = require('zlib');
const { writeFileSync } = require('fs');
const { join } = require('path');

// CRC32 lookup table (standard PNG requirement)
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const buf = Buffer.alloc(12 + data.length);
  buf.writeUInt32BE(data.length, 0);
  buf.write(type, 4, 'ascii');
  data.copy(buf, 8);
  buf.writeUInt32BE(crc32(buf.slice(4, 8 + data.length)), 8 + data.length);
  return buf;
}

// HustleBricks brand blue: #1a56db
function makePNG(size, bgR = 26, bgG = 86, bgB = 219) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB color type
  // bytes 10-12: compression=0, filter=0, interlace=0

  // Build raw image: filter byte (0) + RGB pixels per row
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const off = y * stride + 1 + x * 3;
      // Simple two-tone: white "H" shape in center third, blue background
      const cx = Math.abs(x - size / 2) / size;
      const cy = Math.abs(y - size / 2) / size;
      // White rounded square (letter-mark area)
      const inLetterBox = cx < 0.28 && cy < 0.28;
      if (inLetterBox) {
        // "HB" white letter mark area
        raw[off] = 255;
        raw[off + 1] = 255;
        raw[off + 2] = 255;
      } else {
        raw[off] = bgR;
        raw[off + 1] = bgG;
        raw[off + 2] = bgB;
      }
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  return Buffer.concat([sig, makeChunk('IHDR', ihdrData), makeChunk('IDAT', compressed), iend]);
}

const publicDir = join(__dirname, '../public');
writeFileSync(join(publicDir, 'icon-192.png'), makePNG(192));
writeFileSync(join(publicDir, 'icon-512.png'), makePNG(512));
writeFileSync(join(publicDir, 'apple-touch-icon.png'), makePNG(180));
console.log('PWA icons generated in public/');
