// __tests__/achievements/api.achievements.test.ts
// Unit tests for api/achievements.ts — mapper DTO→domain + mock-fallback logic.

// Ensure USE_MOCK flag is NOT set so we exercise real mapper path.
// Must be set before any imports that read process.env at module evaluation time.
delete process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message?: string) {
      super(message ?? String(status))
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

jest.mock('@/utils/logger', () => ({
  devWarn: jest.fn(),
  devLog: jest.fn(),
  devError: jest.fn(),
}))

import { apiClient, ApiError } from '@/api/client'
import {
  fetchBadgeCatalog,
  fetchMyAchievements,
  fetchUserAchievements,
} from '@/api/achievements'
import {
  MOCK_BADGES,
  MOCK_MY_ACHIEVEMENTS,
  MOCK_PUBLIC_ACHIEVEMENTS,
} from '@/api/achievementsMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>

// ── helpers ────────────────────────────────────────────────────────────────────

const badgeDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'test-badge',
  name: 'Test Badge',
  description: 'A test badge',
  category_slug: 'onboarding',
  category_name: 'Старт',
  tier: 'bronze',
  image_url: null,
  points: 10,
  is_secret: false,
  order: 1,
  ...overrides,
})

const rankDto = (overrides: Record<string, unknown> = {}) => ({
  level: 2,
  title: 'Путешественник',
  total_points: 150,
  badges_count: 3,
  current_level_min_points: 100,
  next_level_min_points: 300,
  next_level_title: 'Исследователь',
  ...overrides,
})

const userBadgeDto = (overrides: Record<string, unknown> = {}) => ({
  badge: badgeDto(),
  earned_at: '2025-10-01T12:00:00Z',
  ...overrides,
})

// ── fetchBadgeCatalog ──────────────────────────────────────────────────────────

describe('fetchBadgeCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps snake_case DTO to camelCase Badge domain objects', async () => {
    const dto = badgeDto()
    mockGet.mockResolvedValueOnce([dto])

    const badges = await fetchBadgeCatalog()

    expect(badges).toHaveLength(1)
    const b = badges[0]
    expect(b.id).toBe(1)
    expect(b.slug).toBe('test-badge')
    expect(b.name).toBe('Test Badge')
    expect(b.categorySlug).toBe('onboarding')
    expect(b.categoryName).toBe('Старт')
    expect(b.tier).toBe('bronze')
    expect(b.imageUrl).toBeNull()
    expect(b.points).toBe(10)
    expect(b.isSecret).toBe(false)
    expect(b.order).toBe(1)
    // No snake_case leaking
    expect((b as any).category_slug).toBeUndefined()
    expect((b as any).image_url).toBeUndefined()
  })

  it('normalizes unknown tier to "none"', async () => {
    mockGet.mockResolvedValueOnce([badgeDto({ tier: 'ultra_rare' })])
    const [b] = await fetchBadgeCatalog()
    expect(b.tier).toBe('none')
  })

  it('normalizes null tier to "none"', async () => {
    mockGet.mockResolvedValueOnce([badgeDto({ tier: null })])
    const [b] = await fetchBadgeCatalog()
    expect(b.tier).toBe('none')
  })

  it('accepts all valid tiers', async () => {
    const tiers = ['none', 'bronze', 'silver', 'gold', 'platinum', 'legendary'] as const
    for (const tier of tiers) {
      mockGet.mockResolvedValueOnce([badgeDto({ tier })])
      const [b] = await fetchBadgeCatalog()
      expect(b.tier).toBe(tier)
    }
  })

  it('uses defaults for absent optional fields', async () => {
    const minimal = { id: 5, slug: 'min', name: 'Min' }
    mockGet.mockResolvedValueOnce([minimal])
    const [b] = await fetchBadgeCatalog()

    expect(b.description).toBe('')
    expect(b.categorySlug).toBe('other')
    expect(b.categoryName).toBe('Достижения')
    expect(b.tier).toBe('none')
    expect(b.imageUrl).toBeNull()
    expect(b.points).toBe(0)
    expect(b.isSecret).toBe(false)
    expect(b.order).toBe(5) // falls back to id
  })

  it('preserves non-null image_url', async () => {
    mockGet.mockResolvedValueOnce([badgeDto({ image_url: 'https://s3.example.com/img.png' })])
    const [b] = await fetchBadgeCatalog()
    expect(b.imageUrl).toBe('https://s3.example.com/img.png')
  })

  it('returns empty array when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchBadgeCatalog()).toEqual([])
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchBadgeCatalog()
    expect(result).toBe(MOCK_BADGES)
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchBadgeCatalog()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    await expect(fetchBadgeCatalog()).rejects.toThrow('Network error')
  })
})

// ── fetchMyAchievements ────────────────────────────────────────────────────────

describe('fetchMyAchievements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps full MyAchievementsDto to domain type', async () => {
    const dto = {
      rank: rankDto(),
      earned: [userBadgeDto()],
      locked: [
        {
          badge: badgeDto({ id: 2, slug: 'second', name: 'Second' }),
          current: 5,
          threshold: 15,
        },
      ],
      recently_earned: [userBadgeDto()],
    }
    mockGet.mockResolvedValueOnce(dto)

    const my = await fetchMyAchievements()

    // rank
    expect(my.rank.level).toBe(2)
    expect(my.rank.title).toBe('Путешественник')
    expect(my.rank.totalPoints).toBe(150)
    expect(my.rank.badgesCount).toBe(3)
    expect(my.rank.currentLevelMinPoints).toBe(100)
    expect(my.rank.nextLevelMinPoints).toBe(300)
    expect(my.rank.nextLevelTitle).toBe('Исследователь')

    // earned
    expect(my.earned).toHaveLength(1)
    expect(my.earned[0].badge.name).toBe('Test Badge')
    expect(my.earned[0].earnedAt).toBe('2025-10-01T12:00:00Z')

    // locked
    expect(my.locked).toHaveLength(1)
    expect(my.locked[0].current).toBe(5)
    expect(my.locked[0].threshold).toBe(15)

    // recentlyEarned
    expect(my.recentlyEarned).toHaveLength(1)
  })

  it('applies rank defaults when fields are null', async () => {
    mockGet.mockResolvedValueOnce({
      rank: {},
      earned: [],
      locked: [],
    })
    const my = await fetchMyAchievements()

    expect(my.rank.level).toBe(1)
    expect(my.rank.title).toBe('Новичок')
    expect(my.rank.totalPoints).toBe(0)
    expect(my.rank.badgesCount).toBe(0)
    expect(my.rank.currentLevelMinPoints).toBe(0)
    expect(my.rank.nextLevelMinPoints).toBeNull()
    expect(my.rank.nextLevelTitle).toBeNull()
  })

  it('uses empty arrays when recently_earned is absent', async () => {
    mockGet.mockResolvedValueOnce({ rank: {}, earned: [], locked: [] })
    const my = await fetchMyAchievements()
    expect(my.recentlyEarned).toEqual([])
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchMyAchievements()
    expect(result).toBe(MOCK_MY_ACHIEVEMENTS)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const result = await fetchMyAchievements()
    expect(result).toBe(MOCK_MY_ACHIEVEMENTS)
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const result = await fetchMyAchievements()
    expect(result).toBe(MOCK_MY_ACHIEVEMENTS)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyAchievements()).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchUserAchievements ──────────────────────────────────────────────────────

describe('fetchUserAchievements', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps PublicAchievementsDto to domain type', async () => {
    const dto = {
      rank: rankDto(),
      earned: [userBadgeDto()],
    }
    mockGet.mockResolvedValueOnce(dto)

    const pub = await fetchUserAchievements(42)

    expect(pub.rank.level).toBe(2)
    expect(pub.earned).toHaveLength(1)
    expect(pub.earned[0].badge.slug).toBe('test-badge')
  })

  it('passes userId in the request URL', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned: [] })
    await fetchUserAchievements(99)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/99/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned: [] })
    await fetchUserAchievements('abc')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/abc/',
      undefined,
      expect.anything(),
    )
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchUserAchievements(1)
    expect(result).toBe(MOCK_PUBLIC_ACHIEVEMENTS)
  })

  it('re-throws ApiError(403) even in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(403))
    await expect(fetchUserAchievements(1)).rejects.toBeInstanceOf(ApiError)
  })
})
