import {
  resolveTravelQuestTeaser,
  TRAVEL_QUEST_MATCH_LIMIT,
  TRAVEL_QUEST_TEASER_SOURCE,
  type TravelQuestTeaserRow,
} from '@/components/travel/details/sections/travelQuestTeaser'

const row = (overrides: Partial<TravelQuestTeaserRow> = {}): TravelQuestTeaserRow => ({
  quest_id: 'grodno-royal',
  city_id: '11',
  city_name: 'Гродно',
  city_alias: 'grodno',
  ...overrides,
})

describe('resolveTravelQuestTeaser (#3221)', () => {
  it('counts the quests of the nearest city and leads to the city page', () => {
    const teaser = resolveTravelQuestTeaser([
      row(),
      row({ quest_id: 'grodno-castles' }),
      row({ quest_id: 'grodno-legends' }),
      row({ quest_id: 'druskininkai-walk', city_id: '40', city_name: 'Друскининкай', city_alias: 'druskininkai' }),
    ])

    expect(teaser).toEqual({ cityName: 'Гродно', cityId: '11', count: 3, exact: true, href: '/quests/grodno' })
  })

  it('leads straight to the quest when the city has a single one', () => {
    expect(resolveTravelQuestTeaser([row()])).toEqual({
      cityName: 'Гродно', cityId: '11', count: 1, exact: true, href: '/quests/11/grodno-royal', questId: 'grodno-royal',
    })
  })

  it('never links to a numeric city address: without an alias it opens the nearest quest', () => {
    const teaser = resolveTravelQuestTeaser([row({ city_alias: undefined }), row({ quest_id: 'grodno-castles', city_alias: undefined })])

    expect(teaser).toMatchObject({ count: 2, href: '/quests/11/grodno-royal', questId: 'grodno-royal' })
  })

  // #3327: Гродно на проде — 8 квестов, а в подбор статьи попадает не больше шести.
  it('states the exact city total from city_quest_count even when the selection is full', () => {
    const full = Array.from({ length: TRAVEL_QUEST_MATCH_LIMIT }, (_, index) => row({ quest_id: `grodno-${index}`, city_quest_count: 8 }))
    expect(resolveTravelQuestTeaser(full)).toEqual({ cityName: 'Гродно', cityId: '11', count: 8, exact: true, href: '/quests/grodno' })
  })

  it('leads to the city page when the city has more quests than reached the selection', () => {
    expect(resolveTravelQuestTeaser([row({ city_quest_count: 3 })])).toEqual({
      cityName: 'Гродно', cityId: '11', count: 3, exact: true, href: '/quests/grodno',
    })
  })

  it('ignores a city total below the rows already in the selection', () => {
    expect(resolveTravelQuestTeaser([row({ city_quest_count: 1 }), row({ quest_id: 'grodno-castles', city_quest_count: 1 })]))
      .toMatchObject({ count: 2, exact: true })
  })

  it('does not state a number once the selection is full: the city may have more quests', () => {
    const full = Array.from({ length: TRAVEL_QUEST_MATCH_LIMIT }, (_, index) => row({ quest_id: `grodno-${index}` }))

    expect(resolveTravelQuestTeaser(full)).toMatchObject({ count: TRAVEL_QUEST_MATCH_LIMIT, exact: false, href: '/quests/grodno' })
  })

  it('prefers the localized city name', () => {
    expect(resolveTravelQuestTeaser([row({ city_name_localized: 'Hrodna' })])?.cityName).toBe('Hrodna')
  })

  it('gives no teaser for an article without quests or without a city name', () => {
    expect(resolveTravelQuestTeaser([])).toBeNull()
    expect(resolveTravelQuestTeaser([row({ city_name: '  ' })])).toBeNull()
  })

  it('reports its own analytics source, distinct from the full block below the text', () => {
    expect(TRAVEL_QUEST_TEASER_SOURCE).toBe('travel_detail_top')
    expect(TRAVEL_QUEST_TEASER_SOURCE).not.toBe('travel_detail')
  })
})
