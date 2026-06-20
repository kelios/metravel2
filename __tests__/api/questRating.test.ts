import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { rateQuest, getUserQuestRating } from '@/api/questRating'
import { useRateQuestMutation } from '@/hooks/useQuestRating'
import type { ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'

jest.mock('@/api/client', () => {
  const post = jest.fn()
  const get = jest.fn()
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return {
    apiClient: { post, get },
    ApiError,
  }
})

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}))

const { apiClient } = jest.requireMock('@/api/client') as {
  apiClient: { post: jest.Mock; get: jest.Mock }
}
const { ApiError } = jest.requireMock('@/api/client') as {
  ApiError: new (msg: string, status: number) => Error & { status: number }
}
const { devError } = jest.requireMock('@/utils/logger') as { devError: jest.Mock }

const buildMeta = (overrides: Partial<ApiQuestMeta> = {}): ApiQuestMeta => ({
  id: 42,
  quest_id: 'minsk-cmok',
  title: 'Минский квест',
  points: '5',
  city_id: '1',
  city_name: 'Минск',
  lat: '53.9',
  lng: '27.56',
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: 4,
  rating_count: 10,
  user_rating: null,
  completions_count: 3,
  is_completed_by_me: false,
  first_completer: null,
  ...overrides,
})

describe('api/questRating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rateQuest posts rating to /quests/{id}/rate/', async () => {
    apiClient.post.mockResolvedValue(undefined)

    await rateQuest(42, 5)

    expect(apiClient.post).toHaveBeenCalledWith('/quests/42/rate/', { rating: 5 })
  })

  it('rateQuest rejects out-of-range ratings without hitting the API', async () => {
    await expect(rateQuest(42, 6 as 1 | 2 | 3 | 4 | 5)).rejects.toThrow()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('getUserQuestRating returns rating from /quests/{id}/rate/', async () => {
    apiClient.get.mockResolvedValue({ rating: 3 })

    const result = await getUserQuestRating(42)

    expect(apiClient.get).toHaveBeenCalledWith('/quests/42/rate/')
    expect(result).toBe(3)
  })

  it('getUserQuestRating returns null on 404 without logging', async () => {
    apiClient.get.mockRejectedValue(new ApiError('Not found', 404))

    const result = await getUserQuestRating(42)

    expect(result).toBeNull()
    expect(devError).not.toHaveBeenCalled()
  })
})

describe('useRateQuestMutation', () => {
  const makeWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        // gcTime Infinity: invalidateQueries in onSettled marks the queryFn-less
        // cache entries stale but must not garbage-collect them, so we can assert
        // the rolled-back/optimistic snapshot afterwards.
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    return { queryClient, wrapper }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('optimistically updates quest detail and list cache on rate', async () => {
    // Keep the mutation in-flight so we can observe the optimistic cache before
    // onSettled invalidation runs (which would GC the queryFn-less cache entries).
    let resolvePost: () => void = () => {}
    apiClient.post.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePost = resolve
      }),
    )
    const { queryClient, wrapper } = makeWrapper()

    queryClient.setQueryData(queryKeys.questDetail(42), buildMeta())
    queryClient.setQueryData(queryKeys.quests(), [buildMeta()])

    const { result } = renderHook(() => useRateQuestMutation(42), { wrapper })

    result.current.mutate(5)

    await waitFor(() => {
      const detail = queryClient.getQueryData<ApiQuestMeta>(queryKeys.questDetail(42))
      expect(detail?.user_rating).toBe(5)
    })

    const detail = queryClient.getQueryData<ApiQuestMeta>(queryKeys.questDetail(42))
    expect(detail?.rating_count).toBe(11)
    expect(queryClient.getQueryData(queryKeys.questRating(42))).toBe(5)

    const list = queryClient.getQueryData<ApiQuestMeta[]>(queryKeys.quests())
    expect(list?.[0]?.user_rating).toBe(5)
    expect(list?.[0]?.rating_count).toBe(11)

    resolvePost()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back optimistic cache when the request fails with 400', async () => {
    apiClient.post.mockRejectedValue(new ApiError('Bad request', 400))
    const { queryClient, wrapper } = makeWrapper()

    const original = buildMeta()
    queryClient.setQueryData(queryKeys.questDetail(42), original)
    queryClient.setQueryData(queryKeys.quests(), [buildMeta()])
    queryClient.setQueryData(queryKeys.questRating(42), null)

    const { result } = renderHook(() => useRateQuestMutation(42), { wrapper })

    result.current.mutate(5)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    const detail = queryClient.getQueryData<ApiQuestMeta>(queryKeys.questDetail(42))
    expect(detail?.user_rating).toBeNull()
    expect(detail?.rating_count).toBe(10)
    expect(queryClient.getQueryData(queryKeys.questRating(42))).toBeNull()

    const list = queryClient.getQueryData<ApiQuestMeta[]>(queryKeys.quests())
    expect(list?.[0]?.user_rating).toBeNull()
    expect(list?.[0]?.rating_count).toBe(10)
  })
})
