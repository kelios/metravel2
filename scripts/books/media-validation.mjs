import {createHash} from 'node:crypto';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const checkedDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const https = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};

/** Contain keeps the whole photo. Never use this density for a cropped/cover fit. */
export function effectivePpi(widthPx, heightPx, widthMm, heightMm) {
  return Math.max(widthPx / widthMm, heightPx / heightMm) * 25.4;
}

export async function validateBookMedia(registry, books, {root = process.cwd()} = {}) {
  const issues = [];
  const fail = (id, detail) => issues.push(`${id}: ${detail}`);
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.assets)) return ['Invalid media registry'];
  if (registry.assets.length !== books.reduce((count, book) => count + book.stops.length + 1, 0)) fail('registry', 'Expected exactly one image per stop and one cover per book');
  const assetIds = new Set();
  const realRoot = await realpath(root);
  for (const book of books) {
    const assets = registry.assets.filter(asset => asset.bookId === book.id);
    for (const stop of book.stops) {
      if (assets.filter(a => a.kind === 'place' && a.stopId === stop.id).length !== 1) fail(book.id, `Expected one image for ${stop.id}`);
    }
    if (assets.filter(a => a.kind === 'cover' && !a.stopId).length !== 1) fail(book.id, 'Expected one cover');
  }
  for (const asset of registry.assets) {
    const id = asset.id;
    if (assetIds.has(id)) fail(id, 'Duplicate media ID');
    assetIds.add(id);
    const book = books.find(book => book.id === asset.bookId);
    if (!book || !['place', 'cover'].includes(asset.kind) || (asset.kind === 'place' && !book.stops.some(s => s.id === asset.stopId)) || (asset.kind === 'cover' && asset.stopId !== undefined)) fail(id, 'Unknown book, kind or stop');
    if (asset.printAllowed !== true || !asset.author?.trim() || !asset.credit?.trim() || !asset.rights?.trim() || !https(asset.sourceUrl) || !https(asset.rightsSource)) fail(id, 'Missing print rights or attribution');
    if (!['licensed', 'public-domain', 'ai-generated', 'owned'].includes(asset.rightsBasis)) fail(id, 'Unverified rights basis');
    if (asset.rightsBasis === 'licensed' && !/^CC BY(?:-SA)? [1-4]\.\d(?: [a-z]+)?$/.test(asset.rights)) fail(id, 'License requires manual review');
    if (asset.rightsBasis === 'ai-generated' && !asset.illustrated) fail(id, 'AI art must be labelled');
    if (asset.fit !== 'contain') fail(id, 'Only uncropped contain is verified');
    if (!checkedDate(asset.checkedAt) || !asset.verification?.note) fail(id, 'Missing verification evidence');
    for (const [name, file] of [['print', asset], ['web', asset.web]]) {
      if (!file || !file.localPath || path.isAbsolute(file.localPath) || !hashPattern.test(file.sha256 ?? '')) { fail(id, `Invalid ${name} artifact metadata`); continue; }
      try {
        const fullPath = await realpath(path.resolve(realRoot, file.localPath));
        if (!fullPath.startsWith(realRoot + path.sep)) { fail(id, `${name} asset escapes repository`); continue; }
        const bytes = await readFile(fullPath);
        if (sha256(bytes) !== file.sha256 || bytes.length !== file.bytes) fail(id, `${name} SHA-256/bytes mismatch`);
        const meta = await sharp(bytes).metadata();
        if (meta.width !== file.widthPx || meta.height !== file.heightPx) fail(id, `${name} dimensions mismatch`);
      } catch (error) { fail(id, `${name}: ${error.message}`); }
    }
    const frame = asset.kind === 'cover' ? [118, 78] : [118, 68];
    if (effectivePpi(asset.widthPx, asset.heightPx, ...frame) < 300) fail(id, 'Print image below 300 ppi at the verified contain size');
    if (!asset.original || !hashPattern.test(asset.original.sha256 ?? '') || !positiveInteger(asset.original.bytes) || !positiveInteger(asset.original.widthPx) || !positiveInteger(asset.original.heightPx) || !(https(asset.original.url) || asset.original.localPath === asset.localPath) || asset.original.widthPx < asset.widthPx || asset.original.heightPx < asset.heightPx) fail(id, 'Missing original or enlarged print image');
  }
  return issues;
}
