#!/usr/bin/env node
// Check every published ready-book file in storage and carry only the publication
// pointer into the atomic web release. The files themselves live in S3 (#2971,
// scripts/books/storage.cjs); the release and the VPS disk never hold them.
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');

const BASE = 'https://metravel.by/travel-books/';
const ROOT_BASE = '/travel-books/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** The detail's deferred contents never carry photos, preview arrays or file metadata. */
function bookContentsIndex(manifest) {
  if (!Array.isArray(manifest.bookMetadata) || manifest.bookMetadata.length !== manifest.books.length) throw new Error('Book contents require pinned edition metadata');
  return {schemaVersion: 1, books: manifest.books.map(book => {
    const metadata = manifest.bookMetadata.filter(asset => asset.bookId === book.id && asset.revision === book.revision);
    if (metadata.length !== 1 || metadata[0].sha256 !== hash(Buffer.from(JSON.stringify(book) + '\n'))) throw new Error('Book contents metadata differs from the published record');
    return {id: book.id, revision: book.revision, metadataSha256: metadata[0].sha256,
      stops: book.stops.map(({id, title, page}) => ({id, title, page}))};
  })};
}

// Only preview images (including their cover alias) may omit our origin.
function publicationAssetLocation(uri, previewBook) {
  if (typeof uri !== 'string' || /[%\\?#\s]/.test(uri)) throw new Error('Invalid publication asset URI');
  let relative;
  if (uri.startsWith(BASE)) relative = uri.slice(BASE.length);
  else if (previewBook && uri.startsWith(ROOT_BASE)) relative = uri.slice(ROOT_BASE.length);
  else throw new Error('Invalid publication asset URI');
  if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid publication asset path');
  if (previewBook && (!relative.startsWith(previewBook.id + '/' + previewBook.revision + '/') || !relative.endsWith('.webp'))) throw new Error('Preview resource revision or path differs');
  return {uri: BASE + relative, relative};
}

function collectAssets(manifests) {
  const assets = new Map();
  for (const manifest of manifests) {
    if (manifest.schemaVersion !== 1 || manifest.releaseId !== 'travel-books-v1' || !Array.isArray(manifest.books)) throw new Error('Invalid publication manifest');
    const metadata=manifest.bookMetadata;
    if(metadata!==undefined&&(!Array.isArray(metadata)||metadata.length!==manifest.books.length||new Set(metadata.map(asset=>asset.bookId)).size!==manifest.books.length||metadata.some(asset=>!manifest.books.some(book=>book.id===asset.bookId&&book.revision===asset.revision))))throw new Error('Book metadata must cover every exact current edition');
    for (const book of manifest.books) {
      const bookMetadata=metadata?.find(asset=>asset.bookId===book.id);
      if(bookMetadata&&(bookMetadata.kind!=='book-metadata'||bookMetadata.mime!=='application/json'||bookMetadata.uri!==`${BASE}${book.id}/${book.revision}/book.json`))throw new Error('Invalid book metadata identity');
      if(bookMetadata){const canonical=Buffer.from(JSON.stringify(book)+'\n');if(bookMetadata.bytes!==canonical.length||bookMetadata.sha256!==hash(canonical))throw new Error('Book metadata must match the exact raw published record');}
      const cover=book.coverPersonalization;
      // v1: the two shared inscriptions of revisions up to 02.11.2026; v2: per-edition inscriptions (#2946).
      if(cover&&(![1,2].includes(cover.schemaVersion)||!Array.isArray(cover.templates)||cover.templates.length!==6||new Set(cover.templates.map(t=>t.profileId+':'+t.mode)).size!==6))throw new Error('Invalid cover personalization resources');
      const guidePages=book.printGuidePages??[];
      const directory=book.printDirectory;
      if(Boolean(book.printGuidePages)!==Boolean(directory)||book.printGuidePages&&(guidePages.length!==2||new Set(guidePages.map(p=>p.profileId)).size!==2||guidePages.some(p=>!['pocket-150x100','album-a5'].includes(p.profileId))))throw new Error('Invalid print document resources');
      const previewPages=book.preview.flatMap(group=>group.pages);
      if(book.coverUri!==undefined)publicationAssetLocation(book.coverUri,book);
      const entries = [...(bookMetadata?[bookMetadata]:[]),...guidePages,...(directory?[directory]:[]),...book.artifacts, ...previewPages, ...(cover?[cover.font,cover.font.license,...cover.templates]:[])];
      for (const entry of entries) {
        const {bytes, sha256} = entry;
        const {uri,relative}=publicationAssetLocation(entry.uri,previewPages.includes(entry)?book:undefined);
        if (!/\.(pdf|webp|ttf|txt|html|json)$/.test(relative)) throw new Error('Invalid publication asset path');
        const extension=relative.split('.').pop();
        const guideEntry=guidePages.includes(entry),directoryEntry=entry===directory,metadataEntry=entry===bookMetadata;
        if(extension==='html'&&!guideEntry||extension==='json'&&!directoryEntry&&!metadataEntry)throw new Error('Print document must be declared');
        if((guideEntry||directoryEntry)&&(!uri.startsWith(BASE+book.id+'/'+book.revision+'/')||entry.mime!==(guideEntry?'text/html':'application/json')||extension!==(guideEntry?'html':'json')||(guideEntry?!uri.endsWith('/'+entry.profileId+'/instructions.html'):!uri.endsWith('/providers.json'))))throw new Error('Print document revision, path or MIME differs');
        const coverEntry=cover&&(entry===cover.font||entry===cover.font.license||cover.templates.includes(entry));
        if((extension==='ttf'||extension==='txt')&&!coverEntry)throw new Error('Font and license must be declared cover resources');
        if(coverEntry&&(!uri.includes('/'+book.id+'/'+book.revision+'/')||entry.mime!==({pdf:'application/pdf',ttf:'font/ttf',txt:'text/plain'})[extension]))throw new Error('Cover resource revision or MIME differs');
        const cap=guideEntry||directoryEntry||metadataEntry?1024*1024:extension==='ttf'?2*1024*1024:extension==='txt'?64*1024:coverEntry?20*1024*1024:100*1024*1024;
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > cap || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid publication asset integrity');
        const prior = assets.get(relative);
        if (prior && (prior.bytes !== bytes || prior.sha256 !== sha256)) throw new Error('Immutable publication asset changed');
        assets.set(relative, {uri, relative, bytes, sha256,...(metadataEntry?{kind:'book-metadata',bookId:book.id,revision:book.revision}:guideEntry?{kind:'print-guide',bookId:book.id,revision:book.revision}:directoryEntry?{kind:'print-directory'}:{})});
      }
    }
  }
  return [...assets.values()];
}

function checkContent(asset, bytes) {
  const extension=asset.relative.split('.').pop();
  if(extension==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid PDF publication resource');
  if(extension==='webp'&&(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP'))throw new Error('Invalid WebP publication resource');
  if(extension==='ttf'&&!bytes.subarray(0,4).equals(Buffer.from([0,1,0,0])))throw new Error('Invalid full TTF publication resource');
  if(extension==='html'){
    const html=bytes.toString('utf8');
    if(!html.startsWith('<!doctype html>')||!html.includes('<html lang="ru">')||!html.includes('<meta charset="utf-8">')||!html.includes(asset.revision)||/<(?:script|iframe|object|embed|form|base|link)\b|\son[a-z]+\s*=/i.test(html))throw new Error('Invalid static print guide');
    for(const match of html.matchAll(/href="([^"]+)"/g)){const url=new URL(match[1].replace(/&amp;/g,'&'));if(url.origin!=='https://metravel.by'||url.search||url.hash||(!url.pathname.startsWith(`/travel-books/${asset.bookId}/${asset.revision}/`)&&!/^\/books\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)))throw new Error('External or mixed-revision HTML link');}
  }
  if(extension==='json'){
    const data=JSON.parse(bytes.toString('utf8'));
    if(asset.kind==='book-metadata'){
      if(data.id!==asset.bookId||data.revision!==asset.revision||!['places','quests'].includes(data.kind??'places')||!Array.isArray(data.artifacts)||!data.artifacts.length||!Array.isArray(data.preview)||data.preview.length!==4)throw new Error('Invalid book metadata JSON');
    }else if(asset.kind!=='print-directory'||![1,2].includes(data.schemaVersion)||!Array.isArray(data.providers)||!data.providers.length||!Array.isArray(data.cities)||!data.cities.length)throw new Error('Invalid provider directory JSON');
  }
  if(extension==='txt'&&!bytes.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1'))throw new Error('Invalid font license publication resource');
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

async function ensureDirectory(root, relative) {
  if (path.isAbsolute(relative) || relative.split(path.sep).includes('..')) throw new Error('Publication directory escapes root');
  let directory = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    directory = path.join(directory, part);
    try { await fs.mkdir(directory); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (!(await fs.lstat(directory)).isDirectory()) throw new Error('Publication directory escapes root through a symlink');
  }
  return directory;
}

/** Fresh staging metadata must never follow or overwrite an existing leaf. */
async function writePublicationStagingMetadata(root, {manifest, related, acceptance}) {
  const entries = [['manifest.json', manifest], ['related.json', related], ['supplement-acceptance.json', acceptance]];
  for (const [name] of entries) {
    try { await fs.lstat(path.join(root, name)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw new Error('Publication staging metadata already exists: ' + name);
  }
  for (const [name, bytes] of entries) await fs.writeFile(path.join(root, name), bytes, {flag: 'wx'});
}

/** The current manifest first, then every immutable snapshot, each checked against its file name. */
async function publicationManifests(root) {
  const manifestPath = path.join(root, 'data/travelBooks/manifest.json');
  // Historical releases before C1 do not contain a publication manifest.
  let current;
  try { current = await readJson(manifestPath); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  if (current.bookMetadata) {
    const contents = await readJson(path.join(root, 'data/travelBooks/contents.json'));
    if (JSON.stringify(contents) !== JSON.stringify(bookContentsIndex(current))) throw new Error('Book contents index differs from the current publication');
  }
  const manifests = [current];
  const releases = path.join(root, 'data/travelBooks/releases');
  let snapshots = [];
  try { snapshots = (await fs.readdir(releases)).filter(file => /^[a-f0-9]{64}\.json$/.test(file)).sort(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const file of snapshots) {
    const bytes = await fs.readFile(path.join(releases, file));
    if (hash(bytes) + '.json' !== file) throw new Error('Publication snapshot checksum mismatch');
    manifests.push(JSON.parse(bytes));
  }
  return manifests;
}

/**
 * Every file of the current editions must be confirmed in storage before the
 * release is built; the release itself receives only `travel-books/manifest.json`.
 * Snapshots stay checked metadata for rollback but hold no files (#2971).
 */
async function copyPublication({root, buildDir, verify}) {
  const manifests = await publicationManifests(root);
  if (!manifests.length) return {files: 0, bytes: 0};
  const assets = collectAssets(manifests.slice(0, 1));
  await verify(assets);
  const outputRoot = await fs.realpath(buildDir);
  const books = await ensureDirectory(outputRoot, 'travel-books');
  const pointer = path.join(books, 'manifest.json');
  await fs.rm(pointer, {force: true});
  await fs.writeFile(pointer, JSON.stringify(manifests[0], null, 2) + '\n', {flag: 'wx'});
  // Build gate: nothing else may reach the release under /travel-books/ (e.g. via public/).
  const entries = await fs.readdir(books);
  if (entries.length !== 1) throw new Error('The release must carry only travel-books/manifest.json; book files belong in storage: ' + entries.filter(name => name !== 'manifest.json').join(', '));
  return {files: assets.length, bytes: assets.reduce((total, asset) => total + asset.bytes, 0)};
}

/** `.codex-temp` of the canonical checkout, shared by its worktrees (deploys build in one). */
function canonicalTemp(root) {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {cwd: root, encoding: 'utf8'}).trim();
  return path.join(path.resolve(root, common, '..'), '.codex-temp');
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const {verifyAssets} = require('./storage.cjs');
  const cacheFile = path.join(canonicalTemp(root), 'books-storage-verified.json');
  copyPublication({root, buildDir: path.resolve(process.argv[2] || 'dist/prod'), verify: assets => verifyAssets(assets, {cacheFile})})
    .then(result => console.log(`Ready books: ${result.files} files of the current editions confirmed in storage (${result.bytes} bytes), release carries only the manifest`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = {collectAssets, copyPublication, publicationManifests, canonicalTemp, ensureDirectory, checkContent, writePublicationStagingMetadata, publicationAssetLocation, bookContentsIndex};
