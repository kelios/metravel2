const {
  ISO_ALPHA2_CODES,
  buildQuestCountryLandingGroups,
  getQuestCountryAlias,
  normalizeIsoCountryCode,
  questCountryLandingIsIndexable,
  resolveQuestCountryAlias,
} = require('@/utils/questCountryLanding')

describe('quest country landing groups', () => {
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
    {
      quest_id: 'gomel-river',
      city_id: '92',
      city_name: 'Гомель',
      country_code: 'by',
      country_name: 'Беларусь',
      title: 'Гомельская набережная',
    },
    {
      quest_id: 'krakow-wawel',
      city_id: '12',
      city_name: 'Краков',
      country_code: 'pl',
      country_name: 'Польша',
      title: 'Вавель',
    },
  ]

  it('uses stable human-readable aliases for the contract fixtures', () => {
    expect(getQuestCountryAlias('BY')).toBe('belarus')
    expect(getQuestCountryAlias('pl')).toBe('poland')
  })

  it('validates ISO alpha-2 without using the active catalog as an allowlist', () => {
    expect(normalizeIsoCountryCode(' nz ')).toBe('NZ')
    expect(getQuestCountryAlias('NZ')).toBe('new-zealand')
    expect(normalizeIsoCountryCode('ZZ')).toBeNull()
    expect(normalizeIsoCountryCode('BEL')).toBeNull()
  })

  it('provides one locale-neutral alias for every ISO alpha-2 country', () => {
    const aliases = Array.from(ISO_ALPHA2_CODES, (countryCode: string) => (
      getQuestCountryAlias(countryCode)
    ))

    expect(ISO_ALPHA2_CODES.size).toBe(249)
    expect(aliases).not.toContain(null)
    expect(new Set(aliases).size).toBe(249)
  })

  it('aggregates every unique quest and canonical logical city in a country', () => {
    const belarus = buildQuestCountryLandingGroups([...quests, quests[0]], { locale: 'en' })
      .find((country: { countryCode: string }) => country.countryCode === 'BY')

    expect(belarus).toMatchObject({
      countryAlias: 'belarus',
      countryName: 'Belarus',
    })
    expect(belarus.quests).toHaveLength(3)
    expect(belarus.cities.map((city: { cityAlias: string }) => city.cityAlias)).toEqual([
      'gomel',
      'minsk',
    ])
    expect(belarus.cities[0]).toMatchObject({
      cityAlias: 'gomel',
      cityIds: ['19', '92'],
      questCount: 2,
    })
  })

  it('buckets by country before merging equal city aliases', () => {
    const sameCityAlias = [
      { quest_id: 'springfield-us', city_id: '1', city_name: 'Springfield', country_code: 'US' },
      { quest_id: 'springfield-ca', city_id: '2', city_name: 'Springfield', country_code: 'CA' },
    ]
    const groups = buildQuestCountryLandingGroups(sameCityAlias, { locale: 'en' })

    expect(groups).toHaveLength(2)
    expect(groups.map((country: { quests: unknown[] }) => country.quests.length)).toEqual([1, 1])
  })

  // #1762: правило считается по каталогу, а не по списку стран — страна, у
  // которой появился второй город, обязана стать индексируемой сама.
  it('treats a country landing as indexable only from the second city on', () => {
    const groups = buildQuestCountryLandingGroups(quests)
    const belarus = groups.find((country: { countryAlias: string }) => country.countryAlias === 'belarus')
    const poland = groups.find((country: { countryAlias: string }) => country.countryAlias === 'poland')

    expect(belarus.cities.length).toBeGreaterThanOrEqual(2)
    expect(poland.cities).toHaveLength(1)
    expect(questCountryLandingIsIndexable(belarus)).toBe(true)
    expect(questCountryLandingIsIndexable(poland)).toBe(false)

    const grownPoland = buildQuestCountryLandingGroups([
      ...quests,
      {
        quest_id: 'gdansk-port',
        city_id: '77',
        city_name: 'Гданьск',
        country_code: 'pl',
        country_name: 'Польша',
        title: 'Гданьский порт',
      },
    ]).find((country: { countryAlias: string }) => country.countryAlias === 'poland')

    expect(grownPoland.cities).toHaveLength(2)
    expect(questCountryLandingIsIndexable(grownPoland)).toBe(true)
  })

  it('refuses a malformed country instead of guessing it is indexable', () => {
    expect(questCountryLandingIsIndexable(null)).toBe(false)
    expect(questCountryLandingIsIndexable(undefined)).toBe(false)
    expect(questCountryLandingIsIndexable({})).toBe(false)
    expect(questCountryLandingIsIndexable({ cities: 'belarus, poland' })).toBe(false)
  })

  it('skips missing or invalid country codes and never resolves an unknown alias', () => {
    const groups = buildQuestCountryLandingGroups([
      ...quests,
      { quest_id: 'unknown-one', city_id: '900', country_code: '' },
      { quest_id: 'unknown-two', city_id: '901', country_code: 'ZZ' },
    ])

    expect(groups).toHaveLength(2)
    expect(resolveQuestCountryAlias('belarus', quests)?.countryCode).toBe('BY')
    expect(resolveQuestCountryAlias('unknown', quests)).toBeNull()
  })
})
