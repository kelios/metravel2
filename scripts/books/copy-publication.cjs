#!/usr/bin/env node
// Materialize only manifest-listed, integrity-checked files into the atomic web release.
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');

const BASE = 'https://metravel.by/travel-books/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function collectAssets(manifests) {
  const assets = new Map();
  for (const manifest of manifests) {
    if (manifest.schemaVersion !== 1 || manifest.releaseId !== 'travel-books-v1' || !Array.isArray(manifest.books)) throw new Error('Invalid publication manifest');
    for (const book of manifest.books) {
      const cover=book.coverPersonalization;
      if(cover&&(cover.schemaVersion!==1||!Array.isArray(cover.templates)||cover.templates.length!==6||new Set(cover.templates.map(t=>t.profileId+':'+t.mode)).size!==6))throw new Error('Invalid cover personalization resources');
      const guidePages=book.printGuidePages??[];
      const directory=book.printDirectory;
      if(Boolean(book.printGuidePages)!==Boolean(directory)||book.printGuidePages&&(guidePages.length!==2||new Set(guidePages.map(p=>p.profileId)).size!==2||guidePages.some(p=>!['pocket-150x100','album-a5'].includes(p.profileId))))throw new Error('Invalid print document resources');
      const entries = [...guidePages,...(directory?[directory]:[]),...book.artifacts, ...book.preview.flatMap(group => group.pages), ...(cover?[cover.font,cover.font.license,...cover.templates]:[])];
      for (const entry of entries) {
        const {uri, bytes, sha256} = entry;
        if (typeof uri !== 'string' || !uri.startsWith(BASE) || /[%\\?#\s]/.test(uri)) throw new Error('Invalid publication asset URI');
        const relative = uri.slice(BASE.length);
        if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..') || !/\.(pdf|webp|ttf|txt|html|json)$/.test(relative)) throw new Error('Invalid publication asset path');
        const extension=relative.split('.').pop();
        const guideEntry=guidePages.includes(entry),directoryEntry=entry===directory;
        if(extension==='html'&&!guideEntry||extension==='json'&&!directoryEntry)throw new Error('Print document must be declared');
        if((guideEntry||directoryEntry)&&(!uri.startsWith(BASE+book.id+'/'+book.revision+'/')||entry.mime!==(guideEntry?'text/html':'application/json')||extension!==(guideEntry?'html':'json')||(guideEntry?!uri.endsWith('/'+entry.profileId+'/instructions.html'):!uri.endsWith('/providers.json'))))throw new Error('Print document revision, path or MIME differs');
        const coverEntry=cover&&(entry===cover.font||entry===cover.font.license||cover.templates.includes(entry));
        if((extension==='ttf'||extension==='txt')&&!coverEntry)throw new Error('Font and license must be declared cover resources');
        if(coverEntry&&(!uri.includes('/'+book.id+'/'+book.revision+'/')||entry.mime!==({pdf:'application/pdf',ttf:'font/ttf',txt:'text/plain'})[extension]))throw new Error('Cover resource revision or MIME differs');
        const cap=guideEntry||directoryEntry?1024*1024:extension==='ttf'?2*1024*1024:extension==='txt'?64*1024:coverEntry?20*1024*1024:100*1024*1024;
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > cap || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid publication asset integrity');
        const prior = assets.get(relative);
        if (prior && (prior.bytes !== bytes || prior.sha256 !== sha256)) throw new Error('Immutable publication asset changed');
        assets.set(relative, {uri, relative, bytes, sha256,...(guideEntry?{kind:'print-guide',bookId:book.id,revision:book.revision}:directoryEntry?{kind:'print-directory'}:{})});
      }
    }
  }
  return [...assets.values()];
}

async function fetchAsset(asset) {
  const response = await fetch(asset.uri, {redirect: 'error', signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Publication asset unavailable: HTTP ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > asset.bytes) {
      throw new Error('Publication asset exceeds declared size');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function checkContent(asset, bytes) {
  const extension=asset.relative.split('.').pop();
  if(extension==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid PDF publication resource');
  if(extension==='webp'&&(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP'))throw new Error('Invalid WebP publication resource');
  if(extension==='ttf'&&!bytes.subarray(0,4).equals(Buffer.from([0,1,0,0])))throw new Error('Invalid full TTF publication resource');
  if(extension==='html'){
    const html=bytes.toString('utf8');
    if(!html.startsWith('<!doctype html>')||!html.includes('<html lang="ru">')||!html.includes('<meta charset="utf-8">')||!html.includes(asset.revision)||/<(?:script|iframe|object|embed|form|base|link)\b|\son[a-z]+\s*=/i.test(html))throw new Error('Invalid static print guide');
    for(const match of html.matchAll(/href="([^"]+)"/g)){const url=new URL(match[1].replace(/&amp;/g,'&'));if(url.origin!=='https://metravel.by'||url.search||url.hash||(!url.pathname.startsWith(`/travel-books/${asset.bookId}/${asset.revision}/`)&&!/^\/books\/[a-z]+$/.test(url.pathname)))throw new Error('External or mixed-revision HTML link');}
  }
  if(extension==='json'){const data=JSON.parse(bytes.toString('utf8'));if(data.schemaVersion!==1||!Array.isArray(data.providers)||!data.providers.length||!Array.isArray(data.cities)||!data.cities.length)throw new Error('Invalid provider directory JSON');}
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

async function copyPublication({root, buildDir, cacheDir, download = fetchAsset}) {
  const manifestPath = path.join(root, 'data/travelBooks/manifest.json');
  // Historical releases before C1 do not contain a publication manifest.
  let current;
  try { current = await readJson(manifestPath); }
  catch (error) { if (error.code === 'ENOENT') return {files: 0, bytes: 0}; throw error; }
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
  const assets = collectAssets(manifests);
  await fs.mkdir(cacheDir, {recursive: true});
  const cacheRoot = await fs.realpath(cacheDir);
  const outputRoot = await fs.realpath(buildDir);
  let total = 0;
  for (const asset of assets) {
    const cached = path.join(cacheRoot, asset.relative);
    let bytes;
    try {
      let current=cacheRoot;
      for(const part of asset.relative.split('/')){current=path.join(current,part);if((await fs.lstat(current)).isSymbolicLink())throw new Error('Publication cache escapes root through a symlink');}
      const actual = await fs.realpath(cached);
      if (!actual.startsWith(cacheRoot + path.sep)) throw new Error('Publication cache escapes root');
      bytes = await fs.readFile(actual);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      bytes = await download(asset);
      if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256) throw new Error('Publication download checksum mismatch');
      checkContent(asset,bytes);
      await ensureDirectory(cacheRoot, path.dirname(asset.relative));
      const temporary = cached + `.tmp-${process.pid}`;
      await fs.writeFile(temporary, bytes, {flag: 'wx'});
      await fs.rename(temporary, cached);
    }
    if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256) throw new Error('Publication cache checksum mismatch');
    checkContent(asset,bytes);
    const destination = path.join(outputRoot, 'travel-books', asset.relative);
    await ensureDirectory(outputRoot, path.join('travel-books', path.dirname(asset.relative)));
    // Do not follow a pre-existing destination symlink.
    await fs.rm(destination, {force: true});
    await fs.writeFile(destination, bytes, {flag: 'wx'});
    total += bytes.length;
  }
  await ensureDirectory(outputRoot, 'travel-books');
  const pointer = path.join(outputRoot, 'travel-books/manifest.json');
  await fs.rm(pointer, {force: true});
  await fs.writeFile(pointer, JSON.stringify(current, null, 2) + '\n', {flag: 'wx'});
  return {files: assets.length, bytes: total};
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {cwd: root, encoding: 'utf8'}).trim();
  const canonical = path.resolve(root, common, '..');
  copyPublication({root, buildDir: path.resolve(process.argv[2] || 'dist/prod'), cacheDir: path.join(canonical, '.codex-temp/books-publication')})
    .then(result => console.log(`Ready books: ${result.files} verified files, ${result.bytes} bytes`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = {collectAssets, copyPublication, ensureDirectory, checkContent, writePublicationStagingMetadata};
