#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile, realpath, stat, writeFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const schemas = () => import('../../data/travelBooks/schema/questBooks.ts');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unique = (values, message) => {if (new Set(values).size !== values.length) throw new Error(message);};
const isoDate = value => typeof value === 'string' ? value.slice(0, 10) : value;
const ownUrl = value => {try {const url = new URL(value); return url.origin === 'https://metravel.by' && !url.username && !url.password && !url.hash;} catch {return false;}};

export function questCatalogTags(value) {
  if (Array.isArray(value)) {
    if (value.some(tag => typeof tag !== 'string' || !tag.trim())) throw new Error('Invalid catalogue tags');
    unique(value, 'Duplicate catalogue tags');
    return [...value];
  }
  if (!value || typeof value !== 'object' || Object.values(value).some(flag => typeof flag !== 'boolean')) throw new Error('Invalid catalogue tag map');
  return Object.entries(value).filter(([, enabled]) => enabled).map(([tag]) => tag);
}

/** Convert the fully paginated public snapshot to the strict, non-personal country catalogue. */
export async function buildQuestBookCatalog(snapshot) {
  const {questBookCatalogSchema} = await schemas();
  if (!snapshot || !Array.isArray(snapshot.quests) || !Number.isSafeInteger(snapshot.pages) || snapshot.pages < 1 ||
      !Number.isSafeInteger(snapshot.total) || snapshot.total < snapshot.quests.length || !ownUrl(snapshot.source)) {
    throw new Error('Invalid fully paginated catalogue snapshot');
  }
  const quests = snapshot.quests.map(quest => ({
    id: quest.id, questId: quest.questId, country: String(quest.countryCode).toUpperCase(),
    title: quest.title, city: quest.cityName, cityAlias: quest.cityAlias,
    questUrl: `https://metravel.by/quests/${quest.cityAlias}/${quest.questId}`,
    pointCount: quest.points, durationMinutes: quest.durationMinutes, difficulty: quest.difficulty,
    tags: questCatalogTags(quest.tags), coverUri: quest.coverOriginalUri ?? quest.coverUri,
  }));
  const catalog = questBookCatalogSchema.parse({
    schemaVersion: 1, verifiedAt: isoDate(snapshot.checkedAt), sourceUrl: snapshot.source,
    totalPublished: snapshot.total, pageCount: snapshot.pages,
    countryCounts: {BY: quests.filter(q => q.country === 'BY').length, PL: quests.filter(q => q.country === 'PL').length}, quests,
  });
  validateCatalog(catalog);
  return catalog;
}

function validateCatalog(catalog) {
  unique(catalog.quests.map(quest => quest.id), 'Duplicate numeric quest in catalogue');
  unique(catalog.quests.map(quest => quest.questId), 'Duplicate quest ID in catalogue');
  if (catalog.totalPublished < catalog.quests.length) throw new Error('Country catalogue exceeds the total published catalogue');
  for (const country of ['BY', 'PL']) {
    if (catalog.countryCounts[country] !== catalog.quests.filter(quest => quest.country === country).length) throw new Error('Incomplete country catalogue: ' + country);
  }
  for (const quest of catalog.quests) {
    unique(quest.tags, 'Duplicate quest tags in catalogue');
    if (quest.questUrl !== `https://metravel.by/quests/${quest.cityAlias}/${quest.questId}`) throw new Error('Quest URL does not match the canonical catalogue route');
    const cover = new URL(quest.coverUri);
    if (!cover.pathname.startsWith(`/quest-cover/quests/${quest.id}/`) || cover.search) throw new Error('Catalogue cover belongs to another quest');
  }
  const url = new URL(catalog.sourceUrl);
  if (url.pathname !== '/api/quests/' || url.searchParams.get('lang') !== 'ru') throw new Error('Unexpected published catalogue source');
}

/** Every published country quest belongs to exactly one selected or reserved volume. */
export async function validateQuestBookSelection(catalogValue, selectionValue, catalogBytes) {
  const {questBookCatalogSchema, questBookSelectionSchema} = await schemas();
  const catalog = questBookCatalogSchema.parse(catalogValue);
  const selection = questBookSelectionSchema.parse(selectionValue);
  validateCatalog(catalog);
  if (selection.catalogSha256 !== sha256(catalogBytes)) throw new Error('Selection refers to another catalogue revision');
  if (selection.verifiedAt !== catalog.verifiedAt) throw new Error('Selection date differs from its catalogue snapshot');
  unique(selection.rows.map(row => row.id), 'Duplicate numeric quest in selection');
  unique(selection.rows.map(row => row.questId), 'Duplicate quest ID in selection');
  unique(selection.volumes.map(volume => volume.country + ':' + volume.volume), 'Duplicate country volume');
  if (selection.rows.length !== catalog.quests.length) throw new Error('Selection does not account for the complete country catalogue');
  const catalogueById = new Map(catalog.quests.map(quest => [quest.id, quest]));
  const ledgerByQuest = new Map(selection.rows.map(row => [row.questId, row]));
  for (const row of selection.rows) {
    const quest = catalogueById.get(row.id);
    if (!quest || quest.questId !== row.questId || quest.country !== row.country) throw new Error('Selection identity differs from catalogue: ' + row.questId);
    if ((row.volume === 1) !== (row.status === 'included')) throw new Error('Included/reserved status differs from volume: ' + row.questId);
    if (row.status === 'reserved' && (row.overview !== undefined || row.compactOverview !== undefined || row.sourceSha256 !== undefined)) throw new Error('Reserved quest is not an authored first-volume source');
  }
  const covered = new Set();
  for (const volume of selection.volumes) {
    if ((volume.volume === 1) !== (volume.status === 'included')) throw new Error('Volume status differs from its selected/reserved role');
    unique(volume.questIds, 'Duplicate quest in volume');
    for (const questId of volume.questIds) {
      const row = ledgerByQuest.get(questId);
      if (!row || row.country !== volume.country || row.volume !== volume.volume || row.status !== volume.status || covered.has(questId)) {
        throw new Error('Volume composition differs from complete selection: ' + questId);
      }
      covered.add(questId);
    }
  }
  if (covered.size !== selection.rows.length) throw new Error('Some catalogue quests have no selected or reserved volume');
  return {catalog, selection};
}

async function confinedBytes(file, root) {
  const resolved = await realpath(path.resolve(file));
  if (!resolved.startsWith(root + path.sep) || !(await stat(resolved)).isFile()) throw new Error('Source asset escapes the input root');
  return {resolved, bytes: await readFile(resolved)};
}

function sourcePoints(bundle) {
  const steps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps;
  if (!Array.isArray(steps)) throw new Error('Quest bundle has no route points');
  return steps.map(step => ({
    id: step.id, stepId: step.step_id, title: step.title, location: step.location,
    lat: Number(step.lat), lng: Number(step.lng), role: step.point_role,
  }));
}

/** Compile the authored ledger against exact local source/media bytes; never fetch or publish. */
export async function loadCountryQuestBookSources({
  catalogPath = 'data/travelBooks/quests/catalog.json',
  selectionPath = 'data/travelBooks/quests/selection.json',
  rightsPath = 'data/travelBooks/quests/cover-provenance.json',
  collectionPath = '.codex-temp/books-quests/source-collection.json',
  sourceRoot = '.codex-temp/books-quests',
} = {}) {
  const catalogBytes = await readFile(catalogPath);
  const {catalog, selection} = await validateQuestBookSelection(JSON.parse(catalogBytes.toString('utf8')), await json(selectionPath), catalogBytes);
  const {countryQuestBookSchema, questBookEntrySchema} = await schemas();
  const collection = await json(collectionPath);
  if (!Array.isArray(collection.quests) || !Array.isArray(collection.errors) || collection.errors.length) throw new Error('Source collection is incomplete');
  unique(collection.quests.map(quest => quest.id), 'Duplicate numeric quest in source collection');
  unique(collection.quests.map(quest => quest.questId), 'Duplicate quest ID in source collection');
  const selected = selection.rows.filter(row => row.status === 'included');
  if (collection.quests.length !== selected.length) throw new Error('Source collection differs from the selected volume composition');
  const rights=await json(rightsPath);
  if(rights.schemaVersion!==1||!rights.permissionBasis?.reference||rights.permissionBasis.authority!=='project-owner task scope'||!Array.isArray(rights.assets)||rights.assets.length!==selected.length)throw new Error('Missing recorded cover reuse scope');
  unique(rights.assets.map(asset=>asset.questId),'Duplicate cover rights association');
  const root = await realpath(sourceRoot), entries = new Map(), assets = {};
  const sourceById = new Map(collection.quests.map(quest => [quest.id, quest]));
  for (const row of selected) {
    if (!row.overview || !row.sourceSha256) throw new Error('Missing authored overview/source binding: ' + row.questId);
    const source = sourceById.get(row.id), meta = catalog.quests.find(quest => quest.id === row.id);
    if (!source || source.questId !== row.questId || source.country !== row.country) throw new Error('Missing or cross-country selected source: ' + row.questId);
    if (!source.source?.bundlePath || !source.source?.bundleSha256 || !source.cover?.localPath) throw new Error('Missing exact source/media metadata: ' + row.questId);
    const original = await confinedBytes(source.source.bundlePath, root);
    const bundleHash = sha256(original.bytes), bundle = JSON.parse(original.bytes.toString('utf8'));
    if (bundleHash !== source.source.bundleSha256 || bundleHash !== row.sourceSha256) throw new Error('Source bundle checksum mismatch: ' + row.questId);
    const originalCoverUri = bundle.media?.cover?.variants?.original ?? bundle.cover_url;
    if (bundle.id !== row.id || bundle.quest_id !== row.questId || bundle.city?.country_code?.toUpperCase() !== row.country ||
        bundle.title !== meta.title || bundle.city_alias !== meta.cityAlias || bundle.city_name_localized !== meta.city ||
        source.questUrl !== meta.questUrl || source.durationMinutes !== meta.durationMinutes || source.difficulty !== meta.difficulty ||
        !same(questCatalogTags(source.tags), meta.tags) || originalCoverUri !== meta.coverUri) throw new Error('Bundle identity differs from catalogue: ' + row.questId);
    const points = sourcePoints(bundle);
    if (points.length !== meta.pointCount || !same(points, source.points.map(point => ({
      id: point.id, stepId: point.stepId, title: point.title, location: point.location, lat: point.lat, lng: point.lng, role: point.role,
    })))) throw new Error('Source route order or point identity changed: ' + row.questId);
    const cover = await confinedBytes(source.cover.localPath, root);
    if (source.cover.uri !== meta.coverUri || sha256(cover.bytes) !== source.cover.sha256 || cover.bytes.length !== source.cover.bytes) {
      throw new Error('Original quest cover checksum mismatch: ' + row.questId);
    }
    const dimensions = await sharp(cover.bytes).metadata();
    if (dimensions.width !== source.cover.widthPx || dimensions.height !== source.cover.heightPx) throw new Error('Original quest cover dimensions differ: ' + row.questId);
    const permission=rights.assets.find(asset=>asset.questId===row.questId);
    if(!permission||permission.numericQuestId!==row.id||permission.questUrl!==meta.questUrl||['uri','sha256','bytes','widthPx','heightPx'].some(key=>permission[key]!==source.cover[key]))throw new Error('Cover reuse record differs from exact selected bytes: '+row.questId);
    const entry = questBookEntrySchema.parse({
      id: row.id, questId: row.questId, title: meta.title, city: meta.city, questUrl: meta.questUrl,
      durationMinutes: meta.durationMinutes, difficulty: meta.difficulty, tags: meta.tags, overview: row.overview, ...(row.compactOverview?{compactOverview:row.compactOverview}:{}),
      source: {bundleUrl: source.source.bundleUrl, sha256: bundleHash, verifiedAt: isoDate(source.source.verifiedAt)},
      cover: {uri: source.cover.uri, sha256: source.cover.sha256, bytes: source.cover.bytes, widthPx: source.cover.widthPx, heightPx: source.cover.heightPx}, points,
    });
    entries.set(row.questId, entry);
    assets[row.questId] = {coverPath: cover.resolved, sourcePath: original.resolved};
  }
  const books = [];
  for (const volume of selection.volumes.filter(volume => volume.volume === 1)) {
    const name = volume.country === 'BY' ? 'belarus' : 'poland';
    const content = {
      schemaVersion: 1, kind: 'quests', status: 'editorial-draft', id: `${name}-quests-1`, slug: `${name}-quests-1`,
      seriesId: `${name}-quests`, country: volume.country, volume: 1, contentLocale: 'ru',
      title: `${volume.country === 'BY' ? 'Беларусь' : 'Польша'}. Книга квестов. Часть 1`,
      catalog: {verifiedAt: catalog.verifiedAt, sha256: selection.catalogSha256, sourceUrl: catalog.sourceUrl, countryCount: catalog.countryCounts[volume.country]},
      quests: volume.questIds.map(questId => entries.get(questId)),
    };
    books.push(countryQuestBookSchema.parse({...content, revision: 'q1-' + sha256(JSON.stringify(content))}));
  }
  return {books, assets, catalog, selection, rights};
}

async function main() {
  const args = process.argv.slice(2), options = {}; let write = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--write') {if (write) throw new Error('Duplicate --write'); write = true; continue;}
    const names = {'--catalog': 'catalogPath', '--selection': 'selectionPath', '--collection': 'collectionPath', '--source-root': 'sourceRoot'};
    if (!names[key] || !args[index + 1] || args[index + 1].startsWith('--') || names[key] in options) throw new Error('Use [--write] [--catalog file] [--selection file] [--collection file] [--source-root directory]');
    options[names[key]] = args[++index];
  }
  const {books} = await loadCountryQuestBookSources(options);
  if (write) {
    const output = path.dirname(path.resolve(options.catalogPath ?? 'data/travelBooks/quests/catalog.json'));
    const projectRoot = await realpath(process.cwd());
    const realOutput = await realpath(output);
    if (!(realOutput === path.join(projectRoot, 'data/travelBooks/quests') || realOutput.startsWith(path.join(projectRoot, '.codex-temp') + path.sep))) {
      throw new Error('Generated sources must stay in the task data directory or ignored staging');
    }
    for (const book of books) {
      const target = path.join(realOutput, book.country.toLowerCase() + '-volume-1.json'), temporary = target + '.' + process.pid + '.tmp';
      try {await writeFile(temporary, JSON.stringify(book, null, 2) + '\n', {flag: 'wx'}); await rename(temporary, target);}
      finally {await rm(temporary, {force: true});}
    }
  }
  console.log(JSON.stringify({status: 'editorial-draft', written: write, books: books.map(book => ({id: book.id, country: book.country, quests: book.quests.length, points: book.quests.reduce((count, quest) => count + quest.points.length, 0), revision: book.revision})), printReady: false}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.execArgv.includes('--experimental-strip-types')) {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {stdio: 'inherit'});
    if (child.error) console.error(child.error.message);
    process.exit(child.status ?? 1);
  }
  main().catch(error => {console.error('quest-book-sources: ' + error.message); process.exitCode = 1;});
}
