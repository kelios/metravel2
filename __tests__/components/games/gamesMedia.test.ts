import { queryKeys } from '@/api/queryKeys'
import { parseColoringSheets, parseGamesMediaManifest, parseRoadQuiz, parseRouteTasks, parseWalkCards } from '@/components/games/gamesMedia'
import { matchRouteTaskStops } from '@/components/games/routeTaskStops'

const revision = 'belarus-poland-01-059f92c4b3de'
const root = `/travel-games-media/${revision}`
const manifest = {
  schemaVersion: 1,
  revision,
  coloringIndexUrl: `${root}/coloring-index.json`,
  collections: [{ id: 'belarus-poland-01', title: 'Беларусь и Польша', pdfUrl: `${root}/book.pdf`, sheetCount: 9 }],
  decks: [],
  quizzes: [],
}
const sheet = {
  id: 'nesvizh', travelId: 201, placeTitle: 'Несвижский замок',
  previewUrl: `${root}/nesvizh.webp`, pdfUrl: `${root}/nesvizh-a4.pdf`,
}
const kids = { id: 'kids', dataUrl: `${root}/kids.json`, pdfUrl: `${root}/kids.pdf` }
const adults = { id: 'adults', dataUrl: `${root}/adults.json`, pdfUrl: `${root}/adults.pdf` }
const cards = Array.from({ length: 12 }, (_, i) => ({ title: `Card ${i + 1}`, body: `Task ${i + 1}` }))
const belarus = { id: 'belarus', dataUrl: `${root}/belarus.json` }
const poland = { id: 'poland', dataUrl: `${root}/poland.json` }
const world = { id: 'world', dataUrl: `${root}/world.json` }
const choices = [
  { id: 'a', label: 'Первый' },
  { id: 'b', label: 'Второй' },
  { id: 'c', label: 'Третий' },
]
const questions = Array.from({ length: 10 }, (_, index) => ({
  id: `q-${index + 1}`, prompt: `Вопрос ${index + 1}`, choices, correctChoiceId: 'b',
  explanation: 'Короткое объяснение.', sourceUrl: 'https://example.com/reference',
}))
const edition = { schemaVersion: 1, id: 'belarus', locale: 'ru', title: 'Беларусь', questions }
const route = {
  id: 'pilot', travelId: 201, travelSlug: 'nesvizh-and-mir', title: 'Несвиж и Мир',
  locale: 'ru', dataUrl: `${root}/route-pilot.json`,
} as const
const routeTasks = [5246, 5247, 5250].map(pointId => ({
  id: `stop-${pointId}`, pointId, title: 'Осмотритесь', instruction: 'Сравните детали.',
}))
const routePack = { schemaVersion: 1, id: route.id, travelId: route.travelId, tasks: routeTasks }

describe('games media publication contract', () => {
  it('reads the published revision and associates a sheet with its stable travel ID', () => {
    expect(parseGamesMediaManifest(manifest)).toEqual({
      revision, coloringIndexUrl: manifest.coloringIndexUrl, collections: manifest.collections,
      decks: [], quizzes: [], routeTasks: [],
    })
    expect(parseColoringSheets({ schemaVersion: 1, sheets: [sheet] }, revision)).toEqual([sheet])
  })

  it.each([
    'https://metravel.by/travel-games-media/belarus-poland-01-059f92c4b3de/book.pdf',
    '//other.example/book.pdf',
    `${root}/../book.pdf`,
    `${root}/%2e%2e/book.pdf`,
    `${root}/book.pdf?redirect=other`,
    '/travel-games-media/old-revision/book.pdf',
  ])('rejects a download outside the versioned media family: %s', pdfUrl => {
    expect(() => parseGamesMediaManifest({
      ...manifest, collections: [{ ...manifest.collections[0], pdfUrl }],
    })).toThrow('Invalid coloring collection')
  })

  it('rejects duplicate sheet identifiers, malformed IDs and unsupported schema revisions', () => {
    expect(() => parseColoringSheets({ schemaVersion: 1, sheets: [sheet, sheet] }, revision)).toThrow()
    expect(() => parseColoringSheets({ schemaVersion: 1, sheets: [{ ...sheet, travelId: '201' }] }, revision)).toThrow()
    expect(() => parseGamesMediaManifest({ ...manifest, schemaVersion: 2 })).toThrow()
  })

  it('keeps the coloring-only manifest compatible and exposes both published decks', () => {
    expect(parseGamesMediaManifest({ ...manifest, decks: undefined }).decks).toEqual([])
    expect(parseGamesMediaManifest({ ...manifest, decks: [kids, adults] }).decks).toEqual([kids, adults])
  })

  it('drops invalid deck entries without breaking the coloring catalog', () => {
    const parsed = parseGamesMediaManifest({
      ...manifest,
      decks: [kids, { ...kids, pdfUrl: `${root}/duplicate.pdf` }, { ...adults, dataUrl: '/travel-games-media/old/adults.json' }],
    })
    expect(parsed.decks).toEqual([kids])
    expect(parsed.collections).toEqual(manifest.collections)
    expect(parsed.coloringIndexUrl).toBe(manifest.coloringIndexUrl)
  })

  it('requires exactly twelve nonempty cards for the requested deck and preserves the finale position', () => {
    const deck = { schemaVersion: 1, id: 'kids', cards }
    expect(parseWalkCards(deck, 'kids')).toEqual(cards)
    expect(() => parseWalkCards(deck, 'adults')).toThrow()
    expect(() => parseWalkCards({ ...deck, cards: cards.slice(1) }, 'kids')).toThrow()
    expect(() => parseWalkCards({ ...deck, cards: [...cards.slice(1), { title: 'Final', body: '  ' }] }, 'kids')).toThrow()
  })

  it('does not share validated cards when two deck IDs point to the same URL', () => {
    expect(queryKeys.walkDeck(kids.dataUrl, 'kids')).not.toEqual(queryKeys.walkDeck(kids.dataUrl, 'adults'))
  })

  it('exposes published quizzes and preserves compatibility with manifests without quizzes', () => {
    expect(parseGamesMediaManifest({ ...manifest, quizzes: undefined }).quizzes).toEqual([])
    expect(parseGamesMediaManifest({ ...manifest, quizzes: [belarus, poland, world] }).quizzes)
      .toEqual([belarus, poland, world])
  })

  it('drops invalid quiz entries without breaking walks or coloring', () => {
    const parsed = parseGamesMediaManifest({
      ...manifest,
      decks: [kids, adults],
      quizzes: [
        belarus, belarus, { ...poland, dataUrl: '/travel-games-media/old/poland.json' },
        { ...world, dataUrl: `${root}/world.json?extra=true` }, { ...world, id: 'unknown' },
      ],
    })
    expect(parsed.quizzes).toEqual([belarus])
    expect(parsed.decks).toEqual([kids, adults])
    expect(parsed.collections).toEqual(manifest.collections)
  })

  it('reads all ten questions and separates quiz cache keys by publication and ID', () => {
    expect(parseRoadQuiz(edition, 'belarus')).toEqual({ title: 'Беларусь', locale: 'ru', questions })
    expect(queryKeys.roadQuiz(belarus.dataUrl, 'belarus')).not.toEqual(queryKeys.roadQuiz(belarus.dataUrl, 'world'))
  })

  it('requires ten unique questions for the requested edition', () => {
    expect(() => parseRoadQuiz(edition, 'poland')).toThrow()
    expect(() => parseRoadQuiz({ ...edition, questions: questions.slice(1) }, 'belarus')).toThrow()
    expect(() => parseRoadQuiz({ ...edition, questions: [...questions.slice(1), questions[1]] }, 'belarus')).toThrow()
  })

  it.each([
    { choices: choices.slice(1) },
    { choices: [choices[0], choices[0], choices[2]] },
    { choices: [choices[0], { ...choices[1], label: ` ${choices[0].label} ` }, choices[2]] },
    { correctChoiceId: 'missing' },
    { explanation: ' ' },
    { sourceUrl: 'javascript:alert(1)' },
  ])('rejects malformed quiz answers and provenance: %j', change => {
    expect(() => parseRoadQuiz({
      ...edition, questions: [{ ...questions[0], ...change }, ...questions.slice(1)],
    }, 'belarus')).toThrow()
  })

  it('ignores malformed or duplicate route descriptors without suppressing other formats', () => {
    const parsed = parseGamesMediaManifest({
      ...manifest, decks: [kids], quizzes: [belarus],
      routeTasks: [
        { ...route, travelId: '201' },
        { ...route, travelSlug: '../other' },
        { ...route, travelSlug: 'undefined' },
        { ...route, travelSlug: '201' },
        { ...route, dataUrl: '/travel-games-media/old/route-pilot.json' },
        route,
        { ...route, id: 'second' },
        { ...route, travelId: 147 },
        { ...route, id: 'different-article', travelId: 147 },
      ],
    })
    const { travelSlug, ...descriptor } = route
    expect(parsed.routeTasks).toEqual([{ ...descriptor, travelPath: `/travels/${travelSlug}` }])
    expect(parsed.decks).toEqual([kids])
    expect(parsed.quizzes).toEqual([belarus])
    expect(parsed.collections).toEqual(manifest.collections)
  })

  it.each([
    { schemaVersion: 2 },
    { travelId: 147 },
    { id: 'another-edition' },
    { tasks: routeTasks.slice(1) },
    { tasks: [...routeTasks.slice(1), routeTasks[1]] },
    { tasks: [{ ...routeTasks[0], pointId: routeTasks[1].pointId }, ...routeTasks.slice(1)] },
    { tasks: [{ ...routeTasks[0], pointId: '5246' }, ...routeTasks.slice(1)] },
    { tasks: [{ ...routeTasks[0], instruction: ' ' }, ...routeTasks.slice(1)] },
  ])('rejects a malformed or mismatched route pack: %j', change => {
    expect(() => parseRouteTasks({ ...routePack, ...change }, route)).toThrow()
  })

  it('matches published IDs in edition order, without coordinates or positional fallback', () => {
    const tasks = parseRouteTasks(routePack, route)
    const mir = { id: 5247, name: '', address: ' Мирский замок ' }
    expect(matchRouteTaskStops(tasks, [
      mir, 'Old string-only point', { id: 999, name: 'Несвижский замок' },
      { id: 5246, name: ' Несвижский замок ' },
    ])).toEqual([
      { ...routeTasks[0], stopName: 'Несвижский замок' },
      { ...routeTasks[1], stopName: 'Мирский замок' },
    ])
    expect(matchRouteTaskStops(tasks, [])).toEqual([])
  })

  it('separates route task cache keys by edition URL, ID and article ID', () => {
    const key = queryKeys.routeTasks(route.dataUrl, route.id, route.travelId)
    expect(key).not.toEqual(queryKeys.routeTasks(kids.dataUrl, route.id, route.travelId))
    expect(key).not.toEqual(queryKeys.routeTasks(route.dataUrl, 'other', route.travelId))
    expect(key).not.toEqual(queryKeys.routeTasks(route.dataUrl, route.id, 147))
  })
})
