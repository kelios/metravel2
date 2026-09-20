/**
 * Regression tests for scripts/verify-static-quest-seo.js
 *
 * The deploy gate that keeps a build from shipping without quest pages:
 * build-prod.sh only checked travel pages, so a skipped quest block passed
 * every guard and reached production.
 */

import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'

import { makeTempDir, removeDir, writeTextFile } from './cli-test-utils'

const {
  MIN_QUEST_PAGE_WORDS,
  THIN_CONTENT_EXEMPTIONS,
  TRAVEL_QUEST_PROMO_MARKER,
  collectQuestSsgPages,
  countTravelQuestPromoPages,
  countWords,
  extractQuestSsgSections,
  expectedAliasLandingQuests,
  expectedCityLandingFiles,
  expectedCountryLandingFiles,
  expectedQuestFiles,
  extractItems,
  fetchBackendSitemap,
  fetchQuestCatalog,
  hasQuestCityLandingSection,
  hasQuestCityStandaloneContent,
  hasQuestCountryLandingSection,
  hasQuestCountryStandaloneContent,
  listTravelPageFiles,
  missingLandingQuestLinks,
  questPageFromHtml,
  selectIndexableQuestPages,
  sitemapCountryAliases,
  sitemapHasUrl,
  templateSkeleton,
  verifyQuestCityHtml,
  verifyQuestCountryHtml,
  verifyQuestCountryMetadataUniqueness,
  verifyQuestCountrySitemap,
  verifyQuestHtml,
  verifyQuestPageContentDepth,
  warnQuestCountryNoindexInSitemap,
} = require('@/scripts/verify-static-quest-seo')

const { buildQuestCityAliasMap } = require('@/utils/questCityAlias')
const { buildQuestCountryLandingGroups } = require('@/utils/questCountryLanding')

const KRAKOW_QUEST = { quest_id: 'krakow-wawel-dragon', city_id: '12', title: 'Квест по Кракову' }
const KRAKOW_QUEST_2 = { quest_id: 'krakow-kazimierz', city_id: '12', title: 'Квест по Казимежу' }
const MINSK_QUEST = { quest_id: 'minsk-svisloch', city_id: '4', title: 'Квест по Минску' }

const CANONICAL = 'https://metravel.by/quests/12/krakow-wawel-dragon'

function buildQuestPageHtml(overrides: Partial<Record<string, string>> = {}): string {
  const parts = {
    title: '<title>Квест по Кракову: Вавельский дракон | Metravel</title>',
    description: '<meta name="description" content="Пеший квест по Кракову: 9 точек, 120 минут." />',
    ogTitle: '<meta property="og:title" content="Квест по Кракову: Вавельский дракон" />',
    ogImage: '<meta property="og:image" content="https://metravel.by/quest-cover.jpg" />',
    ogUrl: `<meta property="og:url" content="${CANONICAL}" />`,
    canonical: `<link rel="canonical" href="${CANONICAL}" />`,
    jsonLd:
      '<script type="application/ld+json" data-seo-jsonld="quest">{"@context":"https://schema.org","@type":"TouristTrip","name":"Квест по Кракову"}</script>',
    intro:
      '<section data-ssg-quest-intro="true" aria-label="Описание городского квеста"><h1>Квест по Кракову</h1><p>Маршрут по Старому городу.</p></section>',
    ...overrides,
  }

  return [
    '<!DOCTYPE html><html lang="ru"><head>',
    parts.title,
    parts.description,
    parts.ogTitle,
    parts.ogImage,
    parts.ogUrl,
    parts.canonical,
    parts.jsonLd,
    '</head><body>',
    parts.intro,
    '</body></html>',
  ].join('\n')
}

describe('expectedQuestFiles', () => {
  it('covers the numeric route and the city-alias route in both file shapes', () => {
    const aliasMap = buildQuestCityAliasMap([KRAKOW_QUEST, KRAKOW_QUEST_2])

    expect(expectedQuestFiles(KRAKOW_QUEST, aliasMap).sort()).toEqual(
      [
        'quests/12/krakow-wawel-dragon.html',
        'quests/12/krakow-wawel-dragon/index.html',
        'quests/krakow/krakow-wawel-dragon.html',
        'quests/krakow/krakow-wawel-dragon/index.html',
      ].sort(),
    )
  })

  it('returns nothing for a quest without a resolvable route', () => {
    expect(expectedQuestFiles({ title: 'Без города' }, new Map())).toEqual([])
  })
})

describe('expectedCityLandingFiles', () => {
  it('lists one landing per city id and per alias, deduplicated across quests', () => {
    const quests = [KRAKOW_QUEST, KRAKOW_QUEST_2, MINSK_QUEST]
    const aliasMap = buildQuestCityAliasMap(quests)

    expect(expectedCityLandingFiles(quests, aliasMap).sort()).toEqual(
      [
        'quests/12/index.html',
        'quests/4/index.html',
        'quests/krakow/index.html',
        'quests/minsk/index.html',
      ].sort(),
    )
  })

  // #1931: the short alias a two-word city used to publish is already indexed,
  // so the build still has to produce a page for it, not a 404.
  it('keeps the landing a two-word city published under its old short alias', () => {
    const quests = [{ quest_id: 'kutna-hora-silver', city_id: '140', city_name: 'Кутна-Гора' }]

    expect(expectedCityLandingFiles(quests, buildQuestCityAliasMap(quests)).sort()).toEqual(
      ['quests/140/index.html', 'quests/kutna-hora/index.html', 'quests/kutna/index.html'].sort(),
    )
  })
})

describe('verifyQuestHtml', () => {
  it('accepts a fully generated quest page', () => {
    expect(verifyQuestHtml(buildQuestPageHtml(), CANONICAL)).toEqual([])
  })

  /**
   * #1930: тонкая детальная уходит под noindex вторым проходом генератора.
   * Тег обязан быть build-owned — с меткой Helmet его снимет гидрация (#1929).
   */
  it('accepts a build-owned noindex on a quest page and rejects a Helmet-owned one', () => {
    const buildOwned = buildQuestPageHtml().replace(
      '</head>',
      '<meta name="robots" content="noindex, follow"/></head>',
    )
    expect(verifyQuestHtml(buildOwned, CANONICAL)).toEqual([])

    const helmetOwned = buildQuestPageHtml().replace(
      '</head>',
      '<meta data-rh="true" name="robots" content="noindex, follow"/></head>',
    )
    expect(verifyQuestHtml(helmetOwned, CANONICAL)).toEqual(
      expect.arrayContaining(['quest page noindex is Helmet-owned (data-rh) and is dropped on hydration']),
    )
  })

  it('rejects the bare SPA shell that a skipped quest block leaves behind', () => {
    const shell = '<!DOCTYPE html><html><head><title>Metravel</title></head><body></body></html>'
    const issues = verifyQuestHtml(shell, CANONICAL)

    expect(issues).toEqual(
      expect.arrayContaining([
        'generic-or-missing <title>',
        'missing description',
        'missing og:title',
        'missing og:image',
        'missing crawlable quest intro section',
        'missing TouristTrip JSON-LD',
      ]),
    )
  })

  it('reports a canonical that points at another route', () => {
    const html = buildQuestPageHtml({
      canonical: '<link rel="canonical" href="https://metravel.by/quests/krakow/krakow-wawel-dragon" />',
    })

    expect(verifyQuestHtml(html, CANONICAL)).toEqual([
      'bad canonical: https://metravel.by/quests/krakow/krakow-wawel-dragon',
    ])
  })

  it('reports a page that lost its crawlable body', () => {
    expect(verifyQuestHtml(buildQuestPageHtml({ intro: '' }), CANONICAL)).toEqual([
      'missing crawlable quest intro section',
    ])
  })

  it('reports a page that lost its TouristTrip JSON-LD', () => {
    expect(verifyQuestHtml(buildQuestPageHtml({ jsonLd: '' }), CANONICAL)).toEqual([
      'missing TouristTrip JSON-LD',
    ])
  })
})

describe('hasQuestCityLandingSection', () => {
  it('accepts a landing that kept its crawlable quest list', () => {
    const html =
      '<body><section data-ssg-quest-city="true" aria-label="Городские квесты: Краков"><h1>Городские квесты: Краков</h1><ul><li><a href="/quests/12/krakow-wawel-dragon">Вавельский дракон</a></li></ul></section></body>'

    expect(hasQuestCityLandingSection(html)).toBe(true)
  })

  it('rejects the untouched SPA shell a skipped quest block leaves on disk', () => {
    expect(hasQuestCityLandingSection('<body><div id="root"></div></body>')).toBe(false)
  })
})

describe('verifyQuestCityHtml', () => {
  const canonical = 'https://metravel.by/quests/rome'
  const cityHtml = [
    '<html><head>',
    '<title>Городские квесты: Рим — прогулки с заданиями | Metravel</title>',
    '<meta name="description" content="Рим: что посмотреть на прогулке — городской квест, практика и соседние города." />',
    `<link rel="canonical" href="${canonical}" />`,
    '</head><body>',
    '<section data-ssg-quest-city="true">',
    '<div data-ssg-quest-city-overview="true"><h2>Прогулка по Риму</h2><p>Самостоятельный городской маршрут.</p></div>',
    '<div data-ssg-quest-city-walk="true"><h2>Что увидите по дороге: Рим</h2><p>Капитолий — площадь Микеланджело.</p></div>',
    '<div data-ssg-quest-city-practical="true"><h2>Как спланировать прогулку</h2><p>Проверьте погоду.</p></div>',
    '</section>',
    '</body></html>',
  ].join('')

  it('accepts independent metadata and mandatory city-only content', () => {
    expect(hasQuestCityStandaloneContent(cityHtml)).toBe(true)
    expect(verifyQuestCityHtml(cityHtml, canonical, buildQuestPageHtml())).toEqual([])
  })

  /**
   * #1569: заметки о местах — единственная часть страницы, которой нет в
   * шаблоне. Без них город снова читается как обёртка дочернего квеста, поэтому
   * их пропажа обязана называться отдельно, а не всплывать счётом слов.
   */
  it('rejects a city landing that lost its own notes about the places', () => {
    const withoutWalk = cityHtml.replace(/<div data-ssg-quest-city-walk="true">[\s\S]*?<\/div>/, '')

    expect(hasQuestCityStandaloneContent(withoutWalk)).toBe(false)
    expect(verifyQuestCityHtml(withoutWalk, canonical, buildQuestPageHtml())).toEqual(
      expect.arrayContaining(['missing independent city overview/walk/practical content']),
    )
  })

  /**
   * Город, чьи квесты не оставили заметок о местах, генератор собирает под
   * build-owned `noindex, follow` (партия 19.09.2026) — такая страница не
   * претендует на выдачу, и заметки с неё не спрашиваются; планировочная часть
   * и навигация по-прежнему обязательны.
   */
  it('accepts a noindex landing without notes as long as it keeps the planning sections', () => {
    const withoutWalk = cityHtml.replace(/<div data-ssg-quest-city-walk="true">[\s\S]*?<\/div>/, '')
    const noindex = withoutWalk.replace(
      '</head>',
      '<meta name="robots" content="noindex, follow"/></head>',
    )

    expect(verifyQuestCityHtml(noindex, canonical, buildQuestPageHtml())).toEqual([])
    expect(
      verifyQuestCityHtml(
        noindex.replace(/<div data-ssg-quest-city-practical="true">[\s\S]*?<\/div>/, ''),
        canonical,
        buildQuestPageHtml(),
      ),
    ).toEqual(expect.arrayContaining(['missing independent city overview/practical content']))
  })

  it('rejects a noindex landing that still carries notes or whose robots tag is Helmet-owned', () => {
    const withNotes = cityHtml.replace('</head>', '<meta name="robots" content="noindex, follow"/></head>')
    expect(verifyQuestCityHtml(withNotes, canonical, buildQuestPageHtml())).toEqual(
      expect.arrayContaining([
        'city landing carries its own notes about the places but ships noindex: noindex, follow',
      ]),
    )

    const helmetOwned = cityHtml
      .replace(/<div data-ssg-quest-city-walk="true">[\s\S]*?<\/div>/, '')
      .replace('</head>', '<meta data-rh="true" name="robots" content="noindex, follow"/></head>')
    expect(verifyQuestCityHtml(helmetOwned, canonical, buildQuestPageHtml())).toEqual(
      expect.arrayContaining([
        'city landing noindex is Helmet-owned (data-rh) and is dropped on hydration',
      ]),
    )
  })

  it('rejects a one-quest wrapper that copies child metadata and has no planning sections', () => {
    const thin = buildQuestPageHtml({
      canonical: `<link rel="canonical" href="${canonical}" />`,
      intro: '<section data-ssg-quest-city="true"><h1>Квест по Кракову</h1></section>',
    })
    const issues = verifyQuestCityHtml(thin, canonical, buildQuestPageHtml())

    expect(issues).toEqual(expect.arrayContaining([
      'missing independent city overview/walk/practical content',
      'title duplicates the only quest page',
      'description duplicates the only quest page',
    ]))
  })

  it('requires the canonical alias in the backend sitemap, not only its numeric redirect source', () => {
    expect(sitemapHasUrl(`<url><loc>${canonical}</loc></url>`, canonical)).toBe(true)
    expect(sitemapHasUrl('<url><loc>https://metravel.by/quests/121</loc></url>', canonical)).toBe(false)
    expect(sitemapHasUrl('<urlset></urlset>', canonical)).toBe(false)
  })
})

describe('quest country landing verification', () => {
  const quests = [
    {
      quest_id: 'minsk-center',
      city_id: '4',
      city_name: 'Минск',
      country_code: 'by',
      country_name: 'Беларусь',
      title: 'Минский центр',
    },
    {
      quest_id: 'gomel-park',
      city_id: '19',
      city_name: 'Гомель',
      country_code: 'BY',
      country_name: 'Беларусь',
      title: 'Гомельский парк',
    },
    { quest_id: 'unknown-one', city_id: '900', country_code: '' },
    { quest_id: 'unknown-two', city_id: '901', country_code: 'ZZ' },
  ]
  const canonical = 'https://metravel.by/quests/country/belarus'
  const html = [
    '<html><head>',
    '<title>Квесты страны: Беларусь — города и маршруты | Metravel</title>',
    '<meta name="description" content="Беларусь: квесты в городах страны." />',
    `<meta property="og:url" content="${canonical}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    '</head><body>',
    '<section data-ssg-quest-country="true">',
    '<div data-ssg-quest-country-overview="true">Обзор страны</div>',
    '<div data-ssg-quest-country-cities="true"><a href="/quests/minsk">Минск</a><a href="/quests/gomel">Гомель</a></div>',
    '<div data-ssg-quest-country-practical="true">Как выбрать маршрут</div>',
    '<a href="/quests/4/minsk-center">Минский центр</a>',
    '<a href="/quests/19/gomel-park">Гомельский парк</a>',
    '</section>',
    '</body></html>',
  ].join('')

  it('derives files only for valid, non-empty country groups', () => {
    expect(expectedCountryLandingFiles(quests)).toEqual([
      'quests/country/belarus/index.html',
    ])
  })

  it('requires independent content, canonical city links, and every quest link', () => {
    expect(hasQuestCountryLandingSection(html)).toBe(true)
    expect(hasQuestCountryStandaloneContent(html)).toBe(true)
    expect(verifyQuestCountryHtml(
      html,
      canonical,
      ['/quests/minsk', '/quests/gomel'],
      ['/quests/4/minsk-center', '/quests/19/gomel-park'],
    )).toEqual([])

    const issues = verifyQuestCountryHtml(
      html.replace('data-ssg-quest-country-practical="true"', ''),
      canonical,
      ['/quests/minsk', '/quests/gomel'],
      ['/quests/4/minsk-center', '/quests/19/missing'],
    )
    expect(issues).toEqual(expect.arrayContaining([
      'missing independent country overview/cities/practical content',
      'missing quest link: /quests/19/missing',
    ]))
  })

  // Правило индексируемости живёт в генераторе, а сюда приходит уже
  // отрисованный HTML. Без этой проверки расхождение между правилом и страницей
  // заметил бы только GSC — через месяц (#1762, #1929).
  it('demands noindex exactly on the country landings that do not clear the floors', () => {
    const noindexHtml = html.replace(
      '</head>',
      '<meta name="robots" content="noindex, follow" /></head>',
    )
    const cityPaths = ['/quests/minsk', '/quests/gomel']
    const questPaths = ['/quests/4/minsk-center', '/quests/19/gomel-park']

    expect(verifyQuestCountryHtml(noindexHtml, canonical, cityPaths, questPaths, '', false)).toEqual([])
    expect(verifyQuestCountryHtml(html, canonical, cityPaths, questPaths, '', true)).toEqual([])

    expect(verifyQuestCountryHtml(html, canonical, cityPaths, questPaths, '', false)).toEqual(
      expect.arrayContaining([
        'country landing does not clear the content floors but is missing noindex',
      ]),
    )
    expect(verifyQuestCountryHtml(noindexHtml, canonical, cityPaths, questPaths, '', true)).toEqual(
      expect.arrayContaining([
        'country landing clears the content floors but ships noindex: noindex, follow',
      ]),
    )
  })

  // Сырой HTML с `data-rh` проходит все прочие проверки, но роут страны robots
  // не объявляет, и Helmet снимает такой тег при гидрации: на проде живой DOM
  // остался без noindex вовсе (#1929, возврат из testing 16.09.2026).
  it('rejects a country noindex that Helmet owns and drops on hydration', () => {
    const cityPaths = ['/quests/minsk', '/quests/gomel']
    const questPaths = ['/quests/4/minsk-center', '/quests/19/gomel-park']
    const helmetOwnedHtml = html.replace(
      '</head>',
      '<meta data-rh="true" name="robots" content="noindex, follow"/></head>',
    )
    const buildOwnedHtml = html.replace(
      '</head>',
      '<meta name="robots" content="noindex, follow"/></head>',
    )

    expect(verifyQuestCountryHtml(helmetOwnedHtml, canonical, cityPaths, questPaths, '', false)).toEqual([
      'country landing noindex is Helmet-owned (data-rh) and is dropped on hydration',
    ])
    expect(verifyQuestCountryHtml(buildOwnedHtml, canonical, cityPaths, questPaths, '', false)).toEqual([])
  })

  /**
   * Адрес в карте сайта под `noindex` — противоречивый сигнал, но `sitemap.xml`
   * принадлежит Django: ронять фронтовую сборку из-за состояния чужого сервиса
   * нельзя, поэтому расхождение выходит предупреждением и задачей бэкенду.
   */
  it('warns instead of failing when the backend sitemap still publishes a noindex country', () => {
    const sitemapXml = [
      '<urlset>',
      '<url><loc>https://metravel.by/quests/country/belarus</loc></url>',
      '<url><loc>https://metravel.by/quests/country/poland</loc></url>',
      '</urlset>',
    ].join('')
    const built = [
      { country: { countryAlias: 'belarus' }, countryPath: '/quests/country/belarus' },
      { country: { countryAlias: 'poland' }, countryPath: '/quests/country/poland' },
    ]
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      expect(
        warnQuestCountryNoindexInSitemap(built, new Set(['/quests/country/belarus']), sitemapXml),
      ).toEqual(['poland'])
      expect(warn).toHaveBeenCalledTimes(1)

      warn.mockClear()
      expect(
        warnQuestCountryNoindexInSitemap(
          built,
          new Set(['/quests/country/belarus', '/quests/country/poland']),
          sitemapXml,
        ),
      ).toEqual([])
      expect(warn).not.toHaveBeenCalled()
      expect(warnQuestCountryNoindexInSitemap(built, new Set(), '<urlset></urlset>')).toEqual([])
    } finally {
      warn.mockRestore()
    }
  })

  it('rejects duplicate head tags and an Open Graph URL that is not self-canonical', () => {
    const broken = html
      .replace(
        `<meta property="og:url" content="${canonical}" />`,
        '<meta property="og:url" content="https://metravel.by/quests/country/poland" />',
      )
      .replace('</head>', [
        '<title>Duplicate title</title>',
        '<meta name="description" content="Duplicate description" />',
        '<link rel="canonical" href="https://metravel.by/quests/country/poland" />',
        '<meta property="og:url" content="https://metravel.by/quests/country/poland" />',
        '</head>',
      ].join(''))

    expect(verifyQuestCountryHtml(broken, canonical)).toEqual(expect.arrayContaining([
      'duplicate <title>',
      'duplicate description',
      'duplicate canonical',
      'duplicate og:url',
      'bad og:url: https://metravel.by/quests/country/poland',
    ]))
  })

  it('keeps Django sitemap membership as an explicit post-deploy gate', () => {
    const countries = buildQuestCountryLandingGroups(quests)
    expect(verifyQuestCountrySitemap(countries, '<urlset></urlset>', false)).toEqual([])
    expect(verifyQuestCountrySitemap(countries, '<urlset></urlset>', true)).toEqual([
      `${canonical}: missing from backend sitemap.xml`,
    ])
    expect(verifyQuestCountrySitemap(
      countries,
      `<urlset><url><loc>${canonical}</loc></url></urlset>`,
      true,
    )).toEqual([])
  })

  // The alias vocabulary IS the contract. A backend on ISO 3166 official names
  // publishes `russian-federation` where the frontend's CLDR display name gives
  // `russia`; nothing serves that path, so nginx returns the SPA shell and the
  // row is a dead URL answering HTTP 200. #1606 acceptance sampled only
  // single-word countries, the only ones that cannot expose this.
  it('rejects a sitemap row that no catalog-derived landing can serve', () => {
    const countries = buildQuestCountryLandingGroups(quests)
    const orphan = 'https://metravel.by/quests/country/belarus-republic-of'
    const xml = `<urlset><url><loc>${canonical}</loc></url><url><loc>${orphan}</loc></url></urlset>`

    expect(verifyQuestCountrySitemap(countries, xml, true)).toEqual([
      `${orphan}: in backend sitemap.xml but no catalog-derived landing (dead URL)`,
    ])
    expect(verifyQuestCountrySitemap(countries, xml, false)).toEqual([])
  })

  it('reports both directions of an alias vocabulary mismatch together', () => {
    const countries = buildQuestCountryLandingGroups(quests)
    const xml =
      '<urlset><url><loc>https://metravel.by/quests/country/belarus-republic-of</loc></url></urlset>'

    expect(verifyQuestCountrySitemap(countries, xml, true)).toEqual([
      `${canonical}: missing from backend sitemap.xml`,
      'https://metravel.by/quests/country/belarus-republic-of: in backend sitemap.xml but no catalog-derived landing (dead URL)',
    ])
  })

  it('reads only country rows out of the sitemap', () => {
    const countries = buildQuestCountryLandingGroups(quests)
    const xml = [
      '<urlset>',
      `<url><loc>${canonical}</loc></url>`,
      '<url><loc>https://metravel.by/quests/minsk</loc></url>',
      '<url><loc>https://metravel.by/quests/4/minsk-center</loc></url>',
      '<url><loc>https://metravel.by/travels/some-trip</loc></url>',
      '</urlset>',
    ].join('')

    expect(verifyQuestCountrySitemap(countries, xml, true)).toEqual([])
    expect([...sitemapCountryAliases(xml)]).toEqual(['belarus'])
  })

  it('rejects title and description reused by another country landing', () => {
    const polandPath = '/quests/country/poland'
    const polandHtmlWithDuplicatedMetadata = html.replaceAll(canonical, `${canonical}/copy`)

    expect(verifyQuestCountryMetadataUniqueness([
      { path: '/quests/country/belarus', html },
      { path: polandPath, html: polandHtmlWithDuplicatedMetadata },
    ])).toEqual([
      `country landing ${polandPath}: title duplicates /quests/country/belarus`,
      `country landing ${polandPath}: description duplicates /quests/country/belarus`,
    ])

    expect(verifyQuestCountryMetadataUniqueness([
      { path: '/quests/country/belarus', html },
      {
        path: polandPath,
        html: polandHtmlWithDuplicatedMetadata
          .replace('Квесты страны: Беларусь', 'Квесты страны: Польша')
          .replace('Беларусь: квесты', 'Польша: квесты'),
      },
    ])).toEqual([])
  })
})

describe('backend sitemap input', () => {
  let server: http.Server
  let origin = ''
  let handler: (request: http.IncomingMessage, response: http.ServerResponse) => void

  beforeAll(async () => {
    server = http.createServer((request, response) => handler(request, response))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  function loadBackendSitemapForApi(apiBase: string): () => Promise<string> {
    const originalArgv = process.argv
    let isolatedFetch: (() => Promise<string>) | undefined
    try {
      process.argv = [originalArgv[0], originalArgv[1], '--api', apiBase]
      jest.isolateModules(() => {
        isolatedFetch = require('@/scripts/verify-static-quest-seo').fetchBackendSitemap
      })
    } finally {
      process.argv = originalArgv
    }
    if (!isolatedFetch) throw new Error('Failed to load isolated sitemap fetcher')
    return isolatedFetch
  }

  it('loads the Django-owned sitemap outside dist', async () => {
    const xml = '<urlset><url><loc>https://metravel.by/quests/rome</loc></url></urlset>'
    const fetcher = jest.fn(async () => xml)

    await expect(fetchBackendSitemap(fetcher)).resolves.toBe(xml)
    expect(fetcher).toHaveBeenCalledWith('https://metravel.by/sitemap.xml')
  })

  it('fails closed on an empty or non-sitemap response', async () => {
    await expect(fetchBackendSitemap(async () => '')).rejects.toThrow('Backend sitemap is empty')
    await expect(fetchBackendSitemap(async () => '<html>error</html>')).rejects.toThrow(
      'Backend sitemap has no <urlset>',
    )
  })

  it('follows a relative backend redirect before validating the sitemap text', async () => {
    const requests: string[] = []
    const xml = '<urlset><url><loc>https://metravel.by/quests/rome</loc></url></urlset>'
    handler = (request, response) => {
      requests.push(request.url || '')
      if (request.url === '/sitemap.xml') {
        response.writeHead(302, { Location: '/seo/sitemap.xml' })
        response.end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/xml' })
      response.end(xml)
    }

    await expect(loadBackendSitemapForApi(origin)()).resolves.toBe(xml)
    expect(requests).toEqual(['/sitemap.xml', '/seo/sitemap.xml'])
  })

  it('fails closed when the backend sitemap answers non-200', async () => {
    handler = (_request, response) => {
      response.writeHead(503)
      response.end('unavailable')
    }

    await expect(loadBackendSitemapForApi(origin)()).rejects.toThrow('answered HTTP 503')
  })
})

describe('fetchQuestCatalog', () => {
  it('reads every catalog page before deriving city aliases', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({
        results: [{ quest_id: 'rome-forum', city_id: '121' }],
        next_page_url: '/api/quests/?page=2',
      })
      .mockResolvedValueOnce({
        results: [{ quest_id: 'naples-castles', city_id: '122' }],
        next: null,
      })

    await expect(fetchQuestCatalog(fetcher, 'https://metravel.by')).resolves.toEqual([
      { quest_id: 'rome-forum', city_id: '121' },
      { quest_id: 'naples-castles', city_id: '122' },
    ])
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'https://metravel.by/api/quests/',
      'https://metravel.by/api/quests/?page=2',
    ])
  })

  it('fails closed when the catalog contains no routable quests', async () => {
    await expect(fetchQuestCatalog(async () => ({ results: [], next: null })))
      .rejects.toThrow('No quests returned by API')
  })

  it('fails instead of silently truncating a catalog beyond the safety cap', async () => {
    const fetcher = jest.fn(async () => ({
      results: [{ quest_id: 'rome-forum', city_id: '121' }],
      next: '/api/quests/?page=next',
    }))

    await expect(fetchQuestCatalog(fetcher)).rejects.toThrow('Quest catalog exceeds 50 pages')
    expect(fetcher).toHaveBeenCalledTimes(50)
  })
})

describe('listTravelPageFiles', () => {
  let distDir = ''

  beforeEach(() => {
    distDir = makeTempDir('verify-static-quest-seo-')
  })

  afterEach(() => {
    removeDir(distDir)
  })

  it('collects generated travel pages and ignores the route template', () => {
    writeTextFile(path.join(distDir, 'travels', 'minsk-za-vykhodnye', 'index.html'), '<html></html>')
    writeTextFile(path.join(distDir, 'travels', 'brest-putevoditel', 'index.html'), '<html></html>')
    // Expo writes the unresolved route template as a flat file next to them.
    writeTextFile(path.join(distDir, 'travels', '[param].html'), '<html></html>')

    expect(listTravelPageFiles(distDir).sort()).toEqual(
      [
        path.join(distDir, 'travels', 'brest-putevoditel', 'index.html'),
        path.join(distDir, 'travels', 'minsk-za-vykhodnye', 'index.html'),
      ].sort(),
    )
  })

  it('returns nothing when the build produced no travels directory', () => {
    expect(listTravelPageFiles(distDir)).toEqual([])
  })
})

describe('countTravelQuestPromoPages', () => {
  const withPromo = `<body><section ${TRAVEL_QUEST_PROMO_MARKER} aria-label="Квест по этому городу"></section></body>`
  const withoutPromo = '<body><article class="ssg-travel-article"></article></body>'

  it('counts only the travel pages that carry the promo block', () => {
    const pages: Record<string, string> = {
      'travels/minsk/index.html': withPromo,
      'travels/brest/index.html': withPromo,
      'travels/karkonosze/index.html': withoutPromo,
    }

    expect(countTravelQuestPromoPages(Object.keys(pages), (file: string) => pages[file])).toBe(2)
  })

  it('returns 0 when an empty quest catalog stripped the promo from every travel page', () => {
    const pages: Record<string, string> = {
      'travels/minsk/index.html': withoutPromo,
      'travels/brest/index.html': withoutPromo,
    }

    expect(countTravelQuestPromoPages(Object.keys(pages), (file: string) => pages[file])).toBe(0)
  })

  it('handles a dist with no travel pages at all', () => {
    expect(countTravelQuestPromoPages([], () => '')).toBe(0)
  })
})

describe('expectedAliasLandingQuests', () => {
  // Гомель ships as both city_id 19 and 92; both map to the alias "gomel".
  const GOMEL_19 = { quest_id: 'gomel-park', city_id: '19' }
  const GOMEL_19B = { quest_id: 'gomel-center', city_id: '19' }
  const GOMEL_92 = { quest_id: 'gomel-river', city_id: '92' }

  it('collects the quests of every city_id sharing an alias', () => {
    const quests = [GOMEL_19, GOMEL_19B, GOMEL_92]
    const aliasMap = buildQuestCityAliasMap(quests)

    expect([...expectedAliasLandingQuests(quests, aliasMap).get('gomel')].sort()).toEqual([
      '/quests/19/gomel-center',
      '/quests/19/gomel-park',
      '/quests/92/gomel-river',
    ])
  })

  it('ignores quests whose city has no distinct alias', () => {
    expect(expectedAliasLandingQuests([{ quest_id: '4-only', city_id: '4' }], new Map()).size).toBe(0)
  })
})

describe('missingLandingQuestLinks', () => {
  const ALL = new Set(['/quests/19/gomel-park', '/quests/92/gomel-river'])

  it('accepts a landing that links every quest of the alias', () => {
    const html =
      '<ul><li><a href="/quests/19/gomel-park">Парк</a></li><li><a href="/quests/92/gomel-river">Набережная</a></li></ul>'

    expect(missingLandingQuestLinks(html, ALL)).toEqual([])
  })

  it('reports the quests dropped when one city overwrote the other landing', () => {
    const lastWriteWins = '<ul><li><a href="/quests/92/gomel-river">Набережная</a></li></ul>'

    expect(missingLandingQuestLinks(lastWriteWins, ALL)).toEqual(['/quests/19/gomel-park'])
  })

  it('does not let a longer path stand in for a shorter one', () => {
    const html = '<a href="/quests/19/gomel-park-extended">Другой</a>'

    expect(missingLandingQuestLinks(html, new Set(['/quests/19/gomel-park']))).toEqual([
      '/quests/19/gomel-park',
    ])
  })
})

describe('extractItems', () => {
  it('unwraps every catalog envelope the quests API uses', () => {
    expect(extractItems([KRAKOW_QUEST])).toEqual([KRAKOW_QUEST])
    expect(extractItems({ data: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems({ results: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems({ items: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems(null)).toEqual([])
  })
})

/**
 * #1930: the guard measures how much text a catalog-derived page carries and
 * how much of it is its own, for every level — not the presence of the three
 * section tags that were added one incident at a time.
 */
describe('catalog-derived quest page content depth', () => {
  /**
   * Body copy of an exact length. The same seed twice is one template written
   * onto two pages; different seeds share no phrasing at all. Digit-free on
   * purpose — the guard drops tokens carrying a number, because that is where
   * the per-page counts live.
   */
  const ALPHABET = 'абвгдежзийклмнопрстуфхцчшщэюя'
  const prose = (words: number, seed = 0): string => {
    const vocabulary = Array.from(
      { length: ALPHABET.length },
      (_, slot) =>
        `сл${ALPHABET[seed % ALPHABET.length]}${ALPHABET[slot]}${ALPHABET[(slot * 7) % ALPHABET.length]}`,
    )
    return Array.from({ length: words }, (_, index) => vocabulary[index % vocabulary.length]).join(' ')
  }

  const questSection = (kind: string, body: string): string =>
    `<section data-ssg-${kind}="true" aria-label="Квесты"><p>${body}</p></section>`

  const page = (kind: string, words: number, seed = 0): { path: string; kind: string; text: string } => {
    const [section] = extractQuestSsgSections(questSection(kind, prose(words, seed)))
    return { path: `quests/${kind}-${seed}/index.html`, kind: section.kind, text: section.text }
  }

  it('fails a page below the word floor and names the file, the floor and the actual count', () => {
    const failures = verifyQuestPageContentDepth([page('quest-region', 40)], { exemptions: [] })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('quests/quest-region-0/index.html')
    expect(failures[0]).toContain('[quest-region]')
    expect(failures[0]).toContain('40 words of crawlable text, minimum 300')
  })

  it('accepts a page that carries enough of its own text', () => {
    expect(
      verifyQuestPageContentDepth([page('quest-region', 400, 0), page('quest-region', 400, 3)], {
        exemptions: [],
      }),
    ).toEqual([])
  })

  it('fails two same-level pages whose text differs only by name and numbers', () => {
    const template = (city: string, count: number) =>
      questSection(
        'quest-region',
        `Здесь собраны ${count} квеста в городе ${city}. ${prose(400)}`,
      )
    const pages = [
      { path: 'quests/region/a/index.html', kind: 'quest-region', text: extractQuestSsgSections(template('Минск', 9))[0].text },
      { path: 'quests/region/b/index.html', kind: 'quest-region', text: extractQuestSsgSections(template('Брест', 4))[0].text },
    ]

    const failures = verifyQuestPageContentDepth(pages, { exemptions: [] })

    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('reads as a shared template')
    expect(failures[0]).toContain('0% of its wording is its own, minimum 30%')
  })

  it('does not call a level a template when it is the only page of that level', () => {
    expect(verifyQuestPageContentDepth([page('quest-region', 400)], { exemptions: [] })).toEqual([])
  })

  /**
   * The measurement that decides whether the rule works at all: a landing is
   * mostly links to other pages, and their labels are unique per page by
   * construction, so counting them turns a thin template into a long page.
   */
  it('measures body copy, not the link labels a catalog page is built from', () => {
    const links = Array.from(
      { length: 60 },
      (_, index) => `<li><a href="/quests/city-${index}">Очень Длинное Название Города ${index}</a></li>`,
    ).join('')
    const [section] = extractQuestSsgSections(
      `<section data-ssg-quest-region="true"><p>${prose(20)}</p><ul>${links}</ul></section>`,
    )

    expect(section.text).not.toContain('Название')
    expect(countWords(section.text)).toBe(20)
  })

  it('applies the full rule to a level nobody has written a guard for yet', () => {
    const failures = verifyQuestPageContentDepth([
      page('quest-theme', 120, 0),
      page('quest-theme', 120, 0),
    ])

    expect(failures).toHaveLength(2)
    expect(failures.every((failure) => failure.includes('[quest-theme]'))).toBe(true)
  })

  /**
   * The /quests hub is the most-crawled catalog page and the generator spells
   * its marker in the plural (`data-ssg-quests-listing`). A rule that only knew
   * the singular would have left that level — and the next one named after it —
   * outside the measurement it exists for.
   */
  it('measures the hub level whose marker the generator spells in the plural', () => {
    const failures = verifyQuestPageContentDepth([page('quests-listing', 40)])

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('[quests-listing]')
    expect(failures[0]).toContain('40 words of crawlable text, minimum 300')
  })

  /**
   * A page at 29.8% own wording must not be reported as "only 30% ... minimum
   * 30%": a build log that argues with itself reads as a broken guard, and the
   * next maintainer reopens the guard instead of the thin page.
   */
  it('reports a share below the floor as below the floor, never as the floor itself', () => {
    // Digit-free lowercase tokens survive templateSkeleton unchanged.
    const token = (index: number) =>
      `тк${String(index).split('').map((digit) => 'абвгдежзий'[Number(digit)]).join('')}`
    const run = (count: number, offset: number) =>
      Array.from({ length: count }, (_, index) => token(offset + index)).join(' ')
    // 298 own + 706 shared tokens = 1000 shingles, 298 of them unique: 29.8%.
    const sharedTail = run(706, 0)
    const pages = [1, 2].map((slot) => ({
      path: `quests/region/${slot}/index.html`,
      kind: 'quest-region',
      text: `${run(298, slot * 100000)} ${sharedTail}`,
    }))

    const failures = verifyQuestPageContentDepth(pages, { exemptions: [] })

    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('only 29% of its wording is its own, minimum 30%')
  })

  it('holds a grandfathered level to its own floor instead of ignoring it', () => {
    const exemptions = [{ kind: 'quest-city', minWords: 110, minDistinctRatio: 0, ticket: '#1569' }]

    expect(
      verifyQuestPageContentDepth([page('quest-city', 150, 0), page('quest-city', 150, 0)], { exemptions }),
    ).toEqual([])

    const regressed = verifyQuestPageContentDepth(
      [page('quest-city', 150, 0), page('quest-city', 90, 0)],
      { exemptions },
    )
    expect(regressed).toHaveLength(1)
    expect(regressed[0]).toContain('90 words of crawlable text, minimum 110')
  })

  it('fails on an exemption that its level has outgrown, so the list can only shrink', () => {
    const failures = verifyQuestPageContentDepth(
      [page('quest-city', 400, 0), page('quest-city', 400, 3)],
      { exemptions: [{ kind: 'quest-city', minWords: 110, minDistinctRatio: 0, ticket: '#1569' }] },
    )

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('exemption for "quest-city" (#1569) is stale')
    expect(failures[0]).toContain('delete the entry from THIN_CONTENT_EXEMPTIONS')
  })

  it('ships no thin-content exemption at all, and keeps the shape of any future one', () => {
    expect(THIN_CONTENT_EXEMPTIONS).toEqual([])
    for (const entry of THIN_CONTENT_EXEMPTIONS as Array<{ ticket: string; minWords: number }>) {
      expect(entry.ticket).toMatch(/^#\d+$/)
      expect(entry.minWords).toBeLessThan(MIN_QUEST_PAGE_WORDS)
    }
  })

  /**
   * Страница под `noindex` не претендует на выдачу, поэтому и глубины с неё не
   * спрашивают. Иначе гвард ронял бы сборку за выполненное решение снять
   * тонкий уровень с претензии на поиск (#1929).
   */
  it('measures only the pages that claim a place in search', () => {
    const thin = { ...page('quest-country', 120, 0), noindex: true }

    expect(verifyQuestPageContentDepth([thin])).toEqual([])
    expect(verifyQuestPageContentDepth([{ ...thin, noindex: false }])).toEqual([
      expect.stringContaining('120 words of crawlable text, minimum 300'),
    ])
  })

  it('reads the level out of the marker, and keeps nested sections in the text', () => {
    const sections = extractQuestSsgSections(
      '<section data-ssg-quest-country="true"><p>Первый абзац.</p>' +
        '<section><p>Вложенный абзац.</p></section><p>Третий абзац.</p></section>',
    )

    expect(sections).toHaveLength(1)
    expect(sections[0].kind).toBe('quest-country')
    expect(sections[0].text).toBe('Первый абзац. Вложенный абзац. Третий абзац.')
  })

  it('drops the names and the numbers two pages of one template differ by', () => {
    expect(templateSkeleton('В городе Минск собрано 9 квестов')).toEqual([
      'городе',
      'собрано',
      'квестов',
    ])
  })
})

describe('collectQuestSsgPages', () => {
  let distDir = ''

  const questPage = (canonical: string, body: string) =>
    [
      '<!DOCTYPE html><html lang="ru"><head>',
      `<link rel="canonical" href="${canonical}" />`,
      '</head><body>',
      `<section data-ssg-quest-intro="true"><p>${body}</p></section>`,
      '</body></html>',
    ].join('')

  beforeEach(() => {
    distDir = makeTempDir('quest-ssg-pages-')
  })

  afterEach(() => {
    removeDir(distDir)
  })

  it('returns nothing when the build produced no quests directory', () => {
    expect(collectQuestSsgPages(distDir)).toEqual([])
  })

  /**
   * generate-seo-pages.js writes each quest as both `<id>.html` and
   * `<id>/index.html`, and each city under its numeric id and its alias — four
   * files, two pages. Counted per file, every page is its own duplicate and the
   * uniqueness rule reports 0% own wording for the whole catalog.
   */
  it('collapses the file shapes of one page onto its canonical url', () => {
    const html = questPage('https://metravel.by/quests/4/minsk-svisloch', 'Текст квеста.')
    writeTextFile(path.join(distDir, 'quests', '4', 'minsk-svisloch.html'), html)
    writeTextFile(path.join(distDir, 'quests', '4', 'minsk-svisloch', 'index.html'), html)
    writeTextFile(
      path.join(distDir, 'quests', 'minsk', 'index.html'),
      questPage('https://metravel.by/quests/minsk', 'Текст города.'),
    )

    const pages = collectQuestSsgPages(distDir)

    expect(pages).toHaveLength(2)
    expect(pages.map((page: { text: string }) => page.text).sort()).toEqual([
      'Текст города.',
      'Текст квеста.',
    ])
  })

  it('skips the Expo route templates and files with no catalog-derived section', () => {
    writeTextFile(path.join(distDir, 'quests', '[city].html'), questPage('https://metravel.by/x', 'Шаблон.'))
    writeTextFile(path.join(distDir, 'quests', 'index.html'), '<!DOCTYPE html><html><body></body></html>')

    expect(collectQuestSsgPages(distDir)).toEqual([])
  })
})

/**
 * #1930 + #1569: what a floor is for, and the level that outgrew it.
 *
 * An exemption floor has to sit under what the generator can legitimately
 * render, not under what the catalog happens to hold today: both optional
 * blocks of a country landing are conditional, so the first quest in an
 * isolated country renders below the current catalog minimum, and a floor taken
 * from that minimum would red a fail-closed production build on a page that is
 * exactly what the template is supposed to produce. The probe drives the real
 * builder at its leanest shape — a hand-written lookalike that misses a key
 * silently measures a fallback label and licenses a floor the real page cannot
 * clear.
 *
 * The city landing left that list in #1569: its text is no longer a template
 * with a name substituted but notes about the places its own quests walk past,
 * so the level is held to the default. What is probed here instead is the other
 * half of that contract — a city whose quest bundles did not resolve carries no
 * notes, and both the generator and the guard have to say so rather than ship
 * the wrapper page the card exists to remove.
 */
describe('thin-content floors against the generator itself', () => {
  const {
    assertQuestCityLandingBundlesResolved,
    buildQuestCityLandingHtml,
    buildQuestCityLandingModel,
    buildQuestCountryLandingHtml,
    buildQuestCountryLandingModel,
  } = require('@/scripts/generate-seo-pages')

  const SHELL = '<!DOCTYPE html><html lang="ru"><head><title>Metravel</title></head><body></body></html>'

  /** The leanest catalog the builders can see: one quest, one city, no neighbours, no travels. */
  const LEAN_CATALOG = [
    { quest_id: 'q', city_id: '1', title: 'К', city_name: 'Х', country_code: 'BY' },
  ]

  /**
   * A bundle in the shape the build fetches, with the only property the city
   * landing needs from it: authored sentences beyond the two the quest page
   * publishes. Third-person, no questions and no instructions, exactly like the
   * corpus the model was measured on.
   */
  const bundleWithNotes = (pointCount: number) => ({
    quest_id: 'q',
    steps: Array.from({ length: pointCount }, (_, index) => ({
      step_id: `p${index}`,
      title: `Объект номер ${index}`,
      location: `Улица номер ${index}`,
      story: [
        `Первое предложение о месте номер ${index} стоит здесь уже третье столетие подряд.`,
        `Второе предложение о месте номер ${index} рассказывает про его перестройку и новых владельцев.`,
        `Третье предложение о месте номер ${index} вспоминает городскую легенду про здешних мастеров.`,
        `Четвёртое предложение о месте номер ${index} описывает лепнину на его фасаде и старую кладку.`,
      ].join(' '),
      answer_pattern: { type: 'any_text' },
    })),
    intro: { location: 'Площадь у вокзала', story: 'Вступление к маршруту.' },
  })

  const cityModel = (bundles: unknown) =>
    buildQuestCityLandingModel(LEAN_CATALOG, buildQuestCityAliasMap(LEAN_CATALOG), [], bundles)
  const cityHtml = (bundles: unknown, options?: { indexable: boolean }) =>
    buildQuestCityLandingHtml(SHELL, cityModel(bundles)[0], null, options)
  const leanCountryHtml = () => {
    const [country] = buildQuestCountryLandingModel(LEAN_CATALOG, 'ru')
    return buildQuestCountryLandingHtml(SHELL, country)
  }

  const leanPage = (html: string, routePath: string) => {
    const page = questPageFromHtml(html, routePath)
    expect(page.kind).not.toBe('')
    return page
  }

  it('passes a city landing built from the notes of its own quest', () => {
    const page = leanPage(cityHtml(new Map([['q', bundleWithNotes(8)]])), 'quests/x/index.html')

    expect(page.kind).toBe('quest-city')
    expect(page.text).toContain('Что увидите по дороге')
    expect(verifyQuestPageContentDepth([page])).toEqual([])
  })

  /**
   * One unreachable bundle used to cost a quest its rich intro and nothing
   * else. Now it costs the city its only own content, so the build has to stop:
   * a release that silently ships that page is the recurrence #1569 is about.
   * A city whose bundles did resolve but left no notes (stories shorter than the
   * quest-page digest, the 19.09.2026 batch) is not a transport failure: it
   * ships `noindex, follow` and leaves the measured set, exactly like a thin
   * country (#1929) — while the same page shipped indexable still fails the floor.
   */
  it('fails the build and the guard when a city has no resolvable quest bundle', () => {
    expect(() => assertQuestCityLandingBundlesResolved(cityModel(null))).toThrow(
      /quest city landings without a single quest bundle/,
    )

    const noindexPage = leanPage(cityHtml(null), 'quests/x/index.html')
    expect(noindexPage.noindex).toBe(true)
    expect(verifyQuestPageContentDepth([noindexPage])).toEqual([])

    const page = leanPage(cityHtml(null, { indexable: true }), 'quests/x/index.html')
    expect(page.noindex).toBe(false)
    expect(verifyQuestPageContentDepth([page])).toEqual([
      expect.stringContaining('words of crawlable text, minimum 300'),
    ])
  })

  /**
   * The rule the recurrence is about: two landings of one template must not read
   * as the same page once the names and the numbers are taken out. Both sides
   * are driven through the real builders, so a template that starts carrying
   * more boilerplate than own text fails here instead of in the next GSC report.
   */
  it('reads two city landings of one template as two different pages', () => {
    const catalog = [
      { quest_id: 'aq', city_id: '1', title: 'Первый квест', city_name: 'Первый', country_code: 'BY' },
      { quest_id: 'bq', city_id: '2', title: 'Второй квест', city_name: 'Второй', country_code: 'BY' },
    ]
    // Своя лексика на каждой точке каждого города: в корпусе у восьми точек
    // восемь разных рассказов, и фикстура, повторяющая одну фразу восемь раз,
    // мерила бы не шаблон страницы, а собственный повтор.
    const CYRILLIC = 'абвгдежзийклмноп'
    const token = (...parts: number[]) =>
      `тк${parts.map((part) => CYRILLIC[part % CYRILLIC.length]).join('')}`
    const sentence = (seed: number, point: number, slot: number) =>
      `${Array.from({ length: 12 }, (_, word) => token(seed, point, slot, word, word * 5 + point)).join(' ')}.`
    const notes = (seed: number) =>
      Array.from({ length: 8 }, (_, index) => ({
        step_id: `s${seed}${index}`,
        title: `Объект номер ${index}`,
        location: `Улица номер ${index}`,
        story: [0, 1, 2, 3].map((slot) => sentence(seed, index, slot)).join(' '),
        answer_pattern: { type: 'any_text' },
      }))

    const bundles = new Map([
      ['aq', { quest_id: 'aq', steps: notes(1) }],
      ['bq', { quest_id: 'bq', steps: notes(2) }],
    ])
    const model = buildQuestCityLandingModel(catalog, buildQuestCityAliasMap(catalog), [], bundles)
    const pages = model.map((city: { segment: string }) =>
      leanPage(buildQuestCityLandingHtml(SHELL, city, null), `quests/${city.segment}/index.html`),
    )

    expect(pages).toHaveLength(2)
    expect(verifyQuestPageContentDepth(pages)).toEqual([])

    // Контроль: те же две страницы с одинаковыми заметками — снова один шаблон.
    const sameNotes = new Map([
      ['aq', { quest_id: 'aq', steps: notes(1) }],
      ['bq', { quest_id: 'bq', steps: notes(1) }],
    ])
    const templatePages = buildQuestCityLandingModel(
      catalog,
      buildQuestCityAliasMap(catalog),
      [],
      sameNotes,
    ).map((city: { segment: string }) =>
      leanPage(buildQuestCityLandingHtml(SHELL, city, null), `quests/${city.segment}/index.html`),
    )

    expect(verifyQuestPageContentDepth(templatePages)).toEqual([
      expect.stringContaining('reads as a shared template'),
      expect.stringContaining('reads as a shared template'),
    ])
  })

  /**
   * Страновая посадочная больше не держится исключением: она не набрала текста и
   * потому не претендует на выдачу. Генератор ставит ей `noindex` сам, гвард её
   * не меряет, и обе стороны считают это одним и тем же кодом.
   */
  it('drops the leanest country landing out of the index instead of out of the guard', () => {
    const page = leanPage(leanCountryHtml(), 'quests/country/x/index.html')

    expect(page.kind).toBe('quest-country')
    expect(page.noindex).toBe(true)
    // Pinned so a drop in the builder's own output surfaces here, not on a prod build.
    expect(countWords(page.text)).toBe(112)
    expect(verifyQuestPageContentDepth([page])).toEqual([])

    // Та же страница, заявленная индексируемой, — это и есть регресс, который
    // гвард обязан поймать: 112 слов против порога в 300.
    expect(verifyQuestPageContentDepth([{ ...page, noindex: false }])).toEqual([
      expect.stringContaining('112 words of crawlable text, minimum 300'),
    ])

    // И пишет этот noindex так, чтобы гидрация его не сняла.
    expect(verifyQuestCountryHtml(leanCountryHtml(), 'https://metravel.by/quests/country/belarus', [], [], '', false))
      .toEqual(expect.not.arrayContaining([
        'country landing noindex is Helmet-owned (data-rh) and is dropped on hydration',
      ]))
  })

  /**
   * Правило считается по каталогу, а не по списку стран, и обе его половины
   * живые. Страна на 40 городах набирает 309 слов и в одиночку место в выдаче
   * берёт. Но рядом с любой соседкой того же шаблона обе теряют его снова: два
   * лендинга, различающиеся только именем и числами, — одна страница под двумя
   * адресами, и именно так Google и обошёлся с уровнем (17 из 18 вне индекса).
   * Уровень вернётся в выдачу не когда одна страна располнеет, а когда шаблон
   * перестанет быть общим — как это случилось с городом в #1569.
   */
  it('lets the same builder earn a country landing its place in search', () => {
    const bigCatalog = Array.from({ length: 40 }, (_, index) => ({
      quest_id: `q${index}-walk`,
      city_id: String(index + 1),
      title: `Квест номер ${index}`,
      city_name: `Город номер ${index}`,
      country_code: 'BY',
    }))
    const [big] = buildQuestCountryLandingModel(bigCatalog, 'ru')
    const bigPage = leanPage(
      buildQuestCountryLandingHtml(SHELL, big, { indexable: true }),
      'quests/country/belarus/index.html',
    )
    const leanPageModel = leanPage(leanCountryHtml(), 'quests/country/x/index.html')

    expect(countWords(bigPage.text)).toBeGreaterThanOrEqual(300)
    expect(bigPage.noindex).toBe(false)
    expect([...selectIndexableQuestPages([bigPage])]).toEqual([
      'quests/country/belarus/index.html',
    ])
    expect(verifyQuestPageContentDepth([bigPage])).toEqual([])

    expect([...selectIndexableQuestPages([bigPage, leanPageModel])]).toEqual([])
    expect(countWords(leanPageModel.text)).toBeLessThan(300)
  })

  it('keeps every exemption floor under the leanest output of its level', () => {
    const leanWords: Record<string, number> = {
      'quest-country': countWords(leanPage(leanCountryHtml(), 'k').text),
    }

    for (const entry of THIN_CONTENT_EXEMPTIONS as Array<{ kind: string; minWords: number }>) {
      expect(leanWords[entry.kind]).toBeGreaterThan(entry.minWords)
    }
  })
})

/**
 * #1930, второй проход генератора: детальная страница ниже порога уходит под
 * `noindex, follow` и из замера не выпадает — проверяется обратное
 * расхождение. Остальные уровни под `noindex` по-прежнему вне замера: их
 * индексируемость решает другое правило (город — заметки о местах, #1569).
 */
describe('depth-gated quest pages under noindex (#1930)', () => {
  const ALPHABET = 'абвгдежзийклмнопрстуфхцчшщэюя'
  const prose = (words: number, seed = 0): string => {
    const vocabulary = Array.from(
      { length: ALPHABET.length },
      (_, slot) =>
        `сл${ALPHABET[seed % ALPHABET.length]}${ALPHABET[slot]}${ALPHABET[(slot * 7) % ALPHABET.length]}`,
    )
    return Array.from({ length: words }, (_, index) => vocabulary[index % vocabulary.length]).join(' ')
  }
  const page = (kind: string, words: number, seed: number, noindex: boolean) => {
    const [section] = extractQuestSsgSections(
      `<section data-ssg-${kind}="true" aria-label="Квесты"><p>${prose(words, seed)}</p></section>`,
    )
    return { path: `quests/${kind}-${seed}/index.html`, kind: section.kind, text: section.text, noindex }
  }

  it('accepts a thin quest page under noindex and rejects a noindex page that clears the floors', () => {
    expect(
      verifyQuestPageContentDepth(
        [page('quest-intro', 40, 0, true), page('quest-intro', 400, 1, false)],
        { exemptions: [] },
      ),
    ).toEqual([])

    expect(
      verifyQuestPageContentDepth(
        [page('quest-intro', 400, 0, true), page('quest-intro', 400, 1, false)],
        { exemptions: [] },
      ),
    ).toEqual(['quests/quest-intro-0/index.html [quest-intro]: clears the content floors but ships noindex'])
  })

  it('keeps noindex pages of other levels out of the measured set', () => {
    expect(
      verifyQuestPageContentDepth(
        [page('quest-city', 400, 0, true), page('quest-city', 40, 1, true)],
        { exemptions: [] },
      ),
    ).toEqual([])
  })
})
