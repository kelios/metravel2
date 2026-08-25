import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { submitQuestReview } from '@/api/questReview'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { useQuestReview } from '@/hooks/useQuestReview'
import { trackQuestReviewSubmit } from '@/utils/questReviewAnalytics'

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

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '77' }),
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  trackQuestReviewSubmit: jest.fn(),
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

// #1486: событие отправки отзыва должно сходиться со строками в базе, поэтому
// стреляет только подтверждённый сервером успех — не нажатие кнопки.
describe('hooks/useQuestReview analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ userId: '77' })
    const get = apiClient.get as unknown as jest.Mock
    get.mockResolvedValue(null)
  })

  const makeWrapper = (client: QueryClient) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client }, children)
    }

  const renderReviewHook = () =>
    renderHook(
      () => useQuestReview({ questId: 42, questSlug: 'minsk-cmok', cityId: 'minsk' }),
      { wrapper: makeWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) },
    )

  it('sends quest_review_submit once the server confirms the save', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockResolvedValue({ id: 1, user: 77, quest: 42, rating: 5, liked: 'Сюжет', disliked: '' })

    const { result } = renderReviewHook()

    act(() => {
      result.current.submit({ rating: 5, liked: 'Сюжет', disliked: '' })
    })

    await waitFor(() => {
      expect(trackQuestReviewSubmit).toHaveBeenCalledTimes(1)
    })
    expect(trackQuestReviewSubmit).toHaveBeenCalledWith({
      questId: 'minsk-cmok',
      cityId: 'minsk',
      rating: 5,
      hasText: true,
    })
  })

  it('reports an empty review as text-free', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockResolvedValue({ id: 2, user: 77, quest: 42, rating: 4, liked: '', disliked: '   ' })

    const { result } = renderReviewHook()

    act(() => {
      result.current.submit({ rating: 4, liked: '', disliked: '' })
    })

    await waitFor(() => {
      expect(trackQuestReviewSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 4, hasText: false }),
      )
    })
  })

  it('stays silent when the save fails', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockRejectedValue(new Error('boom'))

    const { result } = renderReviewHook()

    act(() => {
      result.current.submit({ rating: 3, liked: '', disliked: '' })
    })

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(trackQuestReviewSubmit).not.toHaveBeenCalled()
  })
})
