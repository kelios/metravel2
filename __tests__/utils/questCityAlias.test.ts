const {
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  questRouteVariants,
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

// #1931: a city whose own name is two words ("Кутна-Гора") used to publish only
// the first quest_id token, so /quests/kutna claimed a city called «Кутна».
describe('quest city alias for multi-word city names', () => {
  const twoWordCityQuest = {
    quest_id: 'kutna-hora-silver',
    city_id: '140',
    city_name: 'Кутна-Гора',
    country_code: 'cz',
    lat: 49.95,
    lng: 15.27,
  }

  it('keeps every word of the city name in the alias', () => {
    expect(buildQuestCityAliasMap([twoWordCityQuest]).get('140')).toBe('kutna-hora')
  })

  it('keeps the already indexed short alias resolvable, with the full one canonical', () => {
    const group = buildQuestCityLandingGroups([twoWordCityQuest])[0]

    expect(group).toMatchObject({ segment: 'kutna-hora', legacyAliases: ['kutna'] })
    expect(resolveQuestCitySegment('kutna', [twoWordCityQuest])).toMatchObject({
      cityId: '140',
      segment: 'kutna-hora',
    })
    expect(questRouteVariants(twoWordCityQuest, buildQuestCityAliasMap([twoWordCityQuest]))
      .map((variant: { path: string }) => variant.path)).toEqual([
      '/quests/140/kutna-hora-silver',
      '/quests/kutna-hora/kutna-hora-silver',
      '/quests/kutna/kutna-hora-silver',
    ])
  })

  it('leaves a one-word city on its single-token alias', () => {
    const quests = [
      { quest_id: 'rome-forum', city_id: '121', city_name: 'Рим' },
      { quest_id: 'minsk-cmok', city_id: '4', city_name: 'Минск' },
      { quest_id: 'minsk-loshitsa', city_id: '4', city_name: 'Минск' },
    ]
    const aliases = buildQuestCityAliasMap(quests)

    expect(aliases.get('121')).toBe('rome')
    expect(aliases.get('4')).toBe('minsk')
    expect(buildQuestCityLandingGroups(quests).map((city: { legacyAliases: string[] }) => city.legacyAliases))
      .toEqual([[], []])
  })

  it('does not read an abbreviation slug as the first word of the city name', () => {
    // «Санкт-Петербург» is two words, but `spb` spells neither of them — the
    // theme tokens must stay out of the alias however long the quest_id is.
    // `spb-dostoevsky-secrets` is the trap: 13 latin letters against the 14 of
    // the name pass the whole-name band, so only the lead token («spb» vs
    // «Санкт») tells the abbreviation from a spelling.
    const quests = [
      { quest_id: 'spb-guardians', city_id: '58', city_name: 'Санкт-Петербург' },
      { quest_id: 'spb-dostoevsky-secrets', city_id: '59', city_name: 'Санкт-Петербург' },
      { quest_id: 'nn-kremlin-tour', city_id: '60', city_name: 'Нижний Новгород' },
    ]
    const aliases = buildQuestCityAliasMap(quests)

    expect(aliases.get('58')).toBe('spb')
    expect(aliases.get('59')).toBe('spb')
    expect(aliases.get('60')).toBe('nn')
  })

  it('does not extend a landmark named after the nearest town', () => {
    // The record is «Голубая криница», the quest_id is built from Slavgorod
    // next door, so its second token is quest theme, not city name.
    const quest = {
      quest_id: 'slavgorod-blue-krinica',
      city_id: '66',
      city_name: 'Голубая криница (Славгородский район)',
    }

    expect(buildQuestCityAliasMap([quest]).get('66')).toBe('slavgorod')
  })
})
