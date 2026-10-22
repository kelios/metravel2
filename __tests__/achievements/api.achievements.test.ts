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

jest.mock('@/i18n/format', () => ({ getActiveLocale: jest.fn(() => 'ru') }))

import { apiClient, ApiError } from '@/api/client'
import { getActiveLocale } from '@/i18n/format'
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
const mockGetActiveLocale = jest.mocked(getActiveLocale)
const locales = ['ru', 'be', 'uk', 'pl', 'en'] as const

beforeEach(() => {
  mockGetActiveLocale.mockReturnValue('ru')
})

describe('achievement mock fixtures', () => {
  it('keeps earned and locked sets stable when catalog-only badges are inserted', () => {
    expect(MOCK_MY_ACHIEVEMENTS.earned.map(({ badge }) => badge.id)).toEqual([
      1, 2, 3, 6, 8, 10,
    ])
    expect(MOCK_MY_ACHIEVEMENTS.locked.map(({ badge }) => badge.id)).toEqual([
      4, 5, 7, 9, 11,
    ])
    expect(MOCK_MY_ACHIEVEMENTS.recentlyEarned.map(({ badge }) => badge.id)).toEqual([
      10, 8, 6,
    ])
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

const badgeDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'test-badge',
  name: 'Test Badge',
  description: 'A test badge',
  category: { id: 1, slug: 'onboarding', name: 'Старт', order: 1, icon: null },
  tier: 'bronze',
  image_url: null,
  image_status: 'none',
  points: 10,
  is_secret: false,
  order: 1,
  ...overrides,
})

// rank_levels companion for typical cases (total_points=150 between level 1→3)
const rankLevels = [
  { level: 1, title: 'Новичок', min_points: 0 },
  { level: 2, title: 'Путешественник', min_points: 100 },
  { level: 3, title: 'Исследователь', min_points: 300 },
]

const rankDto = (overrides: Record<string, unknown> = {}) => ({
  level: 2,
  title: 'Путешественник',
  total_points: 150,
  badges_count: 3,
  recomputed_at: null,
  ...overrides,
})

const userBadgeDto = (overrides: Record<string, unknown> = {}) => ({
  // id (PK разблокировки) умышленно ≠ badge.id — это и есть achievement_id для share-card.
  id: 101,
  badge: badgeDto(),
  earned_at: '2025-10-01T12:00:00Z',
  period: null,
  progress_snapshot: null,
  ...overrides,
})

describe('#2697 achievement request locale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it.each(locales)('requests catalog, own and public descriptions in explicit %s', async (locale) => {
    // The explicit request locale wins even when the UI has already moved on.
    mockGetActiveLocale.mockReturnValue(locale === 'en' ? 'pl' : 'en')
    const badge = badgeDto({ description: `server-${locale}` })
    mockGet.mockResolvedValueOnce([badge])
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [userBadgeDto({ badge })] })
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [userBadgeDto({ badge })] })

    expect((await fetchBadgeCatalog(locale))[0].description).toBe(`server-${locale}`)
    expect((await fetchMyAchievements(locale)).earned[0].badge.description).toBe(`server-${locale}`)
    expect((await fetchUserAchievements(42, locale)).earned[0].badge.description).toBe(`server-${locale}`)

    expect(mockGet.mock.calls).toEqual([
      [`/achievements/badges/?lang=${locale}`],
      [`/achievements/me/?lang=${locale}`, 15000],
      [`/achievements/user/42/?lang=${locale}`, undefined, { skipAuth: true }],
    ])
  })

  it.each(locales)('defaults all reads to the applied %s locale', async (locale) => {
    mockGetActiveLocale.mockReturnValue(locale)
    mockGet.mockResolvedValueOnce([])
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })

    await fetchBadgeCatalog()
    await fetchMyAchievements()
    await fetchUserAchievements('public-user')

    expect(mockGet.mock.calls.map(([url]) => url)).toEqual([
      `/achievements/badges/?lang=${locale}`,
      `/achievements/me/?lang=${locale}`,
      `/achievements/user/public-user/?lang=${locale}`,
    ])
  })

  it('requests viewer-personalized author awards only with explicit authentication', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
      .mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
    await fetchUserAchievements(42, 'pl', { authenticated: true })
    await fetchUserAchievements(42, 'en', { authenticated: false })
    expect(mockGet.mock.calls).toEqual([
      ['/achievements/user/42/?lang=pl', undefined, { skipAuth: false }],
      ['/achievements/user/42/?lang=en', undefined, { skipAuth: true }],
    ])
  })

  it('captures the default locale at request start while another locale becomes active', async () => {
    let resolveCatalog!: (value: unknown) => void
    mockGetActiveLocale.mockReturnValue('pl')
    mockGet.mockReturnValueOnce(new Promise((resolve) => { resolveCatalog = resolve }))

    const pending = fetchBadgeCatalog()
    mockGetActiveLocale.mockReturnValue('en')
    mockGet.mockResolvedValueOnce([badgeDto({ description: 'English response' })])
    const current = await fetchBadgeCatalog()
    resolveCatalog([badgeDto({ description: 'Polska odpowiedź' })])

    expect(current[0].description).toBe('English response')
    expect((await pending)[0].description).toBe('Polska odpowiedź')
    expect(mockGet.mock.calls.map(([url]) => url)).toEqual([
      '/achievements/badges/?lang=pl',
      '/achievements/badges/?lang=en',
    ])
  })

  it('preserves server Russian fallback descriptions for a non-Russian request', async () => {
    const description = 'Серверное описание без перевода'
    const badge = badgeDto({ description })
    mockGet.mockResolvedValueOnce([badge])
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [userBadgeDto({ badge })] })
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [userBadgeDto({ badge })] })

    expect((await fetchBadgeCatalog('pl'))[0].description).toBe(description)
    expect((await fetchMyAchievements('pl')).earned[0].badge.description).toBe(description)
    expect((await fetchUserAchievements(42, 'pl')).earned[0].badge.description).toBe(description)
  })
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
    // category is now a nested object in the DTO
    expect(b.categorySlug).toBe('onboarding')
    expect(b.categoryName).toBe('Старт')
    expect(b.tier).toBe('bronze')
    expect(b.imageUrl).toBeNull()
    expect(b.points).toBe(10)
    expect(b.isSecret).toBe(false)
    expect(b.order).toBe(1)
    // No snake_case leaking
    expect((b as any).category).toBeUndefined()
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

  it('normalizes empty string image_url to null', async () => {
    mockGet.mockResolvedValueOnce([badgeDto({ image_url: '' })])
    const [b] = await fetchBadgeCatalog()
    expect(b.imageUrl).toBeNull()
  })

  it('maps extended badge fields (image_status/award_type/target/category id+icon)', async () => {
    mockGet.mockResolvedValueOnce([
      badgeDto({
        image_status: 'ready',
        award_type: 'peer',
        target: 'travel',
        category: { id: 7, slug: 'community', name: 'Сообщество', order: 2, icon: 'users' },
      }),
    ])
    const [b] = await fetchBadgeCatalog()
    expect(b.imageStatus).toBe('ready')
    expect(b.awardType).toBe('peer')
    expect(b.target).toBe('travel')
    expect(b.categoryId).toBe(7)
    expect(b.categoryIcon).toBe('users')
  })

  it('defaults extended badge fields to null when absent', async () => {
    mockGet.mockResolvedValueOnce([{ id: 3, slug: 's', name: 'N' }])
    const [b] = await fetchBadgeCatalog()
    expect(b.imageStatus).toBeNull()
    expect(b.awardType).toBeNull()
    expect(b.target).toBeNull()
    expect(b.categoryId).toBeNull()
    expect(b.categoryIcon).toBeNull()
  })

  it('preserves non-empty image_url', async () => {
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
    // New contract: earned_badges / progress / rank_levels (no flat thresholds on rank)
    const dto = {
      rank: rankDto(), // total_points=150
      rank_levels: rankLevels, // [0,100,300] → current=100, next=300, title='Исследователь'
      earned_badges: [userBadgeDto()],
      progress: [
        {
          badge: badgeDto({ id: 2, slug: 'second', name: 'Second' }),
          current: 5,
          threshold: 15,
          period: null,
        },
      ],
      recently_earned: [userBadgeDto()],
    }
    mockGet.mockResolvedValueOnce(dto)

    const my = await fetchMyAchievements()

    // rank — thresholds computed from rank_levels
    expect(my.rank.level).toBe(2)
    expect(my.rank.title).toBe('Путешественник')
    expect(my.rank.totalPoints).toBe(150)
    expect(my.rank.badgesCount).toBe(3)
    expect(my.rank.currentLevelMinPoints).toBe(100)
    expect(my.rank.nextLevelMinPoints).toBe(300)
    expect(my.rank.nextLevelTitle).toBe('Исследователь')
    expect(my.rank.isMaxLevel).toBe(false)

    // earned
    expect(my.earned).toHaveLength(1)
    expect(my.earned[0].badge.name).toBe('Test Badge')
    expect(my.earned[0].earnedAt).toBe('2025-10-01T12:00:00Z')
    // UserBadge.id (PK разблокировки) проходит маппинг и НЕ совпадает с badge.id.
    expect(my.earned[0].id).toBe(101)
    expect(my.earned[0].id).not.toBe(my.earned[0].badge.id)

    // locked (from progress)
    expect(my.locked).toHaveLength(1)
    expect(my.locked[0].current).toBe(5)
    expect(my.locked[0].threshold).toBe(15)

    // recentlyEarned
    expect(my.recentlyEarned).toHaveLength(1)
  })

  it('maps top-level activity_types with arbitrary metrics', async () => {
    const dto = {
      rank: rankDto(),
      earned_badges: [],
      progress: [],
      activity_types: [
        {
          type: 'explorer',
          label: 'Исследователь',
          score: 320,
          level: 3,
          next_threshold: 500,
          progress_percent: 64,
          metrics: { places: 42, countries: 7 },
        },
      ],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    expect(my.activityTypes).toHaveLength(1)
    const a = my.activityTypes[0]
    expect(a.type).toBe('explorer')
    expect(a.label).toBe('Исследователь')
    expect(a.score).toBe(320)
    expect(a.nextThreshold).toBe(500)
    expect(a.progressPercent).toBe(64)
    expect(a.metrics.places).toBe(42)
    expect(a.metrics.countries).toBe(7)
  })

  it('activityTypes defaults to empty array when absent', async () => {
    mockGet.mockResolvedValueOnce({ rank: {}, earned_badges: [], progress: [] })
    const my = await fetchMyAchievements()
    expect(my.activityTypes).toEqual([])
  })

  it('maps top-level rare_awards; null when field absent', async () => {
    mockGet.mockResolvedValueOnce({
      rank: {},
      earned_badges: [],
      progress: [],
      rare_awards: [
        { id: 901, slug: 'first-wave', category: 'first-wave', title: 'Первая волна', level: 'legendary' },
      ],
    })
    const withRare = await fetchMyAchievements()
    expect(withRare.rareAwards).toHaveLength(1)
    expect(withRare.rareAwards![0].slug).toBe('first-wave')

    mockGet.mockResolvedValueOnce({ rank: {}, earned_badges: [], progress: [] })
    const withoutRare = await fetchMyAchievements()
    // null (not []) distinguishes "field absent" so the hook can do a fallback fetch.
    expect(withoutRare.rareAwards).toBeNull()
  })

  it('passes through consolidated character/progression_lines DTOs; null when absent', async () => {
    mockGet.mockResolvedValueOnce({
      rank: {},
      earned_badges: [],
      progress: [],
      character: { user_id: 1 },
      progression_lines: [],
    })
    const seeded = await fetchMyAchievements()
    expect(seeded.characterDto).toEqual({ user_id: 1 })
    expect(seeded.progressionDto).toEqual([])

    mockGet.mockResolvedValueOnce({ rank: {}, earned_badges: [], progress: [] })
    const bare = await fetchMyAchievements()
    expect(bare.characterDto).toBeNull()
    expect(bare.progressionDto).toBeNull()
  })

  it('maps earned badge period/discovery', async () => {
    mockGet.mockResolvedValueOnce({
      rank: {},
      earned_badges: [userBadgeDto({ period: 'summer-2026', discovery: 'first' })],
      progress: [],
    })
    const my = await fetchMyAchievements()
    expect(my.earned[0].period).toBe('summer-2026')
    expect(my.earned[0].discovery).toBe('first')
  })

  it('reads server rank-progress summary directly (canonical #721 path)', async () => {
    // Buggy rank_levels intentionally present but MUST be ignored when summary fields exist.
    const dto = {
      rank: rankDto({
        total_points: 15,
        current_level_min_points: 0,
        next_level_min_points: 50,
        next_level_title: 'Путешественник',
        is_max_level: false,
        progress_ratio: 0.3,
        remaining_points: 35,
      }),
      rank_levels: [{ level: 99, title: 'WRONG', min_points: 999999 }],
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()

    expect(my.rank.currentLevelMinPoints).toBe(0)
    expect(my.rank.nextLevelMinPoints).toBe(50)
    expect(my.rank.nextLevelTitle).toBe('Путешественник')
    expect(my.rank.isMaxLevel).toBe(false)
    expect(my.rank.progressRatio).toBe(0.3)
    expect(my.rank.remainingPoints).toBe(35)
    // legacy rank_levels must NOT leak in when summary is present
    expect(my.rank.nextLevelTitle).not.toBe('WRONG')
  })

  it('server max-level summary → ratio 1, remaining 0, thresholds from server', async () => {
    const dto = {
      rank: rankDto({
        total_points: 5000,
        current_level_min_points: 4000,
        next_level_min_points: null,
        next_level_title: null,
        is_max_level: true,
        progress_ratio: 1,
        remaining_points: 0,
      }),
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    expect(my.rank.isMaxLevel).toBe(true)
    expect(my.rank.nextLevelMinPoints).toBeNull()
    expect(my.rank.progressRatio).toBe(1)
    expect(my.rank.remainingPoints).toBe(0)
  })

  it('server summary present but ratio/remaining omitted → derived from is_max_level', async () => {
    // Defensive: summary thresholds present, progress fields absent (partial rollout).
    const dto = {
      rank: rankDto({
        current_level_min_points: 0,
        next_level_min_points: 50,
        is_max_level: false,
        // progress_ratio / remaining_points intentionally omitted
      }),
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    // progressRatio/remainingPoints null → RankBar falls back to client compute
    expect(my.rank.progressRatio).toBeNull()
    expect(my.rank.remainingPoints).toBeNull()
    expect(my.rank.nextLevelMinPoints).toBe(50)
  })

  it('legacy fallback: no summary fields → computes thresholds from rank_levels, null progress', async () => {
    const dto = {
      rank: rankDto(), // total_points=150, no summary fields
      rank_levels: rankLevels, // [0,100,300] → current=100, next=300
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    expect(my.rank.currentLevelMinPoints).toBe(100)
    expect(my.rank.nextLevelMinPoints).toBe(300)
    expect(my.rank.nextLevelTitle).toBe('Исследователь')
    expect(my.rank.isMaxLevel).toBe(false)
    // legacy path leaves progress null → RankBar computes it
    expect(my.rank.progressRatio).toBeNull()
    expect(my.rank.remainingPoints).toBeNull()
  })

  it('isMaxLevel true when total_points >= last rank_level min_points', async () => {
    const dto = {
      rank: rankDto({ total_points: 500 }), // exceeds max level 300
      rank_levels: rankLevels,
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    expect(my.rank.isMaxLevel).toBe(true)
    expect(my.rank.nextLevelMinPoints).toBeNull()
    expect(my.rank.nextLevelTitle).toBeNull()
  })

  it('isMaxLevel false and thresholds null when rank_levels is empty', async () => {
    const dto = {
      rank: rankDto(),
      rank_levels: [],
      earned_badges: [],
      progress: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const my = await fetchMyAchievements()
    expect(my.rank.isMaxLevel).toBe(false)
    expect(my.rank.nextLevelMinPoints).toBeNull()
    expect(my.rank.currentLevelMinPoints).toBe(0)
  })

  it('applies rank defaults when fields are null (no rank_levels)', async () => {
    mockGet.mockResolvedValueOnce({
      rank: {},
      earned_badges: [],
      progress: [],
    })
    const my = await fetchMyAchievements()

    expect(my.rank.level).toBe(1)
    expect(my.rank.title).toBe('Новичок')
    expect(my.rank.totalPoints).toBe(0)
    expect(my.rank.badgesCount).toBe(0)
    expect(my.rank.currentLevelMinPoints).toBe(0)
    expect(my.rank.nextLevelMinPoints).toBeNull()
    expect(my.rank.nextLevelTitle).toBeNull()
    expect(my.rank.isMaxLevel).toBe(false)
  })

  it('uses empty arrays when recently_earned is absent', async () => {
    mockGet.mockResolvedValueOnce({ rank: {}, earned_badges: [], progress: [] })
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
    // New contract: earned_badges (no rank_levels on public endpoint)
    const dto = {
      rank: rankDto(),
      earned_badges: [userBadgeDto()],
    }
    mockGet.mockResolvedValueOnce(dto)

    const pub = await fetchUserAchievements(42)

    expect(pub.rank.level).toBe(2)
    // No rank_levels → isMaxLevel false, thresholds null (unknown mode)
    expect(pub.rank.isMaxLevel).toBe(false)
    expect(pub.rank.nextLevelMinPoints).toBeNull()
    expect(pub.earned).toHaveLength(1)
    expect(pub.earned[0].badge.slug).toBe('test-badge')
  })

  it('seeds gamification from a single /user/{id}/ response (activity/rare/character/progression)', async () => {
    const dto = {
      rank: rankDto(),
      earned_badges: [],
      activity_types: [
        { type: 'author', label: 'Автор', score: 180, level: 2, metrics: { travels: 12 } },
      ],
      rare_awards: [
        { id: 902, slug: 'ambassador', category: 'ambassador', title: 'Амбассадор', level: 'platinum' },
      ],
      character: { user_id: 42 },
      progression_lines: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const pub = await fetchUserAchievements(42)
    expect(pub.activityTypes).toHaveLength(1)
    expect(pub.activityTypes[0].metrics.travels).toBe(12)
    expect(pub.rareAwards).toHaveLength(1)
    expect(pub.rareAwards![0].slug).toBe('ambassador')
    expect(pub.characterDto).toEqual({ user_id: 42 })
    expect(pub.progressionDto).toEqual([])
  })

  it('public consolidated fields null/empty when absent (fallback signal for hooks)', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
    const pub = await fetchUserAchievements(42)
    expect(pub.activityTypes).toEqual([])
    expect(pub.rareAwards).toBeNull()
    expect(pub.characterDto).toBeNull()
    expect(pub.progressionDto).toBeNull()
  })

  it('reads server rank-progress summary on public endpoint (#721)', async () => {
    // Public endpoint now also returns full rank summary → RankBar can show XP bar.
    const dto = {
      rank: rankDto({
        level: 5,
        title: 'Эксперт',
        total_points: 840,
        current_level_min_points: 700,
        next_level_min_points: 1200,
        next_level_title: 'Легенда',
        is_max_level: false,
        progress_ratio: 0.28,
        remaining_points: 360,
      }),
      earned_badges: [],
    }
    mockGet.mockResolvedValueOnce(dto)
    const pub = await fetchUserAchievements(7)
    expect(pub.rank.currentLevelMinPoints).toBe(700)
    expect(pub.rank.nextLevelMinPoints).toBe(1200)
    expect(pub.rank.progressRatio).toBe(0.28)
    expect(pub.rank.remainingPoints).toBe(360)
    expect(pub.rank.isMaxLevel).toBe(false)
  })

  it('passes userId in the request URL', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
    await fetchUserAchievements(99)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/99/?lang=ru',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce({ rank: rankDto(), earned_badges: [] })
    await fetchUserAchievements('abc')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/abc/?lang=ru',
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
