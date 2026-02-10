#!/usr/bin/env node
/**
 * SEO smoke-test against production (or any target URL).
 *
 * Fetches raw HTML (no JS execution) and validates:
 *   - <title> is page-specific (not generic fallback)
 *   - <meta name="description"> is page-specific
 *   - <meta property="og:title|og:description|og:image|og:url|og:type">
 *   - <meta name="twitter:card|twitter:title|twitter:description|twitter:image">
 *   - <link rel="canonical">
 *   - No duplicate meta tags
 *   - og:image is a large image (not thumb_200)
 *   - robots meta for noindex pages
 *
 * Usage:
 *   node scripts/test-seo-prod.js [--url https://metravel.by] [--verbose]
 *
 * Exit code 0 = all pass, 1 = failures found.
 */

const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function hasFlag(name) { return args.includes(`--${name}`); }
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const SITE = getArg('url', 'https://metravel.by').replace(/\/+$/, '');
const VERBOSE = hasFlag('verbose');
const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 30000, headers: { 'User-Agent': 'MeTravelSEOTest/1.0' } };
    if (mod === https) opts.rejectUnauthorized = false;
    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${SITE}${res.headers.location}`;
        return fetchHtml(loc).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Extract content of a meta tag by name or property. */
function getMeta(html, attr, value) {
  // Match all occurrences
  const re = new RegExp(`<meta[^>]*${attr}="${value}"[^>]*/?>`, 'gi');
  const matches = html.match(re) || [];
  const contents = matches.map((m) => {
    const cm = m.match(/content="([^"]*)"/i);
    return cm ? cm[1] : '';
  });
  return contents;
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function getCanonical(html) {
  const m = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i);
  return m ? m[1] : '';
}

function countTag(html, pattern) {
  return (html.match(pattern) || []).length;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, detail) {
  totalTests++;
  if (condition) {
    passed++;
    if (VERBOSE) console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label}: ${detail}` : label;
    failures.push(msg);
    console.log(`  ❌ ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Page test definitions
// ---------------------------------------------------------------------------

async function testPage(path, expectations) {
  const url = `${SITE}${path}`;
  console.log(`\n🔍 ${url}`);
  let html;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    totalTests++;
    failed++;
    const msg = `FETCH FAILED: ${e.message}`;
    failures.push(`${path}: ${msg}`);
    console.log(`  ❌ ${msg}`);
    return;
  }

  const title = getTitle(html);
  const descArr = getMeta(html, 'name', 'description');
  const desc = descArr[0] || '';
  const ogTitle = getMeta(html, 'property', 'og:title')[0] || '';
  const ogDesc = getMeta(html, 'property', 'og:description')[0] || '';
  const ogImage = getMeta(html, 'property', 'og:image')[0] || '';
  const ogUrl = getMeta(html, 'property', 'og:url')[0] || '';
  const ogType = getMeta(html, 'property', 'og:type')[0] || '';
  const twCard = getMeta(html, 'name', 'twitter:card')[0] || '';
  const twTitle = getMeta(html, 'name', 'twitter:title')[0] || '';
  const twDesc = getMeta(html, 'name', 'twitter:description')[0] || '';
  const twImage = getMeta(html, 'name', 'twitter:image')[0] || '';
  const canonical = getCanonical(html);
  const robots = getMeta(html, 'name', 'robots')[0] || '';

  // --- Title ---
  assert(title.length > 0, 'title is present', `got: "${title}"`);
  if (expectations.titleContains) {
    assert(
      title.includes(expectations.titleContains),
      `title contains "${expectations.titleContains}"`,
      `got: "${title}"`
    );
  }
  if (expectations.titleNotGeneric) {
    assert(title !== 'MeTravel', 'title is not generic "MeTravel"', `got: "${title}"`);
  }

  // --- Description ---
  assert(descArr.length === 1, 'exactly 1 meta description', `found ${descArr.length}`);
  assert(desc.length > 0, 'description is present', `got: "${desc}"`);
  if (expectations.descNotFallback) {
    assert(
      desc !== FALLBACK_DESC,
      'description is NOT the generic fallback',
      `got: "${desc}"`
    );
  }
  if (expectations.descContains) {
    assert(
      desc.toLowerCase().includes(expectations.descContains.toLowerCase()),
      `description contains "${expectations.descContains}"`,
      `got: "${desc.slice(0, 80)}..."`
    );
  }

  // --- Canonical ---
  assert(canonical.length > 0, 'canonical is present', `got: "${canonical}"`);
  const canonicalCount = countTag(html, /<link[^>]*rel="canonical"[^>]*\/?>/gi);
  assert(canonicalCount === 1, 'exactly 1 canonical link', `found ${canonicalCount}`);
  if (expectations.canonicalPath) {
    assert(
      canonical.includes(expectations.canonicalPath),
      `canonical contains "${expectations.canonicalPath}"`,
      `got: "${canonical}"`
    );
  }

  // --- Open Graph ---
  assert(ogTitle.length > 0, 'og:title is present');
  assert(ogTitle === title, 'og:title matches <title>', `og="${ogTitle}" vs title="${title}"`);
  assert(ogDesc.length > 0, 'og:description is present');
  assert(ogImage.length > 0, 'og:image is present', `got: "${ogImage}"`);
  assert(ogUrl.length > 0, 'og:url is present');
  assert(ogType.length > 0, 'og:type is present', `got: "${ogType}"`);

  if (expectations.ogType) {
    assert(ogType === expectations.ogType, `og:type is "${expectations.ogType}"`, `got: "${ogType}"`);
  }

  if (expectations.ogImageNotThumb) {
    assert(
      !ogImage.includes('thumb_200'),
      'og:image is NOT a 200px thumbnail',
      `got: "${ogImage}"`
    );
  }

  if (expectations.ogImageIsHD) {
    assert(
      ogImage.includes('detail_hd') || ogImage.includes('og-preview'),
      'og:image is HD (detail_hd or og-preview)',
      `got: "${ogImage}"`
    );
  }

  // --- Twitter ---
  assert(twCard === 'summary_large_image', 'twitter:card is summary_large_image', `got: "${twCard}"`);
  assert(twTitle.length > 0, 'twitter:title is present');
  assert(twDesc.length > 0, 'twitter:description is present');
  assert(twImage.length > 0, 'twitter:image is present');

  // --- Robots ---
  if (expectations.robots) {
    assert(
      robots.includes(expectations.robots),
      `robots contains "${expectations.robots}"`,
      `got: "${robots}"`
    );
  }
  if (expectations.noRobots) {
    assert(robots === '', 'no robots meta (indexable)', `got: "${robots}"`);
  }

  // --- No duplicate OG tags ---
  const ogTitleCount = countTag(html, /<meta[^>]*property="og:title"[^>]*\/?>/gi);
  const ogDescCount = countTag(html, /<meta[^>]*property="og:description"[^>]*\/?>/gi);
  const ogImageCount = countTag(html, /<meta[^>]*property="og:image"[^>]*\/?>/gi);
  assert(ogTitleCount === 1, 'no duplicate og:title', `found ${ogTitleCount}`);
  assert(ogDescCount === 1, 'no duplicate og:description', `found ${ogDescCount}`);
  assert(ogImageCount === 1, 'no duplicate og:image', `found ${ogImageCount}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🌐 SEO smoke-test against: ${SITE}\n${'='.repeat(60)}`);

  // --- 1. Home page ---
  await testPage('/', {
    titleContains: 'Metravel',
    descNotFallback: true,
    canonicalPath: '/',
    ogType: 'website',
    noRobots: true,
  });

  // --- 2. Search page ---
  await testPage('/search', {
    titleContains: 'Поиск',
    descNotFallback: true,
    canonicalPath: '/search',
    ogType: 'website',
    noRobots: true,
  });

  // --- 3. Map page ---
  await testPage('/map', {
    titleContains: 'Карта',
    descNotFallback: true,
    canonicalPath: '/map',
    ogType: 'website',
    noRobots: true,
  });

  // --- 4. Travelsby page ---
  await testPage('/travelsby', {
    titleContains: 'Беларуси',
    descNotFallback: true,
    canonicalPath: '/travelsby',
    ogType: 'website',
    noRobots: true,
  });

  // --- 5. About page ---
  await testPage('/about', {
    titleContains: 'MeTravel',
    descNotFallback: true,
    canonicalPath: '/about',
    ogType: 'website',
    noRobots: true,
  });

  // --- 6. Travel detail pages (the main issue) ---
  // Fetch a few known travels from the API to test
  let travelSlugs = [];
  try {
    const apiUrl = `${SITE}/api/travels/?page=1&perPage=5&where=${encodeURIComponent(JSON.stringify({ publish: 1, moderation: 1 }))}`;
    const apiHtml = await fetchHtml(apiUrl);
    const apiData = JSON.parse(apiHtml);
    const items = apiData.data || apiData.results || [];
    travelSlugs = items
      .filter((t) => t.slug)
      .map((t) => t.slug)
      .slice(0, 5);
  } catch (e) {
    console.log(`\n⚠️  Could not fetch travel list from API: ${e.message}`);
    // Hardcode known slugs as fallback
    travelSlugs = [
      'ispaniya-rondo-malaga-peshchera-pileta-i-ushchele-el-chorro',
      'veneciya-za-pol-dnya',
    ];
  }

  for (const slug of travelSlugs) {
    await testPage(`/travels/${slug}`, {
      titleNotGeneric: true,
      titleContains: 'MeTravel',
      descNotFallback: true,
      canonicalPath: `/travels/${slug}`,
      ogType: 'article',
      ogImageNotThumb: true,
    });
  }

  // --- 7. Also test the specific page from the bug report ---
  if (!travelSlugs.includes('ispaniya-rondo-malaga-peshchera-pileta-i-ushchele-el-chorro')) {
    await testPage('/travels/ispaniya-rondo-malaga-peshchera-pileta-i-ushchele-el-chorro', {
      titleNotGeneric: true,
      titleContains: 'Испания',
      descNotFallback: true,
      canonicalPath: '/travels/ispaniya-rondo-malaga-peshchera-pileta-i-ushchele-el-chorro',
      ogType: 'article',
      ogImageNotThumb: true,
    });
  }

  // --- 8. Login page (should be noindex) ---
  await testPage('/login', {
    titleContains: 'Вход',
    canonicalPath: '/login',
    robots: 'noindex',
  });

  // --- 9. Registration page (should be noindex) ---
  await testPage('/registration', {
    titleContains: 'Регистрация',
    canonicalPath: '/registration',
    robots: 'noindex',
  });

  // --- Summary ---
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Results: ${passed}/${totalTests} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log(`\n❌ Failures:`);
    for (const f of failures) {
      console.log(`   • ${f}`);
    }
    process.exit(1);
  } else {
    console.log('\n✅ All SEO checks passed!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
