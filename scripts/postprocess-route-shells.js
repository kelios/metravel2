#!/usr/bin/env node
/**
 * Post-processing of the static route shells of a web export (#2766).
 *
 * Entity pages (travel articles, quests, city and country landings, `/`,
 * `/quests`, `/quests/scenario`) are rendered per request by the Expo Router
 * server (SSR loaders). The build no longer prerenders entity bodies; this
 * script only finishes the shells the export already contains:
 *
 *   - 404 document boot (`prepareNotFoundDocumentBoot`);
 *   - static routes from `utils/seoRoutes/staticRoutes.js`: page meta, SSG
 *     skeleton shell, home hero preload, hidden H1, BreadcrumbList;
 *   - noindex metadata pages for the legacy blog `/article/<id>` (the only
 *     API read of the build);
 *   - noindex/not-found heads of the route fallback templates
 *     (`travels/[param].html`, `quests/[city]/[questId].html`, …);
 *   - the chunk reload guard over every HTML file.
 *
 * Usage:
 *   node scripts/postprocess-route-shells.js [--dist <dir>] [--api <url>]
 *
 * Defaults:
 *   --dist  dist/prod          (output of `expo export`)
 *   --api   https://metravel.by (production API, `/article/<id>` metadata)
 */

const fs = require('fs');
const path = require('path');
const { getSmartAppBannerContent } = require('../utils/mobileAppHandoff');
const { DEFAULT_OG_IMAGE_PATH, listStaticRouteSeo } = require('../utils/seoRoutes/staticRoutes');
const { loadSsgCatalogs } = require('../i18n/babel-inline-plugin');
const { fetchJsonOnce, withRetries } = require('./lib/fetchJson');
const { BUILD_FETCH_MIN_INTERVAL_MS, createRequestPacer } = require('./lib/requestPacer');
const { toLegacyResizePath } = require('./lib/readerMediaUrl');
const { injectSkeletonShell } = require('./ssg-skeletons');
const { ensureHtmlChunkReloadGuards } = require('./lib/htmlChunkReloadGuard');
const { truncateSeoText } = require('../utils/travelSeoDescription');
const {
  buildSeoTitle: buildSharedSeoTitle,
  normalizeSeoLead,
  clampDescriptionForAttr,
} = require('../utils/seoText');
const { prepareNotFoundDocumentBoot } = require('./lib/expoStaticShell');

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
const OG_IMAGE = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.';

const I18N_CATALOGS = loadSsgCatalogs(path.resolve(__dirname, '..')).catalogs;
const RU_I18N_CATALOG = I18N_CATALOGS.get('ru');

function readRequiredRuTranslation(key) {
  const value = RU_I18N_CATALOG?.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required RU translation: ${key}`);
  }
  return value;
}

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

/**
 * Лид для сниппета: сначала чистим декор (эмодзи, служебная строка маршрута),
 * потом режем. В обратном порядке декор съедал бы бюджет 160 символов, а суть
 * уезжала за границу. Только для описаний — названия и FAQ идут через stripHtml.
 */
function stripHtmlToSnippet(html, maxLength = 160) {
  const plain = normalizeSeoLead(stripHtml(html, Number.MAX_SAFE_INTEGER));
  return stripHtml(plain, maxLength);
}

/** Strip HTML tags and collapse whitespace → plain text description. */
const stripHtml = truncateSeoText;

/**
 * Зеркало `socialPreviewWidthForRoute` из `constants/imageContract.ts`: ступень
 * производной для og:image по семейству. Сверяется тестом
 * `__tests__/scripts/socialPreviewWidthParity.test.ts` — руками не править, только
 * вслед за `IMAGE_STORAGE_POLICY_V1`.
 */
const SOCIAL_PREVIEW_WIDTH_BY_ROUTE = new Map([
  ['avatar', 160],
  ['badge-image', 160],
  ['quest-cover', 800],
  ['address-image', 960],
  ['quest-step-image', 800],
  ['quest-review-photo', 800],
  ['quest-poster', 800],
  ['trip-cover', 960],
  ['travel-image', 1280],
  ['gallery', 1280],
  ['travel-description-image', 960],
]);

/**
 * #1221: соцпревью просили картинку «голым» адресом, без `?w=`, и получали МАСТЕР
 * с `no-store` — по 0.4–1 МБ на каждый обход краулера и каждый шеринг. `no-store`
 * не кэширует ни nginx, ни браузер, поэтому кэшируемым такой ответ делает только
 * ширина в URL. Ступень берётся из контракта семейства: ширину вне
 * `derivatives` спрашивать нельзя — чтение fail-closed и отвечает 400 (#1224).
 */
function withSocialPreviewWidth(absoluteUrl) {
  if (!absoluteUrl) return absoluteUrl;
  try {
    const url = new URL(absoluteUrl);
    if (url.searchParams.has('w')) return absoluteUrl;
    const route = /^\/([a-z-]+)\//i.exec(url.pathname)?.[1];
    const width = route ? SOCIAL_PREVIEW_WIDTH_BY_ROUTE.get(route) : null;
    if (!width) return absoluteUrl;
    url.searchParams.set('w', String(width));
    return url.toString();
  } catch {
    return absoluteUrl;
  }
}

/**
 * Адрес, по которому кадр запросит читатель, — для готового абсолютного URL;
 * чужой origin не трогаем.
 *
 * Правило переписывания здесь СВОЁ НЕ ЖИВЁТ: оно одно на все гейты и на SSG —
 * `toLegacyResizePath` из `scripts/lib/readerMediaUrl.js` (#1854). До #1868 тут
 * стояла его четвёртая копия, и сверялась она не с самим правилом, а с разметкой
 * страницы (`travelHeroPreloadParity`: preload греет тот же файл, что просит
 * `<img>`). Сузься во фронте набор расширений — обе стороны SSG уехали бы
 * согласованно, тест остался бы зелёным, а preload грел бы адрес по устаревшему
 * правилу. Ровно так уже разъехались три копии до общего модуля.
 *
 * Берётся `toLegacyResizePath`, а не `toReaderMediaPath`: контракт вызывающего —
 * «переписать или оставить как есть», и `null` на непереписываемом пути обязан
 * отличаться от переписанного адреса. `toReaderMediaPath` на таком пути отдаёт
 * путь как есть, и одно от другого было бы не отличить.
 *
 * На вход идёт ТОЛЬКО `pathname`: origin вызывающий уже проверил, а query
 * остаётся на самом `parsed` — присвоение `parsed.pathname` строку с `?` не примет.
 */
function toReaderMediaUrlOnApiOrigin(absoluteUrl) {
  try {
    const parsed = new URL(absoluteUrl);
    if (parsed.origin !== API_ORIGIN) return absoluteUrl;
    const legacyPathname = toLegacyResizePath(parsed.pathname);
    if (!legacyPathname) return absoluteUrl;
    parsed.pathname = legacyPathname;
    return parsed.toString();
  } catch {
    return absoluteUrl;
  }
}

/**
 * Адрес обложки для соцпревью: ступень производной плюс тот же transform-роут,
 * по которому кадр запрашивает читатель (#1872).
 *
 * ПОРЯДОК ЗДЕСЬ — ЧАСТЬ КОНТРАКТА, И ОН НЕ КОММУТИРУЕТ. `withSocialPreviewWidth`
 * узнаёт семейство по ПЕРВОМУ сегменту пути (`SOCIAL_PREVIEW_WIDTH_BY_ROUTE`).
 * После переписывания первый сегмент — `media-resize`, семейства в таблице нет,
 * ширина не проставится вовсе, и краулер получит мастер с `no-store` — ровно тот
 * регресс, который закрыт #1221. Поэтому сначала ширина по исходному
 * family-роуту, и только потом роут.
 *
 * ЧТО ещё переписывается. С #1204 это только класс `uploads/**`: у него
 * durable-производных нет вовсе. Conversion-ключи остались на своих
 * family-роутах — обе причины обхода закрыты на бэкенде (лестница в
 * #1195/#1201/#1168, кэш nginx в #1920; замер прода 15.09.2026 даёт на
 * `gallery`/`address-image`/`travel-image` `MISS` → `HIT` и SHA-256, совпадающий
 * с legacy-роутом).
 *
 * Классам без legacy-роута (плоский корень `/gallery/<hash>.webp` — большинство
 * обложек) отдельной ветки не нужно: `toLegacyResizePath` отдаёт на них `null`,
 * и адрес остаётся прежним.
 */
function toSocialPreviewUrl(absoluteUrl) {
  return toReaderMediaUrlOnApiOrigin(withSocialPreviewWidth(absoluteUrl));
}

// Правило заголовка живёт в utils/seoTitle.js — тот же код собирает <title> в
// рантайме, иначе статический и гидрированный заголовки разъехались бы.
const buildSeoTitle = buildSharedSeoTitle;

/** Escape a string for safe insertion into HTML attribute values. */
function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// /article/<id> metadata (the only API read of the build)
// ---------------------------------------------------------------------------

function extractCollectionItems(result) {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    return result.data || result.results || result.items || [];
  }
  return [];
}

function normalizeApiEndpoint(endpoint, apiBase = API_BASE) {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/+$/, '');
  }
  if (!raw.startsWith('/')) return '';
  return `${apiBase}${raw}`.replace(/\/+$/, '');
}

async function resolveArticleEndpointCandidates({ fetchJson: read, apiBase = API_BASE }) {
  const fromApiIndex = [];
  try {
    const indexPayload = await read(`${apiBase}/api/`);
    if (indexPayload && typeof indexPayload === 'object') {
      for (const [key, value] of Object.entries(indexPayload)) {
        if (!/articles?/i.test(String(key))) continue;
        const normalized = normalizeApiEndpoint(value, apiBase);
        if (normalized) fromApiIndex.push(normalized);
      }
    }
  } catch {
    // ignore API index probe errors and use hardcoded fallback paths
  }

  return Array.from(
    new Set([
      ...fromApiIndex,
      `${apiBase}/api/articles`,
      `${apiBase}/api/articles/`,
      `${apiBase}/api/article`,
      `${apiBase}/api/article/`,
    ].map((value) => value.replace(/\/+$/, '')))
  );
}

// ---------------------------------------------------------------------------
// Meta-tag injection
// ---------------------------------------------------------------------------

/**
 * Replace an HTML match or insert a fragment beside it without letting
 * String#replace interpret `$&`, `$'`, $` or `$1` inside generated content.
 */
function applyHtmlFragment(html, anchor, fragment, placement = 'replace') {
  return html.replace(anchor, (match) => {
    if (placement === 'before') return `${fragment}${match}`;
    if (placement === 'after') return `${match}${fragment}`;
    return fragment;
  });
}

/**
 * Replace or insert a tag in the HTML.
 * Deduplicate and insert before </head>, or before head scripts when requested.
 */
function replaceOrInsert(html, regex, tag, beforeHeadScripts = false) {
  // Ensure uniqueness: remove all existing matches, then insert one canonical tag.
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const globalRegex = new RegExp(regex.source, flags);
  const withoutMatches = html.replace(globalRegex, '');
  return beforeHeadScripts
    ? applyHtmlFragment(withoutMatches, /<head\b[^>]*>/i, `${tag}\n`, 'after')
    : applyHtmlFragment(withoutMatches, '</head>', `${tag}\n`, 'before');
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
  html = applyHtmlFragment(
    html,
    /<title[^>]*>.*?<\/title>/i,
    `<title data-rh="true">${escapeAttr(title)}</title>`
  );

  // Descriptions must precede the critical head script so it sees the SSG value
  // during parsing. The existing charset postprocessor keeps charset first.
  // Provenance preserves selected text even when it resembles a generic shell fallback.
  // --- meta description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="description"[^>]*\/?>/i,
    `<meta data-rh="true" name="description" content="${escapeAttr(description)}" data-ssg-description="true"/>`,
    true
  );

  // --- canonical ---
  html = replaceOrInsert(
    html,
    /<link[^>]*rel="canonical"[^>]*\/?>/i,
    `<link data-rh="true" rel="canonical" href="${escapeAttr(canonical)}"/>`
  );

  // Safari receives a page-specific app destination before JavaScript loads.
  html = replaceOrInsert(
    html,
    /<meta\b(?=[^>]*\bname\s*=\s*["']apple-itunes-app["'])[^>]*\/?>/i,
    `<meta name="apple-itunes-app" content="${escapeAttr(getSmartAppBannerContent(canonical))}"/>`
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
    `<meta data-rh="true" property="og:description" content="${escapeAttr(description)}" data-ssg-description="true"/>`,
    true
  );

  // --- og:url ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:url"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:url" content="${escapeAttr(canonical)}"/>`
  );

  // --- og:image ---
  // #1221: ширину ставим здесь, в единственной точке вставки, чтобы её нельзя было
  // забыть ни на одном из пяти вызовов injectMeta (город, маршрут, travel, квест, статья).
  // #1872: и тем же вызовом уводим на кэшируемый transform-роут — иначе превью
  // пересчитывается в Django на каждый обход краулера и каждый шеринг.
  image = toSocialPreviewUrl(image);
  if (image) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*property="og:image"[^>]*\/?>/i,
      `<meta data-rh="true" property="og:image" content="${escapeAttr(image)}"/>`
    );
    // The prerendered shell carries generic og:image:secure_url (logo) and
    // og:image:alt ("[param] | Metravel") from the route placeholder — keep
    // them in sync with the per-page image, otherwise crawlers read the shell values.
    html = replaceOrInsert(
      html,
      /<meta[^>]*property="og:image:secure_url"[^>]*\/?>/i,
      `<meta data-rh="true" property="og:image:secure_url" content="${escapeAttr(image)}"/>`
    );
    html = replaceOrInsert(
      html,
      /<meta[^>]*property="og:image:alt"[^>]*\/?>/i,
      `<meta data-rh="true" property="og:image:alt" content="${escapeAttr(title)}"/>`
    );
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="twitter:image:alt"[^>]*\/?>/i,
      `<meta data-rh="true" name="twitter:image:alt" content="${escapeAttr(title)}"/>`
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
    `<meta data-rh="true" name="twitter:description" content="${escapeAttr(description)}" data-ssg-description="true"/>`,
    true
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

function patchNoindexFallbackTemplate(baseHtml, { title, description, robots = 'noindex, follow' } = {}) {
  let html = baseHtml;

  // Template files like travels/[param].html and quests/[city]/[questId].html
  // are served only when there is no generated per-route HTML. Raw crawlers see
  // the template before React resolves the route, so do not leave indexable
  // generic titles or literal [param]/[questId] canonicals in place.
  // #2740: the shell head now comes from the route's generateMetadata (brand
  // defaults, no canonical) — og/twitter/og:url follow the same not-found text.
  html = html.replace(/<link[^>]*rel="canonical"[^>]*\/?>\n?/gi, '');
  html = html.replace(/<meta[^>]*property="og:url"[^>]*\/?>\n?/gi, '');

  if (title) {
    // Export-level pages (+not-found, _sitemap) ship no <title> at all — insert one.
    html = /<title[^>]*>/i.test(html)
      ? applyHtmlFragment(html, /<title[^>]*>.*?<\/title>/i, `<title data-rh="true">${escapeAttr(title)}</title>`)
      : applyHtmlFragment(html, /<head\b[^>]*>/i, `<title data-rh="true">${escapeAttr(title)}</title>\n`, 'after');
    html = replaceOrInsert(html, /<meta[^>]*property="og:type"[^>]*\/?>/i, '<meta data-rh="true" property="og:type" content="website"/>');
    html = replaceOrInsert(html, /<meta[^>]*property="og:site_name"[^>]*\/?>/i, '<meta data-rh="true" property="og:site_name" content="MeTravel"/>');
    html = replaceOrInsert(html, /<meta[^>]*name="twitter:card"[^>]*\/?>/i, '<meta data-rh="true" name="twitter:card" content="summary"/>');
    html = replaceOrInsert(html, /<meta[^>]*property="og:locale"[^>]*\/?>/i, '<meta data-rh="true" property="og:locale" content="ru_RU"/>');
    html = replaceOrInsert(html, /<meta[^>]*property="og:title"[^>]*\/?>/i, `<meta data-rh="true" property="og:title" content="${escapeAttr(title)}"/>`);
    html = replaceOrInsert(html, /<meta[^>]*name="twitter:title"[^>]*\/?>/i, `<meta data-rh="true" name="twitter:title" content="${escapeAttr(title)}"/>`);
  }

  if (description) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="description"[^>]*\/?>/i,
      `<meta data-rh="true" name="description" content="${escapeAttr(description)}"/>`
    );
    html = replaceOrInsert(html, /<meta[^>]*property="og:description"[^>]*\/?>/i, `<meta data-rh="true" property="og:description" content="${escapeAttr(description)}"/>`);
    html = replaceOrInsert(html, /<meta[^>]*name="twitter:description"[^>]*\/?>/i, `<meta data-rh="true" name="twitter:description" content="${escapeAttr(description)}"/>`);
  }

  html = replaceOrInsert(
    html,
    /<meta[^>]*name="robots"[^>]*\/?>/i,
    `<meta data-rh="true" name="robots" content="${escapeAttr(robots)}"/>`
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
  return applyHtmlFragment(cleanedHtml, '</head>', `${scriptTag}\n`, 'before');
}


/**
 * Разрешить content-hashed путь к первому слайду hero главной страницы.
 *
 * `BOOK_IMAGES[0]` (`assets/images/cover_sorapiso.jpg`) — детерминированный
 * первый кадр: его же берёт `HomePageSkeleton`. Metro переименовывает файл в
 * `cover_sorapiso.<hash>.jpg`, поэтому имя резолвится по dist, а не хардкодится.
 * Возвращает null, если файла нет — вызывающий код тогда просто не ставит
 * preload (fail-open, деплой не ломается).
 */
function resolveHomeHeroAssetHref(distDir) {
  const pattern = /^cover_sorapiso\.[a-f0-9]+\.(jpe?g|png|webp)$/i;
  const imagesDir = path.join(distDir, 'assets', 'assets', 'images');
  try {
    const match = fs.readdirSync(imagesDir).find((name) => pattern.test(name));
    if (match) return `/assets/assets/images/${match}`;
  } catch {
    // Каталога нет — падаем в fail-open ниже.
  }
  return null;
}

/**
 * Шрифт иконок Feather здесь НЕ греется (#2170). Этот генератор раньше вставлял
 * в `<head>` preload-ссылку на шрифт (#1409); после перехода выката на изолированный
 * worktree путь ассета сменился, и вставка молча перестала срабатывать. Возвращать
 * её нельзя: ранний запрос шрифта браузер ставит выше LCP-картинки (A/B на проде
 * 04.10.2026: +190 мс LCP главной и статьи). Шрифт подключает оболочка документа —
 * `utils/iconFontShell.ts`, после LCP-картинки первого экрана.
 */

/**
 * Preload hero-картинки главной.
 *
 * Без него URL картинки известен только из JS-бандла, поэтому запрос стартует
 * после гидрации. Замер прода 2026-08-02, 412×823, slow-4G + CPU 4×: LCP-кадр
 * `cover_sorapiso` начинался на 9 292 мс. Preload переносит загрузку в самое
 * начало документа, параллельно бандлу.
 */
function injectHomeHeroPreload(baseHtml, href) {
  if (!href) return baseHtml;
  const tag = `<link data-home-hero-preload="true" rel="preload" as="image" href="${escapeAttr(href)}" fetchpriority="high"/>`;
  return replaceOrInsert(baseHtml, /<link[^>]*data-home-hero-preload="true"[^>]*\/?>/i, tag);
}

function injectHiddenH1(baseHtml, headingText) {
  const text = String(headingText || '').trim();
  if (!text) return baseHtml;

  // SSR H1 stays in raw HTML for crawlers and no-JS consumers, but it must not
  // participate in React hydration inside #root. Keep it out of flow and insert
  // it as a root sibling; placing it inside #root creates a hydration mismatch.
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
    return applyHtmlFragment(
      baseHtml,
      /<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i,
      ssgHeading
    );
  }

  if (/<div\s+id="root"[^>]*>/i.test(baseHtml)) {
    return applyHtmlFragment(baseHtml, /<div\s+id="root"[^>]*>/i, ssgHeading, 'before');
  }

  return applyHtmlFragment(baseHtml, /<body[^>]*>/i, ssgHeading, 'after');
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/** Write file, creating directories as needed. */
function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Replace both served addresses without ever overwriting a linked inode.
 * Link before publishing either name: unsupported hardlinks fail the build,
 * rather than silently restoring the duplicated allocation.
 */
function writePairedPage(flatPath, indexPath, content) {
  fs.mkdirSync(path.dirname(flatPath), { recursive: true });
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const nonce = require('crypto').randomUUID();
  const flatTemp = `${flatPath}.${nonce}.tmp`;
  const indexTemp = `${indexPath}.${nonce}.tmp`;
  let cleanupFailure;
  try {
    fs.writeFileSync(flatTemp, content, { encoding: 'utf8', flag: 'wx' });
    fs.linkSync(flatTemp, indexTemp);
    fs.renameSync(flatTemp, flatPath);
    fs.renameSync(indexTemp, indexPath);
  } finally {
    for (const temporary of [flatTemp, indexTemp]) {
      try { fs.unlinkSync(temporary); } catch (error) {
        if (error.code !== 'ENOENT' && !cleanupFailure) cleanupFailure = error;
      }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
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
// Static pages definitions
// ---------------------------------------------------------------------------
// #2740: таблица статических маршрутов живёт в utils/seoRoutes/staticRoutes.js —
// тот же источник читают файлы маршрутов через generateMetadata (Expo SDK 58),
// поэтому head экспорта и head SSG совпадают по построению. Здесь остаются только
// SSG-экстры поверх него: skeleton shell, hero preload, скрытый H1, breadcrumb.
const STATIC_PAGES = listStaticRouteSeo(readRequiredRuTranslation).map((page) => ({
  route: page.route,
  canonicalRoute: page.canonicalRoute,
  title: page.title,
  description: page.description,
  robots: page.robots,
  image: `${SITE_URL}${page.imagePath}`,
  breadcrumb: page.breadcrumb,
  h1: page.h1,
}));


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
// The network producer has no dist dependency. One request pacer covers every
// endpoint/fallback; no other API producer runs alongside this process.
// One request pacer covers every endpoint candidate and retry.
async function collectArticleMetadata({ read, apiBase }) {
  console.log('\n📰 Fetching articles from API...');
  let articles = [];
  const articleErrors = [];
  const articleParams = new URLSearchParams({
    page: '1',
    perPage: '500',
    where: JSON.stringify({ publish: 1, moderation: 1 }),
  });
  const articleCandidates = await resolveArticleEndpointCandidates({ fetchJson: read, apiBase });

  for (const endpoint of articleCandidates) {
    const url = `${endpoint}/?${articleParams}`;
    try {
      const result = await read(url);
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

  return articles;
}

async function fetchArticleMetadata({ apiBase = API_BASE, fetchJson: fetchInput,
  pace = createRequestPacer(BUILD_FETCH_MIN_INTERVAL_MS) } = {}) {
  const request = async (url) => {
    if (new URL(url).origin !== new URL(apiBase).origin) throw new Error('Article metadata endpoint changed API origin');
    await pace();
    return (fetchInput || fetchJsonOnce)(url);
  };
  // Include retries and endpoint fallbacks in the same request budget.
  const read = (url) => fetchInput ? request(url) : withRetries(() => request(url), {
    onRetry: ({ error, attempt, attempts, delayMs }) =>
      console.warn(`  ⚠️  ${error.message} — retry ${attempt}/${attempts - 1} in ${delayMs}ms`),
  });
  return collectArticleMetadata({ read, apiBase });
}

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
  prepareNotFoundDocumentBoot(DIST_DIR);

  // Route-specific templates contain the correct JS chunk for each route.
  // Falling back to index.html would embed the home-page chunk instead of the
  // route chunk, causing the page to stall on the skeleton.
  const articleTemplatePath = path.join(DIST_DIR, 'article', '[id].html');
  const articleBaseHtml = fs.existsSync(articleTemplatePath)
    ? fs.readFileSync(articleTemplatePath, 'utf8')
    : baseHtml;

  let totalPages = 0;

  const homeHeroHref = resolveHomeHeroAssetHref(DIST_DIR);
  if (!homeHeroHref) {
    console.warn('  ⚠️  home hero asset (cover_sorapiso.*) not found in dist — LCP preload skipped');
  }

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
      image: page.image,
      robots: page.robots,
    });

    // P3.5: Inject SSG skeleton shell for key pages (improves FCP/LCP)
    // #1281: главной шелл отдаёт тот же href, что уходит в rel=preload, — иначе
    // картинка скачана, но нарисовать её до гидрации некому и LCP уезжает.
    html = injectSkeletonShell(
      html,
      page.route,
      page.route === '/' ? { heroHref: homeHeroHref } : undefined
    );

    if (page.route === '/') {
      html = injectHomeHeroPreload(html, homeHeroHref);
    }

    // Out-of-flow semantic H1 for routes whose static HTML has none (`/`, `/map`).
    // Sibling before #root, so hydration is not disturbed and the raw HTML
    // keeps exactly one H1.
    if (page.h1) {
      html = injectHiddenH1(html, page.h1);
    }

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
      writePairedPage(path.join(DIST_DIR, `${routePath}.html`), path.join(DIST_DIR, routePath, 'index.html'), html);
    }
    totalPages++;
    console.log(`  ✅ ${page.route}${(page.route === '/' || page.route === '/search') ? ' (with SSG skeleton)' : ''}`);
  }

  // --- 2. Article pages ---
  const articles = await fetchArticleMetadata();

  if (articles.length > 0) {
    console.log(`📝 Generating ${articles.length} article pages...`);
    let generated = 0;

    for (const article of articles) {
      const id = article.id;
      if (!id) continue;

      const name = article.name || '';
      const title = buildSeoTitle(name || 'Статья о путешествии');
      const rawDesc = article.description || '';
      const description = clampDescriptionForAttr(stripHtmlToSnippet(rawDesc, 160), 160) || FALLBACK_DESC;
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
      writePairedPage(path.join(DIST_DIR, 'article', `${idStr}.html`), path.join(DIST_DIR, 'article', idStr, 'index.html'), html);
      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated} article pages`);
  }

  // --- 3. Patch [param].html / [id].html fallback templates ---
  // These shells answer when neither the SSR renderer nor a generated
  // per-id page resolves the route. They must not be indexable generic shells.
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
    {
      file: path.join(DIST_DIR, 'quests', 'country', '[country].html'),
      title: 'Страна с квестами не найдена | Metravel',
      description: 'Для этой страны нет опубликованной подборки квестов.',
    },
    // #2740: the city shell shipped an empty <title> and sat open to indexing.
    {
      file: path.join(DIST_DIR, 'quests', '[city].html'),
      title: 'Город с квестами не найден | Metravel',
      description: 'Для этого города нет опубликованной подборки квестов.',
    },
    // #2740: Expo renders the export-level 404 outside the [...missing] route's
    // generateMetadata; give it the same head the 404 screen declares.
    {
      file: path.join(DIST_DIR, '+not-found.html'),
      title: readRequiredRuTranslation('shared:app.missing.stranitsa_ne_naydena_metravel_a9673114'),
      description: readRequiredRuTranslation('shared:app.missing.stranitsa_ne_naydena_pereydite_na_glavnuyu_i_0cfdec3b'),
      robots: 'noindex, nofollow',
    },
    // #2740: expo-router's internal route list; never linked, never indexable.
    {
      file: path.join(DIST_DIR, '_sitemap.html'),
      title: 'Metravel',
      description: readRequiredRuTranslation('seoStatic:root.default.description'),
      robots: 'noindex, nofollow',
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

  // Cover the final recursive output, fallback templates included, and reject
  // altered guards.
  const chunkGuardCoverage = ensureHtmlChunkReloadGuards(DIST_DIR);
  console.log(`\n✅ Chunk reload guard: ${chunkGuardCoverage.checked} HTML files checked (${chunkGuardCoverage.injected} injected)`);

  console.log(`\n🎉 Done! Generated ${totalPages} SEO pages in ${DIST_DIR}`);
}

// ---------------------------------------------------------------------------
// Exports for testing (when required as a module, main() is NOT executed)
// ---------------------------------------------------------------------------
module.exports = {
  SOCIAL_PREVIEW_WIDTH_BY_ROUTE,
  STATIC_PAGES,
  applyHtmlFragment,
  replaceOrInsert,
  injectMeta,
  buildSeoTitle,
  escapeAttr,
  stripHtml,
  clampDescriptionForAttr,
  toSocialPreviewUrl,
  injectHomeHeroPreload,
  resolveHomeHeroAssetHref,
  injectHiddenH1,
  injectBreadcrumbJsonLd,
  patchNoindexFallbackTemplate,
  writePairedPage,
  fetchArticleMetadata,
  main,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
