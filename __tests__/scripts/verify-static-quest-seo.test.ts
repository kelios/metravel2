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
  TRAVEL_QUEST_PROMO_MARKER,
  countTravelQuestPromoPages,
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
  sitemapCountryAliases,
  sitemapHasUrl,
  verifyQuestCityHtml,
  verifyQuestCountryHtml,
  verifyQuestCountryMetadataUniqueness,
  verifyQuestCountrySitemap,
  verifyQuestHtml,
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
})

describe('verifyQuestHtml', () => {
  it('accepts a fully generated quest page', () => {
    expect(verifyQuestHtml(buildQuestPageHtml(), CANONICAL)).toEqual([])
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
    '<div data-ssg-quest-city-practical="true"><h2>Как спланировать прогулку</h2><p>Проверьте погоду.</p></div>',
    '</section>',
    '</body></html>',
  ].join('')

  it('accepts independent metadata and mandatory city-only content', () => {
    expect(hasQuestCityStandaloneContent(cityHtml)).toBe(true)
    expect(verifyQuestCityHtml(cityHtml, canonical, buildQuestPageHtml())).toEqual([])
  })

  it('rejects a one-quest wrapper that copies child metadata and has no planning sections', () => {
    const thin = buildQuestPageHtml({
      canonical: `<link rel="canonical" href="${canonical}" />`,
      intro: '<section data-ssg-quest-city="true"><h1>Квест по Кракову</h1></section>',
    })
    const issues = verifyQuestCityHtml(thin, canonical, buildQuestPageHtml())

    expect(issues).toEqual(expect.arrayContaining([
      'missing independent city overview/practical content',
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
