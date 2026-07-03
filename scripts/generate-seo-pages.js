#!/usr/bin/env node
/**
 * Post-build SEO page generator.
 *
 * After `expo export` produces a single index.html (SPA), this script creates
 * per-route copies with unique <title>, <meta description>, <link canonical>,
 * and Open Graph / Twitter tags so that search-engine crawlers see correct
 * metadata without executing JavaScript.
 *
 * Usage:
 *   node scripts/generate-seo-pages.js [--dist <dir>] [--api <url>]
 *
 * Defaults:
 *   --dist  dist/prod          (output of `expo export`)
 *   --api   https://metravel.by (production API)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { injectSkeletonShell } = require('./ssg-skeletons');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'));
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '');
const SITE_URL = 'https://metravel.by';
const OG_IMAGE = `${SITE_URL}/assets/icons/logo_yellow_512x512.png`;
const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.';
const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';
const IMAGE_OPTIMIZATION_QUERY_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr'];

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return SITE_URL;
  }
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch JSON from a URL (follows redirects). */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 30000 };
    // Allow self-signed certs in CI/local environments
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
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Strip HTML tags and collapse whitespace → plain text description. */
function stripHtml(html, maxLength = 160) {
  if (!html) return '';
  const plain = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  // Truncate on a word boundary: cut back to the last space within the limit
  // so the meta description ends on a whole word, then drop any trailing
  // punctuation/dashes. Falls back to the hard cut when there is no space
  // (single very long token).
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const onWord = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return onWord.replace(/[\s,;:–—-]+$/, '') || cut;
}

function toAbsoluteUrl(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return value;
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function buildVersionedTravelImageUrl(rawUrl, updatedAt, id) {
  const absolute = toAbsoluteUrl(rawUrl);
  if (!absolute) return '';
  try {
    const parsed = new URL(absolute);
    if (parsed.protocol === 'http:' && !isPrivateOrLocalHost(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    if (updatedAt) {
      const ts = Date.parse(updatedAt);
      if (Number.isFinite(ts)) {
        parsed.searchParams.set('v', String(ts));
      }
    } else if (id != null && id !== '') {
      parsed.searchParams.set('v', String(id));
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function buildOptimizedTravelImageUrl(rawUrl, { width, quality, updatedAt, id } = {}) {
  const versioned = buildVersionedTravelImageUrl(rawUrl, updatedAt, id);
  if (!versioned) return '';

  try {
    const parsed = new URL(versioned);
    if (parsed.origin !== API_ORIGIN) {
      return parsed.toString();
    }

    IMAGE_OPTIMIZATION_QUERY_PARAMS.forEach((key) => {
      try {
        parsed.searchParams.delete(key);
      } catch {
        // noop
      }
    });

    if (width) parsed.searchParams.set('w', String(Math.round(width)));
    if (quality) parsed.searchParams.set('q', String(Math.round(quality)));
    parsed.searchParams.set('fit', 'contain');

    return parsed.toString();
  } catch {
    return versioned;
  }
}

function buildTravelHeroSrcSet(rawUrl, widths, { quality, updatedAt, id } = {}) {
  if (!rawUrl || !Array.isArray(widths) || widths.length === 0) return '';

  return widths
    .map((width) => {
      const href = buildOptimizedTravelImageUrl(rawUrl, {
        width,
        quality,
        updatedAt,
        id,
      });
      return href ? `${href} ${width}w` : '';
    })
    .filter(Boolean)
    .join(', ');
}

function buildSeoTitle(base, maxLength = SEO_TITLE_MAX_LENGTH) {
  const normalized = String(base || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 'Metravel';

  const maxBaseLength = Math.max(10, maxLength - SEO_TITLE_SUFFIX.length);
  if (normalized.length <= maxBaseLength) {
    return `${normalized}${SEO_TITLE_SUFFIX}`;
  }

  // Clip on a word boundary so the SERP title doesn't end mid-word
  // ("…Нитосл…"). Reserve one char for the ellipsis, then back off to the last
  // space — but only when that boundary keeps most of the budget; a long leading
  // word would otherwise collapse the title, so below 60 % we hard-clip instead.
  const hardLimit = maxBaseLength - 1;
  const slice = normalized.slice(0, hardLimit);
  const lastSpace = slice.lastIndexOf(' ');
  const base2 = lastSpace >= Math.floor(hardLimit * 0.6) ? slice.slice(0, lastSpace) : slice;
  const clippedBase = `${base2.replace(/[\s.,;:!?·–—-]+$/u, '')}…`;

  return `${clippedBase}${SEO_TITLE_SUFFIX}`;
}

function isBareMediaEndpointUrl(input) {
  const value = String(input || '').trim();
  if (!value) return true;

  let pathname = value;
  try {
    pathname = new URL(value).pathname || value;
  } catch {
    // ignore parse error for relative values
  }

  const cleanPath = pathname.split('?')[0].split('#')[0];
  return /(?:^|\/)(travel-image|travel-description-image|address-image|gallery|uploads|media)\/?$/i.test(cleanPath);
}

function upgradeThumbToDetailUrl(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  return value.replace(/-thumb_200(?=\.[a-z0-9]+(?:$|[?#]))/i, '-detail_hd');
}

// Post-deploy SEO check measures the attribute-encoded length of the
// description (raw content="..."), not the plain-text length. Characters
// <, >, &, " expand to HTML entities (e.g. ">" → "&gt;") and inflate the
// attribute by 3 chars each. Clamp the plain text so the encoded form
// stays within the SEO-friendly range (80–160 chars).
function clampDescriptionForAttr(plain, maxEncoded = 160) {
  const text = String(plain || '').trim();
  if (!text) return '';
  if (escapeAttr(text).length <= maxEncoded) return text;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (escapeAttr(text.slice(0, mid)).length <= maxEncoded) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo).trimEnd();
}

function buildTravelSeoDescription(travel, detailDescription) {
  const primary = stripHtml(detailDescription || travel?.description || '', 160);
  const travelName = String(travel?.name || '').trim();
  const countryName = String(travel?.countryName || '').trim();
  const fallbackParts = [travelName, countryName].filter(Boolean);
  const contextual =
    fallbackParts.length > 0
      ? `${fallbackParts.join(' — ')}. Маршрут, советы и впечатления путешественников в MeTravel.`
      : FALLBACK_DESC;

  if (primary.length >= 80) return clampDescriptionForAttr(primary, 160);

  if (primary) {
    const combined = `${primary.replace(/[.!?\s]+$/g, '')}. ${contextual}`.replace(/\s+/g, ' ').trim();
    return clampDescriptionForAttr(combined, 160);
  }

  return clampDescriptionForAttr(contextual, 160);
}

function pickTravelSeoImage(travel, detail) {
  const galleryFirst = detail?.gallery?.[0];
  const galleryUrl = galleryFirst
    ? (typeof galleryFirst === 'string' ? galleryFirst : galleryFirst.url)
    : '';
  const galleryAbsolute = toAbsoluteUrl(galleryUrl);
  if (galleryAbsolute && !isBareMediaEndpointUrl(galleryAbsolute)) return galleryAbsolute;

  const detailHd = toAbsoluteUrl(travel?.travel_image_detail_hd_url || travel?.travelImageDetailHdUrl || '');
  if (detailHd && !isBareMediaEndpointUrl(detailHd)) return detailHd;

  const thumb = String(travel?.travel_image_thumb_url || travel?.travelImageThumbUrl || '').trim();
  const upgradedThumb = toAbsoluteUrl(upgradeThumbToDetailUrl(thumb));
  if (upgradedThumb && !upgradedThumb.includes('thumb_200') && !isBareMediaEndpointUrl(upgradedThumb)) return upgradedThumb;

  const absoluteThumb = toAbsoluteUrl(thumb);
  if (absoluteThumb && !absoluteThumb.includes('thumb_200') && !isBareMediaEndpointUrl(absoluteThumb)) return absoluteThumb;

  const smallThumb = String(travel?.travel_image_thumb_small_url || travel?.travelImageThumbSmallUrl || '').trim();
  const upgradedSmall = toAbsoluteUrl(upgradeThumbToDetailUrl(smallThumb));
  if (upgradedSmall && !upgradedSmall.includes('thumb_200') && !isBareMediaEndpointUrl(upgradedSmall)) return upgradedSmall;

  return OG_IMAGE;
}

function pickTravelHeroImageSource(travel, detail) {
  const galleryFirst = detail?.gallery?.[0];
  if (galleryFirst) {
    const galleryUrl = typeof galleryFirst === 'string' ? galleryFirst : galleryFirst.url;
    const galleryUpdatedAt = typeof galleryFirst === 'string' ? null : galleryFirst.updated_at;
    const galleryId = typeof galleryFirst === 'string' ? null : galleryFirst.id;
    if (galleryUrl) {
      return { url: galleryUrl, updatedAt: galleryUpdatedAt, id: galleryId };
    }
  }

  const thumbUrl = String(travel?.travel_image_thumb_url || travel?.travelImageThumbUrl || '').trim();
  if (thumbUrl) {
    return {
      url: thumbUrl,
      updatedAt: travel?.updated_at || travel?.updatedAt || null,
      id: travel?.id ?? null,
    };
  }

  return null;
}

function buildTravelHeroPreloadData(travel, detail) {
  const source = pickTravelHeroImageSource(travel, detail);
  if (!source?.url) return null;

  // IMPORTANT: these descriptors MUST match the image the LCP <img> actually
  // requests, otherwise the preload downloads a different file and is wasted
  // (the real LCP image then only starts after hydration → slow LCP).
  // Source of truth: TravelDetailsOptimizedLCPHero.tsx (q72 mobile / q82 desktop,
  // widths [320,480,640,720] mobile / [720,960,1280] desktop) and
  // sliderParts/utils.ts buildUriWeb (same q72/q82 for the first slide).
  const mobileHref = buildOptimizedTravelImageUrl(source.url, {
    width: 720,
    quality: 72,
    updatedAt: source.updatedAt,
    id: source.id,
  });
  const desktopHref = buildOptimizedTravelImageUrl(source.url, {
    width: 1280,
    quality: 82,
    updatedAt: source.updatedAt,
    id: source.id,
  });

  if (!mobileHref && !desktopHref) return null;

  return {
    mobile: mobileHref
      ? {
          href: mobileHref,
          srcSet: buildTravelHeroSrcSet(source.url, [320, 480, 640, 720], {
            quality: 72,
            updatedAt: source.updatedAt,
            id: source.id,
          }),
          sizes: '100vw',
        }
      : null,
    desktop: desktopHref
      ? {
          href: desktopHref,
          srcSet: buildTravelHeroSrcSet(source.url, [720, 960, 1280], {
            quality: 82,
            updatedAt: source.updatedAt,
            id: source.id,
          }),
          sizes: '(max-width: 1024px) 92vw, 720px',
        }
      : null,
  };
}

/** Escape a string for safe insertion into HTML attribute values. */
function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Slug 301 redirects
// ---------------------------------------------------------------------------

/** Normalize a slug for comparison / path use (no leading slash, trimmed). */
function normalizeSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').replace(/^travels\//, '').replace(/\/+$/, '');
}

/**
 * Read and validate the slug-redirect manifest. Returns a deduped array of
 * `{ from, to }` (both bare slugs). Bad/empty/self-referential entries are
 * dropped. Missing file → []. The on-disk shape is `{ redirects: [...] }`.
 */
function loadRedirectManifest(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`  ⚠️  Could not parse redirect manifest ${filePath}: ${e.message}`);
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.redirects) ? parsed.redirects : [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const from = normalizeSlug(entry && entry.from);
    const to = normalizeSlug(entry && entry.to);
    if (!from || !to || from === to || seen.has(from)) continue;
    seen.add(from);
    out.push({ from, to });
  }
  return out;
}

/**
 * Build a crawl-safe redirect stub for an old travel slug. nginx serves static
 * route files via `try_files $uri.html` (200), so the stub cannot be a real HTTP
 * 301 by itself. Keep canonical + refresh for users/link discovery, and add
 * noindex so Google does not keep reporting the old slug as an indexable 200.
 */
function buildRedirectStubHtml(toSlug) {
  const target = `${SITE_URL}/travels/${normalizeSlug(toSlug)}`;
  const safe = escapeAttr(target);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Страница переехала | Metravel</title>
<link rel="canonical" href="${safe}"/>
<meta name="robots" content="noindex, follow"/>
<meta http-equiv="refresh" content="0; url=${safe}"/>
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<h1>Страница переехала</h1>
<p>Новый адрес: <a href="${safe}">${safe}</a></p>
</body>
</html>
`;
}

/** Run async tasks with limited concurrency. */
async function batchAsync(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/** Fetch a single travel detail (description + gallery). */
function extractTravelDetailAuthorFields(detail) {
  const authorFields = {};

  if (detail && typeof detail.user === 'object' && detail.user) {
    authorFields.user = detail.user;
  }

  if (typeof detail?.userName === 'string' && detail.userName.trim()) {
    authorFields.userName = detail.userName;
  }

  if (typeof detail?.author_name === 'string' && detail.author_name.trim()) {
    authorFields.author_name = detail.author_name;
  }

  if (typeof detail?.authorName === 'string' && detail.authorName.trim()) {
    authorFields.authorName = detail.authorName;
  }

  if (typeof detail?.owner_name === 'string' && detail.owner_name.trim()) {
    authorFields.owner_name = detail.owner_name;
  }

  if (typeof detail?.ownerName === 'string' && detail.ownerName.trim()) {
    authorFields.ownerName = detail.ownerName;
  }

  if (typeof detail?.userId !== 'undefined' && detail.userId !== null && detail.userId !== '') {
    authorFields.userId = detail.userId;
  }

  if (typeof detail?.user_id !== 'undefined' && detail.user_id !== null && detail.user_id !== '') {
    authorFields.user_id = detail.user_id;
  }

  const rawUserIds = typeof detail?.userIds !== 'undefined' ? detail.userIds : detail?.user_ids;
  if (typeof rawUserIds !== 'undefined' && rawUserIds !== null && rawUserIds !== '') {
    authorFields.userIds = rawUserIds;
  }

  if (typeof detail?.userTravelsCount !== 'undefined' && detail.userTravelsCount !== null) {
    authorFields.userTravelsCount = detail.userTravelsCount;
  }

  return authorFields;
}

function extractTravelDetailContentFields(detail) {
  const contentFields = {};

  if (typeof detail?.youtube_link === 'string') {
    contentFields.youtube_link = detail.youtube_link;
  }

  if (typeof detail?.recommendation === 'string') {
    contentFields.recommendation = detail.recommendation;
  }

  if (typeof detail?.plus === 'string') {
    contentFields.plus = detail.plus;
  }

  if (typeof detail?.minus === 'string') {
    contentFields.minus = detail.minus;
  }

  if (typeof detail?.rating !== 'undefined' && detail.rating !== null) {
    contentFields.rating = detail.rating;
  }

  if (typeof detail?.rating_count !== 'undefined' && detail.rating_count !== null) {
    contentFields.rating_count = detail.rating_count;
  }

  if (typeof detail?.user_rating !== 'undefined' && detail.user_rating !== null) {
    contentFields.user_rating = detail.user_rating;
  }

  if (typeof detail?.number_days !== 'undefined' && detail.number_days !== null) {
    contentFields.number_days = detail.number_days;
  }

  if (typeof detail?.monthName === 'string') {
    contentFields.monthName = detail.monthName;
  }

  if (typeof detail?.year !== 'undefined' && detail.year !== null && detail.year !== '') {
    contentFields.year = detail.year;
  }

  return contentFields;
}

async function fetchTravelDetail(id, slug) {
  // Try /api/travels/{id}/ first
  try {
    const url = `${API_BASE}/api/travels/${id}/`;
    const detail = await fetchJson(url);
    return {
      description: detail.description || '',
      gallery: Array.isArray(detail.gallery) ? detail.gallery : [],
      travelAddress: Array.isArray(detail.travelAddress) ? detail.travelAddress : [],
      coordsMeTravel: Array.isArray(detail.coordsMeTravel) ? detail.coordsMeTravel : [],
      countryCode: detail.countryCode || '',
      ...extractTravelDetailAuthorFields(detail),
      ...extractTravelDetailContentFields(detail),
    };
  } catch {
    // Fallback to /api/travels/by-slug/{slug}/ if id-based fetch fails
    if (slug) {
      try {
        const slugUrl = `${API_BASE}/api/travels/by-slug/${encodeURIComponent(slug)}/`;
        const detail = await fetchJson(slugUrl);
        return {
          description: detail.description || '',
          gallery: Array.isArray(detail.gallery) ? detail.gallery : [],
          travelAddress: Array.isArray(detail.travelAddress) ? detail.travelAddress : [],
          coordsMeTravel: Array.isArray(detail.coordsMeTravel) ? detail.coordsMeTravel : [],
          countryCode: detail.countryCode || '',
          ...extractTravelDetailAuthorFields(detail),
          ...extractTravelDetailContentFields(detail),
        };
      } catch {
        // Both endpoints failed
      }
    }
    return {
      description: '',
      gallery: [],
      travelAddress: [],
      coordsMeTravel: [],
      countryCode: '',
    };
  }
}

function extractCollectionItems(result) {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    return result.data || result.results || result.items || [];
  }
  return [];
}

async function fetchQuestCatalog() {
  const quests = [];
  let nextUrl = `${API_BASE}/api/quests/`;
  let page = 1;
  while (nextUrl && page <= 50) {
    console.log(`  📡 Fetching quests page ${page}...`);
    const result = await fetchJson(nextUrl);
    const items = extractCollectionItems(result).filter((q) => questRouteKey(q));
    quests.push(...items);
    nextUrl = (result && typeof result === 'object' && (result.next_page_url || result.next)) || null;
    page++;
  }
  return quests;
}

function normalizeApiEndpoint(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '');
  }
  if (!raw.startsWith('/')) return '';
  return `${API_BASE}${raw}`.replace(/\/+$/, '');
}

async function resolveArticleEndpointCandidates() {
  const fromApiIndex = [];
  try {
    const indexPayload = await fetchJson(`${API_BASE}/api/`);
    if (indexPayload && typeof indexPayload === 'object') {
      for (const [key, value] of Object.entries(indexPayload)) {
        if (!/articles?/i.test(String(key))) continue;
        const normalized = normalizeApiEndpoint(value);
        if (normalized) fromApiIndex.push(normalized);
      }
    }
  } catch {
    // ignore API index probe errors and use hardcoded fallback paths
  }

  return Array.from(
    new Set([
      ...fromApiIndex,
      `${API_BASE}/api/articles`,
      `${API_BASE}/api/articles/`,
      `${API_BASE}/api/article`,
      `${API_BASE}/api/article/`,
    ].map((value) => value.replace(/\/+$/, '')))
  );
}

// ---------------------------------------------------------------------------
// Meta-tag injection
// ---------------------------------------------------------------------------

/**
 * Replace or insert a tag in the HTML.
 * If the regex matches, replace it; otherwise insert the tag before </head>.
 */
function replaceOrInsert(html, regex, tag) {
  // Ensure uniqueness: remove all existing matches, then insert one canonical tag.
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const globalRegex = new RegExp(regex.source, flags);
  const withoutMatches = html.replace(globalRegex, '');
  return withoutMatches.replace('</head>', `${tag}\n</head>`);
}

/**
 * Inject page-specific meta tags into the base HTML.
 *
 * Uses replace-or-insert so that tags are correctly added even when the
 * base HTML from Expo static export does not contain OG / canonical /
 * Twitter placeholders.
 */
function injectMeta(baseHtml, { title, description, canonical, image, ogType = 'website', robots }) {
  let html = baseHtml;

  // --- <title> ---
  html = html.replace(
    /<title[^>]*>.*?<\/title>/i,
    `<title data-rh="true">${escapeAttr(title)}</title>`
  );

  // --- meta description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="description"[^>]*\/?>/i,
    `<meta data-rh="true" name="description" content="${escapeAttr(description)}"/>`
  );

  // --- canonical ---
  html = replaceOrInsert(
    html,
    /<link[^>]*rel="canonical"[^>]*\/?>/i,
    `<link data-rh="true" rel="canonical" href="${escapeAttr(canonical)}"/>`
  );

  // --- og:type ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:type"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:type" content="${escapeAttr(ogType)}"/>`
  );

  // --- og:title ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:title"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:title" content="${escapeAttr(title)}"/>`
  );

  // --- og:description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:description"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:description" content="${escapeAttr(description)}"/>`
  );

  // --- og:url ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:url"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:url" content="${escapeAttr(canonical)}"/>`
  );

  // --- og:image ---
  if (image) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*property="og:image"[^>]*\/?>/i,
      `<meta data-rh="true" property="og:image" content="${escapeAttr(image)}"/>`
    );
  }

  // --- og:site_name ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:site_name"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:site_name" content="MeTravel"/>`
  );

  // --- twitter:card ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:card"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:card" content="summary_large_image"/>`
  );

  // --- twitter:title ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:title"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:title" content="${escapeAttr(title)}"/>`
  );

  // --- twitter:description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:description"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:description" content="${escapeAttr(description)}"/>`
  );

  // --- twitter:image ---
  if (image) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="twitter:image"[^>]*\/?>/i,
      `<meta data-rh="true" name="twitter:image" content="${escapeAttr(image)}"/>`
    );
  }

  // --- robots (optional, for noindex pages) ---
  if (robots) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="robots"[^>]*\/?>/i,
      `<meta data-rh="true" name="robots" content="${escapeAttr(robots)}"/>`
    );
  }

  return html;
}

function patchNoindexFallbackTemplate(baseHtml, { title, description } = {}) {
  let html = baseHtml;

  // Template files like travels/[param].html and quests/[city]/[questId].html
  // are served only when there is no generated per-route HTML. Raw crawlers see
  // the template before React resolves the route, so do not leave indexable
  // generic titles or literal [param]/[questId] canonicals in place.
  html = html.replace(/<link[^>]*rel="canonical"[^>]*\/?>\n?/gi, '');

  if (title) {
    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title data-rh="true">${escapeAttr(title)}</title>`
    );
  }

  if (description) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="description"[^>]*\/?>/i,
      `<meta data-rh="true" name="description" content="${escapeAttr(description)}"/>`
    );
  }

  html = replaceOrInsert(
    html,
    /<meta[^>]*name="robots"[^>]*\/?>/i,
    '<meta data-rh="true" name="robots" content="noindex, follow"/>'
  );

  return html;
}

function injectBreadcrumbJsonLd(baseHtml, breadcrumb) {
  if (!breadcrumb || !Array.isArray(breadcrumb.itemListElement) || breadcrumb.itemListElement.length === 0) {
    return baseHtml;
  }

  const breadcrumbScriptRe = /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?"@type"\s*:\s*"BreadcrumbList"[\s\S]*?<\/script>\n?/gi;
  const cleanedHtml = baseHtml.replace(breadcrumbScriptRe, '');
  const payload = JSON.stringify(breadcrumb).replace(/<\/script/gi, '<\\/script');
  const scriptTag = `<script type="application/ld+json">${payload}</script>`;
  return cleanedHtml.replace('</head>', `${scriptTag}\n</head>`);
}

function injectTravelHeroPreload(baseHtml, preloadData) {
  if (!preloadData?.mobile?.href && !preloadData?.desktop?.href) return baseHtml;

  const resolveCrossOriginAttr = (href) => {
    if (!href) return '';
    try {
      const resolved = new URL(href, 'https://metravel.by');
      return resolved.origin !== 'https://metravel.by' ? ' crossorigin="anonymous"' : '';
    } catch {
      return '';
    }
  };

  const preloadTags = [
    preloadData.mobile?.href
      ? `<link data-travel-hero-preload="true" data-hero-variant="mobile" rel="preload" as="image" href="${escapeAttr(preloadData.mobile.href)}"${preloadData.mobile.srcSet ? ` imagesrcset="${escapeAttr(preloadData.mobile.srcSet)}"` : ''}${preloadData.mobile.sizes ? ` imagesizes="${escapeAttr(preloadData.mobile.sizes)}"` : ''} media="(max-width: 767px)" fetchpriority="high"${resolveCrossOriginAttr(preloadData.mobile.href)}/>`
      : '',
    preloadData.desktop?.href
      ? `<link data-travel-hero-preload="true" data-hero-variant="desktop" rel="preload" as="image" href="${escapeAttr(preloadData.desktop.href)}"${preloadData.desktop.srcSet ? ` imagesrcset="${escapeAttr(preloadData.desktop.srcSet)}"` : ''}${preloadData.desktop.sizes ? ` imagesizes="${escapeAttr(preloadData.desktop.sizes)}"` : ''} media="(min-width: 768px)" fetchpriority="high"${resolveCrossOriginAttr(preloadData.desktop.href)}/>`
      : '',
  ].filter(Boolean).join('\n');

  return replaceOrInsert(
    baseHtml,
    /<link[^>]*data-travel-hero-preload="true"[^>]*\/?>\n?<link[^>]*data-travel-hero-preload="true"[^>]*\/?>|<link[^>]*data-travel-hero-preload="true"[^>]*\/?>/i,
    preloadTags
  );
}

function injectTravelBootstrapData(baseHtml, travel, routeKey) {
  if (!travel || typeof travel !== 'object') return baseHtml;

  const serialized = JSON.stringify({
    data: travel,
    slug: String(routeKey || '').trim(),
    isId: false,
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/<\/script/gi, '<\\/script');

  const bootstrapScript =
    `<script data-travel-preload-bootstrap="true">` +
    `window.__metravelTravelPreload=${serialized};` +
    `window.__metravelTravelPreloadScriptLoaded=true;` +
    `window.__metravelTravelPreloadPending=false;` +
    `window.__metravelTravelPreloadPromise=Promise.resolve(window.__metravelTravelPreload.data);` +
    `</script>`;

  if (/<script[^>]*data-travel-preload-bootstrap="true"[^>]*>[\s\S]*?<\/script>/i.test(baseHtml)) {
    return baseHtml.replace(
      /<script[^>]*data-travel-preload-bootstrap="true"[^>]*>[\s\S]*?<\/script>/i,
      bootstrapScript
    );
  }

  return baseHtml.replace(/<body([^>]*)>/i, `<body$1>${bootstrapScript}`);
}

function injectHiddenH1(baseHtml, headingText) {
  const text = String(headingText || '').trim();
  if (!text) return baseHtml;

  // SSR H1 stays in raw HTML for crawlers and no-JS consumers, but it must not
  // participate in the RN Web flex layout inside #root. Keep it out of flow so
  // travel pages cannot be squeezed into a narrow right-side column in prod.
  const headingStyle = [
    'position:absolute',
    'width:1px',
    'height:1px',
    'padding:0',
    'margin:-1px',
    'overflow:hidden',
    'clip:rect(0,0,0,0)',
    'clip-path:inset(50%)',
    'white-space:nowrap',
    'border:0',
    'pointer-events:none',
    'font:700 28px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
    'color:#1a1a1a',
    'letter-spacing:-0.01em',
    'max-width:720px',
  ].join(';');

  const ssgHeading = `<h1 data-ssg-travel-h1="true" style="${headingStyle}">${escapeAttr(text)}</h1>`;

  if (/<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i.test(baseHtml)) {
    return baseHtml.replace(
      /<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i,
      ssgHeading
    );
  }

  if (/<div\s+id="root"[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(
      /<div(\s+id="root"[^>]*)>/i,
      `<div$1>${ssgHeading}`
    );
  }

  return baseHtml.replace(/<body([^>]*)>/i, `<body$1>${ssgHeading}`);
}

function injectJsonLd(baseHtml, payload, marker) {
  if (!payload || typeof payload !== 'object') return baseHtml;

  const dataMarker = marker ? ` data-seo-jsonld="${escapeAttr(marker)}"` : '';
  const scriptTag = `<script type="application/ld+json"${dataMarker}>${JSON.stringify(payload).replace(/<\/script/gi, '<\\/script')}</script>`;

  if (marker) {
    const markerRegex = new RegExp(`<script[^>]*data-seo-jsonld="${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<\\/script>\\n?`, 'i');
    if (markerRegex.test(baseHtml)) {
      return baseHtml.replace(markerRegex, `${scriptTag}\n`);
    }
  }

  return baseHtml.replace('</head>', `${scriptTag}\n</head>`);
}

function buildTravelArticleJsonLd({ title, description, canonical, image, travel }) {
  if (!title || !canonical) return null;

  const authorName =
    String(
      travel?.user?.display_name ||
      travel?.user?.name ||
      travel?.userName ||
      travel?.authorName ||
      ''
    ).trim() || 'MeTravel';

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: String(title).trim(),
    description: String(description || '').trim(),
    mainEntityOfPage: canonical,
    url: canonical,
    inLanguage: 'ru',
    publisher: {
      '@type': 'Organization',
      name: 'MeTravel',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/assets/icons/logo_yellow_60x60.png`,
      },
    },
    author: {
      '@type': 'Person',
      name: authorName,
    },
  };

  if (image) payload.image = [image];

  const publishedAt = travel?.created_at || travel?.date_create || travel?.datePublished || null;
  const modifiedAt = travel?.updated_at || travel?.date_update || travel?.dateModified || null;
  if (publishedAt) payload.datePublished = publishedAt;
  if (modifiedAt) payload.dateModified = modifiedAt;

  return payload;
}

// ---------------------------------------------------------------------------
// Quests (городские квест-маршруты): prerender detail pages + crawlable index.
// Sitemap самих квестов отдаёт бэкенд (BE-017); здесь даём индексируемую мету,
// JSON-LD и перелинковку, чтобы Googlebot находил /quests/{city}/{quest} даже
// без записи в sitemap.
// ---------------------------------------------------------------------------
function questRouteKey(quest) {
  const questId = String(quest?.quest_id ?? quest?.id ?? '').trim();
  const cityId = String(quest?.city_id ?? quest?.cityId ?? '').trim();
  if (!questId || !cityId) return null;
  return { cityId, questId, path: `/quests/${cityId}/${questId}` };
}

function buildQuestSeoDescription(quest) {
  const title = String(quest?.title || 'Городской квест').trim();
  const city = String(quest?.city_name || quest?.cityName || quest?.city?.name || '').trim();
  const points = Number(quest?.points) || 0;
  const durationMin = Number(quest?.duration_min) || 0;

  const parts = [];
  parts.push(city ? `${title} — пеший квест-маршрут по городу ${city}` : `${title} — пеший квест-маршрут`);
  if (points > 0) parts.push(`${points} ${pluralizeRu(points, 'точка', 'точки', 'точек')}`);
  if (durationMin > 0) {
    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    const duration = hours > 0 ? (mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`) : `${mins} мин`;
    parts.push(`≈${duration}`);
  }
  parts.push('загадки, легенды и финал — прямо со смартфона');
  return clampDescriptionForAttr(parts.join(' · '));
}

function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'„""–—-]/g, '')
    .replace(/ё/g, 'е')
    .trim();
}

function parseCoordPair(value) {
  if (!value || typeof value !== 'string') return null;
  const [latS, lngS] = value.split(',').map((part) => part.trim());
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function extractTravelCoordsForQuestPromo(travel) {
  const coords = [];
  const pushCoord = (latValue, lngValue) => {
    const lat = Number(latValue);
    const lng = Number(lngValue);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push({ lat, lng });
  };

  if (Array.isArray(travel?.travelAddress)) {
    for (const item of travel.travelAddress) {
      const parsed = parseCoordPair(typeof item === 'string' ? item : item?.coord || item?.coords);
      if (parsed) coords.push(parsed);
      else if (item && typeof item === 'object') pushCoord(item.lat ?? item.latitude, item.lng ?? item.lon ?? item.longitude);
    }
  }

  if (Array.isArray(travel?.coordsMeTravelArr)) {
    for (const raw of travel.coordsMeTravelArr) {
      const parsed = parseCoordPair(raw);
      if (parsed) coords.push(parsed);
    }
  }

  if (Array.isArray(travel?.coordsMeTravel)) {
    for (const item of travel.coordsMeTravel) {
      if (item && typeof item === 'object') pushCoord(item.lat ?? item.latitude, item.lng ?? item.lon ?? item.longitude);
    }
  }

  pushCoord(travel?.lat ?? travel?.latitude, travel?.lng ?? travel?.lon ?? travel?.longitude);

  const seen = new Set();
  return coords.filter((coord) => {
    const key = `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function minDistanceKm(coords, lat, lng) {
  if (!Array.isArray(coords) || !coords.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  return coords.reduce((min, coord) => {
    if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) return min;
    return Math.min(min, haversineKm(coord.lat, coord.lng, lat, lng));
  }, Infinity);
}

function buildQuestPromoMeta(quest, bundle) {
  const route = questRouteKey(quest) || questRouteKey({
    quest_id: bundle?.quest_id || bundle?.id,
    city_id: bundle?.city?.id,
  });
  if (!route) return null;

  const city = bundle?.city || quest?.city || {};
  const lat = Number(city.lat ?? quest?.lat ?? quest?.latitude);
  const lng = Number(city.lng ?? city.lon ?? city.longitude ?? quest?.lng ?? quest?.lon ?? quest?.longitude);
  const cover = String(quest?.cover_url || quest?.coverUrl || bundle?.cover_url || bundle?.coverUrl || '').trim();
  const countryCode = String(city.country_code || city.countryCode || quest?.country_code || quest?.countryCode || '').trim().toLowerCase();
  const title = String(quest?.title || bundle?.title || 'Городской квест').trim();

  return {
    ...quest,
    route,
    title,
    cityName: String(quest?.city_name || quest?.cityName || city.name || '').trim(),
    countryName: String(quest?.country_name || quest?.countryName || city.country_name || city.countryName || '').trim(),
    countryCode,
    lat,
    lng,
    points: Number(quest?.points) || getQuestSteps(bundle).length || 0,
    durationMin: Number(quest?.duration_min ?? quest?.durationMin ?? bundle?.duration_min) || 0,
    cover,
  };
}

function buildQuestPromoCatalog(quests, questBundleMap) {
  return (Array.isArray(quests) ? quests : [])
    .map((quest) => {
      const route = questRouteKey(quest);
      return buildQuestPromoMeta(quest, route ? questBundleMap.get(route.questId) : null);
    })
    .filter(Boolean);
}

function findTravelQuestPromoMatches(travel, questCatalog, limit = 6) {
  if (!Array.isArray(questCatalog) || !questCatalog.length) return [];

  const coords = extractTravelCoordsForQuestPromo(travel);
  const qCity = normalizeLocationText(travel?.cityName || travel?.city_name || travel?.city?.name);
  const qCountry = normalizeLocationText(travel?.countryName || travel?.country_name);
  const qCode = String(travel?.countryCode || travel?.country_code || '').toLowerCase().trim();
  const matches = [];

  for (const quest of questCatalog) {
    const cCity = normalizeLocationText(quest.cityName);
    const cCountry = normalizeLocationText(quest.countryName);
    const cCode = String(quest.countryCode || '').toLowerCase().trim();

    if (qCode && cCode && qCode !== cCode) continue;
    if ((!qCode || !cCode) && qCountry && cCountry && qCountry !== cCountry) {
      const near = minDistanceKm(coords, quest.lat, quest.lng) < 15;
      if (!near) continue;
    }

    let score = 0;
    if (qCity && cCity) {
      if (qCity === cCity) score += 100;
      else if (cCity.includes(qCity) || qCity.includes(cCity)) score += 55;
    }

    const distanceKm = minDistanceKm(coords, quest.lat, quest.lng);
    if (distanceKm < 8) score += 60;
    else if (distanceKm < 20) score += 40;
    else if (distanceKm < 50) score += 40;

    if ((qCountry && cCountry && qCountry === cCountry) || (qCode && cCode && qCode === cCode)) score += 15;
    if (score < 55) continue;

    matches.push({ quest, score, distanceKm });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.distanceKm - b.distanceKm;
  });

  return matches.slice(0, Math.max(1, limit));
}

function formatQuestPromoPoints(points) {
  const total = Number(points) || 0;
  return total > 0 ? `${total} ${pluralizeRu(total, 'точка', 'точки', 'точек')}` : '';
}

function buildQuestPromoCardHtml(match) {
  const quest = match.quest;
  const duration = formatQuestDuration(quest.durationMin);
  const points = formatQuestPromoPoints(quest.points);
  const meta = [quest.cityName, points, duration ? `примерно ${duration}` : '']
    .filter(Boolean)
    .map((item) => `<span style="display:inline-flex;align-items:center;min-width:0">${escapeAttr(item)}</span>`)
    .join('<span aria-hidden="true" style="opacity:.55">·</span>');
  const cover = quest.cover ? toAbsoluteUrl(quest.cover) : '';
  const image = cover
    ? `<span role="img" aria-label="${escapeAttr(`Обложка квеста ${quest.title}`)}" style="width:88px;height:88px;border-radius:8px;background-color:var(--color-surface-muted,rgba(0,0,0,.06));background-image:url('${escapeAttr(cover)}');background-size:cover;background-position:center;flex:0 0 auto"></span>`
    : '';

  return [
    `<a href="${escapeAttr(quest.route.path)}" style="display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit;border:1px solid var(--color-border,rgba(0,0,0,.12));border-radius:8px;padding:10px;background:var(--color-surface,#fff)">`,
    image,
    '<span style="display:flex;flex-direction:column;gap:6px;min-width:0">',
    `<span style="font-size:13px;font-weight:800;color:var(--color-text-muted,rgba(34,51,44,.72))">${escapeAttr(match.distanceKm < 8 ? 'В этом городе' : 'Квест рядом')}</span>`,
    `<strong style="font-size:18px;line-height:1.25;color:var(--color-text,#22332c)">${escapeAttr(quest.title)}</strong>`,
    meta ? `<span style="display:flex;flex-wrap:wrap;gap:6px 8px;font-size:14px;color:var(--color-text-muted,rgba(34,51,44,.72))">${meta}</span>` : '',
    '</span>',
    '</a>',
  ].join('');
}

function injectTravelQuestPromoSection(baseHtml, matches) {
  let html = baseHtml.replace(/<style[^>]*data-ssg-travel-quest-promo-style="true"[^>]*>[\s\S]*?<\/style>\n?/i, '');
  html = html.replace(/<section[^>]*data-ssg-travel-quest-promo="true"[^>]*>[\s\S]*?<\/section>\n?/i, '');
  if (!Array.isArray(matches) || !matches.length) return html;

  const hasSameCityMatch = matches.some((match) => Number.isFinite(match.distanceKm) && match.distanceKm < 8);
  const heading = matches.length === 1
    ? (hasSameCityMatch ? 'Квест по этому городу' : 'Квест рядом')
    : (hasSameCityMatch ? 'Квесты по этому городу и рядом' : 'Квесты рядом');
  const subtitle = matches.length === 1
    ? 'Пройдите пешком по легендам и загадкам — прямо со смартфона.'
    : 'Пешие маршруты с легендами и загадками — выберите подходящий.';
  const cards = matches.map(buildQuestPromoCardHtml).join('');
  const styleTag = [
    '<style data-ssg-travel-quest-promo-style="true">',
    'html.rnw-styles-ready [data-ssg-travel-quest-promo="true"]{display:none!important}',
    '@media(max-width:640px){[data-ssg-travel-quest-promo="true"]{margin:12px;padding:16px 14px}[data-ssg-travel-quest-promo="true"] h2{font-size:22px!important}[data-ssg-travel-quest-promo="true"] [role="img"]{width:72px!important;height:72px!important}}',
    '</style>',
  ].join('');
  const section = [
    `<section data-ssg-travel-quest-promo="true" aria-label="${escapeAttr(heading)}" style="position:relative;z-index:2;box-sizing:border-box;max-width:840px;margin:24px auto;padding:20px 18px;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--color-text,#22332c);background:var(--color-surface,#fff);border:1px solid var(--color-border,rgba(0,0,0,.12));border-radius:8px">`,
    `<h2 style="margin:0 0 8px;font:800 26px/1.2 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:0;color:var(--color-text,#22332c)">${escapeAttr(heading)}</h2>`,
    `<p style="margin:0 0 14px;color:var(--color-text-muted,rgba(34,51,44,.72))">${escapeAttr(subtitle)}</p>`,
    `<div style="display:grid;gap:12px">${cards}</div>`,
    '</section>',
  ].join('');

  const insertion = `${styleTag}\n${section}\n`;
  const skeletonTitleRegex = /(<div\s+class="ssg-travel-h1"[^>]*>[\s\S]*?<\/div>)/i;
  if (skeletonTitleRegex.test(html)) {
    return html.replace(skeletonTitleRegex, `$1\n${insertion}`);
  }
  if (/<div\s+id="root"[^>]*>/i.test(html)) {
    return html.replace(/<div(\s+id="root"[^>]*)>/i, `${insertion}<div$1>`);
  }
  return html.replace('</body>', `${insertion}</body>`);
}

function injectTravelRegisterCtaSection(baseHtml) {
  let html = baseHtml.replace(/<style[^>]*data-ssg-register-cta-style="true"[^>]*>[\s\S]*?<\/style>\n?/i, '');
  html = html.replace(/<section[^>]*data-ssg-register-cta="true"[^>]*>[\s\S]*?<\/section>\n?/i, '');

  const heading = 'Сохраняй маршруты и любимые места';
  const subtitle = 'Бесплатный аккаунт: собирай избранное, планируй поездки и синхронизируй их на всех устройствах.';
  const cta = 'Создать бесплатный аккаунт';

  const styleTag = [
    '<style data-ssg-register-cta-style="true">',
    'html.rnw-styles-ready [data-ssg-register-cta="true"]{display:none!important}',
    '@media(max-width:640px){[data-ssg-register-cta="true"]{margin:12px;padding:16px 14px}[data-ssg-register-cta="true"] h2{font-size:19px!important}}',
    '</style>',
  ].join('');
  const section = [
    `<section data-ssg-register-cta="true" aria-label="${escapeAttr(heading)}" style="position:relative;z-index:2;box-sizing:border-box;max-width:840px;margin:24px auto;padding:18px;font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--color-text,#22332c);background:var(--color-surface,#fff);border:1px solid var(--color-border,rgba(0,0,0,.12));border-radius:8px">`,
    `<h2 style="margin:0 0 6px;font:800 21px/1.25 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--color-text,#22332c)">${escapeAttr(heading)}</h2>`,
    `<p style="margin:0 0 14px;color:var(--color-text-muted,rgba(34,51,44,.72))">${escapeAttr(subtitle)}</p>`,
    `<a href="/registration" style="display:inline-block;padding:11px 20px;border-radius:8px;background:var(--color-primary,#ff7043);color:#fff;font-weight:700;text-decoration:none">${escapeAttr(cta)}</a>`,
    '</section>',
  ].join('');

  const insertion = `${styleTag}\n${section}\n`;
  if (/<div\s+id="root"[^>]*>/i.test(html)) {
    return html.replace(/<div(\s+id="root"[^>]*)>/i, `${insertion}<div$1>`);
  }
  return html.replace('</body>', `${insertion}</body>`);
}

function parseQuestJsonField(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getQuestSteps(bundle) {
  const parsed = parseQuestJsonField(bundle?.steps, []);
  return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
}

function getQuestIntro(bundle) {
  const parsed = parseQuestJsonField(bundle?.intro, null);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function formatQuestDuration(durationMin) {
  const total = Number(durationMin) || 0;
  if (total <= 0) return '';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
}

function buildQuestIntroSectionModel(quest, bundle) {
  const steps = getQuestSteps(bundle);
  const intro = getQuestIntro(bundle);
  const city = String(
    quest?.city_name ||
    quest?.cityName ||
    bundle?.city?.name ||
    ''
  ).trim();
  const points = Number(quest?.points) || steps.length || 0;
  const durationLabel = formatQuestDuration(quest?.duration_min ?? quest?.durationMin ?? bundle?.duration_min);
  const startLocation = String(
    intro?.location ||
    steps[0]?.location ||
    city ||
    ''
  ).trim();

  const facts = [];
  if (city) facts.push(`Город: ${city}`);
  if (points > 0) facts.push(`Маршрут: ${points} ${pluralizeRu(points, 'точка', 'точки', 'точек')}`);
  if (durationLabel) facts.push(`Время: примерно ${durationLabel}`);
  if (startLocation) facts.push(`Старт: ${startLocation}`);

  return { city, points, durationLabel, startLocation, facts };
}

function injectQuestIntroSection(baseHtml, { title, description, quest, bundle }) {
  const cleanTitle = String(title || quest?.title || 'Городской квест').replace(/\s+\|\s*Metravel$/i, '').trim();
  const cleanDescription = String(description || buildQuestSeoDescription(quest)).trim();
  const model = buildQuestIntroSectionModel(quest, bundle);
  const lead = cleanDescription || (
    model.city
      ? `${cleanTitle} — пеший квест по городу ${model.city}.`
      : `${cleanTitle} — пеший городской квест.`
  );
  const facts = model.facts
    .map((fact) => `<li style="margin:0;padding:0">${escapeAttr(fact)}</li>`)
    .join('');

  const sectionStyle = [
    'box-sizing:border-box',
    'max-width:840px',
    'margin:24px auto',
    'padding:20px 18px',
    "font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    'color:var(--color-text,#22332c)',
    'background:var(--color-surface,#ffffff)',
    'border:1px solid var(--color-border,#dbe7df)',
    'border-radius:8px',
  ].join(';');
  const kickerStyle = [
    'margin:0 0 6px',
    'font-size:13px',
    'font-weight:800',
    'letter-spacing:0',
    'color:var(--color-text-muted,#5f756c)',
  ].join(';');
  const titleStyle = [
    'margin:0 0 10px',
    "font:800 28px/1.2 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    'letter-spacing:0',
    'color:var(--color-text,#22332c)',
  ].join(';');
  const textStyle = 'margin:0 0 14px;color:var(--color-text,#22332c)';
  const listStyle = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))',
    'gap:8px 14px',
    'margin:0',
    'padding:0',
    'list-style:none',
    'color:var(--color-text-muted,#5f756c)',
    'font-size:14px',
  ].join(';');

  const styleTag = [
    '<style data-ssg-quest-intro-style="true">',
    'html.rnw-styles-ready [data-ssg-quest-intro="true"]{display:none!important}',
    '@media(max-width:640px){[data-ssg-quest-intro="true"]{margin:12px;padding:16px 14px}[data-ssg-quest-intro="true"] h1{font-size:23px!important}}',
    '</style>',
  ].join('');
  const section = [
    `<section data-ssg-quest-intro="true" aria-label="Описание городского квеста" style="${sectionStyle}">`,
    `<p style="${kickerStyle}">Городской квест Metravel</p>`,
    `<h1 style="${titleStyle}">${escapeAttr(cleanTitle)}</h1>`,
    `<p style="${textStyle}">${escapeAttr(lead)}</p>`,
    facts ? `<ul style="${listStyle}">${facts}</ul>` : '',
    '</section>',
  ].join('');

  let html = baseHtml.replace(/<style[^>]*data-ssg-quest-intro-style="true"[^>]*>[\s\S]*?<\/style>\n?/i, '');
  html = html.replace(/<section[^>]*data-ssg-quest-intro="true"[^>]*>[\s\S]*?<\/section>\n?/i, '');
  html = html.replace('</head>', `${styleTag}\n</head>`);

  if (/<body([^>]*)>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${section}`);
  }

  return `${section}${html}`;
}

function pluralizeRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function buildQuestJsonLd({ title, description, canonical, image, quest }) {
  if (!title || !canonical) return null;
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: String(title).trim(),
    description: String(description || '').trim(),
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: 'ru',
    touristType: 'Городской квест, пеший маршрут',
    provider: {
      '@type': 'Organization',
      name: 'MeTravel',
      url: SITE_URL,
    },
  };
  if (image) payload.image = [image];
  const city = String(quest?.city_name || quest?.cityName || quest?.city?.name || '').trim();
  if (city) {
    payload.location = { '@type': 'City', name: city };
  }
  return payload;
}

/** Скрытый, но crawlable список ссылок на все квесты — для обнаружения без sitemap. */
function injectQuestLinksIndex(baseHtml, quests) {
  const links = quests
    .map((quest) => {
      const route = questRouteKey(quest);
      if (!route) return '';
      const label = String(quest.title || 'Квест').trim();
      return `<li><a href="${escapeAttr(route.path)}">${escapeAttr(label)}</a></li>`;
    })
    .filter(Boolean)
    .join('');
  if (!links) return baseHtml;

  const navStyle = [
    'position:absolute',
    'width:1px',
    'height:1px',
    'padding:0',
    'margin:-1px',
    'overflow:hidden',
    'clip:rect(0,0,0,0)',
    'clip-path:inset(50%)',
    'white-space:nowrap',
    'border:0',
  ].join(';');
  const nav = `<nav data-ssg-quest-index="true" aria-label="Все квесты" style="${navStyle}"><ul>${links}</ul></nav>`;

  if (/<nav[^>]*data-ssg-quest-index="true"[^>]*>[\s\S]*?<\/nav>/i.test(baseHtml)) {
    return baseHtml.replace(/<nav[^>]*data-ssg-quest-index="true"[^>]*>[\s\S]*?<\/nav>/i, nav);
  }
  if (/<div\s+id="root"[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<div(\s+id="root"[^>]*)>/i, `<div$1>${nav}`);
  }
  return baseHtml.replace(/<body([^>]*)>/i, `<body$1>${nav}`);
}

/** Write file, creating directories as needed. */
function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function readStaticRouteHtml(route, fallbackHtml) {
  if (route === '/') return fallbackHtml;

  const routePath = String(route || '').replace(/^\/+/, '');
  if (!routePath) return fallbackHtml;

  const candidates = [
    path.join(DIST_DIR, `${routePath}.html`),
    path.join(DIST_DIR, routePath, 'index.html'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return fs.readFileSync(candidate, 'utf8');
    } catch {
      // Fall through to the next candidate/fallback.
    }
  }

  return fallbackHtml;
}

// ---------------------------------------------------------------------------
// Related-travels index (FE-IDX-3): crawlable internal links between travels.
// ---------------------------------------------------------------------------
function travelPublicPath(t) {
  const key = (t && (t.slug || (t.id != null ? String(t.id) : ''))) || '';
  return key ? `/travels/${key}` : '';
}

function buildRelatedIndex(travels) {
  const byCountry = new Map();
  const all = [];
  for (const t of travels) {
    const p = travelPublicPath(t);
    const name = String(t.name || '').trim();
    if (!p || !name) continue;
    const country = String(t.countryName || '').trim();
    const entry = { path: p, name, country };
    all.push(entry);
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country).push(entry);
  }
  return { byCountry, all };
}

function pickRelatedTravels(travel, index, limit = 6) {
  const selfPath = travelPublicPath(travel);
  const country = String(travel?.countryName || '').trim();
  const seen = new Set([selfPath]);
  const out = [];
  const add = (e) => {
    if (out.length >= limit || !e || seen.has(e.path)) return;
    seen.add(e.path);
    out.push({ path: e.path, name: e.name });
  };
  // Rotate within the same-country list by id so all country articles get
  // a chance to appear in each other's related blocks (not just the first N).
  const offset = Math.abs(Number(travel?.id) || selfPath.length);
  if (country && index.byCountry.has(country)) {
    const countryList = index.byCountry.get(country);
    const co = countryList.length ? offset % countryList.length : 0;
    for (let i = 0; i < countryList.length && out.length < limit; i++) {
      add(countryList[(co + i) % countryList.length]);
    }
  }
  // Fill remaining from the global list, rotated by id so different pages link
  // to different sets (spreads internal link equity instead of one hub).
  const all = index.all;
  if (all.length) {
    const go = offset % all.length;
    for (let i = 0; i < all.length && out.length < limit; i++) {
      add(all[(go + i) % all.length]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Static pages definitions
// ---------------------------------------------------------------------------
const STATIC_PAGES = [
  {
    route: '/',
    title: 'Идеи поездок на выходные и книга путешествий | Metravel',
    description:
      'Планируйте путешествия, публикуйте маршруты, добавляйте фото и заметки, сохраняйте избранное и собирайте красивую книгу поездок в PDF.',
    image: `${SITE_URL}/og-home.jpg`,
  },
  {
    route: '/about',
    title: 'О проекте MeTravel — сообщество путешественников | Metravel',
    description:
      'MeTravel объединяет путешественников: публикуйте маршруты, сохраняйте полезные места, читайте истории и собирайте собственную книгу поездок.',
    breadcrumb: 'О проекте',
  },
  {
    route: '/contact',
    title: 'Контакты и обратная связь | Metravel',
    description:
      'Свяжитесь с командой Metravel: вопросы, предложения, идеи партнерства и обратная связь по маршрутам, статьям и сервису.',
    breadcrumb: 'Контакты',
  },
  {
    route: '/search',
    title: 'Поиск маршрутов и идей путешествий по Беларуси | Metravel',
    description:
      'Ищите путешествия по странам, городам, категориям и датам, применяйте фильтры и быстро находите маршруты, вдохновение и советы для следующей поездки.',
    breadcrumb: 'Поиск маршрутов',
  },
  {
    route: '/map',
    title: 'Карта маршрутов и достопримечательностей Беларуси | Metravel',
    description:
      'Изучайте интерактивную карту путешествий: находите маршруты, достопримечательности и точки интереса, включайте фильтры и стройте путь под свои планы.',
    image: `${SITE_URL}/og-map.png`,
    breadcrumb: 'Карта маршрутов',
  },
  {
    route: '/articles',
    title: 'Статьи о путешествиях, маршрутах и советах | Metravel',
    description: 'Читай статьи и заметки путешественников. Полезные советы, маршруты и лайфхаки.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/roulette',
    title: 'Случайный маршрут и идеи поездок | Metravel',
    description: 'Не знаешь куда поехать? Крути рулетку и получи случайное направление для путешествия!',
    breadcrumb: 'Рулетка маршрутов',
  },
  {
    route: '/favorites',
    title: 'Избранные маршруты и места | Metravel',
    description: 'Твои сохранённые путешествия и маршруты.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/privacy',
    title: 'Политика конфиденциальности и данных | Metravel',
    description: 'Политика конфиденциальности и обработки персональных данных MeTravel.',
    breadcrumb: 'Политика конфиденциальности',
  },
  {
    route: '/cookies',
    title: 'Настройки cookies и аналитики | Metravel',
    description: 'Управление настройками cookies и аналитики на MeTravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/login',
    title: 'Вход в Metravel: аккаунт, маршруты и избранное | Metravel',
    description:
      'Войдите в аккаунт Metravel, чтобы сохранять маршруты, управлять избранным, публиковать поездки и собирать личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/registration',
    title: 'Регистрация в Metravel: аккаунт и маршруты | Metravel',
    description:
      'Создайте аккаунт Metravel, чтобы публиковать маршруты, сохранять идеи поездок, подписываться на авторов и вести личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/register',
    canonicalRoute: '/registration',
    title: 'Регистрация в Metravel: аккаунт и маршруты | Metravel',
    description:
      'Создайте аккаунт Metravel, чтобы публиковать маршруты, сохранять идеи поездок, подписываться на авторов и вести личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/accountconfirmation',
    title: 'Подтверждение аккаунта | Metravel',
    description: 'Подтверждение учётной записи Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/set-password',
    title: 'Смена пароля | Metravel',
    description: 'Смена пароля в аккаунте Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/travelsby',
    title: 'Маршруты по Беларуси и идеи путешествий | Metravel',
    description:
      'Открывайте Беларусь через маршруты, идеи поездок и заметки путешественников: достопримечательности, природа и готовые планы на выходные.',
    breadcrumb: 'Путешествия',
  },
  {
    route: '/quests',
    title: 'Городские квесты и маршруты с заданиями | Metravel',
    description:
      'Проходите городские квесты Metravel: маршруты с заданиями, точками на карте и идеями для прогулок и поездок.',
    breadcrumb: 'Квесты',
  },
  {
    route: '/history',
    title: 'История просмотров маршрутов | Metravel',
    description: 'Хронология твоих путешествий и поездок.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/messages',
    title: 'Сообщения | Metravel',
    description: 'Личные сообщения Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/export',
    title: 'Экспорт | Metravel',
    description: 'Экспорт данных и материалов Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/metravel',
    title: 'Мои путешествия | Metravel',
    description: 'Раздел управления вашими путешествиями.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/profile',
    title: 'Профиль | Metravel',
    description: 'Профиль пользователя Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/settings',
    title: 'Настройки | Metravel',
    description: 'Настройки аккаунта Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/subscriptions',
    title: 'Подписки | Metravel',
    description: 'Ваши подписки и подписчики в Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/quests/map',
    title: 'Карта квестов | Metravel',
    description: 'Карта всех квестов Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/userpoints',
    title: 'Мои точки и сохраненные места | Metravel',
    description: 'Управляй своими точками на карте.',
    robots: 'noindex, nofollow',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ index.html not found at ${indexPath}`);
    console.error('   Run "expo export" first, then run this script.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  // Route-specific templates contain the correct JS chunk for each route.
  // Falling back to index.html would embed the home-page chunk instead of the
  // route chunk, causing the page to stall on the skeleton.
  const travelTemplatePath = path.join(DIST_DIR, 'travels', '[param].html');
  const articleTemplatePath = path.join(DIST_DIR, 'article', '[id].html');
  const travelBaseHtml = fs.existsSync(travelTemplatePath)
    ? fs.readFileSync(travelTemplatePath, 'utf8')
    : baseHtml;
  const articleBaseHtml = fs.existsSync(articleTemplatePath)
    ? fs.readFileSync(articleTemplatePath, 'utf8')
    : baseHtml;

  let totalPages = 0;
  const liveSlugs = new Set();

  // --- 1. Static pages ---
  console.log('📄 Generating static pages...');
  for (const page of STATIC_PAGES) {
    const canonicalRoute = page.canonicalRoute || page.route;
    const canonical = `${SITE_URL}${canonicalRoute === '/' ? '/' : canonicalRoute}`;
    const routeBaseHtml = readStaticRouteHtml(page.route, baseHtml);
    let html = injectMeta(routeBaseHtml, {
      title: page.title,
      description: page.description,
      canonical,
      image: page.image ?? OG_IMAGE,
      robots: page.robots,
    });

    // P3.5: Inject SSG skeleton shell for key pages (improves FCP/LCP)
    html = injectSkeletonShell(html, page.route);

    // SSG BreadcrumbList for indexable overview/landing pages so Googlebot
    // detects crumbs without executing the runtime <BreadcrumbsJsonLd/>.
    if (page.breadcrumb && canonicalRoute !== '/') {
      html = injectBreadcrumbJsonLd(html, {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: page.breadcrumb, item: canonical },
        ],
      });
    }

    if (page.route === '/') {
      // Overwrite root index.html with correct home meta
      writeFileSafe(indexPath, html);
    } else {
      const routePath = page.route.replace(/^\/+/, '');
      // Keep both variants to match nginx try_files order and avoid stale route shells.
      writeFileSafe(path.join(DIST_DIR, `${routePath}.html`), html);
      writeFileSafe(path.join(DIST_DIR, routePath, 'index.html'), html);
    }
    totalPages++;
    console.log(`  ✅ ${page.route}${(page.route === '/' || page.route === '/search') ? ' (with SSG skeleton)' : ''}`);
  }

  // --- 1b. Quest catalog ---
  // Travel SSG needs the quest catalog before travel pages are written so city
  // articles can include crawlable "quest for this city" links in the HTML.
  console.log('\n🧩 Fetching quests from API...');
  let quests = [];
  const questBundleMap = new Map();
  let questPromoCatalog = [];
  try {
    quests = await fetchQuestCatalog();
    console.log(`  📦 Got ${quests.length} quests`);

    if (quests.length > 0) {
      console.log(`  📥 Fetching quest details for location matching (concurrency: 8)...`);
      const bundles = await batchAsync(quests, 8, async (quest, i) => {
        const route = questRouteKey(quest);
        if (!route) return null;
        if ((i + 1) % 20 === 0 || i === quests.length - 1) {
          console.log(`  📡 Fetched ${i + 1}/${quests.length} quest details...`);
        }
        try {
          return await fetchJson(`${API_BASE}/api/quests/by-quest-id/${encodeURIComponent(route.questId)}/`);
        } catch (err) {
          console.warn(`  ⚠️  Quest bundle not available for ${route.questId}: ${err.message}`);
          return null;
        }
      });
      quests.forEach((quest, i) => {
        const route = questRouteKey(quest);
        if (route && bundles[i]) questBundleMap.set(route.questId, bundles[i]);
      });
      questPromoCatalog = buildQuestPromoCatalog(quests, questBundleMap);
    }
  } catch (err) {
    console.error('❌ Failed to fetch quests:', err.message);
    console.error('   Quest pages and travel quest promos will not be generated.');
  }

  // --- 2. Travel pages ---
  console.log('\n🌍 Fetching travels from API...');
  let travels = [];
  try {
    const perPage = 500;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        where: JSON.stringify({ publish: 1, moderation: 1 }),
      });

      const url = `${API_BASE}/api/travels/?${params}`;
      console.log(`  📡 Fetching page ${page}...`);
      const result = await fetchJson(url);

      let items = [];
      let total = 0;
      let hasNext = false;

      if (Array.isArray(result)) {
        items = result;
        total = result.length;
      } else if (result && typeof result === 'object') {
        items = result.data || result.results || result.items || [];
        total = typeof result.total === 'number' ? result.total
              : typeof result.count === 'number' ? result.count
              : items.length;
        // Use next_page_url/next from Laravel-style pagination if available
        hasNext = !!(result.next_page_url || result.next);
      }

      travels = travels.concat(items);
      console.log(`  📦 Got ${items.length} items (total so far: ${travels.length}/${total})`);

      hasMore = hasNext || (travels.length < total && items.length > 0 && items.length === perPage);
      page++;
    }
  } catch (err) {
    console.error('❌ Failed to fetch travels:', err.message);
    console.error('   Travel pages will not be generated.');
  }

  if (travels.length > 0) {
    // Fetch detail for each travel (description + gallery) with concurrency limit
    const travelsWithId = travels.filter((t) => t.id);
    console.log(`\n📥 Fetching details for ${travelsWithId.length} travels (concurrency: 10)...`);
    const details = await batchAsync(travelsWithId, 10, async (travel, i) => {
      if ((i + 1) % 50 === 0 || i === travelsWithId.length - 1) {
        console.log(`  📡 Fetched ${i + 1}/${travelsWithId.length} details...`);
      }
      return fetchTravelDetail(travel.id, travel.slug);
    });
    const detailMap = new Map();
    travelsWithId.forEach((t, i) => detailMap.set(t.id, details[i]));

    // FE-IDX-3: build the related-travels index once for crawlable internal links.
    const relatedIndex = buildRelatedIndex(travels);

    console.log(`\n�📝 Generating ${travels.length} travel pages...`);
    let generated = 0;
    let skipped = 0;
    let emptyNameCount = 0;
    let withBodyCount = 0;
    let withQuestPromoCount = 0;

    for (const travel of travels) {
      const slug = travel.slug || '';
      const id = travel.id;

      if (!slug && !id) {
        skipped++;
        continue;
      }

      const routeKey = slug || String(id);
      liveSlugs.add(normalizeSlug(routeKey));
      const name = travel.name || '';
      const title = buildSeoTitle(name || 'Путешествие');

      // Use detail description when available, otherwise build contextual fallback
      // from list payload fields to avoid generic, duplicate snippets.
      const detail = detailMap.get(id) || { description: '', gallery: [] };
      const description = buildTravelSeoDescription(travel, detail.description);
      const canonical = `${SITE_URL}/travels/${routeKey}`;

      // Prefer HD gallery/detail variants and avoid thumb_200 for social previews.
      const image = pickTravelSeoImage(travel, detail);

      const html = injectMeta(travelBaseHtml, {
        title,
        description,
        canonical,
        image,
        ogType: 'article',
      });

      const htmlWithBreadcrumb = injectBreadcrumbJsonLd(html, {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: `${SITE_URL}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Путешествия',
            item: `${SITE_URL}/travelsby`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: name || routeKey,
            item: canonical,
          },
        ],
      });

      const htmlWithArticleJsonLd = injectJsonLd(
        htmlWithBreadcrumb,
        buildTravelArticleJsonLd({
          title,
          description,
          canonical,
          image,
          travel,
        }),
        'travel-article'
      );

      const travelHeroPreload = buildTravelHeroPreloadData(travel, detail);
      const htmlWithTravelPreload = injectTravelHeroPreload(htmlWithArticleJsonLd, travelHeroPreload);
      const bootstrapTravel = {
        ...travel,
        ...detail,
        gallery: Array.isArray(detail.gallery) ? detail.gallery : travel.gallery,
        description: detail.description || travel.description || '',
      };
      const questMatches = findTravelQuestPromoMatches(bootstrapTravel, questPromoCatalog, 6);
      if (questMatches.length > 0) withQuestPromoCount++;
      const htmlWithTravelBootstrap = injectTravelBootstrapData(
        htmlWithTravelPreload,
        bootstrapTravel,
        routeKey
      );
      if (!name) emptyNameCount++;
      if (detail.description && detail.description.trim()) withBodyCount++;

      const htmlWithSkeleton = injectSkeletonShell(
        htmlWithTravelBootstrap,
        `/travels/${routeKey}`,
        {
          heroPreload: travelHeroPreload,
          name,
          descriptionHtml: detail.description,
          related: pickRelatedTravels(travel, relatedIndex, 6),
        }
      );
      const htmlWithQuestPromo = injectTravelQuestPromoSection(htmlWithSkeleton, questMatches);
      const htmlWithRegisterCta = injectTravelRegisterCtaSection(htmlWithQuestPromo);
      const finalTravelHtml = injectHiddenH1(htmlWithRegisterCta, name || routeKey);

      // Write both explicit-file and directory-index variants.
      // NOTE: we intentionally avoid writing an extensionless file because
      // it conflicts with creating `${routeKey}/index.html` on POSIX filesystems.
      writeFileSafe(path.join(DIST_DIR, 'travels', `${routeKey}.html`), finalTravelHtml);
      writeFileSafe(path.join(DIST_DIR, 'travels', routeKey, 'index.html'), finalTravelHtml);

      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated}, Skipped: ${skipped}`);
    console.log(`  📝 With crawlable body text: ${withBodyCount}/${generated}`);
    console.log(`  🧩 With SSG quest promo: ${withQuestPromoCount}/${generated}`);
    if (emptyNameCount > 0) {
      // FE-IDX-2: a page with an empty name falls back to the generic
      // "Путешествие | Metravel" title — surface it instead of failing silently.
      console.warn(`  ⚠️  ${emptyNameCount} travel(s) have an empty name → generic title fallback. Fix the source data.`);
    }
    if (generated > 0 && withBodyCount / generated < 0.8) {
      console.warn(`  ⚠️  Only ${Math.round((withBodyCount / generated) * 100)}% of pages have body text — check the detail API/description field.`);
    }
  }

  // --- 2b. Quest pages ---
  if (quests.length > 0) {
    const questTemplatePath = path.join(DIST_DIR, 'quests', '[city]', '[questId].html');
    const questBaseHtml = fs.existsSync(questTemplatePath)
      ? fs.readFileSync(questTemplatePath, 'utf8')
      : baseHtml;

    console.log(`\n🧩 Generating ${quests.length} quest pages...`);
    let questGenerated = 0;
    for (const quest of quests) {
      const route = questRouteKey(quest);
      if (!route) continue;

      const name = String(quest.title || 'Городской квест').trim();
      const title = buildSeoTitle(name);
      const description = buildQuestSeoDescription(quest);
      const canonical = `${SITE_URL}${route.path}`;
      const cover = String(quest.cover_url || quest.coverUrl || '').trim();
      const image = cover ? toAbsoluteUrl(cover) : OG_IMAGE;
      const questBundle = questBundleMap.get(route.questId) || null;

      let html = injectMeta(questBaseHtml, {
        title,
        description,
        canonical,
        image,
        // Квест — не статья/путешествие: og:type=website (как ждёт
        // post-deploy-seo-check). 'article' тут было копипастой из travel-блока.
        ogType: 'website',
      });

      html = injectBreadcrumbJsonLd(html, {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Квесты', item: `${SITE_URL}/quests` },
          { '@type': 'ListItem', position: 3, name, item: canonical },
        ],
      });

      html = injectJsonLd(html, buildQuestJsonLd({ title, description, canonical, image, quest: questBundle || quest }), 'quest');
      html = injectQuestIntroSection(html, { title: name, description, quest, bundle: questBundle });

      writeFileSafe(path.join(DIST_DIR, 'quests', route.cityId, `${route.questId}.html`), html);
      writeFileSafe(path.join(DIST_DIR, 'quests', route.cityId, route.questId, 'index.html'), html);
      questGenerated++;
    }

    // Crawlable index of all quests on the /quests listing page so Googlebot can
    // reach detail pages via internal links (sitemap is backend-owned, BE-017).
    const questsListVariants = [
      path.join(DIST_DIR, 'quests.html'),
      path.join(DIST_DIR, 'quests', 'index.html'),
    ];
    for (const variant of questsListVariants) {
      if (!fs.existsSync(variant)) continue;
      const listHtml = injectQuestLinksIndex(fs.readFileSync(variant, 'utf8'), quests);
      writeFileSafe(variant, listHtml);
    }

    totalPages += questGenerated;
    console.log(`  ✅ Generated: ${questGenerated} quest pages + crawlable index`);
  }

  // --- 3. Article pages ---
  console.log('\n📰 Fetching articles from API...');
  let articles = [];
  const articleErrors = [];
  const articleParams = new URLSearchParams({
    page: '1',
    perPage: '500',
    where: JSON.stringify({ publish: 1, moderation: 1 }),
  });
  const articleCandidates = await resolveArticleEndpointCandidates();

  for (const endpoint of articleCandidates) {
    const url = `${endpoint}/?${articleParams}`;
    try {
      const result = await fetchJson(url);
      const items = extractCollectionItems(result);
      if (items.length > 0) {
        articles = items;
        console.log(`  📦 Got ${articles.length} articles from ${endpoint}`);
        break;
      }
      articleErrors.push(`${endpoint} returned empty result`);
    } catch (err) {
      articleErrors.push(err.message);
    }
  }

  if (articles.length === 0) {
    const diagnostics = articleErrors.length > 0 ? articleErrors[0] : 'no article endpoint candidates';
    console.log(`⚠️  Articles API not available (skipping): ${diagnostics}`);
  }

  if (articles.length > 0) {
    console.log(`📝 Generating ${articles.length} article pages...`);
    let generated = 0;

    for (const article of articles) {
      const id = article.id;
      if (!id) continue;

      const name = article.name || '';
      const title = buildSeoTitle(name || 'Статья о путешествии');
      const rawDesc = article.description || '';
      const description = clampDescriptionForAttr(stripHtml(rawDesc, 160), 160) || FALLBACK_DESC;
      const canonical = `${SITE_URL}/article/${id}`;

      let image = OG_IMAGE;
      const thumbUrl = article.article_image_thumb_url || '';
      if (thumbUrl) {
        if (thumbUrl.startsWith('http')) {
          image = thumbUrl;
        } else if (thumbUrl.startsWith('/')) {
          image = `${SITE_URL}${thumbUrl}`;
        }
      }

      const html = injectMeta(articleBaseHtml, {
        title,
        description,
        canonical,
        image,
        ogType: 'article',
        robots: 'noindex, nofollow',
      });

      const idStr = String(id);
      writeFileSafe(path.join(DIST_DIR, 'article', `${idStr}.html`), html);
      writeFileSafe(path.join(DIST_DIR, 'article', idStr, 'index.html'), html);
      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated} article pages`);
  }

  // --- 4. Patch [param].html / [id].html fallback templates ---
  // These files are served by nginx when no per-slug HTML exists.
  // They must not be indexable generic shells. Generated per-slug/per-id HTML
  // above remains indexable; only unresolved fallbacks get noindex.
  const fallbackTemplates = [
    {
      file: path.join(DIST_DIR, 'travels', '[param].html'),
      title: 'Путешествие не найдено | Metravel',
      description: 'Эта страница путешествия не найдена или больше недоступна.',
    },
    {
      file: path.join(DIST_DIR, 'article', '[id].html'),
      title: 'Статья не найдена | Metravel',
      description: 'Эта статья не найдена или больше недоступна.',
    },
    {
      file: path.join(DIST_DIR, 'user', '[id].html'),
      title: 'Профиль не найден | Metravel',
      description: 'Этот профиль не найден или больше недоступен.',
    },
    {
      file: path.join(DIST_DIR, 'quests', '[city]', '[questId].html'),
      title: 'Квест не найден | Metravel',
      description: 'Этот квест не найден или больше недоступен.',
    },
  ];
  for (const tmpl of fallbackTemplates) {
    const filePath = tmpl.file;
    if (!fs.existsSync(filePath)) continue;
    try {
      let tmplHtml = fs.readFileSync(filePath, 'utf8');
      const before = tmplHtml;
      tmplHtml = patchNoindexFallbackTemplate(tmplHtml, tmpl);
      if (tmplHtml !== before) {
        fs.writeFileSync(filePath, tmplHtml, 'utf8');
        console.log(`  🔧 Noindexed fallback template: ${path.relative(DIST_DIR, filePath)}`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not patch fallback template ${filePath}: ${err.message}`);
    }
  }

  // --- 5. Slug 301 redirect stubs ---
  // For every old→new slug pair, emit a soft-301 stub at the old slug's path so
  // a renamed travel keeps its ranking instead of falling through to the generic
  // SPA shell (a soft-404). Skip any `from` that collides with a live travel.
  const manifestPath = path.resolve(getArg('redirects', path.join(__dirname, 'seo-redirects.json')));
  const redirects = loadRedirectManifest(manifestPath);
  if (redirects.length) {
    console.log(`\n🔁 Generating slug redirects (${redirects.length})...`);
    let redirected = 0;
    let clashes = 0;
    for (const { from, to } of redirects) {
      if (liveSlugs.has(from)) {
        clashes++;
        console.warn(`  ⚠️  Skipped redirect ${from} → ${to}: a live travel uses slug "${from}"`);
        continue;
      }
      const stub = buildRedirectStubHtml(to);
      writeFileSafe(path.join(DIST_DIR, 'travels', `${from}.html`), stub);
      writeFileSafe(path.join(DIST_DIR, 'travels', from, 'index.html'), stub);
      redirected++;
    }
    totalPages += redirected;
    console.log(`  ✅ Redirect stubs: ${redirected}${clashes ? ` (skipped ${clashes} live-slug clash)` : ''}`);
  }

  console.log(`\n🎉 Done! Generated ${totalPages} SEO pages in ${DIST_DIR}`);
}

// ---------------------------------------------------------------------------
// Exports for testing (when required as a module, main() is NOT executed)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    replaceOrInsert,
    injectMeta,
    buildSeoTitle,
    escapeAttr,
    stripHtml,
    clampDescriptionForAttr,
    toAbsoluteUrl,
    isBareMediaEndpointUrl,
    upgradeThumbToDetailUrl,
    buildTravelSeoDescription,
    pickTravelSeoImage,
    buildOptimizedTravelImageUrl,
    buildTravelHeroPreloadData,
    injectTravelHeroPreload,
    injectTravelBootstrapData,
    injectHiddenH1,
    injectJsonLd,
    buildTravelArticleJsonLd,
    injectBreadcrumbJsonLd,
    normalizeSlug,
    loadRedirectManifest,
    buildRedirectStubHtml,
    questRouteKey,
    buildQuestSeoDescription,
    buildQuestJsonLd,
    buildQuestPromoCatalog,
    findTravelQuestPromoMatches,
    injectTravelQuestPromoSection,
    injectTravelRegisterCtaSection,
    injectQuestIntroSection,
    injectQuestLinksIndex,
    patchNoindexFallbackTemplate,
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
