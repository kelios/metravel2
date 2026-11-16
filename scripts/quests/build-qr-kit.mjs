#!/usr/bin/env node
import {readFile, writeFile, mkdir, mkdtemp, rm, lstat, open, unlink, rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {build} from 'esbuild';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const {publicRequest} = require('../lib/metravel-tool-session.js');
const {validateQuestDiscovery} = require('../../utils/questDiscovery.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const HELP = 'node scripts/quests/build-qr-kit.mjs --quest-id ID --campaign PLACEMENT [--locale ru|be|uk|pl|en] [--output DIR] [--api-origin https://metravel.by|http://localhost:8000] [--python PYTHON]';

function parseArgs(argv) {
  const options = {locale: 'ru', apiOrigin: 'https://metravel.by', python: process.env.QUEST_QR_PYTHON || 'python3'};
  const keys = {'--quest-id': 'questId', '--campaign': 'campaign', '--locale': 'locale', '--output': 'output', '--api-origin': 'apiOrigin', '--python': 'python'};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const key = Object.hasOwn(keys, argv[i]) ? keys[argv[i]] : null;
    if (!key || seen.has(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(HELP);
    options[key] = argv[++i]; seen.add(key);
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,159}$/.test(options.questId || '') || !options.campaign) throw new Error(HELP);
  if (!['https://metravel.by', 'http://localhost:8000'].includes(options.apiOrigin)) throw new Error('Unsupported public API origin');
  return options;
}

async function readPublic(origin, endpoint) {
  const response = await publicRequest(origin, endpoint, {headers: {Accept: 'application/json'}});
  if (response.status === 404) return {status: 404};
  if (!response.ok) throw new Error(`Published quest source returned ${response.status}: ${endpoint}`);
  const bytes = await response.text();
  return {status: response.status, raw: JSON.parse(bytes), sha256: sha(bytes), endpoint};
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') { console.log(HELP); return; }
  const options = parseArgs(process.argv.slice(2));
  const tempRoot = path.join(root, '.codex-temp');
  await mkdir(tempRoot, {recursive: true});
  const work = await mkdtemp(path.join(tempRoot, 'quest-qr-compile-'));
  let stage, reservedOutput;
  const createdFiles = [];
  try {
    const compiledPath = path.join(work, 'model.cjs');
    await build({entryPoints: [path.join(root, 'scripts/quests/qr-kit-model.ts')], outfile: compiledPath,
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', absWorkingDir: root});
    const compiler = require(compiledPath);
    compiler.validateQuestQrOptions(options);
    const output = path.resolve(options.output || path.join(tempRoot, 'quest-qr-kit', `${options.questId}-${options.locale}-${options.campaign}`));
    try { await lstat(output); throw new Error('Output already exists; choose a fresh directory'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const catalog = await readPublic(options.apiOrigin, '/api/quests/web/discovery/?view=catalog&lang=ru');
    const discovery = validateQuestDiscovery(catalog.raw, 'catalog', 'ru');
    if (!discovery) throw new Error('Invalid published quest catalog');
    const matches = discovery.quests.filter(quest => quest.quest_id === options.questId || String(quest.id) === options.questId);
    if (matches.length !== 1) throw new Error('Quest id must match exactly one published quest');
    const selected = matches[0];
    const cityId = Number(selected.city_id);
    const endpoint = locale => `/api/quests/web/detail/${cityId}/${selected.quest_id}/?lang=${locale}`;
    let source = await readPublic(options.apiOrigin, endpoint(options.locale));
    if (source.status === 404 && options.locale !== 'ru') source = await readPublic(options.apiOrigin, endpoint('ru'));
    if (source.status !== 200) throw new Error('Quest has no available published detail');
    const model = compiler.buildQuestQrPrintModel(source.raw, {...options, questId: selected.quest_id, cityId});
    const code = QRCode.create(model.targetUrl, {errorCorrectionLevel: 'M'});
    for (const profile of model.profiles) {
      if (profile.qrMm / (code.modules.size + 8) < 0.4) throw new Error('QR target is too dense; use a shorter placement code');
    }
    const fontRoot = path.join(root, 'docs/design/travel-memory-books-v1/assets/fonts');
    const license = await readFile(path.join(fontRoot, 'LICENSE.txt'), 'utf8');
    if (!license.includes('SIL OPEN FONT LICENSE Version 1.1')) throw new Error('Verified font license is missing');
    const fonts = {regular: path.join(fontRoot, 'NotoSans-Regular.ttf'), bold: path.join(fontRoot, 'NotoSans-Bold.ttf')};
    const plan = {...model, fonts, qr: {size: code.modules.size, data: Array.from(code.modules.data)}};
    await writeFile(path.join(work, 'plan.json'), JSON.stringify(plan));
    await mkdir(path.dirname(output), {recursive: true});
    stage = await mkdtemp(path.join(path.dirname(output), '.quest-qr-stage-'));
    const rendered = spawnSync(options.python, [path.join(root, 'scripts/quests/render-qr-kit.py'),
      '--plan', path.join(work, 'plan.json'), '--output', stage], {encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024});
    if (rendered.error || rendered.status !== 0) throw new Error(`PDF renderer failed: ${rendered.error?.message || rendered.stderr.trim()}`);
    const pages = JSON.parse(rendered.stdout);
    const outputs = [];
    for (const page of pages) outputs.push({...page, sha256: sha(await readFile(path.join(stage, page.file)))});
    const manifest = {schemaVersion: 1, generatedAt: new Date().toISOString(),
      questId: model.questId, cityId, locale: model.locale, contentLocale: model.contentLocale,
      campaign: model.campaign, targetUrl: model.targetUrl, text: model.text, facts: model.facts,
      source: {url: options.apiOrigin + source.endpoint, sha256: source.sha256, publicationId: model.publicationId,
        sourceRevision: model.sourceRevision, catalogSha256: catalog.sha256},
      fonts: {regularSha256: sha(await readFile(fonts.regular)), boldSha256: sha(await readFile(fonts.bold)), licenseSha256: sha(license)}, outputs};
    await writeFile(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    // Reserve the destination atomically; rename() could replace an existing empty directory.
    await mkdir(output); reservedOutput = output;
    for (const file of [...outputs.map(page => page.file), 'manifest.json']) {
      const destination = path.join(output, file);
      const handle = await open(destination, 'wx');
      createdFiles.push(destination);
      try { await handle.writeFile(await readFile(path.join(stage, file))); }
      finally { await handle.close(); }
    }
    reservedOutput = null;
    console.log(JSON.stringify({output, questId: model.questId, contentLocale: model.contentLocale, targetUrl: model.targetUrl, outputs}, null, 2));
  } finally {
    await rm(work, {recursive: true, force: true});
    if (stage) await rm(stage, {recursive: true, force: true});
    if (reservedOutput) {
      for (const file of createdFiles) await unlink(file).catch(() => {});
      // Preserve any file another process added rather than recursively deleting it.
      await rmdir(reservedOutput).catch(() => {});
    }
  }
}

main().catch(error => { console.error(`quest-qr-kit: ${error.message}`); process.exitCode = 1; });
