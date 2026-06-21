// __tests__/achievements/api.rareAwards.test.ts
// Unit tests for rare-awards slice of api/achievements.ts — DTO→domain mappers,
// mock-fallback on empty/404, admin grant simulate vs. role-error passthrough.
// Контракт зеркалит тикеты борда #376/#377/#379/#380 (Sprint 11).

// Ensure USE_MOCK flag is NOT set so we exercise the real mapper path.
delete process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK
// DEV-gate enables 404/0/501 mock-fallback (shouldFallbackToMock).
;(globalThis as any).__DEV__ = true

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
  fetchMyRareAwards,
  fetchUserRareAwards,
  fetchRareAwardCatalog,
  grantRareAward,
  rareAwardToBadge,
  type RareAward,
} from '@/api/achievements'
import { MOCK_RARE_AWARDS, MOCK_RARE_AWARD_CATALOG } from '@/api/achievementsMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = (apiClient as any).post as jest.Mock

const rareAwardDto = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  slug: 'ambassador',
  category: 'ambassador',
  title: 'Амбассадор',
  level: 'platinum',
  reason: 'За продвижение проекта',
  granted_at: '2026-02-14T12:00:00Z',
  granted_by_profile: { id: 1, name: 'Команда MeTravel' },
  owner_limit: 50,
  is_rare: true,
  share_template: 'rare',
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('rare awards — DTO → domain mappers', () => {
  it('maps a rare award with all fields', async () => {
    mockGet.mockResolvedValueOnce([rareAwardDto()])
    const result = await fetchMyRareAwards()
    expect(result).toHaveLength(1)
    const a = result[0]
    expect(a).toMatchObject({
      id: 5,
      slug: 'ambassador',
      category: 'ambassador',
      title: 'Амбассадор',
      level: 'platinum',
      reason: 'За продвижение проекта',
      grantedAt: '2026-02-14T12:00:00Z',
      ownerLimit: 50,
      isRare: true,
      shareTemplate: 'rare',
    })
    expect(a.grantedByProfile).toEqual({ id: 1, name: 'Команда MeTravel' })
  })

  it('coerces missing/null fields to safe defaults', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 9, slug: 'x', granted_by_profile: null },
    ])
    const [a] = await fetchMyRareAwards()
    expect(a.level).toBe('legendary')
    expect(a.reason).toBe('')
    expect(a.grantedByProfile).toBeNull()
    expect(a.ownerLimit).toBeNull()
    expect(a.shareTemplate).toBe('rare')
  })

  it('calls the public user endpoint with skipAuth', async () => {
    mockGet.mockResolvedValueOnce([rareAwardDto()])
    await fetchUserRareAwards(42)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/user/42/rare-awards/',
      undefined,
      { skipAuth: true },
    )
  })

  it('maps catalog items for the admin picker', async () => {
    mockGet.mockResolvedValueOnce([
      {
        slug: 'first-wave',
        category: 'first-wave',
        title: 'Первая волна',
        level: 'legendary',
        description: 'Один из первых',
        owner_limit: 100,
        owners_count: 37,
      },
    ])
    const [item] = await fetchRareAwardCatalog()
    expect(item).toEqual({
      slug: 'first-wave',
      category: 'first-wave',
      title: 'Первая волна',
      level: 'legendary',
      description: 'Один из первых',
      ownerLimit: 100,
      ownersCount: 37,
    })
  })
})

describe('rare awards — empty + mock fallback', () => {
  it('returns empty array (not mock) when backend returns []', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchMyRareAwards()).toEqual([])
  })

  it('falls back to mock on 404 in DEV', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404))
    expect(await fetchMyRareAwards()).toBe(MOCK_RARE_AWARDS)
  })

  it('falls back to mock catalog on 404 in DEV', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404))
    expect(await fetchRareAwardCatalog()).toBe(MOCK_RARE_AWARD_CATALOG)
  })

  it('rethrows non-fallback errors (500)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(500))
    await expect(fetchMyRareAwards()).rejects.toThrow()
  })
})

describe('rare awards — admin grant', () => {
  it('posts user_id/award_slug/reason and maps the grant response', async () => {
    mockPost.mockResolvedValueOnce({
      id: 77,
      user_id: 42,
      award_slug: 'ambassador',
      category: 'ambassador',
      title: 'Амбассадор',
      level: 'platinum',
      reason: 'хорошо',
      granted_at: '2026-06-21T10:00:00Z',
      granted_by: 1,
      journal_event_id: 555,
    })
    const result = await grantRareAward({ userId: 42, awardSlug: 'ambassador', reason: 'хорошо' })
    expect(mockPost).toHaveBeenCalledWith('/achievements/rare-awards/grants/', {
      user_id: 42,
      award_slug: 'ambassador',
      reason: 'хорошо',
    })
    expect(result).toMatchObject({ id: 77, userId: 42, journalEventId: 555 })
  })

  it('simulates a grant on 404 in DEV (preview mode)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(404))
    const result = await grantRareAward({ userId: 42, awardSlug: 'ambassador', reason: 'r' })
    expect(result.awardSlug).toBe('ambassador')
    expect(result.userId).toBe(42)
  })

  it('rethrows 403 (non-staff) instead of simulating', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(403))
    await expect(
      grantRareAward({ userId: 42, awardSlug: 'ambassador', reason: 'r' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rethrows 409 (duplicate/limit) instead of simulating', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(409))
    await expect(
      grantRareAward({ userId: 42, awardSlug: 'ambassador', reason: 'r' }),
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('rareAwardToBadge', () => {
  it('maps rarity level to a badge tier for the medal visual', () => {
    const award = { ...rareAwardDto(), level: 'gold' } as unknown as RareAward
    // domain object, not DTO — build via mapper output shape
    const badge = rareAwardToBadge({
      id: 5,
      slug: 'ambassador',
      category: 'ambassador',
      title: 'Амбассадор',
      level: 'gold',
      reason: 'r',
      grantedAt: '',
      grantedByProfile: null,
      ownerLimit: null,
      isRare: true,
      shareTemplate: 'rare',
    })
    expect(badge.tier).toBe('gold')
    expect(badge.name).toBe('Амбассадор')
    expect(badge.imageUrl).toBeNull()
    void award
  })

  it('defaults unknown level to legendary', () => {
    const badge = rareAwardToBadge({
      id: 1,
      slug: 's',
      category: 'c',
      title: 't',
      level: 'mythic',
      reason: '',
      grantedAt: '',
      grantedByProfile: null,
      ownerLimit: null,
      isRare: true,
      shareTemplate: 'rare',
    })
    expect(badge.tier).toBe('legendary')
  })
})
