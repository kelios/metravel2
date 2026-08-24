/**
 * #1484: коллекция города и подбор следующего квеста на экране финала.
 */
import {
  buildQuestCityCollection,
  buildQuestCityCollections,
  pickNextQuests,
  NEXT_QUEST_RADIUS_KM,
} from '@/utils/questCityCollection'
import type { QuestMeta } from '@/utils/questAdapters'

const quest = (over: Partial<QuestMeta> & { id: string }): QuestMeta => ({
  title: over.id,
  points: 8,
  cityId: '1',
  cityName: 'Минск',
  lat: 53.9,
  lng: 27.56,
  durationMin: 90,
  ratingAvg: null,
  ratingCount: 0,
  completionsCount: 0,
  isCompletedByMe: false,
  firstCompleter: null,
  ...over,
})

describe('buildQuestCityCollection', () => {
  const catalog = [
    quest({ id: 'a', isCompletedByMe: true }),
    quest({ id: 'b' }),
    quest({ id: 'c' }),
    quest({ id: 'd', cityId: '2', cityName: 'Гродно', isCompletedByMe: true }),
  ]

  it('counts only the quests of the requested city', () => {
    expect(buildQuestCityCollection(catalog, { cityId: '1' })).toEqual({
      cityId: '1',
      cityName: 'Минск',
      completedCount: 1,
      totalCount: 3,
      ratio: 1 / 3,
    })
  })

  it('credits the quest finished in this session even when the catalog is stale', () => {
    // Гость: серверный `is_completed_by_me` про него не знает, а на финале
    // «Пройдено 0 из 3» — прямая ложь.
    const collection = buildQuestCityCollection(catalog, { cityId: '1', completedQuestId: 'b' })
    expect(collection?.completedCount).toBe(2)
  })

  it('does not double-count a quest that is completed on both sides', () => {
    const collection = buildQuestCityCollection(catalog, { cityId: '1', completedQuestId: 'a' })
    expect(collection?.completedCount).toBe(1)
  })

  // Маршрут квеста отдаёт сегмент URL, а он бывает алиасом (`/quests/minsk/...`).
  // По нему в каталоге, ключёванном числовым `city_id`, не находится ничего —
  // и полоса «Пройдено N из M» пропадала с финала целиком.
  it('resolves an alias city segment by the city name from the quest bundle', () => {
    expect(buildQuestCityCollection(catalog, { cityId: 'minsk', cityName: 'Минск' })).toMatchObject({
      cityId: '1',
      completedCount: 1,
      totalCount: 3,
    })
  })

  // Резолв по имени не спасает город с пустым `city_name` — там сцепка идёт
  // через общий с SSG алиас-контракт по префиксу `quest_id`.
  it('resolves an alias segment through the shared quest-id alias contract', () => {
    const namelessCity = [
      quest({ id: 'minsk-dvoriki', cityId: '4', cityName: '', isCompletedByMe: true }),
      quest({ id: 'minsk-old-town', cityId: '4', cityName: '' }),
    ]
    expect(buildQuestCityCollection(namelessCity, { cityId: 'minsk' })).toMatchObject({
      cityId: '4',
      completedCount: 1,
      totalCount: 2,
    })
    expect(
      pickNextQuests(namelessCity, { cityId: 'minsk', origin: { lat: 53.9, lng: 27.56 } }).every(
        (s) => s.otherCity,
      ),
    ).toBe(false)
  })

  it('keeps returning null for an alias segment without a matching city name', () => {
    expect(buildQuestCityCollection(catalog, { cityId: 'minsk' })).toBeNull()
  })

  // Сегмент города приходит из URL: `/quests/constructor/<quest>` не должен
  // доставать из lookup функцию Object.prototype и выдавать её за id города.
  it('does not resolve a city segment that only matches Object.prototype', () => {
    expect(buildQuestCityCollection(catalog, { cityId: 'constructor' })).toBeNull()
    expect(buildQuestCityCollection(catalog, { cityId: '__proto__' })).toBeNull()
    expect(
      pickNextQuests(catalog, { cityId: 'constructor', origin: { lat: 53.9, lng: 27.56 } }).every(
        (s) => s.otherCity,
      ),
    ).toBe(true)
  })

  it('refuses to guess between same-named cities of different countries', () => {
    const ambiguous = [
      quest({ id: 'by', cityId: '10', cityName: 'Брест', countryCode: 'BY' }),
      quest({ id: 'fr', cityId: '11', cityName: 'Брест', countryCode: 'FR' }),
    ]
    expect(buildQuestCityCollection(ambiguous, { cityId: 'brest', cityName: 'Брест' })).toBeNull()
  })

  it('returns null when the city has no quests in the catalog', () => {
    expect(buildQuestCityCollection(catalog, { cityId: '99' })).toBeNull()
    expect(buildQuestCityCollection(catalog, { cityId: '' })).toBeNull()
  })
})

describe('buildQuestCityCollections', () => {
  it('keeps only cities with completions and puts the almost-closed first', () => {
    const catalog = [
      quest({ id: 'a', cityId: '1', cityName: 'Минск', isCompletedByMe: true }),
      quest({ id: 'b', cityId: '1', cityName: 'Минск' }),
      quest({ id: 'c', cityId: '1', cityName: 'Минск' }),
      quest({ id: 'd', cityId: '2', cityName: 'Гродно', isCompletedByMe: true }),
      quest({ id: 'e', cityId: '2', cityName: 'Гродно', isCompletedByMe: true }),
      quest({ id: 'f', cityId: '3', cityName: 'Брест' }),
    ]

    expect(buildQuestCityCollections(catalog).map((c) => [c.cityId, c.completedCount, c.totalCount])).toEqual([
      ['2', 2, 2],
      ['1', 1, 3],
    ])
  })

  it('merges duplicate backend city ids by country and city name', () => {
    const catalog = [
      quest({ id: 'gomel-a', cityId: '19', cityName: 'Гомель', countryCode: 'BY', isCompletedByMe: true }),
      quest({ id: 'gomel-b', cityId: '92', cityName: 'Гомель', countryCode: 'BY' }),
    ]

    expect(buildQuestCityCollections(catalog)).toEqual([
      expect.objectContaining({ cityId: '19', completedCount: 1, totalCount: 2 }),
    ])
    expect(buildQuestCityCollection(catalog, { cityId: '92' })).toEqual(
      expect.objectContaining({ cityId: '19', completedCount: 1, totalCount: 2 }),
    )
  })
})

describe('pickNextQuests', () => {
  const origin = { lat: 53.9, lng: 27.56 }

  it('skips the finished quest and everything already completed', () => {
    const catalog = [
      quest({ id: 'current' }),
      quest({ id: 'done', isCompletedByMe: true }),
      quest({ id: 'next', lat: 53.91, lng: 27.57 }),
    ]
    expect(
      pickNextQuests(catalog, { currentQuestId: 'current', cityId: '1', origin }).map((s) => s.quest.id),
    ).toEqual(['next'])
  })

  // С алиасом в `cityId` свои же квесты считались чужими: город переставал
  // быть «своим», порядок ломался, а всё за 60 км молча выпадало из подбора.
  it('treats own-city quests as own when the city segment is an alias', () => {
    const catalog = [
      quest({ id: 'own-far', lat: 54.6, lng: 27.9 }),
      quest({ id: 'own-near', lat: 53.905, lng: 27.565 }),
    ]
    const picked = pickNextQuests(catalog, { cityId: 'minsk', cityName: 'Минск', origin })
    expect(picked.map((s) => s.quest.id)).toEqual(['own-near', 'own-far'])
    expect(picked.every((s) => s.otherCity)).toBe(false)
  })

  it('orders same-city suggestions by distance and reports it', () => {
    const catalog = [
      quest({ id: 'far', lat: 54.2, lng: 27.9 }),
      quest({ id: 'near', lat: 53.905, lng: 27.565 }),
    ]
    const picked = pickNextQuests(catalog, { cityId: '1', origin })
    expect(picked.map((s) => s.quest.id)).toEqual(['near', 'far'])
    expect(picked[0].distanceKm).toBeGreaterThan(0)
    expect(picked[0].distanceKm).toBeLessThan(picked[1].distanceKm as number)
  })

  it('falls back to another city only inside the radius and after own city', () => {
    const catalog = [
      quest({ id: 'own', lat: 54.4, lng: 27.9 }),
      quest({ id: 'neighbour', cityId: '2', cityName: 'Заславль', lat: 53.95, lng: 27.5 }),
      quest({ id: 'far-away', cityId: '3', cityName: 'Брест', lat: 52.09, lng: 23.68 }),
    ]
    const picked = pickNextQuests(catalog, { cityId: '1', origin })
    expect(picked.map((s) => s.quest.id)).toEqual(['own', 'neighbour'])
    expect(picked[1].otherCity).toBe(true)
    expect(picked[1].distanceKm).toBeLessThanOrEqual(NEXT_QUEST_RADIUS_KM)
  })

  it('keeps same-city quests without coordinates instead of dropping them', () => {
    const catalog = [quest({ id: 'no-coords', lat: Number.NaN, lng: Number.NaN })]
    const picked = pickNextQuests(catalog, { cityId: '1', origin })
    expect(picked.map((s) => s.quest.id)).toEqual(['no-coords'])
    expect(picked[0].distanceKm).toBeNull()
  })

  it('limits the block to three cards', () => {
    const catalog = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      quest({ id, lat: 53.9 + i / 100, lng: 27.56 }),
    )
    expect(pickNextQuests(catalog, { cityId: '1', origin })).toHaveLength(3)
  })
})
