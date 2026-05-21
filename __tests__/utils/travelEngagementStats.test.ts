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
        visited_count: '5',
        planned_count: 3,
      },
    })

    expect(stats).toEqual({
      favoritesCount: 12,
      wishlistCount: null,
      visitedCount: 5,
      plannedCount: 3,
    })
  })

  it('extracts stats when backend serializes engagement payload as JSON string', () => {
    const stats = extractTravelEngagementStats({
      engagement_summary: '{"favorites_count":4,"wishlist_count":2,"planned_count":1}',
    })

    expect(stats).toEqual({
      favoritesCount: 4,
      wishlistCount: 2,
      visitedCount: null,
      plannedCount: 1,
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
          visitedCount: 2,
          plannedCount: 1,
        },
      },
      {
        engagementStats: {
          favoritesCount: 3,
          wishlistCount: null,
          visitedCount: null,
          plannedCount: 2,
        },
      },
    ])

    expect(summary).toEqual({
      favoritesCount: 7,
      wishlistCount: null,
      visitedCount: null,
      plannedCount: 3,
    })
    expect(hasAnyTravelEngagementStats(summary)).toBe(true)
  })
})

