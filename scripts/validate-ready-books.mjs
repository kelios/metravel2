#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Node 22.13 needs explicit type stripping; use the same TS validator as the app.
if (!process.execArgv.includes('--experimental-strip-types')) {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio: 'inherit'});
  if (child.error) console.error(child.error.message);
  process.exit(child.status ?? 1);
}

const {validateEditorialBookDraft, validateReadyBook, buildReadyBookPagePlan} = await import('../services/book/readyBooks/validation/index.ts');
const args = process.argv.slice(2);
if (args[0] === '--sources') {
  const {loadSelectedBook} = await import('./books/source-ready-book.mjs');
  for (const country of ['by', 'pl']) {const {book} = await loadSelectedBook(country); const result = validateEditorialBookDraft(book); if (!result.success) throw new Error(JSON.stringify(result.issues)); console.log(`${country}: ${book.stops.length} selected author-1 places; ${buildReadyBookPagePlan(book).length} body pages; approved source/art association verified`);}
  process.exit(0);
}
if (args[0] === '--production') {
  const child = spawnSync(process.execPath, [...process.execArgv, 'scripts/books/validate-production.mjs', ...args.slice(1)], {stdio: 'inherit'});
  if (child.error) console.error(child.error.message);
  process.exit(child.status ?? 1);
}
const editorial = args.includes('--editorial');
const metadataOnly = args.includes('--metadata-only');
let assetsRoot;
const files = [];
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (['--editorial', '--metadata-only'].includes(arg)) continue;
  if (arg === '--assets-root') {
    assetsRoot = args[++index];
    if (!assetsRoot) throw new Error('--assets-root requires a directory');
  } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
  else files.push(arg);
}
if (editorial && (metadataOnly || assetsRoot)) throw new Error('Editorial validation does not verify publication assets');
if (!editorial && !metadataOnly && !assetsRoot) throw new Error('Publication requires --assets-root; --metadata-only checks structure only');
const defaultCollection = files.length === 0;
if (defaultCollection) {
  for (const country of ['by', 'pl']) files.push(`data/travelBooks/${country}/${editorial ? 'editorial' : 'manifest'}.json`);
}

async function verifyAssets(book) {
  const root = await realpath(assetsRoot);
  const assets = [
    ...book.artifacts.map(file => ({...file, pdf: true})),
    ...book.stops.map(stop => stop.image),
    ...book.preview.flatMap(preview => preview.pages),
  ];
  for (const asset of assets) {
    const pathname = new URL(asset.uri, 'https://assets.invalid').pathname;
    const file = await realpath(path.resolve(root, `.${pathname}`));
    if (!file.startsWith(root + path.sep)) throw new Error(`Asset escapes root: ${asset.uri}`);
    const info = await stat(file);
    if (!info.isFile()) throw new Error(`Asset is not a file: ${asset.uri}`);
    if (asset.bytes !== undefined && info.size !== asset.bytes) throw new Error(`Byte count mismatch: ${asset.uri}`);
    const bytes = await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`SHA-256 mismatch: ${asset.uri}`);
    if (asset.pdf && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Not a PDF: ${asset.uri}`);
  }
}

let failed = false;
const ids = new Set();
const slugs = new Set();
const countries = new Set();
for (const file of files) {
  try {
    const input = JSON.parse(await readFile(file, 'utf8'));
    const result = editorial ? validateEditorialBookDraft(input) : validateReadyBook(input);
    if (!result.success) {
      failed = true;
      for (const issue of result.issues) console.error(`${file}:${issue.path || '$'} [${issue.code}] ${issue.message}`);
      continue;
    }
    const book = result.data;
    if (ids.has(book.id) || slugs.has(book.slug) || countries.has(book.country)) throw new Error('Duplicate edition ID, slug or country in collection');
    ids.add(book.id);
    slugs.add(book.slug);
    countries.add(book.country);
    if (assetsRoot) await verifyAssets(book);
    const plan = buildReadyBookPagePlan(book);
    console.log(`${file}: ${editorial ? 'EDITORIAL' : metadataOnly ? 'METADATA ONLY' : 'ASSETS VERIFIED'} ${book.id}@${book.revision}; ${plan.length} body pages + 4 separate cover pages`);
    if (editorial && book.stops.length < 30) console.log('  Archived editorial composition; fewer than 30 selected places cannot be published as the current edition.');
    if (editorial && book.gaps?.length) console.log(`  Unresolved editorial gaps (not ready for acceptance): ${book.gaps.join('; ')}`);
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}`);
  }
}
if (defaultCollection && (countries.size !== 2 || !countries.has('BY') || !countries.has('PL'))) {
  failed = true;
  console.error('The collection requires both BY and PL editions');
}
process.exitCode = failed ? 1 : 0;
