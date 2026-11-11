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
