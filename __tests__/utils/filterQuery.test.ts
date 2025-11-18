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
})

