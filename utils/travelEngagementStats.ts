import type { Travel } from '@/types/types'

export type TravelEngagementStats = {
  favoritesCount: number | null
  wishlistCount: number | null
  visitedCount: number | null
  plannedCount: number | null
}

const FAVORITES_KEYS = [
  'favoritesCount',
  'favorites_count',
  'favoriteCount',
  'favorite_count',
  'savedCount',
  'saved_count',
  'savedToFavoritesCount',
  'saved_to_favorites_count',
  'favoritedCount',
  'favorited_count',
  'bookmarksCount',
  'bookmarks_count',
]

const WISHLIST_KEYS = [
  'wishlistCount',
  'wishlist_count',
  'wantToGoCount',
  'want_to_go_count',
  'wantCount',
  'want_count',
]

const VISITED_KEYS = [
  'visitedCount',
  'visited_count',
  'beenCount',
  'been_count',
  'visitedUsersCount',
  'visited_users_count',
  'visitedTravelersCount',
  'visited_travelers_count',
]

const PLANNED_KEYS = [
  'plannedCount',
  'planned_count',
  'plannedTripsCount',
  'planned_trips_count',
  'planCount',
  'plan_count',
]

const NESTED_STATS_KEYS = [
  'engagementStats',
  'engagementSummary',
  'engagement_stats',
  'engagement_summary',
  'engagement',
  'summary',
  'travelStats',
  'travel_stats',
  'authorStats',
  'author_stats',
  'socialStats',
  'social_stats',
]

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const toNonNegativeNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

const pickFirstNumber = (source: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = toNonNegativeNumber(source[key])
    if (value !== null) return value
  }

  return null
}

const getStatsCandidates = (value: unknown): Record<string, unknown>[] => {
  const source = asRecord(value)
  const meta = asRecord(source.meta)

  return [
    source,
    ...NESTED_STATS_KEYS.map((key) => asRecord(source[key])),
    meta,
    ...NESTED_STATS_KEYS.map((key) => asRecord(meta[key])),
  ]
}

export const hasAnyTravelEngagementStats = (
  stats: TravelEngagementStats | null | undefined
): stats is TravelEngagementStats =>
  !!stats &&
  (stats.favoritesCount !== null ||
    stats.wishlistCount !== null ||
    stats.visitedCount !== null ||
    stats.plannedCount !== null)

export const extractTravelEngagementStats = (
  value: unknown
): TravelEngagementStats | null => {
  let favoritesCount: number | null = null
  let wishlistCount: number | null = null
  let visitedCount: number | null = null
  let plannedCount: number | null = null

  for (const candidate of getStatsCandidates(value)) {
    if (favoritesCount === null) {
      favoritesCount = pickFirstNumber(candidate, FAVORITES_KEYS)
    }
    if (wishlistCount === null) {
      wishlistCount = pickFirstNumber(candidate, WISHLIST_KEYS)
    }
    if (visitedCount === null) {
      visitedCount = pickFirstNumber(candidate, VISITED_KEYS)
    }
    if (plannedCount === null) {
      plannedCount = pickFirstNumber(candidate, PLANNED_KEYS)
    }
  }

  const stats: TravelEngagementStats = {
    favoritesCount,
    wishlistCount,
    visitedCount,
    plannedCount,
  }

  return hasAnyTravelEngagementStats(stats) ? stats : null
}

export const attachTravelEngagementStats = <T extends Travel>(
  travel: T,
  value: unknown
): T => {
  const engagementStats = extractTravelEngagementStats(value)
  if (!engagementStats) return travel

  return {
    ...travel,
    engagementStats,
  }
}

export const computeTravelEngagementSummary = (
  travels: Array<Pick<Travel, 'engagementStats'>>
): TravelEngagementStats | null => {
  let favoritesTotal = 0
  let wishlistTotal = 0
  let visitedTotal = 0
  let plannedTotal = 0

  let hasFavoritesTotal = travels.length > 0
  let hasWishlistTotal = travels.length > 0
  let hasVisitedTotal = travels.length > 0
  let hasPlannedTotal = travels.length > 0

  for (const travel of travels) {
    const stats = travel.engagementStats

    if (stats?.favoritesCount === null || !stats) {
      hasFavoritesTotal = false
    } else {
      favoritesTotal += stats.favoritesCount
    }

    if (stats?.wishlistCount === null || !stats) {
      hasWishlistTotal = false
    } else {
      wishlistTotal += stats.wishlistCount
    }

    if (stats?.visitedCount === null || !stats) {
      hasVisitedTotal = false
    } else {
      visitedTotal += stats.visitedCount
    }

    if (stats?.plannedCount === null || !stats) {
      hasPlannedTotal = false
    } else {
      plannedTotal += stats.plannedCount
    }
  }

  const summary: TravelEngagementStats = {
    favoritesCount: hasFavoritesTotal ? favoritesTotal : null,
    wishlistCount: hasWishlistTotal ? wishlistTotal : null,
    visitedCount: hasVisitedTotal ? visitedTotal : null,
    plannedCount: hasPlannedTotal ? plannedTotal : null,
  }

  return hasAnyTravelEngagementStats(summary) ? summary : null
}
