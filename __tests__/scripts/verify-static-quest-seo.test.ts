/**
 * Regression tests for scripts/verify-static-quest-seo.js
 *
 * The deploy gate that keeps a build from shipping without quest pages:
 * build-prod.sh only checked travel pages, so a skipped quest block passed
 * every guard and reached production.
 */

const {
  expectedCityLandingFiles,
  expectedQuestFiles,
  extractItems,
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

describe('extractItems', () => {
  it('unwraps every catalog envelope the quests API uses', () => {
    expect(extractItems([KRAKOW_QUEST])).toEqual([KRAKOW_QUEST])
    expect(extractItems({ data: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems({ results: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems({ items: [KRAKOW_QUEST] })).toEqual([KRAKOW_QUEST])
    expect(extractItems(null)).toEqual([])
  })
})
