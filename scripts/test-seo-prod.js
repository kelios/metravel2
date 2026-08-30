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
 * `--help` prints USAGE below; every flag goes through the shared SEO CLI
 * contract (#1391). The hand-rolled `args.indexOf('--url')` this replaced turned
 * a typo into the default target: `--ur https://dev.metravel.by` quietly gated
 * PRODUCTION and reported on the wrong site — the first incident of the
 * `SEO-OPS-001` family (#1107).
 *
 * Exit codes: 0 = all pass, 1 = failures found, 2 = bad invocation.
 */

const https = require('https');
const http = require('http');
const { SEO_TITLE_MAX_LENGTH, SEO_TITLE_SUFFIX } = require('../utils/seoText');
const { parseCliArgs, requireNonEmptySelection, runSeoCli } = require('./lib/seo-cli-contract');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const USAGE = `SEO smoke-test against production HTML — metravel.by

Usage:
  node scripts/test-seo-prod.js [options]

Options:
  --url <origin>        origin to test (default https://metravel.by)
  --verbose             log passing assertions too, not just failures
  --insecure            skip TLS certificate validation (same as SEO_TEST_INSECURE=1)
  --help, -h            print this help and exit

Examples:
  node scripts/test-seo-prod.js
  node scripts/test-seo-prod.js --url https://dev.metravel.by --verbose --insecure`;

/**
 * Every flag this script accepts. Anything else is a UsageError, so a mistyped
 * `--ur` can no longer fall through to the production default (#1107, #1391).
 */
const CLI_SPEC = {
  name: 'test-seo-prod',
  usage: USAGE,
  selection: 'travel slugs',
  flags: {
    url: {
      type: 'string',
      valueName: 'an origin',
      default: 'https://metravel.by',
      stripTrailingSlash: true,
    },
    verbose: { type: 'boolean' },
    insecure: { type: 'boolean' },
  },
};

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC);

// Assigned in main() right after the parse: a module-level parse would run
// before runSeoCli() could map a UsageError onto exit code 2.
let SITE = '';
let VERBOSE = false;
let INSECURE_TLS = false;

const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * One GET, no interpretation: status, redirect target and body as they came.
 * The 404 template (#1441) is only reachable this way — `fetchHtml` below treats
 * a 404 as a transport failure and would never see that head.
 */
function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 30000, headers: { 'User-Agent': 'MeTravelSEOTest/1.0' } };
    if (mod === https) opts.rejectUnauthorized = !INSECURE_TLS;
    const req = mod.get(url, opts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({
        status: res.statusCode,
        location: res.headers.location,
        html: body,
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Follows redirects and rejects anything that is not a 200 with a body. */
function fetchHtml(url) {
  return fetchRaw(url).then((res) => {
    if (res.status >= 300 && res.status < 400 && res.location) {
      const loc = res.location.startsWith('http') ? res.location : `${SITE}${res.location}`;
      return fetchHtml(loc);
    }
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.html;
  });
}

function describeFetchError(err) {
  const code = err && err.code ? String(err.code) : '';
  const message = err && err.message ? String(err.message) : String(err);
  const signature = `${code} ${message}`;
  const tlsChainError = /(UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_HAS_EXPIRED|ERR_TLS_CERT_ALTNAME_INVALID)/i;
  if (!INSECURE_TLS && tlsChainError.test(signature)) {
    return `${message} (TLS chain issue on origin certificate; serve fullchain certificate with intermediate CA)`;
  }
  return message;
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

/**
 * A page is indexable unless the robots meta carries a blocking directive.
 * "No robots meta at all" is NOT the requirement: production legitimately serves
 * max-image-preview:large, which only widens SERP previews. Treating that as a
 * failure made this gate permanently red and therefore useless as a daily alarm.
 */
function isBlockedFromIndexing(robots) {
  return /\b(noindex|none)\b/i.test(String(robots || ''));
}

/**
 * Мирроринг контракта `buildSeoTitle` (`utils/seoText.js`) вместо прямой
 * проверки «в заголовке есть слово Metravel».
 *
 * Бренд-суффикс намеренно необязателен: при нехватке бюджета SERP жертвуем
 * брендом, а не ключевыми словами. Старый ассершен `titleContains: 'Metravel'`
 * падал именно на длинных заголовках, то есть ровно там, где правило
 * отработало верно, — и держал блокирующий гейт красным, из-за чего дневная
 * SEO-рутина каждый раз останавливалась на шаге 0.
 *
 * `buildSeoTitle` возвращает ровно три формы, их и проверяем:
 *   1. `base | Metravel` — суффикс влез в бюджет;
 *   2. `base`            — без суффикса он влезает, с суффиксом уже нет;
 *   3. `clipped…`        — не влез даже без бренда, срез по границе слова.
 */
function checkSeoTitleContract(title) {
  const value = String(title == null ? '' : title);
  const checks = [
    {
      ok: value.length <= SEO_TITLE_MAX_LENGTH,
      label: `title fits SERP budget (≤${SEO_TITLE_MAX_LENGTH} chars)`,
      detail: `got ${value.length}: "${value}"`,
    },
  ];

  // Формы 1 и 3 контракта самодостаточны: суффикс на месте либо заголовок был
  // срезан по бюджету. Осталась форма 2 — бренд отброшен, и это законно только
  // когда он действительно не влезал.
  if (!value.endsWith(SEO_TITLE_SUFFIX) && !value.endsWith('…')) {
    checks.push({
      ok: value.length + SEO_TITLE_SUFFIX.length > SEO_TITLE_MAX_LENGTH,
      label: `brand suffix "${SEO_TITLE_SUFFIX.trim()}" dropped only when it does not fit`,
      detail: `got ${value.length} chars: "${value}" — suffix still fits the budget`,
    });
  }

  return checks;
}

function assertSeoTitleContract(title) {
  for (const check of checkSeoTitleContract(title)) {
    assert(check.ok, check.label, check.detail);
  }
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
    const msg = `FETCH FAILED: ${describeFetchError(e)}`;
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
  if (expectations.titleFollowsBrandPolicy) {
    assertSeoTitleContract(title);
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

  if (Number.isInteger(expectations.h1Count)) {
    const h1Count = countTag(html, /<h1\b/gi);
    assert(
      h1Count === expectations.h1Count,
      `exactly ${expectations.h1Count} raw HTML H1`,
      `found ${h1Count}`
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
  if (expectations.indexable) {
    assert(!isBlockedFromIndexing(robots), 'indexable (no noindex directive)', `got: "${robots}"`);
  }

  // --- No duplicate OG tags ---
  const ogTitleCount = countTag(html, /<meta[^>]*property="og:title"[^>]*\/?>/gi);
  const ogDescCount = countTag(html, /<meta[^>]*property="og:description"[^>]*\/?>/gi);
  const ogImageCount = countTag(html, /<meta[^>]*property="og:image"[^>]*\/?>/gi);
  assert(ogTitleCount === 1, 'no duplicate og:title', `found ${ogTitleCount}`);
  assert(ogDescCount === 1, 'no duplicate og:description', `found ${ogDescCount}`);
  assert(ogImageCount === 1, 'no duplicate og:image', `found ${ogImageCount}`);
}

/**
 * #1441: the 404 template must not canonicalize an error page to the home page.
 *
 * Every unknown URL is served the same prebuilt `+not-found.html`, so a build-time
 * canonical there can only ever point at some other page — it pointed at `/`,
 * contradicting the `noindex, nofollow` on the same head. Absent is correct;
 * self-referential (what the inline head script produces for JS clients) is also
 * accepted, since the raw HTML this gate reads is what robots without JS see.
 *
 * The regression this catches from the other side is `testPage`'s `canonicalPath`
 * assertions on real pages: strip canonical everywhere and those go red.
 */
async function testNotFoundTemplate(path) {
  const url = `${SITE}${path}`;
  console.log(`\n🔍 ${url} (404 template)`);
  let res;
  try {
    res = await fetchRaw(url);
  } catch (e) {
    totalTests++;
    failed++;
    const msg = `FETCH FAILED: ${describeFetchError(e)}`;
    failures.push(`${path}: ${msg}`);
    console.log(`  ❌ ${msg}`);
    return;
  }

  const { status, html } = res;
  assert(status === 404, `${path} answers 404`, `got HTTP ${status}`);

  const robots = getMeta(html, 'name', 'robots')[0] || '';
  assert(isBlockedFromIndexing(robots), `${path} is noindex`, `got: "${robots}"`);

  const canonical = getCanonical(html);
  const isSelfReferential = canonical.replace(/\/$/, '') === url.replace(/\/$/, '');
  assert(
    !canonical || isSelfReferential,
    `${path} carries no canonical to another page`,
    `got: "${canonical}"`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  SITE = args.url;
  VERBOSE = args.verbose;
  INSECURE_TLS = args.insecure || String(process.env.SEO_TEST_INSECURE || '0') === '1';

  console.log(`\n🌐 SEO smoke-test against: ${SITE}\n${'='.repeat(60)}`);
  if (INSECURE_TLS) {
    console.log('⚠️  TLS certificate validation is disabled (--insecure / SEO_TEST_INSECURE=1).');
  }

  // --- 1. Home page ---
  await testPage('/', {
    titleContains: 'Metravel',
    descNotFallback: true,
    canonicalPath: '/',
    ogType: 'website',
    indexable: true,
  });

  // --- 2. Search page ---
  await testPage('/search', {
    titleContains: 'Поиск',
    descNotFallback: true,
    canonicalPath: '/search',
    ogType: 'website',
    indexable: true,
  });

  // --- 3. Map page ---
  await testPage('/map', {
    titleContains: 'Карта',
    descNotFallback: true,
    canonicalPath: '/map',
    ogType: 'website',
    indexable: true,
    h1Count: 1,
  });

  // --- 4. Articles page ---
  await testPage('/articles', {
    titleContains: 'Статьи',
    descNotFallback: true,
    canonicalPath: '/articles',
    ogType: 'website',
    robots: 'noindex',
    h1Count: 1,
  });

  // --- 5. Contact page ---
  await testPage('/contact', {
    titleContains: 'Контакты',
    descNotFallback: true,
    canonicalPath: '/contact',
    ogType: 'website',
    indexable: true,
    h1Count: 1,
  });

  // --- 6. Travelsby page ---
  await testPage('/travelsby', {
    titleContains: 'Беларуси',
    descNotFallback: true,
    canonicalPath: '/travelsby',
    ogType: 'website',
    indexable: true,
  });

  // --- 7. About page ---
  await testPage('/about', {
    titleContains: 'MeTravel',
    descNotFallback: true,
    canonicalPath: '/about',
    ogType: 'website',
    indexable: true,
  });

  // --- 8. Travel detail pages (the main issue) ---
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

  // A dead API has the hardcoded fallback above. A LIVE API that answers with
  // zero slugs has none: the envelope key changed, the gate would check no
  // travel page at all and still print "All SEO checks passed" (#1325).
  requireNonEmptySelection(travelSlugs, {
    what: 'travel slugs',
    source: `${SITE}/api/travels/`,
    hint: 'no travel detail page would be checked — fix the article source instead of reporting a clean run',
  });

  for (const slug of travelSlugs) {
    await testPage(`/travels/${slug}`, {
      titleNotGeneric: true,
      titleFollowsBrandPolicy: true,
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

  // --- 10. Shared 404 template (#1441) ---
  // Three shapes of "not a page": a plainly invalid URL, and the two bare
  // prefixes that used to answer 200 with the home shell (#1341).
  for (const path of ['/zzz-does-not-exist-1441', '/article', '/user']) {
    await testNotFoundTemplate(path);
  }

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
  }
}

if (require.main === module) {
  runSeoCli(main, { name: 'test-seo-prod', usage: USAGE });
}

module.exports = { CLI_SPEC, USAGE, parseArgs, isBlockedFromIndexing, checkSeoTitleContract };
