#!/usr/bin/env node
// Collect every original photograph of the selected author-1 articles for the
// photographic book style (#2854). Nothing is generated or upscaled here: the
// script downloads the largest published variant of each photo, records SHA-256
// and real pixel dimensions, and groups the candidates by article and point.
// Usage: node scripts/books/source-ready-book-photos.mjs by pl [--force]
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const PHOTO_ROOT = '.codex-temp/books-photo';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const exists = async file => stat(file).then(() => true, () => false);
const ownUrl = value => {try {const url = new URL(value, 'https://metravel.by'); return url.origin === 'https://metravel.by' ? url : null;} catch {return null;}};

async function fetchBytes(url) {
  const response = await fetch(url, {headers: {accept: 'image/*,*/*'}});
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadArticle(id, force) {
  const file = path.join(PHOTO_ROOT, 'articles', `${id}.json`);
  if (!force && await exists(file)) return json(file);
  const response = await fetch(`https://metravel.by/api/travels/${id}/`, {headers: {accept: 'application/json'}});
  if (!response.ok) throw new Error(`Article ${id}: HTTP ${response.status}`);
  const text = await response.text();
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, text);
  return JSON.parse(text);
}

/** Canonical original URL: same origin, no query, as the article media record names it. */
function originalOf(entry) {
  const raw = entry?.variants?.original ?? entry?.variants?.print_2500 ?? entry?.variants?.hero_1920 ?? entry?.variants?.content_1600;
  const url = raw ? ownUrl(raw) : null;
  if (!url) return null;
  url.search = '';
  url.hash = '';
  return url.href;
}

async function downloadOriginal(uri, force) {
  const indexFile = path.join(PHOTO_ROOT, 'originals', 'index.json');
  const index = (await exists(indexFile)) ? await json(indexFile) : {};
  if (!force && index[uri] && await exists(index[uri].localPath)) return index[uri];
  const bytes = await fetchBytes(uri);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Undecodable photo: ${uri}`);
  const digest = sha(bytes);
  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
  const localPath = path.join(PHOTO_ROOT, 'originals', `${digest}.${extension}`);
  await mkdir(path.dirname(localPath), {recursive: true});
  await writeFile(localPath, bytes);
  index[uri] = {uri, sha256: digest, bytes: bytes.length, widthPx: metadata.width, heightPx: metadata.height, format: metadata.format, localPath};
  await writeFile(indexFile, JSON.stringify(index, null, 1) + '\n');
  return index[uri];
}

export async function collectCountryPhotos(country, {force = false} = {}) {
  const selection = await json(`data/travelBooks/${country}/selection.json`);
  const records = await json(`data/travelBooks/${country}/source-records.json`);
  if (selection.country !== country.toUpperCase() || records.country !== selection.country) throw new Error('Country mismatch');
  const places = selection.rows.map(row => {
    const record = records.records.find(item => item.id === `point-${row.pointId}`);
    if (!record) throw new Error('Missing source record: ' + row.pointId);
    return {stopId: record.id, pointId: row.pointId, printTitle: record.printTitle, localName: record.localName, travelId: row.travelId, travelUrl: row.travelUrl,
      watercolorSourceUri: record.photo.originalUri, watercolorSourceAlt: record.photo.alt ?? null};
  });
  const articleIds = [...new Set(places.map(place => place.travelId))];
  const articles = [];
  for (const id of articleIds) {
    const article = await loadArticle(id, force);
    if (article.id !== id || Number(article.userIds) !== 1 || article.user?.id !== 1 || article.publication_status !== 'published') throw new Error(`Article ${id} is not a published author-1 travel`);
    const media = article.media ?? {};
    const entries = [];
    (media.article_body?.gallery ?? []).forEach((entry, index) => entries.push({group: 'body', index, alt: entry.alt ?? null, declared: [entry.width, entry.height], uri: originalOf(entry)}));
    (media.gallery ?? []).forEach((entry, index) => entries.push({group: 'gallery', index, alt: null, declared: [entry.width, entry.height], uri: originalOf(entry)}));
    for (const [pointId, entry] of Object.entries(media.address_images ?? {})) entries.push({group: 'address', index: Number(pointId), pointId: Number(pointId), alt: entry.alt ?? null, declared: [entry.width, entry.height], uri: originalOf(entry)});
    const photos = [];
    const seen = new Map();
    for (const entry of entries) {
      if (!entry.uri) continue;
      let original = seen.get(entry.uri);
      if (!original) {
        try {original = await downloadOriginal(entry.uri, force);}
        catch (error) {console.error(`  skip ${entry.uri}: ${error.message}`); continue;}
        seen.set(entry.uri, original);
      }
      photos.push({...entry, ...original});
    }
    const addresses = (article.travelAddress ?? []).map(address => ({id: address.id, address: address.address, coord: address.coord, categoryName: address.categoryName}));
    articles.push({id, title: article.title, url: `https://metravel.by/travels/${article.slug}`, publishedAt: article.published_at, updatedAt: article.updated_at ?? null, addresses, photos});
    console.log(`${country} article ${id}: ${photos.length} originals (${photos.filter(p => p.group === 'body').length} body, ${photos.filter(p => p.group === 'gallery').length} gallery, ${photos.filter(p => p.group === 'address').length} address)`);
  }
  const output = path.join(PHOTO_ROOT, 'candidates', `${country}.json`);
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, JSON.stringify({schemaVersion: 1, country: selection.country, collectedOn: new Date().toISOString().slice(0, 10), places, articles}, null, 1) + '\n');
  return {country, places: places.length, articles: articles.length, photos: articles.reduce((n, a) => n + a.photos.length, 0), output};
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const force = process.argv.includes('--force');
  const countries = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (!countries.length) throw new Error('Usage: source-ready-book-photos.mjs by pl [--force]');
  for (const country of countries) console.log(JSON.stringify(await collectCountryPhotos(country, {force})));
}
