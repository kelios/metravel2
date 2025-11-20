import {
  buildTravelQueryParams,
  mapCategoryNamesToIds,
} from '@/src/utils/filterQuery'

describe('filterQuery helpers', () => {
  it('normalizes base params with publish/moderation defaults', () => {
    const params = buildTravelQueryParams(
      { categories: ['1', '2'] },
      { userId: null }
    )

    expect(params).toEqual({
      categories: [1, 2],
      moderation: 1,
      publish: 1,
    })
  })

  it('uses moderation value from filter if provided', () => {
    const params = buildTravelQueryParams(
      { categories: ['1', '2'], moderation: 0 },
      { userId: null }
    )

    expect(params).toEqual({
      categories: [1, 2],
      moderation: 0,
    })
  })

  it('forces Belarus filter on travelsby pages and preserves user scope', () => {
    const params = buildTravelQueryParams(
      {},
      { isTravelBy: true, belarusId: 7, routeUserId: '55' }
    )

    expect(params).toEqual({ countries: [7], moderation: 1, publish: 1, user_id: '55' })
  })

  it('maps category names to ids case-insensitively', () => {
    const ids = mapCategoryNamesToIds(['ХАЙКИНГ', 'морЕ'], [
      { id: 10, name: 'хайкинг' },
      { id: 20, name: 'МОРЕ' },
    ])

    expect(ids).toEqual([10, 20])
  })

  describe('Year filter', () => {
    it('should include year in query params when provided', () => {
      const params = buildTravelQueryParams(
        { year: '2023' },
        { userId: null }
      )

      expect(params).toEqual({
        moderation: 1,
        publish: 1,
        year: '2023',
      })
    })

    it('should include year with other filters', () => {
      const params = buildTravelQueryParams(
        { year: '2021', countries: [1, 2], categories: ['hiking'] },
        { userId: null }
      )

      expect(params).toHaveProperty('year', '2021')
      expect(params).toHaveProperty('countries', [1, 2])
      expect(params).toHaveProperty('categories', ['hiking'])
    })

    it('should exclude year when empty string', () => {
      const params = buildTravelQueryParams(
        { year: '' },
        { userId: null }
      )

      expect(params).not.toHaveProperty('year')
      expect(params).toEqual({
        moderation: 1,
        publish: 1,
      })
    })

    it('should exclude year when undefined', () => {
      const params = buildTravelQueryParams(
        { year: undefined },
        { userId: null }
      )

      expect(params).not.toHaveProperty('year')
    })

    it('should handle year with numeric filters', () => {
      const params = buildTravelQueryParams(
        { year: '2022', countries: [3, 4], month: [6, 7] },
        { userId: null }
      )

      expect(params.year).toBe('2022')
      expect(params.countries).toEqual([3, 4])
      expect(params.month).toEqual([6, 7])
    })
  })
})

