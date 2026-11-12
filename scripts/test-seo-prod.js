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
 * And the server contracts the head cannot show (no JS, redirects not followed):
 *   - hub and catalogue links in raw HTML (#3218, #3323), sitemap shape and
 *     <lastmod>, per article too (#3235, #3344)
 *   - ETag + 304 on an article, /quests and an author profile (#3233)
 *   - /travels/<id> → 301 to the slug, /quests/<id>/ → one redirect (#3282)
 *   - hreflang of a quest page = sitemap alternates, each answering 200 (#3282)
 *   - a missing profile is a 404 with X-Robots-Tag: noindex (#3240)
 *   - trip_facts of the quest API = the TouristTrip node of its page (#3356)
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
const {
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract');
const { readResponseText, withAcceptEncoding } = require('./lib/httpText');

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
// before runCli() could map a UsageError onto exit code 2.
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
function fetchRaw(url, requestHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      timeout: 30000,
      headers: withAcceptEncoding({ 'User-Agent': 'MeTravelSEOTest/1.0', ...requestHeaders }),
    };
    if (mod === https) opts.rejectUnauthorized = !INSECURE_TLS;
    const req = mod.get(url, opts, (res) => {
      // #1649: whole body buffered, then decoded once.
      readResponseText(res).then((body) => resolve({
        status: res.statusCode,
        location: res.headers.location,
        headers: res.headers,
        html: body,
      }), reject);
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

/**
 * #3218: хаб обязан отдавать краулеру без JS видимые ссылки `<a href>` на
 * контент. До правки главная несла 0 ссылок на статьи, `/quests` — ни одной на
 * квест, город или страну: списки строил только клиент. Пороги ниже реальных
 * чисел (страны, города, первая страница каталога) — проверяется наличие слоя,
 * а не точный размер каталога.
 */
const HUB_CONTENT_LINKS = [
  {
    path: '/',
    groups: [
      { label: 'article links', pattern: '^/travels/[^/]+$', min: 4 },
      { label: 'quest links', pattern: '^/quests/(?!country/|theme/)[^/]+/[^/]+$', min: 4 },
    ],
  },
  {
    path: '/quests',
    groups: [
      { label: 'quest country links', pattern: '^/quests/country/[^/]+$', min: 5 },
      { label: 'quest city links', pattern: '^/quests/(?!scenario$|country$|map$|theme$)[^/]+$', min: 20 },
      { label: 'quest links', pattern: '^/quests/(?!country/|theme/)[^/]+/[^/]+$', min: 20 },
    ],
  },
  {
    path: '/travelsby',
    groups: [{ label: 'article links', pattern: '^/travels/[^/]+$', min: 5 }],
  },
];

/** Уникальные пути `<a href>` своего сайта из сырого HTML, без query и якоря. */
function collectAnchorPaths(html) {
  const paths = new Set();
  for (const match of String(html || '').matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
    const href = match[1].replace(/^https?:\/\/(?:www\.)?metravel\.by(?=\/|$)/i, '');
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    paths.add(href.split('?')[0].split('#')[0].replace(/(.)\/$/, '$1'));
  }
  return [...paths];
}

function countContentLinks(html, pattern) {
  const matcher = new RegExp(pattern);
  return collectAnchorPaths(html).filter((href) => matcher.test(href)).length;
}

async function testHubContentLinks({ path, groups }) {
  const url = `${SITE}${path}`;
  console.log(`\n🔍 ${url} (hub content links)`);
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
  for (const group of groups) {
    const found = countContentLinks(html, group.pattern);
    assert(found >= group.min, `${path} raw HTML has at least ${group.min} ${group.label}`, `found ${found}`);
  }
}

/**
 * #3323: постраничный каталог статей `/search?page=N` в сыром HTML — блок
 * `<nav data-search-catalog-links="N">` со ссылками на статьи этой страницы.
 * Пока HTML `/search` отдаётся статикой (до переключения nginx на SSR, #3279),
 * блока нет ни на одной странице: проверка сообщает об этом и не краснеет.
 * Как только блок появился, обе страницы обязаны его нести, наборы статей
 * различаться, а canonical второй страницы — указывать на неё саму.
 */
const SEARCH_CATALOG_PAGES = { first: '/search', second: '/search?page=2' };
const SEARCH_CATALOG_BLOCK = /<nav\b[^>]*\bdata-search-catalog-links="(\d+)"[^>]*>([\s\S]*?)<\/nav>/i;

function readSearchCatalogBlock(html) {
  const match = String(html || '').match(SEARCH_CATALOG_BLOCK);
  if (!match) return null;
  const articles = collectAnchorPaths(match[2]).filter((href) => /^\/travels\/[^/]+$/.test(href));
  return { page: Number(match[1]), articles };
}

function evaluateSearchCatalogPages({ first, second, site }) {
  const one = readSearchCatalogBlock(first);
  const two = readSearchCatalogBlock(second);
  if (!one && !two) return { state: 'static', failures: [] };
  const failures = [];
  if (!one || one.page !== 1) failures.push('/search has no page-1 catalogue block');
  if (!two || two.page !== 2) failures.push('/search?page=2 has no page-2 catalogue block');
  if (two && two.articles.length === 0) failures.push('/search?page=2 block has no /travels/ links');
  if (one && two && two.articles.length > 0) {
    const firstSet = new Set(one.articles);
    if (two.articles.length === one.articles.length && two.articles.every((href) => firstSet.has(href))) {
      failures.push('/search and /search?page=2 list the same articles');
    }
  }
  const canonical = getCanonical(String(second || ''));
  if (canonical !== `${site}/search?page=2`) failures.push(`/search?page=2 canonical is "${canonical}"`);
  return { state: failures.length ? 'fail' : 'ok', failures, counts: [one?.articles.length ?? 0, two?.articles.length ?? 0] };
}

async function testSearchCatalogPages({ first, second }) {
  console.log(`\n🔍 ${SITE}${second} (article catalogue pages)`);
  let pages;
  try {
    pages = { first: await fetchHtml(`${SITE}${first}`), second: await fetchHtml(`${SITE}${second}`) };
  } catch (e) {
    totalTests++;
    failed++;
    const msg = `FETCH FAILED: ${describeFetchError(e)}`;
    failures.push(`${second}: ${msg}`);
    console.log(`  ❌ ${msg}`);
    return;
  }
  const verdict = evaluateSearchCatalogPages({ ...pages, site: SITE });
  if (verdict.state === 'static') {
    console.log('  ⚠️  /search ещё отдаётся статикой: блока ссылок каталога нет (ждёт #3279), проверка пропущена');
    return;
  }
  assert(verdict.state === 'ok', `${second} raw HTML links its own articles and pages`, verdict.failures.join('; '));
}

/**
 * #3235: постоянный контроль sitemap и редиректов (бэкенд их уже отдаёт верно).
 * Порог `maxWithoutLastmod` — число, а не доля: без `<lastmod>` живут только
 * статические страницы (на 11.11.2026 их 7 из 1885), и рост этого числа значит,
 * что без даты осталась целая сущность, а не одна страница.
 */
const SITEMAP_EXPECTATIONS = {
  path: '/sitemap.xml',
  rootPath: '/',
  maxWithoutLastmod: 15,
};

/** Числовой id города квестов обязан отвечать 301 на адрес с алиасом. */
const NUMERIC_QUEST_CITY_PATH = '/quests/58';

const decodeXmlEntities = (value) => String(value || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  .trim();

/**
 * Разбор sitemap без XML-библиотеки: `<urlset>` из `<url>` с `<loc>`, необязательным
 * `<lastmod>` и альтернативами `<xhtml:link href>`. `null` — документ не sitemap
 * (HTML-заглушка, `<sitemapindex>`, пустой или оборванный ответ).
 */
function parseSitemap(xml) {
  const text = String(xml || '');
  if (!/<urlset\b/i.test(text) || !/<\/urlset>\s*$/i.test(text)) return null;
  const urls = [];
  for (const match of text.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const body = match[1];
    const loc = decodeXmlEntities((body.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1]);
    if (!loc) return null;
    urls.push({
      loc,
      hasLastmod: /<lastmod>\s*\S[\s\S]*?<\/lastmod>/i.test(body),
      alternates: [...body.matchAll(/<xhtml:link\b[^>]*\bhref="([^"]*)"/gi)].map((link) => decodeXmlEntities(link[1])),
    });
  }
  return urls.length ? urls : null;
}

/** `<loc>` статьи: `/travels/<slug>` на любом origin. */
const isArticleLoc = (loc) => /^https?:\/\/[^/]+\/travels\/[^/]+$/.test(String(loc || ''));

/** Факты о sitemap для проверок: всё считается по документу, без сети. */
function evaluateSitemap(xml, { site, rootPath = '/' } = {}) {
  const urls = parseSitemap(xml);
  if (!urls) return { parsed: false };
  const locs = new Set(urls.map((url) => url.loc));
  const withAlternates = urls.filter((url) => url.alternates.length > 0);
  const missingAlternates = [...new Set(withAlternates.flatMap((url) => url.alternates).filter((href) => !locs.has(href)))];
  return {
    parsed: true,
    urlCount: urls.length,
    hasRoot: locs.has(`${String(site || '').replace(/\/+$/, '')}${rootPath}`),
    withoutLastmod: urls.filter((url) => !url.hasLastmod).map((url) => url.loc),
    articleCount: urls.filter((url) => isArticleLoc(url.loc)).length,
    articlesWithoutLastmod: urls.filter((url) => !url.hasLastmod && isArticleLoc(url.loc)).map((url) => url.loc),
    alternateUrlCount: withAlternates.length,
    missingAlternates,
  };
}


/**
 * `301` на `/quests/<alias>`: ровно один сегмент после `/quests/`, и он не число.
 * Значение алиаса не зашито — город могут переименовать, правило останется верным.
 */
function evaluateQuestCityAliasRedirect({ status, location } = {}) {
  const target = String(location || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].split('#')[0];
  const alias = (target.match(/^\/quests\/([^/]+)\/?$/) || [])[1] || '';
  return {
    ok: status === 301 && Boolean(alias) && !/^\d+$/.test(alias),
    status,
    target,
  };
}

async function testSitemap({ path, rootPath, maxWithoutLastmod }) {
  const url = `${SITE}${path}`;
  console.log(`\n🔍 ${url} (sitemap)`);
  let res;
  try {
    res = await fetchRaw(url);
  } catch (e) {
    totalTests++;
    failed++;
    const msg = `FETCH FAILED: ${describeFetchError(e)}`;
    failures.push(`${path}: ${msg}`);
    console.log(`  ❌ ${msg}`);
    return null;
  }
  assert(res.status === 200, `${path} answers 200`, `got HTTP ${res.status}`);
  const facts = evaluateSitemap(res.html, { site: SITE, rootPath });
  assert(facts.parsed, `${path} parses as a <urlset> sitemap`, 'no <urlset> with <url><loc> entries');
  if (!facts.parsed) return null;
  assert(facts.hasRoot, `${path} lists the home page ${SITE}${rootPath}`, `${facts.urlCount} URLs, none is the home page`);
  assert(
    facts.withoutLastmod.length <= maxWithoutLastmod,
    `${path} has at most ${maxWithoutLastmod} URLs without <lastmod>`,
    `found ${facts.withoutLastmod.length} of ${facts.urlCount}, e.g. ${facts.withoutLastmod.slice(0, 5).join(', ')}`
  );
  // #3344: the threshold above is for static pages; an article has a date of its
  // own, so not one `/travels/<slug>` may go without it.
  assert(
    facts.articlesWithoutLastmod.length === 0,
    `${path}: every /travels/<slug> has <lastmod>`,
    `${facts.articlesWithoutLastmod.length} of ${facts.articleCount} articles without it, e.g. ${facts.articlesWithoutLastmod.slice(0, 3).join(', ')}`
  );
  assert(facts.alternateUrlCount > 0, `${path} carries xhtml:link alternates`, `0 of ${facts.urlCount} URLs have them`);
  assert(
    facts.missingAlternates.length === 0,
    `${path}: every xhtml:link href is itself a <loc>`,
    `${facts.missingAlternates.length} missing, e.g. ${facts.missingAlternates.slice(0, 5).join(', ')}`
  );
  return parseSitemap(res.html);
}

async function testQuestCityAliasRedirect(path) {
  const url = `${SITE}${path}`;
  console.log(`\n🔍 ${url} (numeric city id → alias)`);
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
  const verdict = evaluateQuestCityAliasRedirect(res);
  assert(
    verdict.ok,
    `${path} answers 301 to /quests/<alias>`,
    `got HTTP ${verdict.status}, location "${res.location || ''}"`
  );
}

/**
 * #3329: контракты бэк-поезда спринта 35 (#3233, #3282, #3240) под постоянным
 * контролем. Оценка каждой пробы — чистая функция от уже полученного ответа:
 * её проверяют фикстуры, а сеть остаётся в тонких `test*`-обёртках.
 */

/** Несуществующий профиль: id заведомо вне диапазона выданных. */
const MISSING_PROFILE_PATH = '/user/999999999';
/** Тот же числовой id города со слэшем: один редирект, а не «снять слэш, потом алиас». */
const NUMERIC_QUEST_CITY_SLASH_PATH = '/quests/58/';
/** Запасной id статьи, когда список статей API недоступен. */
const FALLBACK_TRAVEL_ID = 586;

const headerOf = (response, name) => String((response && response.headers && response.headers[name]) || '');
const pathOfLocation = (location) => String(location || '').replace(/^https?:\/\/[^/]+/i, '').split('?')[0].split('#')[0];

/**
 * #3233: страница отдаёт валидатор, а повтор с ним получает 304 без тела.
 * `second` отсутствует, когда валидатора нет и повторять нечем.
 */
function evaluateConditionalGet({ first, second } = {}) {
  const etag = headerOf(first, 'etag');
  const failures = [];
  if (!first || first.status !== 200) failures.push(`first answer is HTTP ${first ? first.status : 'none'}`);
  if (!etag) failures.push('no ETag header');
  if (etag && (!second || second.status !== 304)) {
    failures.push(`If-None-Match answered HTTP ${second ? second.status : 'none'}, expected 304`);
  } else if (etag && second.html) {
    failures.push('the 304 answer carries a body');
  }
  return { ok: failures.length === 0, etag, failures };
}

/**
 * #3282: `/travels/<id>` — 301 на `/travels/<slug>`. Slug не число (иначе это
 * редирект id на id) и, когда он известен из API, ровно тот, что у статьи.
 */
function evaluateNumericTravelRedirect({ status, location } = {}, expectedSlug = '') {
  const target = pathOfLocation(location);
  const slug = (target.match(/^\/travels\/([^/]+)$/) || [])[1] || '';
  return {
    ok: status === 301 && Boolean(slug) && !/^\d+$/.test(slug) && (!expectedSlug || slug === expectedSlug),
    status,
    target,
  };
}

/** #3240: несуществующий профиль — 404 и запрет индексации заголовком. */
function evaluateMissingProfile(response = {}) {
  const robots = headerOf(response, 'x-robots-tag');
  return { ok: response.status === 404 && isBlockedFromIndexing(robots), status: response.status, robots };
}

/** `<link rel="alternate" hreflang>` сырого HTML, атрибуты в любом порядке. */
function readHreflangLinks(html) {
  const links = [];
  for (const [tag] of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
    const attr = (name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i')) || [])[1];
    if (String(attr('rel') || '').toLowerCase() !== 'alternate' || !attr('hreflang')) continue;
    links.push({ hreflang: attr('hreflang'), href: decodeXmlEntities(attr('href')) });
  }
  return links;
}

/**
 * #3282: hreflang страницы — только живые локали. «Живые» бэкенд считает одной
 * функцией для страницы и для sitemap, поэтому набор адресов в HTML обязан
 * совпасть с альтернативами этой же страницы в sitemap, а каждый адрес —
 * отвечать 200 (`statuses`: href → код ответа без следования редиректам).
 */
function evaluateHreflang({ html, sitemapAlternates = [], statuses = {} } = {}) {
  const links = readHreflangLinks(html);
  const failures = [];
  const codes = links.map((link) => link.hreflang);
  const repeated = [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
  if (!links.length) failures.push('no hreflang links in the raw HTML');
  if (repeated.length) failures.push(`hreflang repeated: ${repeated.join(', ')}`);
  const inHtml = new Set(links.map((link) => link.href));
  const inSitemap = new Set(sitemapAlternates);
  const onlyHtml = [...inHtml].filter((href) => !inSitemap.has(href));
  const onlySitemap = [...inSitemap].filter((href) => !inHtml.has(href));
  if (onlyHtml.length) failures.push(`in HTML but not in sitemap: ${onlyHtml.join(', ')}`);
  if (onlySitemap.length) failures.push(`in sitemap but not in HTML: ${onlySitemap.join(', ')}`);
  const dead = [...inHtml].filter((href) => statuses[href] !== 200);
  if (dead.length) failures.push(`not answering 200: ${dead.map((href) => `${href} (${statuses[href] ?? 'not probed'})`).join(', ')}`);
  return { ok: failures.length === 0, hrefs: [...inHtml], failures };
}

/** Первая русская страница квеста из sitemap, у которой есть альтернативы. */
function pickQuestSample(urls, site) {
  const origin = String(site || '').replace(/\/+$/, '');
  const found = (urls || []).find((url) => url.alternates.length > 0
    && url.loc.startsWith(`${origin}/quests/`) && /^\/quests\/[^/]+\/[^/]+$/.test(url.loc.slice(origin.length)));
  if (!found) return null;
  const [, , city, slug] = found.loc.slice(origin.length).split('/');
  return { path: `/quests/${city}/${slug}`, apiPath: `/api/quests/web/detail/${city}/${slug}/?lang=ru`, alternates: found.alternates };
}

/** Узел квеста из графа `data-seo-jsonld="quest-public"`; `null` — графа или узла нет. */
function readQuestTouristTrip(html) {
  for (const [tag, body] of String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!/\bdata-seo-jsonld="quest-public"/i.test(tag.slice(0, tag.indexOf('>') + 1))) continue;
    try {
      const graph = JSON.parse(body)['@graph'];
      const isTrip = (entry) => [].concat((entry && entry['@type']) || []).includes('TouristTrip');
      return (Array.isArray(graph) && graph.find(isTrip)) || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * #3356 (пункт «а»): `trip_facts` из API и узел TouristTrip в HTML описывают один
 * маршрут. Сверка живёт здесь, в ежедневной пробе, а не в шлюзе выката
 * `verify-live-quest-ssr.js`: расхождение фактов не делает выкат негодным, а
 * новая причина автоотката стоит дороже суток до сигнала. Неизвестный факт в
 * узле отсутствует, а не подставлен — как в `utils/questTouristTrip.ts`
 * (соответствие закреплено тестом на общих фикстурах).
 */
function evaluateTripFacts({ tripFacts, entity } = {}) {
  if (tripFacts === undefined) return { ok: false, failures: ['API detail has no trip_facts key'] };
  if (!entity) return { ok: false, failures: ['no TouristTrip node in the quest-public JSON-LD graph'] };
  const facts = tripFacts || {};
  const geo = (entity.tripOrigin && entity.tripOrigin.geo) || null;
  const expected = {
    timeRequired: facts.duration_min ? `PT${facts.duration_min}M` : undefined,
    'potentialAction.distance': facts.distance_m ? `${facts.distance_m} m` : undefined,
    'tripOrigin.geo': facts.start ? `${facts.start.lat},${facts.start.lng}` : undefined,
    isAccessibleForFree: tripFacts ? facts.is_free : undefined,
  };
  const actual = {
    timeRequired: entity.timeRequired,
    'potentialAction.distance': entity.potentialAction ? entity.potentialAction.distance : undefined,
    'tripOrigin.geo': geo ? `${geo.latitude},${geo.longitude}` : undefined,
    isAccessibleForFree: entity.isAccessibleForFree,
  };
  const failures = Object.keys(expected)
    .filter((key) => expected[key] !== actual[key])
    .map((key) => `${key}: API says ${JSON.stringify(expected[key])}, HTML has ${JSON.stringify(actual[key])}`);
  return { ok: failures.length === 0, failures };
}

/** Сетевая ошибка пробы — красный результат с адресом, а не падение набора. */
async function fetchForProbe(path, requestHeaders) {
  try {
    return await fetchRaw(path.startsWith('http') ? path : `${SITE}${path}`, requestHeaders);
  } catch (e) {
    totalTests++;
    failed++;
    const msg = `FETCH FAILED: ${describeFetchError(e)}`;
    failures.push(`${path}: ${msg}`);
    console.log(`  ❌ ${msg}`);
    return null;
  }
}

async function testConditionalGet(path) {
  console.log(`\n🔍 ${SITE}${path} (ETag → 304)`);
  const first = await fetchForProbe(path);
  if (!first) return;
  const etag = headerOf(first, 'etag');
  const second = etag ? await fetchForProbe(path, { 'If-None-Match': etag }) : null;
  if (etag && !second) return;
  const verdict = evaluateConditionalGet({ first, second });
  assert(verdict.ok, `${path} sends an ETag and answers 304 to If-None-Match`, verdict.failures.join('; '));
}

async function testNumericTravelRedirect(id, expectedSlug) {
  const path = `/travels/${id}`;
  console.log(`\n🔍 ${SITE}${path} (article id → slug)`);
  const res = await fetchForProbe(path);
  if (!res) return;
  const verdict = evaluateNumericTravelRedirect(res, expectedSlug);
  assert(
    verdict.ok,
    `${path} answers 301 to /travels/${expectedSlug || '<slug>'}`,
    `got HTTP ${verdict.status}, location "${res.location || ''}"`
  );
}

async function testSingleQuestCityRedirect(path) {
  console.log(`\n🔍 ${SITE}${path} (one redirect to the alias)`);
  const res = await fetchForProbe(path);
  if (!res) return;
  const verdict = evaluateQuestCityAliasRedirect(res);
  assert(verdict.ok, `${path} answers 301 to /quests/<alias>`, `got HTTP ${verdict.status}, location "${res.location || ''}"`);
  if (!verdict.ok) return;
  const landing = await fetchForProbe(verdict.target);
  if (!landing) return;
  assert(landing.status === 200, `${path} needs one redirect only`, `${verdict.target} answered HTTP ${landing.status}, location "${landing.location || ''}"`);
}

async function testMissingProfile(path) {
  console.log(`\n🔍 ${SITE}${path} (missing profile)`);
  const res = await fetchForProbe(path);
  if (!res) return;
  const verdict = evaluateMissingProfile(res);
  assert(verdict.ok, `${path} answers 404 with X-Robots-Tag: noindex`, `got HTTP ${verdict.status}, X-Robots-Tag "${verdict.robots}"`);
}

/** Образец квеста один на две пробы: hreflang (#3282) и сверка trip_facts (#3356). */
async function testQuestSample(sitemapUrls) {
  const sample = pickQuestSample(sitemapUrls, SITE);
  console.log(`\n🔍 ${SITE}${sample ? sample.path : '/quests/<city>/<quest>'} (hreflang, trip_facts)`);
  assert(Boolean(sample), 'sitemap offers a quest page with alternates to probe', 'sitemap unavailable or lists no such quest');
  if (!sample) return;
  const page = await fetchForProbe(sample.path);
  if (!page) return;
  assert(page.status === 200, `${sample.path} answers 200`, `got HTTP ${page.status}`);

  const statuses = {};
  for (const href of new Set(readHreflangLinks(page.html).map((link) => link.href))) {
    if (href === `${SITE}${sample.path}`) { statuses[href] = page.status; continue; }
    const res = await fetchForProbe(href);
    if (!res) return;
    statuses[href] = res.status;
  }
  const hreflang = evaluateHreflang({ html: page.html, sitemapAlternates: sample.alternates, statuses });
  assert(hreflang.ok, `${sample.path} hreflang lists only live locales, same as the sitemap`, hreflang.failures.join('; '));

  const api = await fetchForProbe(sample.apiPath);
  if (!api) return;
  let payload = null;
  try { payload = JSON.parse(api.html); } catch { /* reported by the assertion below */ }
  assert(api.status === 200 && Boolean(payload), `${sample.apiPath} answers 200 with JSON`, `got HTTP ${api.status}`);
  if (api.status !== 200 || !payload) return;
  const tripFacts = evaluateTripFacts({ tripFacts: payload.trip_facts, entity: readQuestTouristTrip(page.html) });
  assert(tripFacts.ok, `${sample.path} TouristTrip node matches trip_facts of the API`, tripFacts.failures.join('; '));
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
    h1Count: 1,
  });

  // --- 2. Search page ---
  await testPage('/search', {
    titleContains: 'Поиск',
    descNotFallback: true,
    canonicalPath: '/search',
    ogType: 'website',
    indexable: true,
    h1Count: 1,
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
    h1Count: 1,
  });

  // --- 6a. Hubs hand a no-JS crawler links to content (#3218) ---
  for (const hub of HUB_CONTENT_LINKS) {
    await testHubContentLinks(hub);
  }

  // --- 6a'. Article catalogue pages for a no-JS crawler (#3323) ---
  await testSearchCatalogPages(SEARCH_CATALOG_PAGES);

  // --- 6b. Sitemap and the numeric city redirect stay as the backend shipped them (#3235) ---
  const sitemapUrls = await testSitemap(SITEMAP_EXPECTATIONS);
  await testQuestCityAliasRedirect(NUMERIC_QUEST_CITY_PATH);

  // --- 6c. Backend train of sprint 35 (#3329): one redirect, live hreflang, 404 profile ---
  await testSingleQuestCityRedirect(NUMERIC_QUEST_CITY_SLASH_PATH);
  await testQuestSample(sitemapUrls);
  await testMissingProfile(MISSING_PROFILE_PATH);
  await testConditionalGet('/quests');

  // --- 7. About page ---
  await testPage('/about', {
    titleContains: 'MeTravel',
    descNotFallback: true,
    canonicalPath: '/about',
    ogType: 'website',
    indexable: true,
    h1Count: 1,
  });

  // --- 8. Travel detail pages (the main issue) ---
  // Fetch a few known travels from the API to test
  let travelSlugs = [];
  // First listed article: its id, slug and author feed the #3329 probes below.
  let leadTravel = null;
  try {
    const apiUrl = `${SITE}/api/travels/?page=1&perPage=5&where=${encodeURIComponent(JSON.stringify({ publish: 1, moderation: 1 }))}`;
    const apiHtml = await fetchHtml(apiUrl);
    const apiData = JSON.parse(apiHtml);
    const items = apiData.data || apiData.results || [];
    travelSlugs = items
      .filter((t) => t.slug)
      .map((t) => t.slug)
      .slice(0, 5);
    leadTravel = items.find((t) => t.slug && Number.isInteger(t.id)) || null;
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

  // --- 8a. Backend train of sprint 35 (#3329): validators and the numeric article address ---
  await testConditionalGet(`/travels/${leadTravel ? leadTravel.slug : travelSlugs[0]}`);
  await testConditionalGet(`/user/${(leadTravel && leadTravel.user && leadTravel.user.id) || 1}`);
  await testNumericTravelRedirect(leadTravel ? leadTravel.id : FALLBACK_TRAVEL_ID, leadTravel ? leadTravel.slug : '');

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
  }
  requireNoBatchFailures(failed, {
    total: totalTests,
    what: 'SEO checks',
    message: `${failed} of ${totalTests} SEO checks failed — see the report above`,
  });
  console.log('\n✅ All SEO checks passed!');
}

if (require.main === module) {
  runCli(main, { name: 'test-seo-prod', usage: USAGE });
}

module.exports = {
  CLI_SPEC, USAGE, parseArgs, isBlockedFromIndexing, checkSeoTitleContract,
  HUB_CONTENT_LINKS, collectAnchorPaths, countContentLinks,
  SEARCH_CATALOG_PAGES, evaluateSearchCatalogPages,
  SITEMAP_EXPECTATIONS, NUMERIC_QUEST_CITY_PATH, parseSitemap, evaluateSitemap, evaluateQuestCityAliasRedirect,
  MISSING_PROFILE_PATH, NUMERIC_QUEST_CITY_SLASH_PATH, evaluateConditionalGet, evaluateNumericTravelRedirect,
  evaluateMissingProfile, readHreflangLinks, evaluateHreflang, pickQuestSample, readQuestTouristTrip, evaluateTripFacts,
};
