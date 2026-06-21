// __tests__/achievements/achievementShare.test.ts
// Sprint 12 #386: unit-покрытие FE-слоя share-достижений — UTM-link builder (#458)
// и createShareCard с мок-фолбэком (#382/#384). Кейсы зеркалят FE-API-контракт:
// image-only, direct-link, public_url=null, expired/revoked 410, UTM-preserve.

delete process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK

jest.mock('@/api/client', () => ({
  apiClient: { post: jest.fn() },
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

jest.mock('@/utils/seo', () => ({
  getSiteBaseUrl: () => 'https://metravel.by',
}))

import { apiClient, ApiError } from '@/api/client'
import { createShareCard } from '@/api/achievementsShare'
import { buildShareLink, buildShareUtm } from '@/utils/achievementShare'

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

beforeEach(() => {
  mockPost.mockReset()
})

// ── UTM link builder (#458) ─────────────────────────────────────────────────

describe('buildShareLink', () => {
  it('appends utm_source/medium/campaign to a clean URL', () => {
    const out = buildShareLink('https://metravel.by/achievements/901', {
      channel: 'telegram',
      slug: 'first-wave',
    })
    expect(out).toContain('utm_source=telegram')
    expect(out).toContain('utm_medium=badge_share')
    expect(out).toContain('utm_campaign=badge_first-wave')
    expect(out.startsWith('https://metravel.by/achievements/901?')).toBe(true)
  })

  it('preserves existing query params and uses & separator', () => {
    const out = buildShareLink('https://metravel.by/a/1?ref=home', {
      channel: 'copy',
      slug: 'x',
    })
    expect(out).toContain('ref=home')
    expect(out).toContain('&utm_source=copy')
  })

  it('does not duplicate UTM params already present', () => {
    const out = buildShareLink('https://metravel.by/a/1?utm_source=existing', {
      channel: 'facebook',
      slug: 'x',
    })
    expect(out.match(/utm_source=/g)).toHaveLength(1)
    expect(out).toContain('utm_source=existing')
  })

  it('keeps the URL hash at the end', () => {
    const out = buildShareLink('https://metravel.by/a/1#top', {
      channel: 'native',
      slug: 'x',
    })
    expect(out.endsWith('#top')).toBe(true)
    expect(out).toContain('utm_source=native')
  })

  it('returns empty string unchanged (no public/image url)', () => {
    expect(buildShareLink('', { channel: 'copy', slug: 'x' })).toBe('')
  })
})

describe('buildShareUtm', () => {
  it('builds the UTM object for the create-share-card body', () => {
    expect(buildShareUtm('whatsapp', 'ambassador')).toEqual({
      source: 'whatsapp',
      medium: 'badge_share',
      campaign: 'badge_ambassador',
    })
  })
})

// ── createShareCard (#382 contract + mock fallback) ─────────────────────────

describe('createShareCard', () => {
  it('maps a full DTO (direct-link share)', async () => {
    mockPost.mockResolvedValueOnce({
      share_token: 'tok123',
      image_url: 'https://cdn/x.png',
      public_url: 'https://metravel.by/achievements/901',
      expires_at: '2030-01-01T00:00:00Z',
    })
    const card = await createShareCard({ achievementId: 901, template: 'rare' })
    expect(card).toEqual({
      shareToken: 'tok123',
      imageUrl: 'https://cdn/x.png',
      publicUrl: 'https://metravel.by/achievements/901',
      expiresAt: '2030-01-01T00:00:00Z',
    })
    expect(mockPost).toHaveBeenCalledWith('/achievements/share-cards/', {
      achievement_id: 901,
      template: 'rare',
    })
  })

  it('handles image-only share (public_url null)', async () => {
    mockPost.mockResolvedValueOnce({
      share_token: 'tok',
      image_url: 'https://cdn/y.png',
      public_url: null,
      expires_at: null,
    })
    const card = await createShareCard({ achievementId: 1 })
    expect(card.publicUrl).toBeNull()
    expect(card.imageUrl).toBe('https://cdn/y.png')
  })

  it('throws on expired/revoked token (410) — no mock fallback', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(410, 'gone'))
    await expect(createShareCard({ achievementId: 1 })).rejects.toBeInstanceOf(ApiError)
  })

  it('falls back to a mock card on DEV 404', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new ApiError(404, 'not found'))
    const card = await createShareCard({ achievementId: 901 })
    expect(card.shareToken).toBe('mock-901')
    expect(card.publicUrl).toBe('https://metravel.by/achievements/901')
    expect(card.imageUrl).toContain('https://metravel.by')
  })

  it('passes UTM through to the request body', async () => {
    mockPost.mockResolvedValueOnce({
      share_token: 't',
      image_url: 'i',
      public_url: null,
      expires_at: null,
    })
    await createShareCard({
      achievementId: 5,
      utm: { source: 'copy', medium: 'badge_share', campaign: 'badge_x' },
    })
    expect(mockPost).toHaveBeenCalledWith('/achievements/share-cards/', {
      achievement_id: 5,
      utm: { source: 'copy', medium: 'badge_share', campaign: 'badge_x' },
    })
  })
})
