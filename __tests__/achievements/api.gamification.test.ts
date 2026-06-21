// __tests__/achievements/api.gamification.test.ts
// Unit tests for api/gamification.ts — DTO→domain mappers + mock-fallback logic.
// Coverage: fetchMyPlaceFirstBadges, fetchUserPlaceFirstBadges,
//           fetchMyGamificationProgress, fetchUserGamificationProgress,
//           fetchMyCharacter, fetchUserCharacter, chooseCharacterPath.

// Ensure USE_MOCK flag is NOT set so we exercise the real mapper path.
delete process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
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
  fetchMyPlaceFirstBadges,
  fetchUserPlaceFirstBadges,
  fetchMyGamificationProgress,
  fetchUserGamificationProgress,
  fetchMyCharacter,
  fetchUserCharacter,
  chooseCharacterPath,
} from '@/api/gamification'
import {
  MOCK_PLACE_FIRST_BADGES,
  MOCK_GAMIFICATION_PROGRESS,
  MOCK_CHARACTER_STATE,
} from '@/api/gamificationMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = (apiClient as any).post as jest.Mock

// ── DTO factories ──────────────────────────────────────────────────────────────

const placeFirstBadgeDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  place_id: 42,
  place_name: 'Тестовое место',
  place_url: '/places/42',
  discovered_at: '2026-01-15T10:00:00Z',
  views: 100,
  saves: 20,
  visits: 5,
  author_status: 'Первооткрыватель',
  image_url: 'https://cdn.example.com/img.png',
  tier: 'gold',
  is_fresh: true,
  ...overrides,
})

const progressionLineDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'dog',
  name: 'Собачья тропа',
  activity_kind: 'explorer',
  activity_name: 'Исследователь',
  level: 3,
  level_title: 'Следопыт',
  current: 47,
  current_level_min: 30,
  next_level_min: 70,
  next_level_title: 'Проводник',
  emoji: '🐕',
  ...overrides,
})

const characterDetailDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'collar',
  name: 'Ошейник проводника',
  unlocked: true,
  ...overrides,
})

const characterPathOptionDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'scout',
  name: 'Разведчик',
  description: 'Бонус за дальние вылазки',
  emoji: '🧭',
  ...overrides,
})

const characterStateDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Странник',
  level: 4,
  path_slug: 'scout',
  path_name: 'Разведчик',
  details: [characterDetailDto()],
  pending_choice: false,
  path_options: [characterPathOptionDto()],
  ...overrides,
})

// ── fetchMyPlaceFirstBadges ───────────────────────────────────────────────────

describe('fetchMyPlaceFirstBadges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps snake_case DTO to camelCase PlaceFirstBadge domain object', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto()])

    const badges = await fetchMyPlaceFirstBadges()

    expect(badges).toHaveLength(1)
    const b = badges[0]
    expect(b.id).toBe(1)
    expect(b.placeId).toBe(42)
    expect(b.placeName).toBe('Тестовое место')
    expect(b.placeUrl).toBe('/places/42')
    expect(b.discoveredAt).toBe('2026-01-15T10:00:00Z')
    expect(b.views).toBe(100)
    expect(b.saves).toBe(20)
    expect(b.visits).toBe(5)
    expect(b.authorStatus).toBe('Первооткрыватель')
    expect(b.imageUrl).toBe('https://cdn.example.com/img.png')
    expect(b.tier).toBe('gold')
    expect(b.isFresh).toBe(true)
    // No snake_case leaking
    expect((b as any).place_id).toBeUndefined()
    expect((b as any).discovered_at).toBeUndefined()
    expect((b as any).is_fresh).toBeUndefined()
  })

  it('defaults authorStatus to "Первооткрыватель" when absent', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ author_status: null })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.authorStatus).toBe('Первооткрыватель')
  })

  it('normalizes empty string image_url to null', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ image_url: '' })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.imageUrl).toBeNull()
  })

  it('normalizes null image_url to null', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ image_url: null })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.imageUrl).toBeNull()
  })

  it('coerces is_fresh null/undefined to false', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ is_fresh: null })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.isFresh).toBe(false)
  })

  it('coerces is_fresh 1 (truthy) to true', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ is_fresh: 1 })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.isFresh).toBe(true)
  })

  it('defaults views/saves/visits to 0 when absent', async () => {
    mockGet.mockResolvedValueOnce([
      placeFirstBadgeDto({ views: null, saves: null, visits: null }),
    ])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.views).toBe(0)
    expect(b.saves).toBe(0)
    expect(b.visits).toBe(0)
  })

  it('normalizes unknown tier to "gold" (place-badge default)', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ tier: 'ultra_rare' })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.tier).toBe('gold')
  })

  it('normalizes null tier to "gold"', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ tier: null })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.tier).toBe('gold')
  })

  it('accepts all valid tiers', async () => {
    const tiers = ['none', 'bronze', 'silver', 'gold', 'platinum', 'legendary'] as const
    for (const tier of tiers) {
      mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ tier })])
      const [b] = await fetchMyPlaceFirstBadges()
      expect(b.tier).toBe(tier)
    }
  })

  it('returns empty array when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchMyPlaceFirstBadges()).toEqual([])
  })

  it('normalizes null place_url to null', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto({ place_url: null })])
    const [b] = await fetchMyPlaceFirstBadges()
    expect(b.placeUrl).toBeNull()
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchMyPlaceFirstBadges()
    expect(result).toBe(MOCK_PLACE_FIRST_BADGES)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const result = await fetchMyPlaceFirstBadges()
    expect(result).toBe(MOCK_PLACE_FIRST_BADGES)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyPlaceFirstBadges()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyPlaceFirstBadges()).rejects.toBeInstanceOf(ApiError)
  })

  it('calls correct endpoint', async () => {
    mockGet.mockResolvedValueOnce([])
    await fetchMyPlaceFirstBadges()
    expect(mockGet).toHaveBeenCalledWith('/achievements/place-badges/me/')
  })
})

// ── fetchUserPlaceFirstBadges ─────────────────────────────────────────────────

describe('fetchUserPlaceFirstBadges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps DTO to domain object same as my-endpoint', async () => {
    mockGet.mockResolvedValueOnce([placeFirstBadgeDto()])
    const badges = await fetchUserPlaceFirstBadges(99)
    expect(badges).toHaveLength(1)
    expect(badges[0].placeId).toBe(42)
    expect(badges[0].discoveredAt).toBe('2026-01-15T10:00:00Z')
  })

  it('passes userId in the request URL', async () => {
    mockGet.mockResolvedValueOnce([])
    await fetchUserPlaceFirstBadges(99)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/place-badges/user/99/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce([])
    await fetchUserPlaceFirstBadges('alice')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/place-badges/user/alice/',
      undefined,
      expect.anything(),
    )
  })

  it('returns empty array when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchUserPlaceFirstBadges(7)).toEqual([])
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchUserPlaceFirstBadges(1)
    expect(result).toBe(MOCK_PLACE_FIRST_BADGES)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchUserPlaceFirstBadges(1)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchMyGamificationProgress ───────────────────────────────────────────────

describe('fetchMyGamificationProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps a full ProgressionLineDto to ProgressionLine domain object', async () => {
    mockGet.mockResolvedValueOnce({ lines: [progressionLineDto()] })

    const progress = await fetchMyGamificationProgress()

    expect(progress.lines).toHaveLength(1)
    const l = progress.lines[0]
    expect(l.slug).toBe('dog')
    expect(l.name).toBe('Собачья тропа')
    expect(l.activityKind).toBe('explorer')
    expect(l.activityName).toBe('Исследователь')
    expect(l.level).toBe(3)
    expect(l.levelTitle).toBe('Следопыт')
    expect(l.current).toBe(47)
    expect(l.currentLevelMin).toBe(30)
    expect(l.nextLevelMin).toBe(70)
    expect(l.nextLevelTitle).toBe('Проводник')
    expect(l.isMaxLevel).toBe(false)
    expect(l.emoji).toBe('🐕')
    // No snake_case leaking
    expect((l as any).activity_kind).toBeUndefined()
    expect((l as any).next_level_min).toBeUndefined()
  })

  it('normalizes unknown activity_kind to "explorer"', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ activity_kind: 'unknown_type' })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].activityKind).toBe('explorer')
  })

  it('normalizes null activity_kind to "explorer"', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ activity_kind: null })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].activityKind).toBe('explorer')
  })

  it('accepts all valid activity_kind values', async () => {
    const kinds = ['explorer', 'reader', 'author', 'participant'] as const
    for (const activity_kind of kinds) {
      mockGet.mockResolvedValueOnce({ lines: [progressionLineDto({ activity_kind })] })
      const { lines } = await fetchMyGamificationProgress()
      expect(lines[0].activityKind).toBe(activity_kind)
    }
  })

  it('normalizes unknown slug to "dog"', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ slug: 'cat' })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].slug).toBe('dog')
  })

  it('accepts all valid slug values', async () => {
    const slugs = ['dog', 'boar', 'fox', 'bird'] as const
    for (const slug of slugs) {
      mockGet.mockResolvedValueOnce({ lines: [progressionLineDto({ slug })] })
      const { lines } = await fetchMyGamificationProgress()
      expect(lines[0].slug).toBe(slug)
    }
  })

  it('sets isMaxLevel true when next_level_min is null', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ next_level_min: null, next_level_title: null })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].isMaxLevel).toBe(true)
    expect(lines[0].nextLevelMin).toBeNull()
    expect(lines[0].nextLevelTitle).toBeNull()
  })

  it('defaults level to 1 when absent', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ level: null })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].level).toBe(1)
  })

  it('defaults emoji to "🐾" when absent', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ emoji: null })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].emoji).toBe('🐾')
  })

  it('defaults current/currentLevelMin to 0 when absent', async () => {
    mockGet.mockResolvedValueOnce({
      lines: [progressionLineDto({ current: null, current_level_min: null })],
    })
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].current).toBe(0)
    expect(lines[0].currentLevelMin).toBe(0)
  })

  it('returns empty lines when lines is absent', async () => {
    mockGet.mockResolvedValueOnce({})
    const progress = await fetchMyGamificationProgress()
    expect(progress.lines).toEqual([])
  })

  it('returns empty lines when lines is empty array', async () => {
    mockGet.mockResolvedValueOnce({ lines: [] })
    const progress = await fetchMyGamificationProgress()
    expect(progress.lines).toEqual([])
  })

  it('calls correct endpoint', async () => {
    mockGet.mockResolvedValueOnce({ lines: [] })
    await fetchMyGamificationProgress()
    expect(mockGet).toHaveBeenCalledWith('/achievements/progression/me/')
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchMyGamificationProgress()
    expect(result).toBe(MOCK_GAMIFICATION_PROGRESS)
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const result = await fetchMyGamificationProgress()
    expect(result).toBe(MOCK_GAMIFICATION_PROGRESS)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyGamificationProgress()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyGamificationProgress()).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchUserGamificationProgress ─────────────────────────────────────────────

describe('fetchUserGamificationProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps DTO same as my-endpoint', async () => {
    mockGet.mockResolvedValueOnce({ lines: [progressionLineDto()] })
    const progress = await fetchUserGamificationProgress(55)
    expect(progress.lines).toHaveLength(1)
    expect(progress.lines[0].activityKind).toBe('explorer')
  })

  it('passes userId in the request URL with skipAuth', async () => {
    mockGet.mockResolvedValueOnce({ lines: [] })
    await fetchUserGamificationProgress(55)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/55/progression-lines/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce({ lines: [] })
    await fetchUserGamificationProgress('bob')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/bob/progression-lines/',
      undefined,
      expect.anything(),
    )
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchUserGamificationProgress(1)
    expect(result).toBe(MOCK_GAMIFICATION_PROGRESS)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchUserGamificationProgress(1)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchMyCharacter ──────────────────────────────────────────────────────────

describe('fetchMyCharacter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps CharacterStateDto to CharacterState domain object', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())

    const char = await fetchMyCharacter()

    expect(char.id).toBe(1)
    expect(char.name).toBe('Странник')
    expect(char.level).toBe(4)
    expect(char.pathSlug).toBe('scout')
    expect(char.pathName).toBe('Разведчик')
    expect(char.pendingChoice).toBe(false)
    expect(char.details).toHaveLength(1)
    expect(char.details[0].slug).toBe('collar')
    expect(char.details[0].name).toBe('Ошейник проводника')
    expect(char.details[0].unlocked).toBe(true)
    expect(char.pathOptions).toHaveLength(1)
    expect(char.pathOptions[0].slug).toBe('scout')
    expect(char.pathOptions[0].name).toBe('Разведчик')
    expect(char.pathOptions[0].description).toBe('Бонус за дальние вылазки')
    expect(char.pathOptions[0].emoji).toBe('🧭')
    // No snake_case leaking
    expect((char as any).path_slug).toBeUndefined()
    expect((char as any).pending_choice).toBeUndefined()
  })

  it('valid path_slug "scout" stays "scout"', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_slug: 'scout' }))
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBe('scout')
  })

  it('valid path_slug "cartographer" stays "cartographer"', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_slug: 'cartographer' }))
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBe('cartographer')
  })

  it('valid path_slug "photohunter" stays "photohunter"', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_slug: 'photohunter' }))
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBe('photohunter')
  })

  it('normalizes invalid path_slug to null', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_slug: 'unknown_path' }))
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBeNull()
  })

  it('normalizes null path_slug to null (not yet chosen)', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_slug: null }))
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBeNull()
  })

  it('coerces pending_choice null to false', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ pending_choice: null }))
    const char = await fetchMyCharacter()
    expect(char.pendingChoice).toBe(false)
  })

  it('coerces pending_choice 1 (truthy) to true', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ pending_choice: 1 }))
    const char = await fetchMyCharacter()
    expect(char.pendingChoice).toBe(true)
  })

  it('defaults level to 1 when absent', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ level: null }))
    const char = await fetchMyCharacter()
    expect(char.level).toBe(1)
  })

  it('returns empty details when details absent', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ details: undefined }))
    const char = await fetchMyCharacter()
    expect(char.details).toEqual([])
  })

  it('returns empty pathOptions when path_options absent', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ path_options: undefined }))
    const char = await fetchMyCharacter()
    expect(char.pathOptions).toEqual([])
  })

  it('normalizes invalid path option slug to "cartographer"', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        path_options: [characterPathOptionDto({ slug: 'totally_invalid' })],
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathOptions[0].slug).toBe('cartographer')
  })

  it('defaults path option emoji to "🧭" when absent', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        path_options: [characterPathOptionDto({ emoji: null })],
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathOptions[0].emoji).toBe('🧭')
  })

  it('defaults path option description to "" when absent', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        path_options: [characterPathOptionDto({ description: null })],
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathOptions[0].description).toBe('')
  })

  it('coerces detail.unlocked null to false', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        details: [characterDetailDto({ unlocked: null })],
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.details[0].unlocked).toBe(false)
  })

  it('calls correct endpoint', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())
    await fetchMyCharacter()
    expect(mockGet).toHaveBeenCalledWith('/achievements/character/me/')
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchMyCharacter()
    expect(result).toBe(MOCK_CHARACTER_STATE)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const result = await fetchMyCharacter()
    expect(result).toBe(MOCK_CHARACTER_STATE)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyCharacter()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchMyCharacter()).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchUserCharacter ────────────────────────────────────────────────────────

describe('fetchUserCharacter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps DTO same as my-endpoint', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())
    const char = await fetchUserCharacter(77)
    expect(char.id).toBe(1)
    expect(char.pathSlug).toBe('scout')
    expect(char.pendingChoice).toBe(false)
  })

  it('passes userId in the request URL with skipAuth', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())
    await fetchUserCharacter(77)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/77/character/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())
    await fetchUserCharacter('charlie')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/charlie/character/',
      undefined,
      expect.anything(),
    )
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchUserCharacter(1)
    expect(result).toBe(MOCK_CHARACTER_STATE)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchUserCharacter(1)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── chooseCharacterPath ───────────────────────────────────────────────────────

describe('chooseCharacterPath', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('POSTs to correct endpoint with path_slug body', async () => {
    mockPost.mockResolvedValueOnce(characterStateDto({ path_slug: 'cartographer' }))
    await chooseCharacterPath({ pathSlug: 'cartographer' })
    expect(mockPost).toHaveBeenCalledWith(
      '/achievements/character/me/path/',
      { path_slug: 'cartographer' },
    )
  })

  it('returns mapped CharacterState from POST response', async () => {
    mockPost.mockResolvedValueOnce(
      characterStateDto({
        path_slug: 'cartographer',
        path_name: 'Картограф',
        pending_choice: false,
        path_options: [],
      }),
    )
    const result = await chooseCharacterPath({ pathSlug: 'cartographer' })
    expect(result.pathSlug).toBe('cartographer')
    expect(result.pathName).toBe('Картограф')
    expect(result.pendingChoice).toBe(false)
    expect(result.pathOptions).toEqual([])
  })

  it('returns mock fallback on ApiError(404) in __DEV__ — simulates path chosen', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    // MOCK_CHARACTER_STATE.pathOptions[0] is 'cartographer'
    const result = await chooseCharacterPath({ pathSlug: 'cartographer' })
    expect(result.pathSlug).toBe('cartographer')
    expect(result.pendingChoice).toBe(false)
    expect(result.pathOptions).toEqual([])
  })

  it('mock fallback: finds the matching option by pathSlug', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await chooseCharacterPath({ pathSlug: 'scout' })
    expect(result.pathSlug).toBe('scout')
    expect(result.pathName).toBe('Разведчик')
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockPost.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(chooseCharacterPath({ pathSlug: 'scout' })).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(chooseCharacterPath({ pathSlug: 'scout' })).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError network error regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new Error('Network error'))
    await expect(chooseCharacterPath({ pathSlug: 'photohunter' })).rejects.toThrow('Network error')
  })
})
