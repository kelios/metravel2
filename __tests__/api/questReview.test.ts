import { submitQuestReview } from '@/api/questReview'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

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
  devError: jest.fn(),
}))

describe('api/questReview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ userId: '77' })
  })

  it('posts quest review with the current user id', async () => {
    const record = { id: 1, user: 77, quest: 42, rating: 5, liked: 'Сюжет', disliked: '' }
    const post = apiClient.post as unknown as jest.Mock
    post.mockResolvedValue(record)

    await expect(
      submitQuestReview({
        questId: 42,
        rating: 5,
        liked: 'Сюжет',
        disliked: '',
      }),
    ).resolves.toBe(record)

    expect(apiClient.post).toHaveBeenCalledWith('/quest-reviews/', {
      user: 77,
      quest: 42,
      rating: 5,
      liked: 'Сюжет',
      disliked: '',
    })
  })

  it('rejects zero rating before calling the API', async () => {
    await expect(
      submitQuestReview({
        questId: 42,
        rating: 0,
        liked: '',
        disliked: '',
      }),
    ).rejects.toThrow('от 1 до 5')

    expect(apiClient.post).not.toHaveBeenCalled()
  })
})
