// #2169: публичный отзыв квеста несёт id автора (`user`, бэк #2163). Старый бэк
// поля не отдаёт — id не выдумывается, отзыв остаётся без блокировки автора.
jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number) {
      super(String(status))
      this.status = status
    }
  },
}))

const { apiClient } = require('@/api/client') as { apiClient: { get: jest.Mock } }
const { fetchQuestReviews } = require('@/api/quests')

const raw = (id: number, extra: Record<string, unknown>) => ({
  id,
  rating: 5,
  liked: 'да',
  disliked: '',
  author_name: 'Игрок',
  author_avatar: null,
  created_at: null,
  ...extra,
})

describe('fetchQuestReviews author id (#2169)', () => {
  it('maps `user` to authorId and keeps legacy reviews without an invented id', async () => {
    apiClient.get.mockResolvedValueOnce([raw(1, { user: 42 }), raw(2, { user: null }), raw(3, {}), raw(4, { user: '7' })])
    const reviews = await fetchQuestReviews('minsk')
    expect(reviews.map((review: { id: number; authorId: number | null }) => [review.id, review.authorId])).toEqual([
      [1, 42],
      [2, null],
      [3, null],
      [4, null],
    ])
  })
})
