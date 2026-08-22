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
