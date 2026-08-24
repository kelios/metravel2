// __tests__/api/questsShare.test.ts
// Контракт share-карточки результата квеста ([INV2-02], #1472): тело запроса к
// бэкенду и маппинг DTO→domain. Фиксирует то, что должен принять и вернуть
// будущий эндпоинт `/quests/result-cards/`, и мок-фолбэк до его готовности.

// USE_MOCK читается при загрузке модуля — снимаем флаг ДО импорта.
delete process.env.EXPO_PUBLIC_QUEST_SHARE_MOCK

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

import { apiClient } from '@/api/client'
import { createQuestResultCard } from '@/api/questsShare'

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

const baseInput = {
  questId: 42,
  questSlug: 'minsk-cipher',
  pointsDone: 6,
  pointsTotal: 8,
}

beforeEach(() => {
  mockPost.mockReset()
})

describe('api/questsShare createQuestResultCard', () => {
  it('posts the completion payload the backend needs and maps the response', async () => {
    mockPost.mockResolvedValueOnce({
      share_token: 'tok-1',
      image_url: 'https://metravel.by/media/quest-result-42-og.png',
      story_image_url: 'https://metravel.by/media/quest-result-42-story.png',
      public_url: 'https://metravel.by/quests/result/42',
      expires_at: null,
    })

    const card = await createQuestResultCard({
      ...baseInput,
      heroName: 'Аня',
      finishedAt: 1_700_000_000_000,
      utm: { source: 'share', medium: 'quest_result', campaign: 'quest_minsk-cipher' },
    })

    expect(mockPost).toHaveBeenCalledWith('/quests/result-cards/', {
      quest_id: 42,
      quest_slug: 'minsk-cipher',
      points_done: 6,
      points_total: 8,
      hero_name: 'Аня',
      finished_at: 1_700_000_000, // epoch seconds
      utm: { source: 'share', medium: 'quest_result', campaign: 'quest_minsk-cipher' },
    })

    expect(card).toEqual({
      shareToken: 'tok-1',
      imageUrl: 'https://metravel.by/media/quest-result-42-og.png',
      storyImageUrl: 'https://metravel.by/media/quest-result-42-story.png',
      publicUrl: 'https://metravel.by/quests/result/42',
      expiresAt: null,
    })
  })

  it('omits optional fields when hero name and finish time are absent', async () => {
    mockPost.mockResolvedValueOnce({ share_token: 't', image_url: 'x' })

    await createQuestResultCard(baseInput)

    const body = mockPost.mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('hero_name')
    expect(body).not.toHaveProperty('finished_at')
  })
})
