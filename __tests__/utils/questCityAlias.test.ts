const {
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  resolveQuestCitySegment,
} = require('@/utils/questCityAlias')

describe('quest city landing groups', () => {
  const quests = [
    {
      quest_id: 'rome-forum',
      city_id: '121',
      city_name: 'Рим',
      country_name: 'Италия',
      country_code: 'it',
      lat: 41.89,
      lng: 12.49,
    },
    {
      quest_id: 'gomel-park',
      city_id: '19',
      city_name: 'Гомель',
      lat: 52.43,
      lng: 30.99,
    },
    {
      quest_id: 'gomel-river',
      city_id: '92',
      city_name: 'Гомель',
      lat: 52.44,
      lng: 31,
    },
    {
      quest_id: 'naples-castles',
      city_id: '122',
      city_name: 'Неаполь',
      country_name: 'Италия',
      country_code: 'it',
      lat: 40.85,
      lng: 14.27,
    },
  ]

  it('creates a public city URL even when the city has exactly one quest', () => {
    const rome = buildQuestCityLandingGroups(quests).find((city: { segment: string }) => city.segment === 'rome')

    expect(rome).toMatchObject({
      cityId: '121',
      cityIds: ['121'],
      cityName: 'Рим',
      countryName: 'Италия',
    })
    expect(rome.quests).toHaveLength(1)
  })

  it('merges duplicate backend city ids behind the canonical alias', () => {
    const gomel = buildQuestCityLandingGroups(quests).find((city: { segment: string }) => city.segment === 'gomel')
    expect(gomel.cityIds).toEqual(['19', '92'])
    expect(gomel.quests).toHaveLength(2)

    expect(resolveQuestCitySegment('92', quests)).toMatchObject({
      cityId: '19',
      cityIds: ['19', '92'],
      alias: 'gomel',
      segment: 'gomel',
    })
  })

  it('deduplicates repeated catalog records by their public quest route', () => {
    const groups = buildQuestCityLandingGroups([...quests, quests[0]])
    const rome = groups.find((city: { segment: string }) => city.segment === 'rome')

    expect(rome.quests).toHaveLength(1)
  })

  it('derives nearby quest-city links from catalog coordinates', () => {
    const groups = buildQuestCityLandingGroups(quests)
    const rome = groups.find((city: { segment: string }) => city.segment === 'rome')
    const nearby = findNearbyQuestCityGroups(rome, groups, { limit: 4, maxDistanceKm: 400 })

    expect(nearby.map((city: { segment: string }) => city.segment)).toEqual(['naples'])
    expect(nearby[0].distanceKm).toBeGreaterThan(150)
    expect(nearby[0].distanceKm).toBeLessThan(250)
  })

  it('honors an explicit zero result limit', () => {
    const groups = buildQuestCityLandingGroups(quests)
    const rome = groups.find((city: { segment: string }) => city.segment === 'rome')

    expect(findNearbyQuestCityGroups(rome, groups, { limit: 0 })).toEqual([])
  })
})
