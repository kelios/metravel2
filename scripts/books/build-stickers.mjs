#!/usr/bin/env node
// Adds local supplemental PDFs without re-rendering the reading books or previews.
import {readFile, writeFile, mkdir, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {loadSelectedBook, projectFile, sha256} from './source-ready-book.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const identifier = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export async function buildStickerArtifacts({book, source, output, python = '.codex-temp/books-production/venv/bin/python'}) {
  output = path.resolve(output);
  if (!output.startsWith(path.resolve('.codex-temp') + path.sep)) throw new Error('Sticker authoring must stay in ignored .codex-temp/');
  await mkdir(output, {recursive: true});
  if (!(await realpath(output)).startsWith((await realpath('.codex-temp')) + path.sep)) throw new Error('Sticker output escapes authoring root');
  if (![book.bookId, book.revision].every(value => typeof value === 'string' && identifier.test(value))) throw new Error('Invalid sticker book identity');
  source ??= await loadSelectedBook(book.country.toLowerCase());
  if (source.book.id !== book.bookId || source.book.revision !== book.revision || source.book.stops.length !== book.stopCount) throw new Error('Stickers must identify the exact production book revision and composition');
  const editorial = await json(book.editorialPath);
  if (editorial.id !== source.book.id || editorial.revision !== source.book.revision || JSON.stringify(editorial.stops.map(stop => ({id: stop.id, title: stop.title}))) !== JSON.stringify(source.book.stops.map(stop => ({id: stop.id, title: stop.title})))) throw new Error('Sticker names/order differ from the production editorial snapshot');
  const directory = path.join(output, book.bookId, book.revision, 'supplements', 'stickers');
  await mkdir(directory, {recursive: true});
  if (!(await realpath(directory)).startsWith((await realpath(output)) + path.sep)) throw new Error('Sticker directory escapes output root');
  const bundle = path.join(directory, 'sticker-planner.cjs');
  await build({entryPoints: ['scripts/books/sticker-entry.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'});
  const {buildStickerSheets} = createRequire(import.meta.url)(bundle);
  const assets = [];
  for (const stop of source.book.stops) {
    const provenance = source.provenance.assets.filter(asset => asset.stopId === stop.id);
    if (provenance.length !== 1) throw new Error('Every sticker requires one exact-place rights record: ' + stop.id);
    const asset = provenance[0];
    // Re-read exact approved bytes and keep the same-article/photo association durable.
    await projectFile(asset.artworkPath, asset.artworkSha256);
    assets.push({stopId: stop.id, path: path.resolve(asset.artworkPath), sha256: asset.artworkSha256, bounds: asset.artworkBounds, sourceTravelId: asset.sourceTravelId, articleUrl: asset.articleUrl, articleImageUri: asset.articleImageUri, sourceOriginalUri: asset.sourceOriginalUri, sourcePhotoSha256: asset.sourcePhotoSha256});
  }
  const font = source.coverPersonalization.font;
  await projectFile(font.path, font.sha256);
  const artifacts = [], reports = [];
  for (const variant of ['color', 'no-background']) {
    const sheets = buildStickerSheets(source.book, variant);
    const spec = {schemaVersion: 1, bookId: book.bookId, revision: book.revision, title: source.book.title, countryTitle: source.book.country === 'BY' ? 'Беларусь' : 'Польша', variant, sheets, assets, font: {path: font.path, sha256: font.sha256, license: font.license}, printNotesRu: 'Листы A4, масштаб 100%, односторонняя печать, ручная резка по контуру. Самоклеящаяся бумага должна подходить вашему принтеру. Преднарезанные этикетки без точного артикула и проверки не подходят. Контрольную линейку 50 мм измерьте с допуском ±1 мм.'};
    const sheetPlanPath = path.join(directory, `stickers-${variant}.json`);
    await writeFile(sheetPlanPath, JSON.stringify(spec, null, 2) + '\n');
    const file = path.join(directory, `stickers-${variant}.pdf`);
    const rendered = spawnSync(python, ['services/book/readyBooks/stickers/render_pdf.py', '--spec', sheetPlanPath, '--output', file], {encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024});
    if (rendered.error || rendered.status !== 0) throw new Error('Sticker PDF authoring failed: ' + (rendered.error?.message || rendered.stderr));
    const report = JSON.parse(rendered.stdout);
    const bytes = await readFile(file);
    if (!report.pass || report.pageCount !== 2 || sha256(bytes) !== report.sha256 || bytes.length !== report.bytes) throw new Error('Sticker PDF acceptance differs from actual output');
    artifacts.push({path: file, purpose: 'stickers', component: 'stickers', variant, sha256: report.sha256, bytes: report.bytes, pageCount: report.pageCount, outputPageMm: {width: 210, height: 297}, sheetPlanPath});
    reports.push({...report, placeCount: source.book.stops.length, stopIds: source.book.stops.map(stop => stop.id), safeMm: 10, stickerMm: 35, rulerMm: 50, scale: 1, physicalCutCheck: 'unverified'});
  }
  const reportPath = path.join(directory, 'inspection.json');
  await writeFile(reportPath, JSON.stringify({schemaVersion: 1, bookId: book.bookId, revision: book.revision, pass: reports.every(report => report.pass), reports}, null, 2) + '\n');
  return {artifacts, reportPath};
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const options = {input: '.codex-temp/books-next/production', output: '.codex-temp/books-next/production', registry: '.codex-temp/books-next/media-registry.json', python: '.codex-temp/books-production/venv/bin/python'};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = {'--input': 'input', '--output': 'output', '--registry': 'registry', '--python': 'python'}[process.argv[index]];
    if (!key || !process.argv[index + 1]) throw new Error('Use --input DIR --output DIR --registry FILE --python BIN');
    options[key] = process.argv[index + 1];
  }
  const index = await json(path.join(options.input, 'production-index.json'));
  if (index.schemaVersion !== 1 || index.books?.length !== 2) throw new Error('Both production books are required');
  const books = [];
  for (const book of index.books) {
    const source = await loadSelectedBook(book.country.toLowerCase(), {registryPath: options.registry});
    books.push({bookId: book.bookId, revision: book.revision, ...await buildStickerArtifacts({book, source, output: options.output, python: options.python})});
  }
  const output = path.resolve(options.output, 'sticker-supplements.json');
  await writeFile(output, JSON.stringify({schemaVersion: 1, books}, null, 2) + '\n');
  console.log(JSON.stringify({output, bookCount: books.length, pdfCount: books.reduce((sum, book) => sum + book.artifacts.length, 0)}));
}
