import {
  buildTravelQueryParams,
  mapCategoryNamesToIds,
} from '@/src/utils/filterQuery'

describe('buildTravelQueryParams', () => {
  it('adds default publish/moderation for public listings', () => {
    const params = buildTravelQueryParams({}, {})
    expect(params).toEqual({ moderation: 1, publish: 1 })
  })

  it('normalizes numeric arrays by trimming, deduping and sorting', () => {
    const params = buildTravelQueryParams(
      {
        countries: ['20', '3', 20, ' 3 '],
      },
      {},
    )

    expect(params.countries).toEqual([3, 20])
  })

  it('removes publish/moderation overrides for personal areas', () => {
    const params = buildTravelQueryParams(
      {},
      { isMeTravel: true, userId: '42' },
    )

    expect(params).toEqual({ user_id: '42' })
  })

  it('forces Belarus filter for travelsby page', () => {
    const params = buildTravelQueryParams(
      { countries: [1, 2, 4] },
      { isTravelBy: true, belarusId: 3 },
    )

    expect(params.countries).toEqual([3])
  })

  it('keeps explicit moderation filter without overriding publish', () => {
    const params = buildTravelQueryParams({ moderation: 0 }, {})
    expect(params).toEqual({ moderation: 0 })
  })
})

describe('mapCategoryNamesToIds', () => {
  it('maps names ignoring case and removes duplicates', () => {
    const ids = mapCategoryNamesToIds(
      ['Trail', 'trail', 'Hike'],
      [
        { id: 5, name: 'Trail' },
        { id: 9, name: 'Hike' },
      ],
    )

    expect(ids).toEqual([5, 9])
  })
})
