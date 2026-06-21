// __tests__/api/questRating.test.ts
// Unit tests for api/questRating.ts (POST/GET, валидация, 404→null)
// и hooks/useQuestRating.ts (оптимистика + rollback).
//
// __DEV__ === false в тестовом окружении (см. __tests__/setup.ts), поэтому
// QUEST_RATING_MOCK-шорткат неактивен и упражняется реальный сетевой путь.

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
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

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '7' }),
}))

import { apiClient, ApiError } from '@/api/client'
import { rateQuest, getUserQuestRating } from '@/api/questRating'
import { useQuestRatingMutation } from '@/hooks/useQuestRating'
import { queryKeys } from '@/api/queryKeys'
import { type ApiQuestMeta } from '@/api/quests'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

const baseMeta = (overrides: Partial<ApiQuestMeta> = {}): ApiQuestMeta => ({
  id: 42,
  quest_id: 'minsk-test',
  title: 'Test Quest',
  points: '5',
  city_id: '1',
  city_name: 'Minsk',
  lat: '53.9',
  lng: '27.5',
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  rating_avg: 4,
  rating_count: 2,
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

  it('POST /quests/{id}/rate/ on rateQuest happy-path', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    await expect(rateQuest(42, 4)).resolves.toBeUndefined()
    expect(mockPost).toHaveBeenCalledWith('/quests/42/rate/', { rating: 4 })
  })

  it('rejects invalid rating without calling the API', async () => {
    await expect(rateQuest(42, 0 as 1)).rejects.toThrow('от 1 до 5')
    await expect(rateQuest(42, 6 as 5)).rejects.toThrow('от 1 до 5')
    await expect(rateQuest(42, 2.5 as 2)).rejects.toThrow('от 1 до 5')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('getUserQuestRating returns null on 404', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404, 'not found'))
    await expect(getUserQuestRating(42)).resolves.toBeNull()
  })

  it('getUserQuestRating returns the stored rating', async () => {
    mockGet.mockResolvedValueOnce({ user_rating: 5 })
    await expect(getUserQuestRating(42)).resolves.toBe(5)
  })
})

const makeWrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children)
  }

describe('hooks/useQuestRating', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockResolvedValue(null)
  })

  it('optimistically updates detail + list, keeps them on success', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    // После сохранения сервер отдаёт поставленную оценку — onSettled-инвалидация
    // questRating перечитывает её, не сбрасывая оптимистичное состояние.
    mockGet.mockResolvedValue(5)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(queryKeys.questDetail(42), baseMeta())
    client.setQueryData(queryKeys.quests(), [baseMeta()])

    const { result } = renderHook(() => useQuestRatingMutation(42), {
      wrapper: makeWrapper(client),
    })

    act(() => {
      result.current.rate(5)
    })

    await waitFor(() => {
      expect(client.getQueryData(queryKeys.questRating(42))).toBe(5)
    })

    const detail = client.getQueryData<ApiQuestMeta>(queryKeys.questDetail(42))
    expect(detail?.user_rating).toBe(5)
    expect(detail?.rating_count).toBe(3)
    const list = client.getQueryData<ApiQuestMeta[]>(queryKeys.quests())
    expect(list?.[0].user_rating).toBe(5)
  })

  it('rolls back optimistic update on error', async () => {
    mockPost.mockRejectedValueOnce(new Error('boom'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(queryKeys.questDetail(42), baseMeta())
    client.setQueryData(queryKeys.quests(), [baseMeta()])

    const { result } = renderHook(() => useQuestRatingMutation(42), {
      wrapper: makeWrapper(client),
    })

    act(() => {
      result.current.rate(5)
    })

    await waitFor(() => {
      expect(client.getQueryData(queryKeys.questRating(42))).toBeNull()
    })

    const detail = client.getQueryData<ApiQuestMeta>(queryKeys.questDetail(42))
    expect(detail?.user_rating).toBeNull()
    expect(detail?.rating_count).toBe(2)
    const list = client.getQueryData<ApiQuestMeta[]>(queryKeys.quests())
    expect(list?.[0].user_rating).toBeNull()
  })
})
