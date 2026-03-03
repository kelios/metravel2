#!/usr/bin/env node
// scripts/generate-monochrome-icon.js
// AND-12: Generate monochrome icon for Android 13+ Material You.
//
// Reads assets/icons/logo_yellow_512x512.png (the bird logo),
// converts all non-transparent pixels to white (255,255,255),
// preserving the alpha channel. The result is a white silhouette
// on transparent background — exactly what Android expects for
// monochromeImage in adaptive icons.
//
// Usage: node scripts/generate-monochrome-icon.js
//
// Requires: no external dependencies (uses zlib + raw PNG encoding).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', 'assets', 'icons', 'logo_yellow_512x512.png');
const DST = path.join(__dirname, '..', 'assets', 'images', 'monochrome-icon.png');

// ── Minimal PNG decoder (only handles RGBA 8-bit) ──────────────────────────

function readPNG(buf) {
  // Verify PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.subarray(0, 8).compare(sig) !== 0) throw new Error('Not a PNG');

  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + len; // 4 (len) + 4 (type) + len + 4 (crc)
  }

  if (colorType !== 6 || bitDepth !== 8) {
    throw new Error(`Unsupported PNG format: colorType=${colorType}, bitDepth=${bitDepth}. Need RGBA 8-bit.`);
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  // Defilter rows (each row has a 1-byte filter prefix)
  const bpp = 4; // bytes per pixel (RGBA)
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);

  let prevRow = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filterByte = decompressed[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const row = Buffer.from(decompressed.subarray(rowStart, rowStart + stride));

    // Apply defilter
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;

      switch (filterByte) {
        case 0: break; // None
        case 1: row[x] = (row[x] + a) & 0xFF; break; // Sub
        case 2: row[x] = (row[x] + b) & 0xFF; break; // Up
        case 3: row[x] = (row[x] + Math.floor((a + b) / 2)) & 0xFF; break; // Average
        case 4: row[x] = (row[x] + paethPredictor(a, b, c)) & 0xFF; break; // Paeth
      }
    }

    row.copy(pixels, y * stride);
    prevRow = row;
  }

  return { width, height, pixels };
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ── Minimal PNG encoder ────────────────────────────────────────────────────

function writePNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT — filter None on every row
  const stride = width * 4;
  const rawData = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rawData[y * (stride + 1)] = 0; // filter None
    pixels.copy(rawData, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// CRC-32 (PNG spec)
let crcTable = null;
function makeCRCTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  return t;
}

function crc32(buf) {
  if (!crcTable) crcTable = makeCRCTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source icon not found:', SRC);
    process.exit(1);
  }

  console.log('Reading source:', SRC);
  const srcBuf = fs.readFileSync(SRC);
  const { width, height, pixels } = readPNG(srcBuf);
  console.log(`Decoded: ${width}x${height} RGBA`);

  // Convert to monochrome: all non-transparent pixels become white,
  // alpha channel is preserved.
  let nonTransparent = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha > 0) {
      pixels[i] = 255;     // R → white
      pixels[i + 1] = 255; // G → white
      pixels[i + 2] = 255; // B → white
      // alpha stays as-is
      nonTransparent++;
    }
  }
  console.log(`Converted ${nonTransparent} pixels to white (alpha preserved)`);

  const outBuf = writePNG(width, height, pixels);
  fs.writeFileSync(DST, outBuf);
  console.log('Wrote monochrome icon:', DST, `(${outBuf.length} bytes)`);
}

main();

