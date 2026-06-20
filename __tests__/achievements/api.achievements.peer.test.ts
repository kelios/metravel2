// __tests__/achievements/api.achievements.peer.test.ts
// Unit tests for peer-слоя api/achievements.ts (§10):
//   fetchPeerBadgeCatalog, fetchTravelPeerBadges, grantPeerBadge
//   + расширение fetchUserAchievements на peer_received.
//
// Паттерн: jest.mock('@/api/client') как в api.achievements.test.ts.

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
  fetchPeerBadgeCatalog,
  fetchTravelPeerBadges,
  fetchUserAchievements,
  grantPeerBadge,
} from '@/api/achievements'
import { MOCK_PEER_CATALOG, MOCK_TRAVEL_PEER_RECEIVED, MOCK_PUBLIC_ACHIEVEMENTS } from '@/api/achievementsMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = (apiClient as any).post as jest.Mock

// ── helpers ─────────────────────────────────────────────────────────────────

const peerBadgeDto = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  slug: 'favorite-author',
  name: 'Любимый автор',
  description: 'Один из ваших любимых авторов',
  category: { id: 5, slug: 'community', name: 'От сообщества', order: 5, icon: null },
  tier: 'gold',
  image_url: null,
  image_status: 'none',
  points: 0,
  is_secret: false,
  order: 101,
  target: 'user',
  ...overrides,
})

const peerReceivedDto = (overrides: Record<string, unknown> = {}) => ({
  badge: peerBadgeDto(),
  count: 5,
  granted_by_me: false,
  ...overrides,
})

const rankDto = () => ({
  level: 2,
  title: 'Путешественник',
  total_points: 150,
  badges_count: 3,
  recomputed_at: null,
})

const userBadgeDto = () => ({
  badge: {
    id: 1,
    slug: 'welcome',
    name: 'Добро пожаловать',
    description: 'Регистрация',
    category: { id: 1, slug: 'onboarding', name: 'Старт', order: 1, icon: null },
    tier: 'bronze',
    image_url: null,
    image_status: 'none',
    points: 5,
    is_secret: false,
    order: 1,
  },
  earned_at: '2025-10-01T12:00:00Z',
})

// ── fetchPeerBadgeCatalog ──────────────────────────────────────────────────

describe('fetchPeerBadgeCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps PeerBadgeDto array to PeerBadge domain objects', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto()])

    const result = await fetchPeerBadgeCatalog()

    expect(result).toHaveLength(1)
    const b = result[0]
    expect(b.id).toBe(101)
    expect(b.slug).toBe('favorite-author')
    expect(b.name).toBe('Любимый автор')
    expect(b.categorySlug).toBe('community')
    expect(b.categoryName).toBe('От сообщества')
    expect(b.tier).toBe('gold')
    expect(b.imageUrl).toBeNull()
    expect(b.points).toBe(0)
    expect(b.target).toBe('user')
    // no snake_case leaking
    expect((b as any).image_url).toBeUndefined()
    expect((b as any).category).toBeUndefined()
  })

  it('normalizes target="travel" correctly', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto({ target: 'travel' })])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.target).toBe('travel')
  })

  it('normalizes target absent (undefined) to "user"', async () => {
    const dto = { ...peerBadgeDto() }
    delete (dto as any).target
    mockGet.mockResolvedValueOnce([dto])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.target).toBe('user')
  })

  it('normalizes target=null to "user"', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto({ target: null })])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.target).toBe('user')
  })

  it('normalizes target="unknown" to "user"', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto({ target: 'unknown' })])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.target).toBe('user')
  })

  it('extracts category.slug → categorySlug and category.name → categoryName', async () => {
    mockGet.mockResolvedValueOnce([
      peerBadgeDto({ category: { id: 9, slug: 'special', name: 'Особые', order: 9, icon: null } }),
    ])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.categorySlug).toBe('special')
    expect(b.categoryName).toBe('Особые')
  })

  it('normalizes image_url="" to null', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto({ image_url: '' })])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.imageUrl).toBeNull()
  })

  it('preserves non-empty image_url', async () => {
    mockGet.mockResolvedValueOnce([peerBadgeDto({ image_url: 'https://cdn.example.com/badge.png' })])
    const [b] = await fetchPeerBadgeCatalog()
    expect(b.imageUrl).toBe('https://cdn.example.com/badge.png')
  })

  it('returns empty array when API returns empty array', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchPeerBadgeCatalog()).toEqual([])
  })

  it('maps multiple badges in one response', async () => {
    mockGet.mockResolvedValueOnce([
      peerBadgeDto({ id: 101, slug: 'a', target: 'user' }),
      peerBadgeDto({ id: 111, slug: 'b', target: 'travel' }),
    ])
    const result = await fetchPeerBadgeCatalog()
    expect(result).toHaveLength(2)
    expect(result[0].target).toBe('user')
    expect(result[1].target).toBe('travel')
  })

  it('returns MOCK_PEER_CATALOG on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchPeerBadgeCatalog()
    expect(result).toBe(MOCK_PEER_CATALOG)
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchPeerBadgeCatalog()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    await expect(fetchPeerBadgeCatalog()).rejects.toThrow('Network error')
  })
})

// ── fetchTravelPeerBadges ──────────────────────────────────────────────────

describe('fetchTravelPeerBadges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps {peer_received:[...]} → PeerBadgeReceived[]', async () => {
    mockGet.mockResolvedValueOnce({
      peer_received: [peerReceivedDto({ count: 7, granted_by_me: true })],
    })

    const result = await fetchTravelPeerBadges(42)

    expect(result).toHaveLength(1)
    const r = result[0]
    expect(r.badge.slug).toBe('favorite-author')
    expect(r.count).toBe(7)
    expect(r.grantedByMe).toBe(true)
  })

  it('uses count=0 when count is null/absent', async () => {
    mockGet.mockResolvedValueOnce({
      peer_received: [peerReceivedDto({ count: null })],
    })
    const [r] = await fetchTravelPeerBadges(1)
    expect(r.count).toBe(0)
  })

  it('coerces granted_by_me to boolean (null → false)', async () => {
    mockGet.mockResolvedValueOnce({
      peer_received: [peerReceivedDto({ granted_by_me: null })],
    })
    const [r] = await fetchTravelPeerBadges(1)
    expect(r.grantedByMe).toBe(false)
  })

  it('coerces granted_by_me=1 to true', async () => {
    mockGet.mockResolvedValueOnce({
      peer_received: [peerReceivedDto({ granted_by_me: 1 })],
    })
    const [r] = await fetchTravelPeerBadges(1)
    expect(r.grantedByMe).toBe(true)
  })

  it('URL contains travelId (numeric)', async () => {
    mockGet.mockResolvedValueOnce({ peer_received: [] })
    await fetchTravelPeerBadges(99)
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/travel/99/',
      undefined,
      expect.objectContaining({ skipAuth: true }),
    )
  })

  it('URL contains travelId (string)', async () => {
    mockGet.mockResolvedValueOnce({ peer_received: [] })
    await fetchTravelPeerBadges('abc-slug')
    expect(mockGet).toHaveBeenCalledWith(
      '/achievements/travel/abc-slug/',
      undefined,
      expect.anything(),
    )
  })

  it('returns empty array when peer_received is absent', async () => {
    mockGet.mockResolvedValueOnce({})
    const result = await fetchTravelPeerBadges(1)
    expect(result).toEqual([])
  })

  it('returns empty array when peer_received is empty', async () => {
    mockGet.mockResolvedValueOnce({ peer_received: [] })
    expect(await fetchTravelPeerBadges(1)).toEqual([])
  })

  it('returns MOCK_TRAVEL_PEER_RECEIVED on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchTravelPeerBadges(1)
    expect(result).toBe(MOCK_TRAVEL_PEER_RECEIVED)
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchTravelPeerBadges(1)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── grantPeerBadge ─────────────────────────────────────────────────────────

describe('grantPeerBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('sends body with badge_slug and recipient_id when recipientId provided', async () => {
    mockPost.mockResolvedValueOnce({ granted: true, count: 3 })

    await grantPeerBadge({ badgeSlug: 'favorite-author', recipientId: 42 })

    expect(mockPost).toHaveBeenCalledWith(
      '/achievements/peer-badges/grant/',
      expect.objectContaining({ badge_slug: 'favorite-author', recipient_id: 42 }),
    )
    const body = mockPost.mock.calls[0][1] as any
    expect(body).not.toHaveProperty('travel_id')
  })

  it('sends body with badge_slug and travel_id when travelId provided', async () => {
    mockPost.mockResolvedValueOnce({ granted: true, count: 7 })

    await grantPeerBadge({ badgeSlug: 'best-photos', travelId: 99 })

    expect(mockPost).toHaveBeenCalledWith(
      '/achievements/peer-badges/grant/',
      expect.objectContaining({ badge_slug: 'best-photos', travel_id: 99 }),
    )
    const body = mockPost.mock.calls[0][1] as any
    expect(body).not.toHaveProperty('recipient_id')
  })

  it('omits both recipient_id and travel_id when neither is provided', async () => {
    mockPost.mockResolvedValueOnce({ granted: true, count: 1 })

    await grantPeerBadge({ badgeSlug: 'any-badge' })

    const body = mockPost.mock.calls[0][1] as any
    expect(body).not.toHaveProperty('recipient_id')
    expect(body).not.toHaveProperty('travel_id')
    expect(body.badge_slug).toBe('any-badge')
  })

  it('parses response {granted, count} correctly', async () => {
    mockPost.mockResolvedValueOnce({ granted: true, count: 5 })
    const result = await grantPeerBadge({ badgeSlug: 'favorite-author', recipientId: 1 })
    expect(result.granted).toBe(true)
    expect(result.count).toBe(5)
  })

  it('coerces granted=false → false', async () => {
    mockPost.mockResolvedValueOnce({ granted: false, count: 0 })
    const result = await grantPeerBadge({ badgeSlug: 'favorite-author', recipientId: 1 })
    expect(result.granted).toBe(false)
    expect(result.count).toBe(0)
  })

  it('uses count=0 when count is null/absent', async () => {
    mockPost.mockResolvedValueOnce({ granted: true, count: null })
    const result = await grantPeerBadge({ badgeSlug: 'test', recipientId: 1 })
    expect(result.count).toBe(0)
  })

  it('returns simulation {granted:true, count:1} on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await grantPeerBadge({ badgeSlug: 'test', travelId: 1 })
    expect(result).toEqual({ granted: true, count: 1 })
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(grantPeerBadge({ badgeSlug: 'test', travelId: 1 })).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new Error('Server down'))
    await expect(grantPeerBadge({ badgeSlug: 'test' })).rejects.toThrow('Server down')
  })
})

// ── fetchUserAchievements + peer_received ──────────────────────────────────

describe('fetchUserAchievements — peer_received', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps peer_received array → peerReceived on PublicAchievements', async () => {
    mockGet.mockResolvedValueOnce({
      rank: rankDto(),
      earned_badges: [userBadgeDto()],
      peer_received: [
        peerReceivedDto({ count: 12, granted_by_me: true }),
        peerReceivedDto({ ...peerBadgeDto({ id: 102, slug: 'inspired-me', target: 'user' }), count: 3, granted_by_me: false }),
      ],
    })

    const result = await fetchUserAchievements(42)

    expect(result.peerReceived).toHaveLength(2)
    expect(result.peerReceived[0].badge.slug).toBe('favorite-author')
    expect(result.peerReceived[0].count).toBe(12)
    expect(result.peerReceived[0].grantedByMe).toBe(true)
    expect(result.peerReceived[1].count).toBe(3)
    expect(result.peerReceived[1].grantedByMe).toBe(false)
  })

  it('peerReceived defaults to [] when peer_received absent in response', async () => {
    mockGet.mockResolvedValueOnce({
      rank: rankDto(),
      earned_badges: [],
    })

    const result = await fetchUserAchievements(7)

    expect(result.peerReceived).toEqual([])
  })

  it('peerReceived defaults to [] when peer_received is empty array', async () => {
    mockGet.mockResolvedValueOnce({
      rank: rankDto(),
      earned_badges: [],
      peer_received: [],
    })

    const result = await fetchUserAchievements(7)

    expect(result.peerReceived).toEqual([])
  })

  it('returns MOCK_PUBLIC_ACHIEVEMENTS (with peerReceived) on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await fetchUserAchievements(1)
    expect(result).toBe(MOCK_PUBLIC_ACHIEVEMENTS)
    // Confirm the mock itself has peerReceived
    expect(result.peerReceived).toBeDefined()
    expect(Array.isArray(result.peerReceived)).toBe(true)
  })
})
