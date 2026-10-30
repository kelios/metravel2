import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, realpath, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import QRCode from 'qrcode';
import {validateBookMedia} from './media-validation.mjs';

const root = process.cwd();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const require = createRequire(import.meta.url);
const {pureSource} = require('../build-book-renderer.js');

export async function loadReadyBookCompiler(output) {
  const bundle = path.resolve(output, 'ready-book-source.cjs');
  await mkdir(path.dirname(bundle), {recursive: true});
  await build({entryPoints: ['scripts/books/render-entry.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
    // The canonical PDF helper reaches imageProxy. Reuse the worker's existing pure adapter
    // rather than bringing React Native platform discovery into a production compiler.
    plugins: [{name: 'canonical-print-policy', setup(builder) {
      builder.onLoad({filter: /[\\/]utils[\\/]imageProxy\.ts$/}, async ({path: file}) => ({
        contents: pureSource(await readFile(file, 'utf8'), 'utils/imageProxy.ts'), loader: 'ts',
      }));
      builder.onLoad({filter: /[\\/]i18n[\\/]config\.ts$/}, async ({path: file}) => ({
        contents: pureSource(await readFile(file, 'utf8'), 'i18n/config.ts'), loader: 'ts',
      }));
      builder.onResolve({filter: /^\.\/instance$/}, args => args.importer.endsWith('/i18n/format.ts')
        ? {path: path.resolve('workers/book-renderer/localeInstance.ts')} : null);
    }}]});
  return require(bundle);
}

async function embeddedFile(file, mime, expectedSha) {
  const resolved = await realpath(path.resolve(file));
  if (!resolved.startsWith(root + path.sep)) throw new Error(`Asset outside project: ${file}`);
  const bytes = await readFile(resolved);
  if (expectedSha && sha(bytes) !== expectedSha) throw new Error(`Asset hash mismatch: ${file}`);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function loadReadyBookInputs(country, profileId, purpose) {
  const editorialPath = `data/travelBooks/${country}/editorial.json`;
  const book = await readJson(editorialPath);
  const rights = await readJson('data/travelBooks/rights.json');
  const items = rights.assets.filter(asset => asset.bookId === book.id);
  const assets = {};
  let cover;
  for (const asset of items) {
    if (asset.printAllowed !== true || !asset.credit || !asset.sourceUrl || !asset.rights) throw new Error(`Unverified print rights: ${asset.id}`);
    const dataUri = await embeddedFile(asset.localPath, asset.localPath.endsWith('.png') ? 'image/png' : 'image/jpeg', asset.sha256);
    const embedded = {...asset, dataUri};
    if (asset.stopId) assets[asset.stopId] = embedded;
    else if (asset.kind === 'cover') cover = embedded;
  }
  if (!cover || items.length !== 13 || Object.keys(assets).length !== 12) throw new Error(`Expected 12 distinct places and a cover: ${book.id}`);
  const fontsRoot = 'docs/design/travel-memory-books-v1/assets';
  const provenance = await readJson(`${fontsRoot}/provenance.json`);
  const fonts = {};
  for (const [key, file] of Object.entries({regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf', serif: 'NotoSerif-Bold.ttf'})) {
    const pinned = provenance.fonts.find(font => font.file === `fonts/${file}`);
    fonts[key] = await embeddedFile(`${fontsRoot}/fonts/${file}`, 'font/ttf', pinned.sha256);
  }
  const qr = {};
  for (const stop of book.stops) qr[stop.id] = await QRCode.toDataURL(stop.source.url, {type: 'image/png', errorCorrectionLevel: 'M', margin: 4, scale: 8});
  const profile = {id: profileId, widthMm: profileId === 'album-a5' ? 148 : 150, heightMm: profileId === 'album-a5' ? 210 : 100,
    bleedMm: purpose === 'read' ? 0 : 3, safeMm: 5, bindingMm: 15, binding: 'rings'};
  return {book, profile, purpose, assets, cover, fonts, qr, editorialPath, assetsHash: sha(JSON.stringify(items.map(item => [item.id, item.sha256]).sort()))};
}

function pythonRun(python, args) {
  const result = spawnSync(python, args, {encoding: 'utf8', timeout: 180_000, maxBuffer: 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(`PDF processing failed: ${result.error?.message || result.stderr}`);
}

async function compilePdf(page, html, output, profile, python) {
  await page.setContent(html, {waitUntil: 'load'});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    // Keep the full story. Move only whole trailing words into its visible continuation.
    for (const box of document.querySelectorAll('[data-story]')) {
      const id = box.getAttribute('data-story');
      const target = document.querySelector(`[data-continuation="${id}"]`);
      while (box.scrollHeight > box.clientHeight + 1 && box.textContent?.includes(' ')) {
        const end = box.textContent.lastIndexOf(' ');
        const word = box.textContent.slice(end + 1);
        box.textContent = box.textContent.slice(0, end);
        target.textContent = `${word} ${target.textContent}`.trim();
      }
    }
    const overflow = [...document.querySelectorAll('[data-check-overflow],.flow,.content')].filter(element => element.scrollHeight > element.clientHeight + 2 || element.scrollWidth > element.clientWidth + 2);
    if (overflow.length) throw new Error(`PRINT_OVERFLOW: ${overflow.map(element => `${element.closest('.book-page')?.getAttribute('data-folio')}:${element.className}`).join(', ')}`);
    if ([...document.images].some(image => !image.complete || !image.naturalWidth)) throw new Error('PRINT_IMAGE_DECODE_FAILED');
  });
  const raw = `${output}.raw.pdf`;
  await page.pdf({path: raw, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false});
  pythonRun(python, ['scripts/books/render-pdf-boxes.py', '--source', raw, '--output', output,
    '--width-mm', String(profile.widthMm), '--height-mm', String(profile.heightMm), '--bleed-mm', String(profile.bleedMm)]);
  await unlink(raw);
}

async function artifact(file, purpose, component, pageCount) {
  const bytes = await readFile(file);
  return {path: file, purpose, component, sha256: sha(bytes), bytes: bytes.length, pageCount};
}

export async function renderReadyBooks({output, python, check = false}) {
  output = path.resolve(output);
  await mkdir(output, {recursive: true});
  const registry = await readJson('data/travelBooks/rights.json');
  const sourceBooks = await Promise.all(['by', 'pl'].map(country => readJson(`data/travelBooks/${country}/editorial.json`)));
  const mediaIssues = await validateBookMedia(registry, sourceBooks, {root});
  if (mediaIssues.length) throw new Error(`Print media validation failed:\n${mediaIssues.join('\n')}`);
  const compiler = await loadReadyBookCompiler(output);
  let browser;
  const books = [];
  try {
    if (!check) {
      const {chromium} = await import('playwright');
      browser = await chromium.launch({headless: true});
    }
    for (const country of ['by', 'pl']) {
      const entry = {bookId: '', revision: '', country: country.toUpperCase(), editorialPath: `data/travelBooks/${country}/editorial.json`, profiles: []};
      for (const profileId of ['pocket-150x100', 'album-a5']) {
        const profileEntry = {profile: null, artifacts: [], controls: []};
        let readFiles;
        for (const purpose of ['read', 'print-shop']) {
          const input = await loadReadyBookInputs(country, profileId, purpose);
          entry.bookId = input.book.id;
          entry.revision = input.book.revision;
          const html = compiler.buildReadyBookHtml(input);
          profileEntry.profile = {...input.profile, bleedMm: 0};
          const directory = path.join(output, input.book.id, input.book.revision, profileId);
          if (check) continue;
          await mkdir(directory, {recursive: true});
          const page = await browser.newPage();
          await page.route('**/*', route => route.request().url().startsWith('data:') ? route.continue() : route.abort());
          try {
            const files = {};
            for (const component of ['body', 'cover']) {
              const file = path.join(directory, `${purpose}-${component}.pdf`);
              await compilePdf(page, html[`${component}Html`], file, input.profile, python);
              files[component] = file;
              const info = await artifact(file, purpose, component, component === 'body' ? 56 : 4);
              profileEntry.artifacts.push({...info, printProfile: input.profile, assetsHash: input.assetsHash});
            }
            if (purpose === 'read') readFiles = files;
          } finally {await page.close();}
        }
        for (const mode of profileId === 'album-a5' ? ['home-rings', 'home-sewn'] : ['home-rings']) {
          for (const component of mode === 'home-sewn' ? ['body'] : ['body', 'cover']) {
            const plan = compiler.buildImpositionPlan({profileId, mode, component});
            if (check) continue;
            const directory = path.dirname(readFiles.body);
            const planPath = path.join(directory, `${mode}-${component}.plan.json`);
            const file = path.join(directory, `${mode}-${component}.pdf`);
            const controlPath = path.join(directory, `${mode}-${component}-control.pdf`);
            await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
            pythonRun(python, ['scripts/books/impose-ready-book.py', '--source', readFiles[component], '--plan', planPath, '--output', file, '--control', controlPath]);
            profileEntry.artifacts.push({...await artifact(file, mode, component, plan.sheets.length * 2), planPath, printProfile: {...profileEntry.profile, binding: mode === 'home-sewn' ? 'sewn' : 'rings'}});
            profileEntry.controls.push({path: controlPath, planPath, sha256: sha(await readFile(controlPath))});
          }
        }
        entry.profiles.push(profileEntry);
      }
      books.push(entry);
    }
  } finally {await browser?.close();}
  if (!check) {
    const index = {schemaVersion: 1, status: 'production-intermediate', publishable: false, color: 'RGB', providerAcceptance: 'unverified', books};
    const tmp = path.join(output, 'production-index.json.tmp');
    await writeFile(tmp, JSON.stringify(index, null, 2) + '\n');
    await rename(tmp, path.join(output, 'production-index.json'));
  }
  return {books: books.length, profiles: books.reduce((total, book) => total + book.profiles.length, 0), check};
}
