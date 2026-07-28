/**
 * Regression tests for scripts/verify-static-quest-seo.js
 *
 * The deploy gate that keeps a build from shipping without quest pages:
 * build-prod.sh only checked travel pages, so a skipped quest block passed
 * every guard and reached production.
 */

import path from 'path'

import { makeTempDir, removeDir, writeTextFile } from './cli-test-utils'

const {
  TRAVEL_QUEST_PROMO_MARKER,
  countTravelQuestPromoPages,
  expectedCityLandingFiles,
  expectedQuestFiles,
  extractItems,
  hasQuestCityLandingSection,
  listTravelPageFiles,
  verifyQuestHtml,
} = require('@/scripts/verify-static-quest-seo')

const { buildQuestCityAliasMap } = require('@/utils/questCityAlias')

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

describe('hasQuestCityLandingSection', () => {
  it('accepts a landing that kept its crawlable city section', () => {
    const landing =
      '<html><body><section data-ssg-quest-city="true" aria-label="Городские квесты: Краков"><h1>Квесты</h1></section></body></html>'

    expect(hasQuestCityLandingSection(landing)).toBe(true)
  })

  it('rejects a landing that fell back to the bare SPA shell', () => {
    expect(hasQuestCityLandingSection('<html><body><div id="root"></div></body></html>')).toBe(false)
  })
})

describe('countTravelQuestPromoPages', () => {
  it('counts only travel pages that carry the promo block', () => {
    const pages: Record<string, string> = {
      '/dist/travels/krakow/index.html': `<section ${TRAVEL_QUEST_PROMO_MARKER} aria-label="Квест по этому городу"></section>`,
      '/dist/travels/bled/index.html': '<html><body>Озеро Блед</body></html>',
      '/dist/travels/minsk/index.html': `<section ${TRAVEL_QUEST_PROMO_MARKER} aria-label="Квесты рядом"></section>`,
    }

    expect(countTravelQuestPromoPages(Object.keys(pages), (filePath: string) => pages[filePath])).toBe(2)
  })

  it('returns zero when the promo catalog produced nothing', () => {
    expect(countTravelQuestPromoPages(['/dist/travels/a/index.html'], () => '<html></html>')).toBe(0)
    expect(countTravelQuestPromoPages([], () => '')).toBe(0)
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
