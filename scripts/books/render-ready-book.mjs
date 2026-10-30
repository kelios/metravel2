import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, rename, unlink, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import QRCode from 'qrcode';
import {loadSelectedBook} from './source-ready-book.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
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

export async function loadReadyBookInputs(country, profileId, purpose, options = {}) {
  const source = options.source ?? await loadSelectedBook(country, options);
  const qr = {};
  for (const stop of source.book.stops) {
    const links = {map: stop.navigation.mapUrl, article: stop.navigation.articleUrl, ...(stop.navigation.quest ? {quest: stop.navigation.quest.url} : {})};
    const codes = {};
    let sizeMm = 22;
    for (const [kind, url] of Object.entries(links)) {
      const model = QRCode.create(url, {errorCorrectionLevel: 'M'});
      sizeMm = Math.max(sizeMm, Math.ceil((model.modules.size + 8) * .28 * 10) / 10);
      const svg = await QRCode.toString(url, {type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: {dark: '#4a6655ff', light: '#fffefaff'}});
      codes[kind] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }
    if (sizeMm > 29) throw new Error(`Verified QR target too dense for this physical layout: ${stop.id} (${sizeMm} mm)`);
    qr[stop.id] = {...codes, sizeMm};
  }
  const profile = {id: profileId, widthMm: profileId === 'album-a5' ? 148 : 150, heightMm: profileId === 'album-a5' ? 210 : 100,
    bleedMm: purpose === 'read' ? 0 : 3, safeMm: 5, bindingMm: 15, binding: 'rings'};
  const imagePpis = Object.values(source.assets).map(asset => {const bounds=asset.artworkBounds;return profileId==='album-a5'?Math.max(asset.widthPx/148,asset.heightPx/210)*25.4:Math.max(asset.widthPx*bounds.width/62,asset.heightPx*bounds.height/42)*25.4;});
  imagePpis.push(Math.max(source.cover.widthPx/profile.widthMm,source.cover.heightPx/profile.heightMm)*25.4);
  return {...source, profile, purpose, qr, estimatedMinIllustrationPpi: Math.round(Math.min(...imagePpis))};
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
    // Titles can use the approved physical range; body prose is never truncated or shrunk.
    for (const box of document.querySelectorAll('.place-heading')) {
      const heading = box.querySelector('h2');
      const minimum = box.closest('.pocket-layout') ? 13 : 19;
      while ((box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) && parseFloat(getComputedStyle(heading).fontSize) > minimum * 96 / 72) heading.style.fontSize = `${Math.max(minimum * 96 / 72, parseFloat(getComputedStyle(heading).fontSize) - 1)}px`;
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

export async function renderReadyBooks({output, python, check = false, registryPath, sourcesRoot}) {
  output = path.resolve(output);
  await mkdir(output, {recursive: true});
  const compiler = await loadReadyBookCompiler(output);
  let browser;
  const books = [];
  try {
    if (!check) {
      const {chromium} = await import('playwright');
      browser = await chromium.launch({headless: true});
    }
    for (const country of ['by', 'pl']) {
      const source = await loadSelectedBook(country, {registryPath, sourcesRoot});
      const entry = {bookId: '', revision: '', bodyPageCount: 0, stopCount: 0, country: country.toUpperCase(), editorialPath: `data/travelBooks/${country}/editorial.json`, profiles: []};
      entry.coverPersonalization = {...source.coverPersonalization, font: {...source.coverPersonalization.font, license: {...source.coverPersonalization.font.license}}, templates: []};
      const fontBytes = await readFile(source.coverPersonalization.font.path);
      const defaultCoverText = source.coverPersonalization.presets.find(preset => preset.id === source.coverPersonalization.defaultPresetId)?.text;
      if (!defaultCoverText) throw new Error('The default cover preset is missing');
      if (!check) {
        const fontDirectory = path.join(output, source.book.id, source.book.revision, 'fonts');
        await mkdir(fontDirectory, {recursive: true});
        const fontPath = path.join(fontDirectory, 'MarckScript-Regular.ttf'), licensePath = path.join(fontDirectory, 'OFL.txt');
        await copyFile(source.coverPersonalization.font.path, fontPath);
        await copyFile(source.coverPersonalization.font.license.path, licensePath);
        entry.coverPersonalization.font.path = fontPath;
        entry.coverPersonalization.font.license.path = licensePath;
      }
      for (const profileId of ['pocket-150x100', 'album-a5']) {
        const profileEntry = {profile: null, artifacts: [], controls: []};
        let readFiles, readCoverTemplate;
        for (const purpose of ['read', 'print-shop']) {
          const input = await loadReadyBookInputs(country, profileId, purpose, {source});
          entry.bookId = input.book.id;
          entry.revision = input.book.revision;
          const html = compiler.buildReadyBookHtml(input);
          entry.bodyPageCount = html.bodyPages.length;
          entry.stopCount = input.book.stops.length;
          profileEntry.profile = {...input.profile, bleedMm: 0};
          const directory = path.join(output, input.book.id, input.book.revision, profileId);
          if (check) continue;
          await mkdir(directory, {recursive: true});
          entry.editorialPath = path.resolve(directory, 'source-book.json');
          await writeFile(entry.editorialPath, JSON.stringify(input.book, null, 2) + '\n');
          await writeFile(path.join(directory, 'source-provenance.json'), JSON.stringify(input.provenance, null, 2) + '\n');
          await writeFile(path.join(directory, 'page-map.json'), JSON.stringify(html.pageMap, null, 2) + '\n');
          const page = await browser.newPage();
          page.setDefaultTimeout(180_000);
          await page.route('**/*', route => route.request().url().startsWith('data:') ? route.continue() : route.abort());
          try {
            const files = {};
            for (const component of ['body', 'cover']) {
              const file = path.join(directory, `${purpose}-${component}.pdf`);
              if (component === 'cover') {
                const template = path.join(directory, `${purpose}-cover-template.pdf`);
                await compilePdf(page, html.coverHtml, template, input.profile, python);
                const geometry = compiler.coverTextGeometry(input.profile);
                const templateBytes = await readFile(template);
                entry.coverPersonalization.templates.push({path: template, profileId, mode: purpose, mime: 'application/pdf', bytes: templateBytes.length, sha256: sha(templateBytes), pageCount: 4, ...geometry});
                if (purpose === 'read') readCoverTemplate = template;
                const personalized = await compiler.createPersonalizedCoverPdf({templateBytes, fontBytes, text: defaultCoverText, maxCharacters: source.coverPersonalization.maxCharacters, textRegion: geometry.textRegion, expectedPageCount: 4, widthMm: geometry.widthMm, heightMm: geometry.heightMm});
                await writeFile(file, personalized);
              } else await compilePdf(page, html.bodyHtml, file, input.profile, python);
              files[component] = file;
              const info = await artifact(file, purpose, component, component === 'body' ? html.bodyPages.length : html.coverPages.length);
              profileEntry.artifacts.push({...info, pageMapPath: path.join(directory, 'page-map.json'), printProfile: input.profile, assetsHash: input.assetsHash});
            }
            if (purpose === 'read') readFiles = files;
          } finally {await page.close();}
        }
        for (const mode of profileId === 'album-a5' ? ['home-rings', 'home-sewn'] : ['home-rings']) {
          for (const component of mode === 'home-sewn' ? ['body'] : ['body', 'cover']) {
            const plan = compiler.buildImpositionPlan({profileId, mode, component, pageCount: component === 'body' ? entry.bodyPageCount : 4});
            if (check) continue;
            const directory = path.dirname(readFiles.body);
            const planPath = path.join(directory, `${mode}-${component}.plan.json`);
            const file = path.join(directory, `${mode}-${component}.pdf`);
            const controlPath = path.join(directory, `${mode}-${component}-control.pdf`);
            await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
            pythonRun(python, ['scripts/books/impose-ready-book.py', '--source', readFiles[component], '--plan', planPath, '--output', file, '--control', controlPath]);
            if (component === 'cover') {
              const template = path.join(directory, `${mode}-cover-template.pdf`);
              pythonRun(python, ['scripts/books/impose-ready-book.py', '--source', readCoverTemplate, '--plan', planPath, '--output', template]);
              const bytes = await readFile(template);
              entry.coverPersonalization.templates.push({path: template, profileId, mode, mime: 'application/pdf', bytes: bytes.length, sha256: sha(bytes), pageCount: plan.sheets.length * 2, ...compiler.imposedCoverTextGeometry(profileEntry.profile, plan), planPath});
            }
            profileEntry.artifacts.push({...await artifact(file, mode, component, plan.sheets.length * 2), planPath, printProfile: {...profileEntry.profile, binding: mode === 'home-sewn' ? 'sewn' : 'rings'}});
            profileEntry.controls.push({path: controlPath, planPath, pageCount: Number((await import('node:child_process')).execFileSync(python, ['-c', 'from pypdf import PdfReader; import sys; print(len(PdfReader(sys.argv[1]).pages))', controlPath], {encoding: 'utf8'}).trim()), sha256: sha(await readFile(controlPath))});
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
  return {books: books.length, profiles: books.reduce((total, book) => total + book.profiles.length, 0), standardPdfCount: check?0:books.reduce((n,book)=>n+book.profiles.reduce((m,p)=>m+p.artifacts.length+p.controls.length,0),0), templatePdfCount: check?0:books.reduce((n,book)=>n+book.coverPersonalization.templates.length,0), check};
}
