#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'));
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '');
const SITE_URL = 'https://metravel.by';
const STATIC_ROUTES = ['/', '/search', '/map', '/travelsby', '/about', '/contact', '/roulette'];
const DEFAULT_PAGE_SIZE = 100;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 30000 };
    if (mod === https) opts.rejectUnauthorized = false;

    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    return payload.results || payload.data || payload.items || [];
  }
  return [];
}

function extractTotal(payload, itemsLength) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return itemsLength;

  const candidates = [payload.count, payload.total, payload.totalCount];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return itemsLength;
}

function normalizeRoute(route) {
  const raw = String(route || '').trim();
  if (!raw || raw === '/') return '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function toAbsoluteUrl(route) {
  const normalized = normalizeRoute(route);
  return normalized === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildUrlEntry(entry) {
  const lines = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  lines.push('  </url>');
  return lines.join('\n');
}

function buildSitemapXml(entries) {
  const body = entries.map(buildUrlEntry).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

function buildStaticEntries() {
  return STATIC_ROUTES.map((route) => ({ loc: toAbsoluteUrl(route) }));
}

function buildTravelEntries(travels) {
  const seen = new Set();
  const entries = [];

  for (const travel of travels) {
    if (!travel) continue;
    const routeKey = String(travel.slug || travel.id || '').trim();
    if (!routeKey) continue;

    const loc = toAbsoluteUrl(`/travels/${routeKey}`);
    if (seen.has(loc)) continue;
    seen.add(loc);

    entries.push({
      loc,
      lastmod: toIsoDate(
        travel.updated_at ||
        travel.updatedAt ||
        travel.modified_at ||
        travel.modifiedAt ||
        travel.created_at ||
        travel.createdAt
      ),
    });
  }

  return entries;
}

async function fetchAllPublishedTravels() {
  const collected = [];
  let page = 1;
  let expectedTotal = null;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(DEFAULT_PAGE_SIZE),
      where: JSON.stringify({ publish: 1, moderation: 1 }),
    });

    const payload = await fetchJson(`${API_BASE}/api/travels/?${params}`);
    const items = extractItems(payload);
    const total = extractTotal(payload, items.length);

    if (expectedTotal == null) expectedTotal = total;
    if (items.length === 0) break;

    collected.push(...items);

    if (collected.length >= total || items.length < DEFAULT_PAGE_SIZE) break;
    page += 1;
  }

  return collected;
}

function writeSitemap(distDir, xml) {
  fs.mkdirSync(distDir, { recursive: true });
  const target = path.join(distDir, 'sitemap.xml');
  fs.writeFileSync(target, xml, 'utf8');
  return target;
}

async function main() {
  const travels = await fetchAllPublishedTravels();
  const entries = [...buildStaticEntries(), ...buildTravelEntries(travels)];
  const xml = buildSitemapXml(entries);
  const target = writeSitemap(DIST_DIR, xml);
  console.log(`[generate-sitemap] Wrote ${entries.length} URLs to ${target}`);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATIC_ROUTES,
    buildSitemapXml,
    buildStaticEntries,
    buildTravelEntries,
    buildUrlEntry,
    escapeXml,
    extractItems,
    extractTotal,
    normalizeRoute,
    toAbsoluteUrl,
    toIsoDate,
    writeSitemap,
  };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[generate-sitemap] ${error.message}`);
    process.exit(1);
  });
}
