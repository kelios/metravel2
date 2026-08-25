import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { submitQuestReview } from '@/api/questReview'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { useQuestReview } from '@/hooks/useQuestReview'
import { trackQuestReviewSubmit } from '@/utils/questReviewAnalytics'
import { queryKeys } from '@/api/queryKeys'

let mockAuthState: { isAuthenticated: boolean; userId: string | null } = {
  isAuthenticated: true,
  userId: '77',
}

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
  useAuth: () => mockAuthState,
}))

jest.mock('@/utils/questReviewAnalytics', () => ({
  trackQuestReviewSubmit: jest.fn(),
}))

describe('api/questReview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState = { isAuthenticated: true, userId: '77' }
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

  it.each([0, 2.5, 6, Number.NaN])(
    'rejects invalid rating %s before calling the API',
    async (rating) => {
      await expect(
        submitQuestReview({
          questId: 42,
          rating,
          liked: '',
          disliked: '',
        }),
      ).rejects.toThrow('от 1 до 5')

      expect(apiClient.post).not.toHaveBeenCalled()
    },
  )
})

// #1486: событие отправки отзыва должно сходиться со строками в базе, поэтому
// стреляет только подтверждённый сервером успех — не нажатие кнопки.
describe('hooks/useQuestReview analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthState = { isAuthenticated: true, userId: '77' }
    useAuthStore.setState({ userId: '77' })
    const get = apiClient.get as unknown as jest.Mock
    get.mockResolvedValue(null)
  })

  const makeWrapper = (client: QueryClient) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client }, children)
    }

  const renderReviewHook = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => ({
    client,
    ...renderHook(
      () => useQuestReview({ questId: 42, questSlug: 'minsk-cmok', cityId: 'minsk' }),
      { wrapper: makeWrapper(client) },
    ),
  })

  it('sends quest_review_submit once the server confirms the save', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockResolvedValue({ id: 1, user: 77, quest: 42, rating: 5, liked: 'Сюжет', disliked: '' })

    const { result } = renderReviewHook()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

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

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.submit({ rating: 4, liked: '', disliked: '' })
    })

    await waitFor(() => {
      expect(trackQuestReviewSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 4, hasText: false }),
      )
    })
  })

  it('updates personal data and invalidates public, detail, and catalog data after save', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockResolvedValue({ id: 3, user: 77, quest: 42, rating: 5, liked: '', disliked: '' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = renderReviewHook(client)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.submit({ rating: 5, liked: '', disliked: '' })
    })

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.quests() })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.questDetail(42),
        exact: true,
      })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.questReviews('minsk-cmok'),
        exact: true,
      })
    })
    expect(client.getQueryData(queryKeys.questUserReview('77', 42))).toEqual({
      id: 3,
      user: 77,
      quest: 42,
      rating: 5,
      liked: '',
      disliked: '',
    })
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: queryKeys.questUserReview('77', 42),
    })
  })

  it('does not reuse another account\'s cached review', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const otherReview = {
      id: 8,
      user: 12,
      quest: 42,
      rating: 1,
      liked: 'Другой пользователь',
      disliked: '',
    }
    client.setQueryData(queryKeys.questUserReview('12', 42), otherReview)

    const { result } = renderReviewHook(client)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.review).toBeNull()
    expect(client.getQueryData(queryKeys.questUserReview('12', 42))).toEqual(otherReview)
  })

  it('blocks submit when the existing-review request fails unexpectedly', async () => {
    const get = apiClient.get as unknown as jest.Mock
    const post = apiClient.post as unknown as jest.Mock
    get.mockRejectedValue(new Error('network down'))

    const { result } = renderReviewHook()

    await waitFor(() => {
      expect(result.current.hasLoadError).toBe(true)
    })

    act(() => {
      result.current.submit({ rating: 5, liked: '', disliked: '' })
    })

    expect(post).not.toHaveBeenCalled()
  })

  it('does not fetch or submit personal data without an authenticated identity', () => {
    mockAuthState = { isAuthenticated: false, userId: null }
    const get = apiClient.get as unknown as jest.Mock
    const post = apiClient.post as unknown as jest.Mock

    const { result } = renderReviewHook()

    act(() => {
      result.current.submit({ rating: 5, liked: '', disliked: '' })
    })

    expect(get).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('stays silent when the save fails', async () => {
    const post = apiClient.post as unknown as jest.Mock
    post.mockRejectedValue(new Error('boom'))

    const { result } = renderReviewHook()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.submit({ rating: 3, liked: '', disliked: '' })
    })

    await waitFor(() => {
      expect(result.current.hasError).toBe(true)
    })
    expect(trackQuestReviewSubmit).not.toHaveBeenCalled()
  })
})
