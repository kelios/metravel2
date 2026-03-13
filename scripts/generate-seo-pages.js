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
  return plain.slice(0, maxLength) || '';
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

function buildOptimizedTravelImageUrl(rawUrl, { width, quality, updatedAt, id, dpr } = {}) {
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
    if (dpr) parsed.searchParams.set('dpr', String(dpr));
    parsed.searchParams.set('fit', 'contain');

    return parsed.toString();
  } catch {
    return versioned;
  }
}

function buildTravelHeroSrcSet(rawUrl, widths, { quality, updatedAt, id, dpr } = {}) {
  if (!rawUrl || !Array.isArray(widths) || widths.length === 0) return '';

  return widths
    .map((width) => {
      const href = buildOptimizedTravelImageUrl(rawUrl, {
        width,
        quality,
        updatedAt,
        id,
        dpr,
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
  const clippedBase =
    normalized.length > maxBaseLength
      ? `${normalized.slice(0, maxBaseLength - 1).trimEnd()}…`
      : normalized;

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

function buildTravelSeoDescription(travel, detailDescription) {
  const primary = stripHtml(detailDescription || travel?.description || '', 160);
  const travelName = String(travel?.name || '').trim();
  const countryName = String(travel?.countryName || '').trim();
  const fallbackParts = [travelName, countryName].filter(Boolean);
  const contextual =
    fallbackParts.length > 0
      ? `${fallbackParts.join(' — ')}. Маршрут, советы и впечатления путешественников в MeTravel.`
      : FALLBACK_DESC;

  if (primary.length >= 80) return primary;

  if (primary) {
    const combined = `${primary.replace(/[.!?\s]+$/g, '')}. ${contextual}`.replace(/\s+/g, ' ').trim();
    return combined.slice(0, 160);
  }

  return contextual.slice(0, 160);
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
  const thumbUrl = String(travel?.travel_image_thumb_url || travel?.travelImageThumbUrl || '').trim();
  if (thumbUrl) {
    return {
      url: thumbUrl,
      updatedAt: travel?.updated_at || travel?.updatedAt || null,
      id: travel?.id ?? null,
    };
  }

  const galleryFirst = detail?.gallery?.[0];
  if (galleryFirst) {
    const galleryUrl = typeof galleryFirst === 'string' ? galleryFirst : galleryFirst.url;
    const galleryUpdatedAt = typeof galleryFirst === 'string' ? null : galleryFirst.updated_at;
    const galleryId = typeof galleryFirst === 'string' ? null : galleryFirst.id;
    if (galleryUrl) {
      return { url: galleryUrl, updatedAt: galleryUpdatedAt, id: galleryId };
    }
  }

  return null;
}

function buildTravelHeroPreloadData(travel, detail) {
  const source = pickTravelHeroImageSource(travel, detail);
  if (!source?.url) return null;

  const mobileHref = buildOptimizedTravelImageUrl(source.url, {
    width: 400,
    quality: 35,
    updatedAt: source.updatedAt,
    id: source.id,
    dpr: 1,
  });
  const desktopHref = buildOptimizedTravelImageUrl(source.url, {
    width: 720,
    quality: 45,
    updatedAt: source.updatedAt,
    id: source.id,
    dpr: 1.5,
  });

  if (!mobileHref && !desktopHref) return null;

  return {
    mobile: mobileHref
      ? {
          href: mobileHref,
          srcSet: buildTravelHeroSrcSet(source.url, [320, 400], {
            quality: 35,
            updatedAt: source.updatedAt,
            id: source.id,
            dpr: 1,
          }),
          sizes: '100vw',
        }
      : null,
    desktop: desktopHref
      ? {
          href: desktopHref,
          srcSet: buildTravelHeroSrcSet(source.url, [480, 720], {
            quality: 45,
            updatedAt: source.updatedAt,
            id: source.id,
            dpr: 1.5,
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
async function fetchTravelDetail(id) {
  try {
    const url = `${API_BASE}/api/travels/${id}/`;
    const detail = await fetchJson(url);
    return {
      description: detail.description || '',
      gallery: Array.isArray(detail.gallery) ? detail.gallery : [],
    };
  } catch {
    return { description: '', gallery: [] };
  }
}

function extractCollectionItems(result) {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    return result.data || result.results || result.items || [];
  }
  return [];
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

  const preloadTags = [
    preloadData.mobile?.href
      ? `<link data-travel-hero-preload="true" data-hero-variant="mobile" rel="preload" as="image" href="${escapeAttr(preloadData.mobile.href)}"${preloadData.mobile.srcSet ? ` imagesrcset="${escapeAttr(preloadData.mobile.srcSet)}"` : ''}${preloadData.mobile.sizes ? ` imagesizes="${escapeAttr(preloadData.mobile.sizes)}"` : ''} media="(max-width: 767px)" fetchpriority="high" crossorigin="anonymous"/>`
      : '',
    preloadData.desktop?.href
      ? `<link data-travel-hero-preload="true" data-hero-variant="desktop" rel="preload" as="image" href="${escapeAttr(preloadData.desktop.href)}"${preloadData.desktop.srcSet ? ` imagesrcset="${escapeAttr(preloadData.desktop.srcSet)}"` : ''}${preloadData.desktop.sizes ? ` imagesizes="${escapeAttr(preloadData.desktop.sizes)}"` : ''} media="(min-width: 768px)" fetchpriority="high" crossorigin="anonymous"/>`
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

  const hiddenHeading = `<h1 data-ssg-travel-h1="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">${escapeAttr(text)}</h1>`;

  if (/<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i.test(baseHtml)) {
    return baseHtml.replace(
      /<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i,
      hiddenHeading
    );
  }

  return baseHtml.replace(/<body([^>]*)>/i, `<body$1>${hiddenHeading}`);
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
        url: `${SITE_URL}/assets/icons/logo_yellow.png`,
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

/** Write file, creating directories as needed. */
function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
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
  },
  {
    route: '/about',
    title: 'О проекте MeTravel — сообщество путешественников | Metravel',
    description:
      'MeTravel объединяет путешественников: публикуйте маршруты, сохраняйте полезные места, читайте истории и собирайте собственную книгу поездок.',
  },
  {
    route: '/contact',
    title: 'Контакты и обратная связь | Metravel',
    description:
      'Свяжитесь с командой Metravel: вопросы, предложения, идеи партнерства и обратная связь по маршрутам, статьям и сервису.',
  },
  {
    route: '/search',
    title: 'Поиск маршрутов и идей путешествий по Беларуси | Metravel',
    description:
      'Ищите путешествия по странам, городам, категориям и датам, применяйте фильтры и быстро находите маршруты, вдохновение и советы для следующей поездки.',
  },
  {
    route: '/map',
    title: 'Карта маршрутов и достопримечательностей Беларуси | Metravel',
    description:
      'Изучайте интерактивную карту путешествий: находите маршруты, достопримечательности и точки интереса, включайте фильтры и стройте путь под свои планы.',
  },
  {
    route: '/articles',
    title: 'Статьи о путешествиях, маршрутах и советах | Metravel',
    description: 'Читай статьи и заметки путешественников. Полезные советы, маршруты и лайфхаки.',
  },
  {
    route: '/roulette',
    title: 'Случайный маршрут и идеи поездок | Metravel',
    description: 'Не знаешь куда поехать? Крути рулетку и получи случайное направление для путешествия!',
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
    route: '/travelsby',
    title: 'Маршруты по Беларуси и идеи путешествий | Metravel',
    description:
      'Открывайте Беларусь через маршруты, идеи поездок и заметки путешественников: достопримечательности, природа и готовые планы на выходные.',
  },
  {
    route: '/quests',
    title: 'Городские квесты и маршруты | Metravel',
    description: 'Проходи квесты по городам и открывай новые места.',
  },
  {
    route: '/history',
    title: 'История просмотров маршрутов | Metravel',
    description: 'Хронология твоих путешествий и поездок.',
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

  // --- 1. Static pages ---
  console.log('📄 Generating static pages...');
  for (const page of STATIC_PAGES) {
    const canonical = `${SITE_URL}${page.route === '/' ? '/' : page.route}`;
    let html = injectMeta(baseHtml, {
      title: page.title,
      description: page.description,
      canonical,
      image: OG_IMAGE,
      robots: page.robots,
    });

    // P3.5: Inject SSG skeleton shell for key pages (improves FCP/LCP)
    html = injectSkeletonShell(html, page.route);

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

      if (Array.isArray(result)) {
        items = result;
        total = result.length;
      } else if (result && typeof result === 'object') {
        items = result.data || result.results || result.items || [];
        total = typeof result.total === 'number' ? result.total
              : typeof result.count === 'number' ? result.count
              : items.length;
      }

      travels = travels.concat(items);
      console.log(`  📦 Got ${items.length} items (total so far: ${travels.length}/${total})`);

      hasMore = travels.length < total && items.length === perPage;
      page++;
    }
  } catch (err) {
    console.error('❌ Failed to fetch travels:', err.message);
    console.error('   Travel pages will not be generated.');
  }

  if (travels.length > 0) {
    // Fetch detail for each travel (description + gallery) with concurrency limit
    const travelsWithId = travels.filter((t) => t.id);
    console.log(`\n� Fetching details for ${travelsWithId.length} travels (concurrency: 10)...`);
    const details = await batchAsync(travelsWithId, 10, async (travel, i) => {
      if ((i + 1) % 50 === 0 || i === travelsWithId.length - 1) {
        console.log(`  📡 Fetched ${i + 1}/${travelsWithId.length} details...`);
      }
      return fetchTravelDetail(travel.id);
    });
    const detailMap = new Map();
    travelsWithId.forEach((t, i) => detailMap.set(t.id, details[i]));

    console.log(`\n�📝 Generating ${travels.length} travel pages...`);
    let generated = 0;
    let skipped = 0;

    for (const travel of travels) {
      const slug = travel.slug || '';
      const id = travel.id;

      if (!slug && !id) {
        skipped++;
        continue;
      }

      const routeKey = slug || String(id);
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
      const htmlWithTravelBootstrap = injectTravelBootstrapData(
        htmlWithTravelPreload,
        bootstrapTravel,
        routeKey
      );
      const finalTravelHtml = injectHiddenH1(htmlWithTravelBootstrap, name || routeKey);

      // Write both explicit-file and directory-index variants.
      // NOTE: we intentionally avoid writing an extensionless file because
      // it conflicts with creating `${routeKey}/index.html` on POSIX filesystems.
      writeFileSafe(path.join(DIST_DIR, 'travels', `${routeKey}.html`), finalTravelHtml);
      writeFileSafe(path.join(DIST_DIR, 'travels', routeKey, 'index.html'), finalTravelHtml);

      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated}, Skipped: ${skipped}`);
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
      const description = stripHtml(rawDesc, 160) || FALLBACK_DESC;
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
  // They must NOT contain a hardcoded canonical pointing to the homepage —
  // the inline JS in +html.tsx sets the correct canonical at runtime.
  const fallbackTemplates = [
    path.join(DIST_DIR, 'travels', '[param].html'),
    path.join(DIST_DIR, 'article', '[id].html'),
    path.join(DIST_DIR, 'user', '[id].html'),
  ];
  for (const tmpl of fallbackTemplates) {
    if (!fs.existsSync(tmpl)) continue;
    try {
      let tmplHtml = fs.readFileSync(tmpl, 'utf8');
      // Remove any hardcoded <link rel="canonical"> — the inline JS handles it.
      const before = tmplHtml;
      tmplHtml = tmplHtml.replace(/<link[^>]*rel="canonical"[^>]*\/?>\n?/gi, '');
      if (tmplHtml !== before) {
        fs.writeFileSync(tmpl, tmplHtml, 'utf8');
        console.log(`  🔧 Stripped canonical from fallback: ${path.relative(DIST_DIR, tmpl)}`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not patch fallback template ${tmpl}: ${err.message}`);
    }
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
    escapeAttr,
    stripHtml,
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
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
