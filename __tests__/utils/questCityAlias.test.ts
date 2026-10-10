const {
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  questRouteVariants,
  resolveQuestCitySegment,
  normalizeQuestCityLegacyIds,
} = require('@/utils/questCityAlias')

describe('retired quest city IDs', () => {
  const quests = [
    { quest_id: 'gomel-palace', city_id: '19', city_alias: 'gomel', city_legacy_ids: [92] },
    { quest_id: 'gomel-kids-lost-playbill', city_id: '19', city_alias: 'gomel', city_legacy_ids: [92] },
    { quest_id: 'grodno-royal', city_id: '11', city_alias: 'grodno', city_legacy_ids: [91] },
    { quest_id: 'grodno-kids-zveri', city_id: '11', city_alias: 'grodno', city_legacy_ids: [91] },
    { quest_id: 'krakow-dragon', city_id: '1', city_alias: 'krakow' },
  ]

  it.each([['92', '19', 'gomel'], ['91', '11', 'grodno']])(
    'resolves retired %s to the complete canonical city %s', (legacy, canonical, alias) => {
      expect(resolveQuestCitySegment(legacy, quests)).toEqual(resolveQuestCitySegment(canonical, quests))
      expect(resolveQuestCitySegment(alias, quests)).toEqual(resolveQuestCitySegment(canonical, quests))
      const group = buildQuestCityLandingGroups([...quests, quests[0]])
        .find((city: { segment: string }) => city.segment === alias)
      expect(group.cityIds).toEqual([canonical])
      expect(group.legacyCityIds).toEqual([legacy])
      expect(group.quests).toHaveLength(2)
      for (const quest of group.quests) {
        expect(questRouteVariants(quest, buildQuestCityAliasMap(quests), buildQuestCityLandingGroups(quests)))
          .toContainEqual({ cityId: legacy, questId: quest.quest_id, path: `/quests/${legacy}/${quest.quest_id}` })
      }
    },
  )

  it('reads adapted metadata and preserves a DTO predating the fields', () => {
    const adapted = [{ id: 'gomel-palace', cityId: '19', cityAlias: 'gomel', cityLegacyIds: [92] }]
    expect(resolveQuestCitySegment('92', adapted)).toMatchObject({ cityId: '19', segment: 'gomel' })
    expect(resolveQuestCitySegment('1', quests)).toMatchObject({ cityId: '1', segment: 'krakow' })
    expect(buildQuestCityLandingGroups([quests[4]])[0].legacyCityIds).toEqual([])
  })

  it('rejects malformed IDs and removes duplicates', () => {
    expect(normalizeQuestCityLegacyIds([92, 92, 0, -1, 1.5, '91', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]))
      .toEqual([92])
    expect(normalizeQuestCityLegacyIds('92')).toEqual([])
    expect(normalizeQuestCityLegacyIds(undefined)).toEqual([])
  })

  it('gives live identities priority over stale legacy claims in resolver and SSG', () => {
    const catalog = [...quests, { quest_id: 'other-town', city_id: '92', city_alias: 'other' }]
    const groups = buildQuestCityLandingGroups(catalog)
    expect(resolveQuestCitySegment('92', catalog)).toMatchObject({ cityId: '92', segment: 'other' })
    expect(questRouteVariants(quests[0], buildQuestCityAliasMap(catalog), groups)
      .some((route: { cityId: string }) => route.cityId === '92')).toBe(false)
  })

  it('does not choose randomly when two cities claim the same retired ID', () => {
    expect(resolveQuestCitySegment('92', [quests[0], { ...quests[2], city_legacy_ids: [92] }])).toBeNull()
  })

  it('retains retired IDs even for cities whose explicit API alias is empty', () => {
    expect(resolveQuestCitySegment('92', [{ ...quests[0], city_alias: '' }]))
      .toMatchObject({ cityId: '19', segment: '19', alias: null })
  })
})

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

  it('reads a transliterated «-ий/-ый» adjective as the first word of the city name', () => {
    // «Великий» -> `veliky` loses a letter in the ending (6 against 7), which
    // is a spelling, not an abbreviation: the backend sitemap publishes
    // /quests/veliky-novgorod, and a shorter alias here stops the prod deploy
    // on the sitemap parity check (#2209).
    const quests = [
      { quest_id: 'veliky-novgorod-sadko', city_id: '184', city_name: 'Великий Новгород' },
      { quest_id: 'stary-oskol-fortress', city_id: '185', city_name: 'Старый Оскол' },
      { quest_id: 'novy-urengoy-gas', city_id: '186', city_name: 'Новый Уренгой' },
      { quest_id: 'nizhny-novgorod-kremlin', city_id: '187', city_name: 'Нижний Новгород' },
    ]
    const aliases = buildQuestCityAliasMap(quests)

    expect(aliases.get('184')).toBe('veliky-novgorod')
    expect(aliases.get('185')).toBe('stary-oskol')
    expect(aliases.get('186')).toBe('novy-urengoy')
    expect(aliases.get('187')).toBe('nizhny-novgorod')
    expect(resolveQuestCitySegment('veliky', quests)).toMatchObject({ segment: 'veliky-novgorod' })
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

// #2212: the catalog API publishes the city alias itself (#2211); the quest_id
// heuristic only covers records that predate the field.
describe('quest city alias from the catalog API field', () => {
  it('prefers the API alias over the quest_id heuristic', () => {
    // The heuristic would read `veliky` here (single quest, theme-only tail).
    const quests = [
      { quest_id: 'veliky-sadko', city_id: '184', city_name: 'Великий Новгород', city_alias: 'veliky-novgorod' },
    ]

    expect(buildQuestCityAliasMap(quests).get('184')).toBe('veliky-novgorod')
    expect(resolveQuestCitySegment('veliky-novgorod', quests)).toMatchObject({ cityId: '184' })
  })

  it('keeps the short legacy alias resolvable when it comes from the API field', () => {
    const quests = [
      { quest_id: 'kutna-hora-silver', city_id: '140', city_name: 'Кутна-Гора', city_alias: 'kutna-hora' },
    ]

    expect(resolveQuestCitySegment('kutna', quests)).toMatchObject({
      cityId: '140',
      segment: 'kutna-hora',
    })
  })

  it('treats an empty API alias as "no alias" instead of guessing one', () => {
    const quests = [{ quest_id: 'gomel-park', city_id: '19', city_name: 'Гомель', city_alias: '' }]

    expect(buildQuestCityAliasMap(quests).has('19')).toBe(false)
    expect(buildQuestCityLandingGroups(quests)[0]).toMatchObject({ segment: '19', alias: null })
  })

  it('falls back to the heuristic for records without the field', () => {
    const quests = [
      { quest_id: 'minsk-cmok', city_id: '4', city_name: 'Минск' },
      { quest_id: 'rome-forum', city_id: '121', city_name: 'Рим', city_alias: 'roma' },
    ]
    const aliases = buildQuestCityAliasMap(quests)

    expect(aliases.get('4')).toBe('minsk')
    expect(aliases.get('121')).toBe('roma')
  })

  it('lets the API alias win when one city mixes fresh and cached records', () => {
    const quests = [
      { quest_id: 'gomel-park', city_id: '19', city_name: 'Гомель' },
      { quest_id: 'gomel-river', city_id: '19', city_name: 'Гомель', city_alias: 'homel' },
    ]

    expect(buildQuestCityAliasMap(quests).get('19')).toBe('homel')
  })
})
