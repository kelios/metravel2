#!/usr/bin/env node
// Immutable ready-book files live in S3, not in the web release (#2971).
// The object key is the public URL path, so nginx serves
// https://metravel.by/travel-books/<book>/<revision>/<file> by proxying $uri to
// the bucket. Every object carries the manifest SHA-256 as its S3 checksum: S3
// itself refuses a body with another hash, and an anonymous HEAD proves presence
// without downloading the body. Uploads never overwrite (`If-None-Match: *`).
// Storage holds only the files of the current editions — what the site offers
// to download or shows — and `prune` removes everything else (owner's rules,
// 03.11.2026): no previous revisions, no working material.
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash, createHmac} = require('node:crypto');

const BUCKET = 'metravelprod';
const REGION = 'eu-north-1';
const HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`;
const PREFIX = 'travel-books/';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPES = {pdf: 'application/pdf', webp: 'image/webp', ttf: 'font/ttf', txt: 'text/plain; charset=utf-8', html: 'text/html; charset=utf-8', json: 'application/json'};
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const base64Checksum = hex => Buffer.from(hex, 'hex').toString('base64');
// RFC 3986, as SigV4 canonical requests require.
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Thousands of requests from a home connection meet network drops and S3 500/503 (SlowDown); retry those, never other answers. */
async function withRetry(request, {attempts = 4, delayMs = 1000} = {}) {
  for (let attempt = 1; ; attempt += 1) {
    let response, error;
    try { response = await request(); }
    catch (caught) {
      if (!(caught instanceof TypeError || caught?.name === 'TimeoutError' || caught?.name === 'AbortError')) throw caught;
      error = caught;
    }
    if (response && response.status !== 500 && response.status !== 503) return response;
    if (attempt >= attempts) { if (error) throw error; return response; }
    await new Promise(resolve => setTimeout(resolve, delayMs * 2 ** (attempt - 1)));
  }
}

function objectKey(asset) {
  if (!asset.relative || asset.relative.split('/').some(part => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')) throw new Error('Invalid publication storage key: ' + asset.relative);
  return PREFIX + asset.relative;
}

function contentType(relative) {
  const type = CONTENT_TYPES[relative.split('.').pop()];
  if (!type) throw new Error('No storage content type for ' + relative);
  return type;
}

const objectUrl = asset => `https://${HOST}/${objectKey(asset)}`;

/** AWS Signature Version 4 for one S3 request; `headers` are lower-case and include host. */
function signRequest({method, key, query = {}, headers, payloadHash, credentials, region = REGION, now = new Date()}) {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const signed = {...headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate};
  const names = Object.keys(signed).sort();
  const canonicalQuery = Object.keys(query).sort().map(name => `${encode(name)}=${encode(query[name])}`).join('&');
  const canonical = [method, '/' + key.split('/').map(encode).join('/'), canonicalQuery,
    names.map(name => `${name}:${String(signed[name]).trim()}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = ['s3', 'aws4_request'].reduce(hmac, hmac(hmac('AWS4' + credentials.secretAccessKey, date), region));
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  return {...signed, authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`};
}

/** One signed request; fetch derives the identical Host header from the URL. */
async function s3Request({method, key = '', query = {}, headers = {}, body, payloadHash = EMPTY_SHA256, credentials, fetchImpl = fetch, timeout = 60000}) {
  const search = Object.keys(query).length ? '?' + Object.keys(query).sort().map(name => `${encode(name)}=${encode(query[name])}`).join('&') : '';
  return withRetry(() => {
    const signed = signRequest({method, key, query, payloadHash, credentials, headers: {host: HOST, ...headers}});
    delete signed.host;
    return fetchImpl(`https://${HOST}/${key.split('/').map(encode).join('/')}${search}`, {method, headers: signed, body, redirect: 'error', signal: AbortSignal.timeout(timeout)});
  });
}

/** present | missing | conflict, from an anonymous HEAD (the bucket is publicly readable). */
async function headObject(asset, {fetchImpl = fetch} = {}) {
  const response = await withRetry(() => fetchImpl(objectUrl(asset), {method: 'HEAD', headers: {'x-amz-checksum-mode': 'ENABLED'}, redirect: 'error', signal: AbortSignal.timeout(30000)}));
  // A public GetObject-only policy answers 403, not 404, for an absent key.
  if (response.status === 403 || response.status === 404) return 'missing';
  if (response.status !== 200) throw new Error(`Book storage HEAD ${asset.relative}: HTTP ${response.status}`);
  const same = Number(response.headers.get('content-length')) === asset.bytes && response.headers.get('x-amz-checksum-sha256') === base64Checksum(asset.sha256);
  return same ? 'present' : 'conflict';
}

async function putObject(asset, bytes, credentials, {fetchImpl} = {}) {
  const response = await s3Request({method: 'PUT', key: objectKey(asset), body: bytes, payloadHash: asset.sha256, credentials, fetchImpl, timeout: 300000, headers: {
    'cache-control': CACHE_CONTROL, 'content-type': contentType(asset.relative),
    'if-none-match': '*', 'x-amz-checksum-sha256': base64Checksum(asset.sha256),
  }});
  // 412: the key already exists (a parallel upload); the caller re-checks it.
  if (response.status !== 200 && response.status !== 412) throw new Error(`Book storage PUT ${asset.relative}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
}

/** Every object under travel-books/ as {key, bytes}. */
async function listObjects(credentials, {fetchImpl} = {}) {
  const objects = [];
  let token;
  do {
    const query = {'list-type': '2', prefix: PREFIX, ...(token ? {'continuation-token': token} : {})};
    const response = await s3Request({method: 'GET', query, credentials, fetchImpl});
    const xml = await response.text();
    if (response.status !== 200) throw new Error(`Book storage LIST: HTTP ${response.status} ${xml.slice(0, 300)}`);
    for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      objects.push({key: entry.match(/<Key>([^<]*)<\/Key>/)[1].replace(/&amp;/g, '&'), bytes: Number(entry.match(/<Size>(\d+)<\/Size>/)[1])});
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)[1] : undefined;
  } while (token);
  return objects;
}

async function deleteObject(key, credentials, {fetchImpl} = {}) {
  if (!key.startsWith(PREFIX)) throw new Error('Refusing to delete outside travel-books/: ' + key);
  const response = await s3Request({method: 'DELETE', key, credentials, fetchImpl});
  if (response.status !== 204 && response.status !== 200) throw new Error(`Book storage DELETE ${key}: HTTP ${response.status}`);
}

async function pool(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) { const item = items[next++]; await worker(item); }
  }));
}

async function readVerified(cacheFile) {
  try {
    const data = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    return data.schemaVersion === 1 && data.bucket === BUCKET && data.objects && typeof data.objects === 'object' ? data.objects : {};
  } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return {}; throw error; }
}

async function writeVerified(cacheFile, objects) {
  await fs.mkdir(path.dirname(cacheFile), {recursive: true});
  const temporary = `${cacheFile}.tmp-${process.pid}`;
  await fs.writeFile(temporary, JSON.stringify({schemaVersion: 1, bucket: BUCKET, objects}) + '\n');
  await fs.rename(temporary, cacheFile);
}

/**
 * Every asset must be in storage with its manifest size and SHA-256. Objects are
 * immutable, so a confirmed key+hash is remembered and only new revisions are
 * asked again. Throws listing what is missing or different.
 */
async function verifyAssets(assets, {cacheFile, fetchImpl, concurrency = 16} = {}) {
  const verified = cacheFile ? await readVerified(cacheFile) : {};
  const failures = [];
  const pending = assets.filter(asset => verified[objectKey(asset)] !== asset.sha256);
  await pool(pending, concurrency, async asset => {
    const state = await headObject(asset, {fetchImpl});
    if (state === 'present') verified[objectKey(asset)] = asset.sha256;
    else failures.push(`${state}: ${asset.relative}`);
  });
  if (cacheFile && pending.length) await writeVerified(cacheFile, verified);
  if (failures.length) throw new Error(`Book storage lacks ${failures.length} of ${assets.length} files (docs/features/travel-memory-books.md, «Хранилище файлов»):\n${failures.sort().slice(0, 20).join('\n')}`);
  return {files: assets.length, checked: pending.length};
}

/**
 * Uploads only the referenced files storage lacks, from `readBytes(asset)`
 * checked against the manifest and its content role before sending; a
 * different object under the same key is refused, never replaced.
 */
async function uploadAssets(assets, {readBytes, credentials, checkContent, fetchImpl, concurrency = 6, log = () => {}} = {}) {
  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) throw new Error('Book storage credentials are required');
  let uploaded = 0, present = 0, bytes = 0;
  await pool(assets, concurrency, async asset => {
    const state = await headObject(asset, {fetchImpl});
    if (state === 'conflict') throw new Error('Immutable publication asset changed in storage: ' + asset.relative);
    if (state === 'present') { present += 1; return; }
    const body = await readBytes(asset);
    if (body.length !== asset.bytes || sha256(body) !== asset.sha256) throw new Error('Publication source checksum mismatch: ' + asset.relative);
    checkContent?.(asset, body);
    await putObject(asset, body, credentials, {fetchImpl});
    if (await headObject(asset, {fetchImpl}) !== 'present') throw new Error('Book storage did not confirm ' + asset.relative);
    uploaded += 1; bytes += body.length;
    log({uploaded, bytes});
  });
  return {files: assets.length, present, uploaded, bytes};
}

/**
 * Objects under travel-books/ that no kept manifest references: kept are the
 * current manifest of the checkout, the one the site serves right now (so a
 * prune before a deploy never removes live files) and an optional staged one.
 */
function planPrune(listed, assets) {
  const referenced = new Set(assets.map(objectKey));
  if (!referenced.size) throw new Error('Refusing to prune: no manifest references any book file');
  const orphans = listed.filter(object => {
    if (!object.key.startsWith(PREFIX) || !/^[A-Za-z0-9._/-]+$/.test(object.key)) throw new Error('Unexpected storage key: ' + object.key);
    return !referenced.has(object.key);
  }).sort((a, b) => a.key.localeCompare(b.key));
  return {objects: listed.length, referenced: referenced.size, orphans, bytes: orphans.reduce((total, object) => total + object.bytes, 0)};
}

/**
 * The media key the site already uploads photos with (owner, 03.11.2026): from
 * the environment, else the backend `local_env.sh` (`AWS_*` names there) or a
 * file named by METRAVEL_BOOKS_S3_ENV. Never printed.
 */
async function loadCredentials(env = process.env) {
  let values = env;
  if (!env.METRAVEL_BOOKS_S3_ACCESS_KEY_ID) {
    // Next to the canonical checkout, also when run from a worktree (`canonicalTemp` → `<checkout>/.codex-temp`).
    const checkout = path.dirname(require('./copy-publication.cjs').canonicalTemp(path.resolve(__dirname, '../..')));
    const file = env.METRAVEL_BOOKS_S3_ENV || path.resolve(checkout, '../metravel-backend/local_env.sh');
    values = Object.fromEntries((await fs.readFile(file, 'utf8')).split('\n')
      .map(line => line.trim().replace(/^export\s+/, '').match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
      .map(([, name, value]) => [name, value.replace(/^(['"])(.*)\1$/, '$2')]));
  }
  return {accessKeyId: values.METRAVEL_BOOKS_S3_ACCESS_KEY_ID || values.AWS_ACCESS_KEY_ID, secretAccessKey: values.METRAVEL_BOOKS_S3_SECRET_ACCESS_KEY || values.AWS_SECRET_ACCESS_KEY};
}

/** Reads `<root>/<relative>` without following a symlink at any level. */
async function readPublicationFile(root, asset) {
  const realRoot = await fs.realpath(root);
  let current = realRoot;
  for (const part of asset.relative.split('/')) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Publication source escapes root through a symlink');
  }
  return fs.readFile(current);
}

const LIVE_MANIFEST = 'https://metravel.by/travel-books/manifest.json';

async function main(argv, {fetchImpl = fetch} = {}) {
  const {collectAssets, checkContent, canonicalTemp} = require('./copy-publication.cjs');
  const [action, ...rest] = argv;
  const option = name => { const index = rest.indexOf(name); return index >= 0 ? rest[index + 1] : undefined; };
  const readManifest = async file => JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  const root = path.resolve(__dirname, '../..');
  const temp = canonicalTemp(root);
  const cacheFile = path.join(temp, 'books-storage-verified.json');
  const manifest = await readManifest(option('--manifest') ?? path.join(root, 'data/travelBooks/manifest.json'));
  const assets = collectAssets([manifest]);
  if (action === 'verify') return verifyAssets(assets, {cacheFile});
  if (action === 'upload') {
    // Sources: the publication output of publish.mjs, which is also the build cache.
    const source = path.resolve(option('--source') ?? path.join(temp, 'books-publication'));
    console.error(`Book storage: ${assets.length} files of the current editions, s3://${BUCKET}/${PREFIX}`);
    const result = await uploadAssets(assets, {readBytes: asset => readPublicationFile(source, asset), credentials: await loadCredentials(), checkContent,
      log: ({uploaded, bytes}) => { if (uploaded % 200 === 0) console.error(`uploaded ${uploaded} new files (${Math.round(bytes / 2 ** 20)} MB)`); }});
    await verifyAssets(assets, {cacheFile});
    return result;
  }
  if (action === 'prune') {
    const response = await fetchImpl(LIVE_MANIFEST, {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Refusing to prune: the live manifest is unavailable (HTTP ${response.status})`);
    const extra = option('--keep-manifest');
    const kept = collectAssets([manifest, await response.json(), ...(extra ? [await readManifest(extra)] : [])]);
    const credentials = await loadCredentials();
    const plan = planPrune(await listObjects(credentials), kept);
    const report = path.join(temp, `books-storage-prune-${new Date().toISOString().replace(/[-:.]/g, '')}.txt`);
    await fs.writeFile(report, plan.orphans.map(object => object.key).join('\n') + (plan.orphans.length ? '\n' : ''));
    console.error(`Book storage: ${plan.objects} objects, ${plan.referenced} kept, ${plan.orphans.length} to remove (${Math.round(plan.bytes / 2 ** 20)} MB); list: ${report}`);
    for (const object of plan.orphans.slice(0, 20)) console.error('  ' + object.key);
    if (!rest.includes('--apply') || !plan.orphans.length) return {...plan, orphans: plan.orphans.length, applied: false};
    // Forget the keys before deleting: a delete that fails halfway must not
    // leave the build gate trusting a confirmation of a removed object.
    const verified = await readVerified(cacheFile);
    for (const object of plan.orphans) delete verified[object.key];
    await writeVerified(cacheFile, verified);
    await pool(plan.orphans, 6, object => deleteObject(object.key, credentials));
    return {...plan, orphans: plan.orphans.length, applied: true};
  }
  throw new Error('Usage: storage.cjs verify|upload [--manifest <manifest.json>] [--source <dir>] | prune [--manifest <file>] [--keep-manifest <staged manifest.json>] [--apply]');
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {withRetry, BUCKET, REGION, HOST, PREFIX, CACHE_CONTROL, EMPTY_SHA256, objectKey, objectUrl, contentType, signRequest, headObject, putObject, listObjects, deleteObject, verifyAssets, uploadAssets, planPrune, loadCredentials, readPublicationFile};
