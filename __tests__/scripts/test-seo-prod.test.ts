import fs from 'fs';
import path from 'path';

const { isBlockedFromIndexing, checkSeoTitleContract } = require('../../scripts/test-seo-prod');
const { buildSeoTitle } = require('../../utils/seoText');

const ROOT = path.resolve(__dirname, '../..');

// Regression guard for #1107: the production gate must fire on a real
// deindexing risk (#1090 served every article as a noindex shell for a day)
// and stay quiet on directives that do not block indexing — otherwise it is
// permanently red and nobody reacts to it.
describe('production SEO gate: indexability check (#1107)', () => {
  it('treats a page without robots meta as indexable', () => {
    expect(isBlockedFromIndexing('')).toBe(false);
    expect(isBlockedFromIndexing(undefined)).toBe(false);
  });

  it('accepts preview directives that do not block indexing', () => {
    expect(isBlockedFromIndexing('max-image-preview:large')).toBe(false);
    expect(isBlockedFromIndexing('max-snippet:-1, max-image-preview:large')).toBe(false);
    expect(isBlockedFromIndexing('index, follow')).toBe(false);
  });

  it('fires on the directives that actually remove a page from the index', () => {
    expect(isBlockedFromIndexing('noindex')).toBe(true);
    expect(isBlockedFromIndexing('noindex, follow')).toBe(true);
    expect(isBlockedFromIndexing('NOINDEX, NOFOLLOW')).toBe(true);
    expect(isBlockedFromIndexing('none')).toBe(true);
    expect(isBlockedFromIndexing('max-image-preview:large, noindex')).toBe(true);
  });

  it('does not confuse nofollow with a blocked page', () => {
    // nofollow affects link equity, not whether the page is indexed.
    expect(isBlockedFromIndexing('nofollow')).toBe(false);
  });

  it('accepts every title shape buildSeoTitle can produce', () => {
    // Три формы контракта: с брендом, без бренда (не влез) и срезанная.
    const bases = [
      'Веницейские окна',
      'Брест: путеводитель по крепости, фонарщику и старому городу',
      'Албания. Достопримечательности Влёра: замок Канина, мечеть Мурадие и бункеры Ходжи',
    ];
    for (const base of bases) {
      const failed = checkSeoTitleContract(buildSeoTitle(base)).filter((c: any) => !c.ok);
      expect({ base, failed }).toEqual({ base, failed: [] });
    }
  });

  it('fires when the brand suffix is dropped although it still fits the budget', () => {
    const failed = checkSeoTitleContract('Брест за один день').filter((c: any) => !c.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0].label).toMatch(/brand suffix/);
  });

  it('fires when a title overflows the SERP budget', () => {
    // Бренд у такого заголовка отсутствует законно — он не влезал; красным
    // должен гореть только выход за бюджет, иначе в отчёте два дубля на одну причину.
    const failed = checkSeoTitleContract('А'.repeat(61)).filter((c: any) => !c.ok);
    expect(failed.map((c: any) => c.label)).toEqual([expect.stringMatching(/fits SERP budget/)]);
  });

  it('wires the gate into the daily SEO routine as a blocking first step', () => {
    const agent = fs.readFileSync(path.join(ROOT, '.claude/agents/seo-daily.md'), 'utf8');
    expect(agent).toMatch(/npm run test:seo:prod/);
    expect(agent).toMatch(/Шаг 0/);
    // The routine must not submit URLs for indexing while output is broken.
    expect(agent).toMatch(/останавливается/);
  });
});

// #3218: хаб без ссылок на контент в сыром HTML — красный гейт. До правки главная
// отдавала карточки «Популярных маршрутов» как `<div role="link">`, а `/quests` —
// только навигацию.
describe('production SEO gate: hub content links (#3218)', () => {
  const { HUB_CONTENT_LINKS, collectAnchorPaths, countContentLinks } = require('../../scripts/test-seo-prod');
  const group = (hubPath: string, label: string) => HUB_CONTENT_LINKS
    .find((hub: { path: string }) => hub.path === hubPath)
    .groups.find((item: { label: string }) => item.label === label);

  it('reads only real anchors of the own site and normalises them to paths', () => {
    const html = [
      '<a href="/travels/minsk-za-vykhodnye">Минск</a>',
      '<a class="x" href="https://metravel.by/travels/grodno?returnTo=%2Fsearch#top">Гродно</a>',
      '<a href="/travels/minsk-za-vykhodnye/">дубль со слэшем</a>',
      '<div role="link" data-home-popular-card="true">карточка без адреса</div>',
      '<a href="https://example.com/travels/foreign">чужой сайт</a>',
      '<a href="//evil.example/travels/x">protocol-relative</a>',
    ].join('');

    expect(collectAnchorPaths(html).sort()).toEqual(['/travels/grodno', '/travels/minsk-za-vykhodnye']);
  });

  it('counts a card that is not an anchor as no link at all', () => {
    const before = '<div role="link" data-home-popular-card="true">Озеро Сорапис</div><a href="/search">Все</a>';
    expect(countContentLinks(before, group('/', 'article links').pattern)).toBe(0);
  });

  it('tells quests, cities and countries apart from catalogue navigation', () => {
    const html = [
      '<a href="/quests">Квесты</a><a href="/quests/scenario">Сценарий</a><a href="/quests/map">Карта</a>',
      '<a href="/quests/country/by">Беларусь</a><a href="/quests/country/pl">Польша</a>',
      '<a href="/quests/minsk">Минск</a><a href="/quests/12">Брест</a>',
      '<a href="/quests/minsk/minsk-cmok">Цмок</a><a href="/quests/12/brest-fortress">Крепость</a>',
    ].join('');

    expect(countContentLinks(html, group('/quests', 'quest country links').pattern)).toBe(2);
    expect(countContentLinks(html, group('/quests', 'quest city links').pattern)).toBe(2);
    expect(countContentLinks(html, group('/quests', 'quest links').pattern)).toBe(2);
  });

  it('covers the home page, the quest catalogue and the Belarus hub', () => {
    expect(HUB_CONTENT_LINKS.map((hub: { path: string }) => hub.path)).toEqual(['/', '/quests', '/travelsby']);
    for (const hub of HUB_CONTENT_LINKS) {
      for (const item of hub.groups) expect(item.min).toBeGreaterThan(0);
    }
  });
});

// #3323: постраничный каталог /search?page=N. До переключения HTML /search на
// SSR (#3279) блока нет — проба об этом сообщает и не краснеет.
describe('production SEO gate: article catalogue pages (#3323)', () => {
  const { SEARCH_CATALOG_PAGES, evaluateSearchCatalogPages } = require('../../scripts/test-seo-prod');
  const site = 'https://metravel.by';
  const page = (number: number, slugs: string[], canonical = number > 1 ? `/search?page=${number}` : '/search') => [
    `<link rel="canonical" href="${site}${canonical}"/>`,
    '<a href="/travels/footer-link">в подвале</a>',
    `<nav aria-label="Статьи" data-search-catalog-links="${number}"><style>[data-search-catalog-links] a{color:red}</style><ul>`,
    ...slugs.map((slug) => `<li><a href="/travels/${slug}">${slug}</a></li>`),
    '</ul><a href="/search" rel="prev">Назад</a></nav>',
  ].join('');
  const staticShell = `<link rel="canonical" href="${site}/search"/><div id="root"></div>`;

  it('probes the bare catalogue and its second page', () => {
    expect(SEARCH_CATALOG_PAGES).toEqual({ first: '/search', second: '/search?page=2' });
  });

  it('reports a static /search without failing while the HTML is not SSR yet', () => {
    expect(evaluateSearchCatalogPages({ first: staticShell, second: staticShell, site })).toEqual({ state: 'static', failures: [] });
  });

  it('accepts two pages that link different articles, page 2 being its own canonical', () => {
    const verdict = evaluateSearchCatalogPages({ first: page(1, ['a', 'b']), second: page(2, ['c', 'd']), site });
    expect(verdict).toMatchObject({ state: 'ok', failures: [], counts: [2, 2] });
  });

  it('fails a page 2 that repeats page 1, has no articles, or points canonical to /search', () => {
    expect(evaluateSearchCatalogPages({ first: page(1, ['a', 'b']), second: page(2, ['b', 'a']), site }).failures)
      .toEqual(['/search and /search?page=2 list the same articles']);
    expect(evaluateSearchCatalogPages({ first: page(1, ['a']), second: page(2, []), site }).failures)
      .toEqual(['/search?page=2 block has no /travels/ links']);
    expect(evaluateSearchCatalogPages({ first: page(1, ['a']), second: page(2, ['c'], '/search'), site }).failures)
      .toEqual(['/search?page=2 canonical is "https://metravel.by/search"']);
  });

  it('fails once only one of the two pages carries the block', () => {
    const verdict = evaluateSearchCatalogPages({ first: page(1, ['a']), second: staticShell, site });
    expect(verdict.state).toBe('fail');
    expect(verdict.failures).toContain('/search?page=2 has no page-2 catalogue block');
  });
});

// #3235: sitemap и редирект числового id города — постоянный контроль на проде.
// Разбор и оценка проверяются на фикстурах, без сети.
describe('production SEO gate: sitemap and city alias redirect (#3235)', () => {
  const {
    SITEMAP_EXPECTATIONS, NUMERIC_QUEST_CITY_PATH, parseSitemap, evaluateSitemap, evaluateQuestCityAliasRedirect,
  } = require('../../scripts/test-seo-prod');
  const SITE = 'https://metravel.by';
  const alt = (lang: string, href: string) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`;
  const url = (loc: string, extra = '<lastmod>2026-11-04</lastmod>') => `<url><loc>${loc}</loc>${extra}</url>`;
  const sitemap = (...urls: string[]) => [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
  ].join('\n');
  const questAlternates = [
    alt('ru', `${SITE}/quests/1/krakow-dragon`),
    alt('pl', `${SITE}/pl/quests/1/krakow-dragon`),
    alt('x-default', `${SITE}/quests/1/krakow-dragon`),
  ].join('');
  const healthy = sitemap(
    url(`${SITE}/`, '<changefreq>weekly</changefreq>'),
    url(`${SITE}/travels/minsk-za-vykhodnye`),
    url(`${SITE}/quests/1/krakow-dragon`, `<lastmod>2026-11-04</lastmod>${questAlternates}`),
    url(`${SITE}/pl/quests/1/krakow-dragon`, `<lastmod>2026-11-04</lastmod>${questAlternates}`),
  );

  it('reads loc, lastmod and alternates of every url', () => {
    expect(parseSitemap(healthy)).toEqual([
      { loc: `${SITE}/`, hasLastmod: false, alternates: [] },
      { loc: `${SITE}/travels/minsk-za-vykhodnye`, hasLastmod: true, alternates: [] },
      expect.objectContaining({ loc: `${SITE}/quests/1/krakow-dragon`, hasLastmod: true, alternates: expect.arrayContaining([`${SITE}/pl/quests/1/krakow-dragon`]) }),
      expect.objectContaining({ loc: `${SITE}/pl/quests/1/krakow-dragon` }),
    ]);
  });

  it('accepts a healthy sitemap: home page listed, alternates closed over the sitemap itself', () => {
    expect(evaluateSitemap(healthy, { site: SITE })).toEqual({
      parsed: true,
      urlCount: 4,
      hasRoot: true,
      withoutLastmod: [`${SITE}/`],
      articleCount: 1,
      articlesWithoutLastmod: [],
      alternateUrlCount: 2,
      missingAlternates: [],
    });
  });

  it('refuses what is not a sitemap: an HTML shell, an index, a truncated or empty document', () => {
    expect(evaluateSitemap('<!DOCTYPE html><html><body>MeTravel</body></html>', { site: SITE })).toEqual({ parsed: false });
    expect(evaluateSitemap('<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>', { site: SITE })).toEqual({ parsed: false });
    expect(evaluateSitemap(healthy.replace('</urlset>', ''), { site: SITE })).toEqual({ parsed: false });
    expect(evaluateSitemap(sitemap(), { site: SITE })).toEqual({ parsed: false });
    expect(evaluateSitemap(sitemap('<url><lastmod>2026-11-04</lastmod></url>'), { site: SITE })).toEqual({ parsed: false });
  });

  it('notices a sitemap without the home page', () => {
    const facts = evaluateSitemap(sitemap(url(`${SITE}/travelsby`), url(`${SITE}/map`)), { site: SITE });
    expect(facts).toMatchObject({ parsed: true, hasRoot: false, alternateUrlCount: 0 });
  });

  it('names every url that lost its lastmod, an empty tag included', () => {
    const facts = evaluateSitemap(sitemap(
      url(`${SITE}/`),
      url(`${SITE}/travels/a`, ''),
      url(`${SITE}/travels/b`, '<lastmod> </lastmod>'),
    ), { site: SITE });
    expect(facts.withoutLastmod).toEqual([`${SITE}/travels/a`, `${SITE}/travels/b`]);
  });

  // #3344: общий порог терпит статические страницы; у статьи дата своя.
  it('counts articles without lastmod apart from static pages', () => {
    const facts = evaluateSitemap(sitemap(
      url(`${SITE}/`, ''),
      url(`${SITE}/travelsby`, ''),
      url(`${SITE}/travels/a`, ''),
      url(`${SITE}/travels/b`),
      url(`${SITE}/quests/1/krakow-dragon`, ''),
    ), { site: SITE });
    expect(facts).toMatchObject({ articleCount: 2, articlesWithoutLastmod: [`${SITE}/travels/a`] });
    expect(facts.withoutLastmod).toHaveLength(4);
  });

  it('reports an alternate that the sitemap itself does not list, once', () => {
    const orphan = `${SITE}/en/quests/1/krakow-dragon`;
    const facts = evaluateSitemap(sitemap(
      url(`${SITE}/`),
      url(`${SITE}/quests/1/krakow-dragon`, `<lastmod>2026-11-04</lastmod>${questAlternates}${alt('en', orphan)}`),
      url(`${SITE}/pl/quests/1/krakow-dragon`, `<lastmod>2026-11-04</lastmod>${questAlternates}${alt('en', orphan)}`),
    ), { site: SITE });
    expect(facts.missingAlternates).toEqual([orphan]);
  });

  it('compares addresses after XML entity decoding', () => {
    const facts = evaluateSitemap(sitemap(
      url(`${SITE}/`),
      url(`${SITE}/search?a=1&amp;b=2`, `<lastmod>2026-11-04</lastmod>${alt('ru', `${SITE}/search?a=1&amp;b=2`)}`),
    ), { site: SITE });
    expect(facts.missingAlternates).toEqual([]);
  });

  it('keeps the lastmod threshold a small absolute number', () => {
    expect(SITEMAP_EXPECTATIONS).toMatchObject({ path: '/sitemap.xml', rootPath: '/' });
    expect(SITEMAP_EXPECTATIONS.maxWithoutLastmod).toBeGreaterThanOrEqual(7);
    expect(SITEMAP_EXPECTATIONS.maxWithoutLastmod).toBeLessThanOrEqual(20);
  });

  it('accepts only a permanent redirect of a numeric city id to an alias', () => {
    expect(NUMERIC_QUEST_CITY_PATH).toMatch(/^\/quests\/\d+$/);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: '/quests/spb' }).ok).toBe(true);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: 'https://metravel.by/quests/sankt-peterburg' }).ok).toBe(true);
    // Не тот статус, не тот адрес, снова числовой id, квест вместо города, нет location.
    expect(evaluateQuestCityAliasRedirect({ status: 302, location: '/quests/spb' }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 200, location: undefined }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: '/quests/58' }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: '/quests' }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: '/quests/58/spb-walk' }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 301, location: '/' }).ok).toBe(false);
    expect(evaluateQuestCityAliasRedirect({ status: 301 }).ok).toBe(false);
  });
});

// #3329: контракты бэк-поезда спринта 35 (#3233, #3282, #3240) и сверка
// `trip_facts` (#3356, пункт «а»). Оценки — чистые функции, сеть не нужна.
describe('production SEO gate: backend train of sprint 35 (#3329)', () => {
  const {
    MISSING_PROFILE_PATH, NUMERIC_QUEST_CITY_SLASH_PATH, evaluateConditionalGet, evaluateNumericTravelRedirect,
    evaluateMissingProfile, readHreflangLinks, evaluateHreflang, pickQuestSample, parseSitemap,
  } = require('../../scripts/test-seo-prod');
  const SITE = 'https://metravel.by';
  const etag = 'W/"/__internal/travel-ssr/minsk?v=1&b=abc"';

  it('accepts a validator that the server honours with an empty 304', () => {
    const first = { status: 200, headers: { etag }, html: '<html></html>' };
    expect(evaluateConditionalGet({ first, second: { status: 304, headers: {}, html: '' } })).toEqual({ ok: true, etag, failures: [] });
  });

  it('fails a page that lost its ETag, ignores If-None-Match or sends a body with the 304', () => {
    const first = { status: 200, headers: { etag }, html: '<html></html>' };
    expect(evaluateConditionalGet({ first: { status: 200, headers: {}, html: 'x' }, second: null }).failures).toEqual(['no ETag header']);
    expect(evaluateConditionalGet({ first, second: { status: 200, headers: { etag }, html: '<html></html>' } }).failures)
      .toEqual(['If-None-Match answered HTTP 200, expected 304']);
    expect(evaluateConditionalGet({ first, second: { status: 304, headers: {}, html: '<html></html>' } }).failures)
      .toEqual(['the 304 answer carries a body']);
    expect(evaluateConditionalGet({ first: { status: 500, headers: {}, html: '' }, second: null }).failures)
      .toEqual(['first answer is HTTP 500', 'no ETag header']);
  });

  it('accepts only a permanent redirect of an article id to that article slug', () => {
    expect(evaluateNumericTravelRedirect({ status: 301, location: '/travels/minsk-za-vykhodnye' }, 'minsk-za-vykhodnye').ok).toBe(true);
    expect(evaluateNumericTravelRedirect({ status: 301, location: `${SITE}/travels/minsk-za-vykhodnye?utm=1` }, 'minsk-za-vykhodnye').ok).toBe(true);
    // slug неизвестен (API лежал): достаточно, что это адрес статьи, а не число
    expect(evaluateNumericTravelRedirect({ status: 301, location: '/travels/minsk-za-vykhodnye' }).ok).toBe(true);
    // вернулся 404, временный редирект, чужая статья, id на id, хаб
    expect(evaluateNumericTravelRedirect({ status: 404 }, 'minsk-za-vykhodnye').ok).toBe(false);
    expect(evaluateNumericTravelRedirect({ status: 302, location: '/travels/minsk-za-vykhodnye' }, 'minsk-za-vykhodnye').ok).toBe(false);
    expect(evaluateNumericTravelRedirect({ status: 301, location: '/travels/grodno' }, 'minsk-za-vykhodnye').ok).toBe(false);
    expect(evaluateNumericTravelRedirect({ status: 301, location: '/travels/940' }).ok).toBe(false);
    expect(evaluateNumericTravelRedirect({ status: 301, location: `${SITE}/travelsby` }).ok).toBe(false);
  });

  it('wants a missing profile to be a 404 that a header keeps out of the index', () => {
    expect(MISSING_PROFILE_PATH).toMatch(/^\/user\/\d+$/);
    expect(evaluateMissingProfile({ status: 404, headers: { 'x-robots-tag': 'noindex, follow' } }).ok).toBe(true);
    expect(evaluateMissingProfile({ status: 404, headers: {} }).ok).toBe(false);
    expect(evaluateMissingProfile({ status: 200, headers: { 'x-robots-tag': 'noindex' } }).ok).toBe(false);
    expect(evaluateMissingProfile({ status: 404, headers: { 'x-robots-tag': 'max-image-preview:large' } }).ok).toBe(false);
  });

  it('probes the numeric city address with a trailing slash too', () => {
    expect(NUMERIC_QUEST_CITY_SLASH_PATH).toMatch(/^\/quests\/\d+\/$/);
  });

  describe('hreflang of a quest page', () => {
    const ru = `${SITE}/quests/1/krakow-dragon`;
    const pl = `${SITE}/pl/quests/1/krakow-dragon`;
    const en = `${SITE}/en/quests/1/krakow-dragon`;
    const link = (lang: string, href: string) => `<link rel="alternate" href="${href}" hreflang="${lang}"/>`;
    const html = [link('ru', ru), link('pl', pl), link('x-default', ru), '<link rel="canonical" href="x"/>'].join('');
    const live = { [ru]: 200, [pl]: 200 };

    it('reads alternates whatever the attribute order and skips other links', () => {
      expect(readHreflangLinks(`<link hreflang="pl" rel="alternate" href="${pl}?a=1&amp;b=2">${html}`)).toEqual([
        { hreflang: 'pl', href: `${pl}?a=1&b=2` },
        { hreflang: 'ru', href: ru },
        { hreflang: 'pl', href: pl },
        { hreflang: 'x-default', href: ru },
      ]);
    });

    it('accepts the set the sitemap lists when every address is alive', () => {
      expect(evaluateHreflang({ html, sitemapAlternates: [ru, pl, ru], statuses: live }))
        .toEqual({ ok: true, hrefs: [ru, pl], failures: [] });
    });

    it('fails a withdrawn locale left in the HTML, a locale missing from it, a dead or repeated one', () => {
      const withEn = html + link('en', en);
      expect(evaluateHreflang({ html: withEn, sitemapAlternates: [ru, pl], statuses: { ...live, [en]: 404 } }).failures).toEqual([
        `in HTML but not in sitemap: ${en}`,
        `not answering 200: ${en} (404)`,
      ]);
      expect(evaluateHreflang({ html, sitemapAlternates: [ru, pl, en], statuses: live }).failures)
        .toEqual([`in sitemap but not in HTML: ${en}`]);
      expect(evaluateHreflang({ html, sitemapAlternates: [ru, pl], statuses: { [ru]: 200, [pl]: 301 } }).failures)
        .toEqual([`not answering 200: ${pl} (301)`]);
      expect(evaluateHreflang({ html: html + link('pl', pl), sitemapAlternates: [ru, pl], statuses: live }).failures)
        .toEqual(['hreflang repeated: pl']);
      expect(evaluateHreflang({ html: '<head></head>', sitemapAlternates: [], statuses: {} }).failures)
        .toEqual(['no hreflang links in the raw HTML']);
    });

    it('picks the first Russian quest page that has alternates as the sample', () => {
      const alt = (lang: string, href: string) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`;
      const urls = parseSitemap([
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        `<url><loc>${SITE}/quests/krakow</loc></url>`,
        `<url><loc>${SITE}/quests/2/solo-quest</loc></url>`,
        `<url><loc>${pl}</loc>${alt('ru', ru)}${alt('pl', pl)}</url>`,
        `<url><loc>${ru}</loc>${alt('ru', ru)}${alt('pl', pl)}</url>`,
        '</urlset>',
      ].join(''));
      expect(pickQuestSample(urls, SITE)).toEqual({
        path: '/quests/1/krakow-dragon',
        apiPath: '/api/quests/web/detail/1/krakow-dragon/?lang=ru',
        alternates: [ru, pl],
      });
      expect(pickQuestSample(null, SITE)).toBeNull();
      expect(pickQuestSample(parseSitemap(`<urlset><url><loc>${SITE}/</loc></url></urlset>`), SITE)).toBeNull();
    });
  });
});

describe('production SEO gate: trip_facts against the TouristTrip node (#3356)', () => {
  const { readQuestTouristTrip, evaluateTripFacts } = require('../../scripts/test-seo-prod');
  const { buildQuestTouristTrip } = require('../../utils/questTouristTrip');
  const full = { duration_min: 120, distance_m: 1293, start: { lat: 53.678429, lng: 23.81863 }, is_free: true };
  const node = (tripFacts: unknown) => buildQuestTouristTrip({
    name: 'Квест', description: 'Описание', url: 'https://metravel.by/quests/11/grodno-royal', inLanguage: 'ru',
    image: null, cityName: 'Гродно', touristType: 'Городской квест, пеший маршрут', tripFacts,
  });
  const page = (entity: unknown) => [
    '<script type="application/ld+json" data-seo-jsonld="travel-article">{"@graph":[{"@type":"TouristTrip","timeRequired":"PT1M"}]}</script>',
    `<script id="quest-public-structured-data" data-seo-jsonld="quest-public" type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@graph': [{ '@type': 'BreadcrumbList' }, entity],
    })}</script>`,
  ].join('');

  // Проба повторяет соответствие «факт → свойство» из сборщика узла; этот тест
  // держит их вместе: что построил сборщик, то проба принимает.
  it.each([
    ['all facts known', full],
    ['paid quest without a start point', { ...full, start: null, is_free: false }],
    ['no facts at all', null],
  ])('accepts the node the page builder makes: %s', (_label, tripFacts) => {
    const entity = readQuestTouristTrip(page(node(tripFacts)));
    expect(entity).toMatchObject({ '@type': ['TouristTrip', 'CreativeWork'] });
    expect(evaluateTripFacts({ tripFacts, entity })).toEqual({ ok: true, failures: [] });
  });

  it('names every fact where the HTML and the API disagree', () => {
    const entity = node(full);
    expect(evaluateTripFacts({ tripFacts: { ...full, duration_min: 90, is_free: false }, entity }).failures).toEqual([
      'timeRequired: API says "PT90M", HTML has "PT120M"',
      'isAccessibleForFree: API says false, HTML has true',
    ]);
    expect(evaluateTripFacts({ tripFacts: { ...full, distance_m: 2000, start: { lat: 1, lng: 2 } }, entity }).failures).toEqual([
      'potentialAction.distance: API says "2000 m", HTML has "1293 m"',
      'tripOrigin.geo: API says "1,2", HTML has "53.678429,23.81863"',
    ]);
  });

  it('fails a node that keeps facts the API no longer has, and one that lost them', () => {
    expect(evaluateTripFacts({ tripFacts: null, entity: node(full) }).failures).toHaveLength(4);
    expect(evaluateTripFacts({ tripFacts: full, entity: node(null) }).failures).toHaveLength(4);
  });

  it('fails when the API has no trip_facts key or the page has no quest node', () => {
    expect(evaluateTripFacts({ tripFacts: undefined, entity: node(full) }).failures).toEqual(['API detail has no trip_facts key']);
    expect(evaluateTripFacts({ tripFacts: full, entity: readQuestTouristTrip('<html></html>') }).failures)
      .toEqual(['no TouristTrip node in the quest-public JSON-LD graph']);
    expect(readQuestTouristTrip('<script data-seo-jsonld="quest-public" type="application/ld+json">{broken</script>')).toBeNull();
  });
});
