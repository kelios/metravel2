import {
  computeTravelEngagementSummary,
  extractTravelEngagementStats,
  hasAnyTravelEngagementStats,
} from '@/utils/travelEngagementStats'

describe('travelEngagementStats', () => {
  it('extracts stats from nested backend-friendly fields', () => {
    const stats = extractTravelEngagementStats({
      engagement_summary: {
        favorites_count: 12,
        wishlist_count: '5',
        planned_count: 3,
      },
    })

    expect(stats).toEqual({
      favoritesCount: 12,
      wishlistCount: 5,
      plannedCount: 3,
    })
  })

  it('returns null when no supported counters are present', () => {
    expect(extractTravelEngagementStats({ count: 10, results: [] })).toBeNull()
  })

  it('builds exact totals only for metrics that are available on every travel', () => {
    const summary = computeTravelEngagementSummary([
      {
        engagementStats: {
          favoritesCount: 4,
          wishlistCount: 2,
          plannedCount: 1,
        },
      },
      {
        engagementStats: {
          favoritesCount: 3,
          wishlistCount: null,
          plannedCount: 2,
        },
      },
    ])

    expect(summary).toEqual({
      favoritesCount: 7,
      wishlistCount: null,
      plannedCount: 3,
    })
    expect(hasAnyTravelEngagementStats(summary)).toBe(true)
  })
})

