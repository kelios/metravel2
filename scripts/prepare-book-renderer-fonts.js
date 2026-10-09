#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(ROOT, 'workers/book-renderer/fonts.lock.json');
const OUTPUT = path.join(ROOT, '.codex-temp/book-renderer-fonts');
const FONT_ORIGIN = 'https://book-snapshot.invalid/fonts/';
// A fixed modern browser UA makes Google serve the WOFF2 unicode-range faces.
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function canonicalFontsUrl(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument.ts'), 'utf8');
  const url = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"\s]+/)?.[0];
  if (!url) throw new Error('Canonical book font stylesheet is missing');
  return url;
}

async function download(url, host, limit) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== host) throw new Error('Unexpected font source origin');
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error(`Font fetch failed with status ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > limit) throw new Error('Font source exceeds bounded setup download');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function rewriteFontCss(css, mapping) {
  return css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_match, url) => {
    const file = mapping.get(url);
    if (!file) throw new Error('Font stylesheet references an unpinned face');
    return `url(${FONT_ORIGIN}${file})`;
  });
}

function verifiedFontBundle(fontDir, root = ROOT) {
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'workers/book-renderer/fonts.lock.json'), 'utf8'));
  const actual = JSON.parse(fs.readFileSync(path.join(fontDir, 'fonts.lock.json'), 'utf8'));
  if (JSON.stringify(expected) !== JSON.stringify(actual) || expected.source_url !== canonicalFontsUrl(root)) {
    throw new Error('Worker font bundle does not match the pinned canonical font lock');
  }
  const records = [{ path: 'fonts.css', sha256: expected.stylesheet_sha256, size_bytes: expected.stylesheet_size_bytes },
    ...expected.files];
  for (const record of records) {
    const file = path.join(fontDir, record.path);
    if (!/^(?:fonts\.css|[a-f0-9]{64}\.woff2)$/.test(record.path) || fs.lstatSync(file).isSymbolicLink()) {
      throw new Error('Invalid worker font bundle filename');
    }
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.size_bytes || hash(bytes) !== record.sha256) throw new Error(`Worker font checksum mismatch: ${record.path}`);
    if (record.path.endsWith('.woff2') && bytes.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error('Worker font is not WOFF2');
  }
  const css = fs.readFileSync(path.join(fontDir, 'fonts.css'), 'utf8');
  const refs = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
  const names = new Set(expected.files.map((record) => record.path));
  if (!refs.length || /@import\b/i.test(css) || refs.some((url) =>
    !url.startsWith(FONT_ORIGIN) || !names.has(url.slice(FONT_ORIGIN.length)))) {
    throw new Error('Worker fonts must resolve entirely from the frozen local bundle');
  }
  return { lock: expected, records: [...records, { path: 'fonts.lock.json' }] };
}

async function downloadFontBundle({ refresh = false, outDir = OUTPUT } = {}) {
  const sourceUrl = canonicalFontsUrl();
  const existing = fs.existsSync(LOCK_FILE) ? JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) : null;
  if (!existing && !refresh) throw new Error('Font lock is missing; initialize it with --refresh-lock');
  if (existing && existing.source_url !== sourceUrl && !refresh) throw new Error('Canonical font families changed; refresh their reviewed lock explicitly');
  const source = await download(sourceUrl, 'fonts.googleapis.com', 1_048_576);
  if (!refresh && hash(source) !== existing.source_css_sha256) throw new Error('Remote font stylesheet changed; pinned setup refuses silent font drift');
  const css = source.toString('utf8');
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((match) => match[1]))].sort();
  if (!urls.length || urls.length > 512 || urls.some((url) => !url.endsWith('.woff2'))) throw new Error('Expected bounded WOFF2 font faces');
  const mapping = new Map();
  const files = [];
  const pending = [];
  let total = 0;
  // Setup only: download bounded faces one at a time, never during a render job.
  for (const url of urls) {
    const bytes = await download(url, 'fonts.gstatic.com', 16_777_216);
    if (bytes.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error('Remote font is not WOFF2');
    total += bytes.length;
    if (total > 67_108_864) throw new Error('Font bundle exceeds 64 MiB setup budget');
    const sha256 = hash(bytes);
    const file = `${sha256}.woff2`;
    if (!refresh) {
      const pinned = existing.files.find((record) => record.source_url === url);
      if (!pinned || pinned.sha256 !== sha256 || pinned.size_bytes !== bytes.length) throw new Error('Remote font bytes changed; pinned setup refuses silent font drift');
    }
    mapping.set(url, file);
    files.push({ path: file, sha256, size_bytes: bytes.length, source_url: url });
    pending.push([file, bytes]);
  }
  const stylesheet = rewriteFontCss(css, mapping);
  const lock = { schema_version: 1, source_url: sourceUrl, user_agent: USER_AGENT,
    source_css_sha256: hash(source), stylesheet_sha256: hash(stylesheet),
    stylesheet_size_bytes: Buffer.byteLength(stylesheet), files };
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, bytes] of pending) fs.writeFileSync(path.join(outDir, file), bytes);
  fs.writeFileSync(path.join(outDir, 'fonts.css'), stylesheet);
  fs.writeFileSync(path.join(outDir, 'fonts.lock.json'), json(lock));
  if (refresh) fs.writeFileSync(LOCK_FILE, json(lock));
  return { outDir, faces: urls.length, bytes: total, stylesheet_sha256: lock.stylesheet_sha256 };
}

async function prepareFonts(options = {}) {
  const marker = path.join(ROOT, '.codex-temp/ops/book-renderer-fonts.lock');
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  let handle;
  try { handle = fs.openSync(marker, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('Font setup marker exists; check its owner before starting another setup');
  }
  fs.writeFileSync(handle, json({ pid: process.pid, operation: 'book-renderer-fonts' }));
  try { return await downloadFontBundle(options); }
  finally { fs.closeSync(handle); fs.unlinkSync(marker); }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--refresh-lock')) throw new Error('Usage: node scripts/prepare-book-renderer-fonts.js [--refresh-lock]');
  prepareFonts({ refresh: args.includes('--refresh-lock') }).then((result) => process.stdout.write(json(result)))
    .catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
module.exports = { canonicalFontsUrl, rewriteFontCss, verifiedFontBundle, prepareFonts, FONT_ORIGIN };
