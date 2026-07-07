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

// Реальный BE-shape: уровень — вложенный объект, метрика — `score`,
// тип активности — `activity_type`/`activity_label`, следующий уровень — `next_level`.
const progressionLineDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'dog',
  name: 'Собачья',
  description: 'Социальная ветка',
  visual_key: 'dog',
  activity_type: 'participant',
  activity_label: 'Участник',
  score: 47,
  progress_percent: 44,
  points_to_next: 28,
  level: { level: 2, title: 'Следопыт стаи', min_score: 25, visual_key: 'dog-level-2' },
  next_level: {
    level: 3,
    title: 'Надёжный спутник',
    min_score: 75,
    visual_key: 'dog-level-3',
  },
  levels: [
    { level: 1, title: 'Щенок', min_score: 0, visual_key: 'dog-level-1' },
    { level: 2, title: 'Следопыт стаи', min_score: 25, visual_key: 'dog-level-2' },
    { level: 3, title: 'Надёжный спутник', min_score: 75, visual_key: 'dog-level-3' },
  ],
  ...overrides,
})

// Реальный BE-shape: visual_details[] с key/label/unlocked/equipped/min_level.
const visualDetailDto = (overrides: Record<string, unknown> = {}) => ({
  key: 'collar',
  label: 'Ошейник',
  visual_key: 'fox-collar',
  min_level: 1,
  unlocked: true,
  equipped: true,
  ...overrides,
})

// Реальный BE-shape: available_paths[] — линейки с can_select/selected.
const availablePathDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'fox',
  name: 'Лисья',
  activity_type: 'reader',
  score: 1523,
  level: { level: 5, title: 'Мудрая лиса', min_score: 300, visual_key: 'fox-level-5' },
  selected: false,
  can_select: true,
  locked_reason: '',
  ...overrides,
})

const pathLineDto = (overrides: Record<string, unknown> = {}) => ({
  slug: 'fox',
  name: 'Лисья',
  description: 'Ветка читателя',
  visual_key: 'fox',
  activity_type: 'reader',
  activity_label: 'Читатель',
  score: 1523,
  progress_percent: 100,
  points_to_next: null,
  level: { level: 5, title: 'Мудрая лиса', min_score: 300, visual_key: 'fox-level-5' },
  next_level: null,
  levels: [],
  ...overrides,
})

// Реальный BE-shape character/me/: user_id + active/selected/available_paths.
const characterStateDto = (overrides: Record<string, unknown> = {}) => ({
  user_id: 104,
  selected_path: null,
  active_path: pathLineDto(),
  suggested_path: pathLineDto(),
  switch_unlocked: true,
  available_paths: [availablePathDto({ slug: 'dog', name: 'Собачья' })],
  visual_details: [visualDetailDto()],
  updated_at: '2026-06-21T10:00:00Z',
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

  it('maps a full ProgressionLineDto (BE array shape) to ProgressionLine', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto()])

    const progress = await fetchMyGamificationProgress()

    expect(progress.lines).toHaveLength(1)
    const l = progress.lines[0]
    expect(l.slug).toBe('dog')
    expect(l.name).toBe('Собачья')
    expect(l.activityKind).toBe('participant')
    expect(l.activityName).toBe('Участник')
    expect(l.level).toBe(2)
    expect(l.levelTitle).toBe('Следопыт стаи')
    expect(l.current).toBe(47)
    expect(l.currentLevelMin).toBe(25)
    expect(l.nextLevelMin).toBe(75)
    expect(l.nextLevelTitle).toBe('Надёжный спутник')
    expect(l.isMaxLevel).toBe(false)
    expect(l.emoji).toBe('🐕')
    // No snake_case leaking
    expect((l as any).activity_type).toBeUndefined()
    expect((l as any).next_level).toBeUndefined()
  })

  it('maps server progress_percent/points_to_next/visual_key/levels (BE-authoritative)', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto()])
    const { lines } = await fetchMyGamificationProgress()
    const l = lines[0]
    expect(l.progressPercent).toBe(44)
    expect(l.pointsToNext).toBe(28)
    expect(l.visualKey).toBe('dog')
    expect(l.levels).toHaveLength(3)
    expect(l.levels[0].minScore).toBe(0)
    expect(l.levels[2].title).toBe('Надёжный спутник')
    expect(l.levels[2].visualKey).toBe('dog-level-3')
  })

  it('progressPercent/pointsToNext null and levels [] when BE omits them', async () => {
    mockGet.mockResolvedValueOnce([
      progressionLineDto({ progress_percent: null, points_to_next: null, levels: undefined, visual_key: null }),
    ])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].progressPercent).toBeNull()
    expect(lines[0].pointsToNext).toBeNull()
    expect(lines[0].visualKey).toBeNull()
    expect(lines[0].levels).toEqual([])
  })

  it('normalizes unknown activity_type to "explorer"', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto({ activity_type: 'unknown_type' })])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].activityKind).toBe('explorer')
  })

  it('normalizes null activity_type to "explorer"', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto({ activity_type: null })])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].activityKind).toBe('explorer')
  })

  it('accepts all valid activity_type values', async () => {
    const kinds = ['explorer', 'reader', 'author', 'participant'] as const
    for (const activity_type of kinds) {
      mockGet.mockResolvedValueOnce([progressionLineDto({ activity_type })])
      const { lines } = await fetchMyGamificationProgress()
      expect(lines[0].activityKind).toBe(activity_type)
    }
  })

  it('normalizes unknown slug to "dog"', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto({ slug: 'cat' })])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].slug).toBe('dog')
  })

  it('accepts all valid slug values and derives the matching emoji', async () => {
    const cases = [
      ['dog', '🐕'],
      ['boar', '🐗'],
      ['fox', '🦊'],
      ['bird', '🦅'],
    ] as const
    for (const [slug, emoji] of cases) {
      mockGet.mockResolvedValueOnce([progressionLineDto({ slug })])
      const { lines } = await fetchMyGamificationProgress()
      expect(lines[0].slug).toBe(slug)
      expect(lines[0].emoji).toBe(emoji)
    }
  })

  it('sets isMaxLevel true when next_level is null', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto({ next_level: null })])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].isMaxLevel).toBe(true)
    expect(lines[0].nextLevelMin).toBeNull()
    expect(lines[0].nextLevelTitle).toBeNull()
  })

  it('defaults level to 1 when level.level absent', async () => {
    mockGet.mockResolvedValueOnce([
      progressionLineDto({ level: { level: undefined, title: 'x', min_score: 0 } }),
    ])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].level).toBe(1)
  })

  it('defaults current/currentLevelMin to 0 when score/min_score absent', async () => {
    mockGet.mockResolvedValueOnce([
      progressionLineDto({ score: null, level: { level: 1, title: 'x', min_score: null } }),
    ])
    const { lines } = await fetchMyGamificationProgress()
    expect(lines[0].current).toBe(0)
    expect(lines[0].currentLevelMin).toBe(0)
  })

  it('returns empty lines for an empty array (safe fallback)', async () => {
    mockGet.mockResolvedValueOnce([])
    const progress = await fetchMyGamificationProgress()
    expect(progress.lines).toEqual([])
  })

  it('returns empty lines for null/undefined payload (safe fallback)', async () => {
    mockGet.mockResolvedValueOnce(null as any)
    const progress = await fetchMyGamificationProgress()
    expect(progress.lines).toEqual([])
  })

  it('still accepts legacy {lines:[]} wrapper shape (defensive)', async () => {
    mockGet.mockResolvedValueOnce({ lines: [progressionLineDto()] } as any)
    const progress = await fetchMyGamificationProgress()
    expect(progress.lines).toHaveLength(1)
    expect(progress.lines[0].slug).toBe('dog')
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

  it('maps DTO same as my-endpoint (BE array shape)', async () => {
    mockGet.mockResolvedValueOnce([progressionLineDto()])
    const progress = await fetchUserGamificationProgress(55)
    expect(progress.lines).toHaveLength(1)
    expect(progress.lines[0].activityKind).toBe('participant')
  })

  it('passes userId in the request URL with skipAuth', async () => {
    mockGet.mockResolvedValueOnce([])
    await fetchUserGamificationProgress(55)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/55/progression-lines/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('accepts string userId', async () => {
    mockGet.mockResolvedValueOnce([])
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

  it('maps real BE character/me/ shape to CharacterState domain object', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())

    const char = await fetchMyCharacter()

    // id ← user_id, name/level ← active_path
    expect(char.id).toBe(104)
    expect(char.name).toBe('Лисья')
    expect(char.level).toBe(5)
    // selected_path null → no chosen path yet, but switch_unlocked → pending choice
    expect(char.pathSlug).toBeNull()
    expect(char.pathName).toBeNull()
    expect(char.pendingChoice).toBe(true)
    // details ← visual_details[]
    expect(char.details).toHaveLength(1)
    expect(char.details[0].slug).toBe('collar')
    expect(char.details[0].name).toBe('Ошейник')
    expect(char.details[0].unlocked).toBe(true)
    // pathOptions ← available_paths[]
    expect(char.pathOptions).toHaveLength(1)
    expect(char.pathOptions[0].slug).toBe('dog')
    expect(char.pathOptions[0].name).toBe('Собачья')
    expect(char.pathOptions[0].emoji).toBe('🐕')
    // No snake_case leaking
    expect((char as any).user_id).toBeUndefined()
    expect((char as any).selected_path).toBeUndefined()
    expect((char as any).available_paths).toBeUndefined()
  })

  it('maps extended character fields (visual detail equipped/minLevel/visualKey, active/suggested/updated)', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto())
    const char = await fetchMyCharacter()
    // visual detail extras
    expect(char.details[0].visualKey).toBe('fox-collar')
    expect(char.details[0].minLevel).toBe(1)
    expect(char.details[0].equipped).toBe(true)
    // active/suggested path + switch + updated
    expect(char.activePathSlug).toBe('fox')
    expect(char.suggestedPathSlug).toBe('fox')
    expect(char.switchUnlocked).toBe(true)
    expect(char.updatedAt).toBe('2026-06-21T10:00:00Z')
  })

  it('reflects a chosen path via selected_path (line slug)', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        selected_path: pathLineDto({ slug: 'fox', name: 'Лисья' }),
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBe('fox')
    expect(char.pathName).toBe('Лисья')
    // already chosen → not pending despite switch_unlocked
    expect(char.pendingChoice).toBe(false)
  })

  it('accepts each valid line slug as selected_path', async () => {
    const slugs = ['dog', 'boar', 'fox', 'bird'] as const
    for (const slug of slugs) {
      mockGet.mockResolvedValueOnce(
        characterStateDto({ selected_path: pathLineDto({ slug }) }),
      )
      const char = await fetchMyCharacter()
      expect(char.pathSlug).toBe(slug)
    }
  })

  it('normalizes invalid selected_path slug to null', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({ selected_path: pathLineDto({ slug: 'unknown_path' }) }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathSlug).toBeNull()
  })

  it('pendingChoice false when switch is locked', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ switch_unlocked: false }))
    const char = await fetchMyCharacter()
    expect(char.pendingChoice).toBe(false)
  })

  it('coerces switch_unlocked null to false → not pending', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ switch_unlocked: null }))
    const char = await fetchMyCharacter()
    expect(char.pendingChoice).toBe(false)
  })

  it('defaults level to 1 when active_path missing', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({ active_path: null, selected_path: null }),
    )
    const char = await fetchMyCharacter()
    expect(char.level).toBe(1)
    expect(char.name).toBe('Персонаж')
  })

  it('falls back to selected_path for name/level when active_path absent', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        active_path: null,
        selected_path: pathLineDto({ slug: 'boar', name: 'Кабанья' }),
      }),
    )
    const char = await fetchMyCharacter()
    expect(char.name).toBe('Кабанья')
    expect(char.level).toBe(5)
    expect(char.pathSlug).toBe('boar')
  })

  it('returns empty details when visual_details absent', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ visual_details: undefined }))
    const char = await fetchMyCharacter()
    expect(char.details).toEqual([])
  })

  it('returns empty pathOptions when available_paths absent', async () => {
    mockGet.mockResolvedValueOnce(characterStateDto({ available_paths: undefined }))
    const char = await fetchMyCharacter()
    expect(char.pathOptions).toEqual([])
  })

  it('keeps non-selectable available_paths with canSelect flag + lockedReason (additive)', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({
        available_paths: [
          availablePathDto({ slug: 'dog', can_select: true, locked_reason: '' }),
          availablePathDto({
            slug: 'boar',
            can_select: false,
            locked_reason: 'Достигните 5 уровня',
          }),
        ],
      }),
    )
    const char = await fetchMyCharacter()
    // Маппер больше не прячет заблокированные пути — отдаёт все с флагом доступности.
    expect(char.pathOptions).toHaveLength(2)
    const dog = char.pathOptions.find((o) => o.slug === 'dog')!
    const boar = char.pathOptions.find((o) => o.slug === 'boar')!
    expect(dog.canSelect).toBe(true)
    expect(boar.canSelect).toBe(false)
    expect(boar.lockedReason).toBe('Достигните 5 уровня')
    // score/level из available_paths[] тоже пробрасываются
    expect(boar.score).toBe(1523)
    expect(boar.level).toBe(5)
  })

  it('derives path option emoji from line slug', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({ available_paths: [availablePathDto({ slug: 'bird' })] }),
    )
    const char = await fetchMyCharacter()
    expect(char.pathOptions[0].emoji).toBe('🦅')
  })

  it('coerces visual_detail.unlocked null to false', async () => {
    mockGet.mockResolvedValueOnce(
      characterStateDto({ visual_details: [visualDetailDto({ unlocked: null })] }),
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
    mockGet.mockResolvedValueOnce(
      characterStateDto({ selected_path: pathLineDto({ slug: 'fox', name: 'Лисья' }) }),
    )
    const char = await fetchUserCharacter(77)
    expect(char.id).toBe(104)
    expect(char.pathSlug).toBe('fox')
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

  it('POSTs to correct endpoint with progression_line_slug body', async () => {
    mockPost.mockResolvedValueOnce(
      characterStateDto({ selected_path: pathLineDto({ slug: 'fox', name: 'Лисья' }) }),
    )
    await chooseCharacterPath({ pathSlug: 'fox' })
    expect(mockPost).toHaveBeenCalledWith(
      '/achievements/character/me/path/',
      { progression_line_slug: 'fox' },
    )
  })

  it('returns mapped CharacterState from POST response', async () => {
    mockPost.mockResolvedValueOnce(
      characterStateDto({
        selected_path: pathLineDto({ slug: 'fox', name: 'Лисья' }),
        switch_unlocked: false,
        available_paths: [],
      }),
    )
    const result = await chooseCharacterPath({ pathSlug: 'fox' })
    expect(result.pathSlug).toBe('fox')
    expect(result.pathName).toBe('Лисья')
    expect(result.pendingChoice).toBe(false)
    expect(result.pathOptions).toEqual([])
  })

  it('returns mock fallback on ApiError(404) in __DEV__ — simulates path chosen', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    // MOCK_CHARACTER_STATE.pathOptions[0] is 'dog'
    const result = await chooseCharacterPath({ pathSlug: 'dog' })
    expect(result.pathSlug).toBe('dog')
    expect(result.pendingChoice).toBe(false)
    expect(result.pathOptions).toEqual([])
  })

  it('mock fallback: finds the matching option by pathSlug', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await chooseCharacterPath({ pathSlug: 'fox' })
    expect(result.pathSlug).toBe('fox')
    expect(result.pathName).toBe('Лисья')
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    mockPost.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(chooseCharacterPath({ pathSlug: 'fox' })).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws ApiError(500) even in __DEV__ (not in whitelist)', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(chooseCharacterPath({ pathSlug: 'fox' })).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError network error regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new Error('Network error'))
    await expect(chooseCharacterPath({ pathSlug: 'bird' })).rejects.toThrow('Network error')
  })
})
