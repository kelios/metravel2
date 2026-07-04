import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import type { ApiQuestMeta } from '@/api/quests'
import { useQuestsForLocation } from '@/hooks/useQuestForLocation'

const mockFetchQuestsNearLocation = jest.fn()
const mockFetchQuestsList = jest.fn()

jest.mock('@/api/quests', () => ({
  fetchQuestsNearLocation: (...args: Parameters<typeof mockFetchQuestsNearLocation>) =>
    mockFetchQuestsNearLocation(...args),
  fetchQuestsList: (...args: Parameters<typeof mockFetchQuestsList>) => mockFetchQuestsList(...args),
}))

const apiQuest: ApiQuestMeta = {
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Тайна Краковского дракона',
  points: '9',
  city_id: 'krakow',
  city_name: 'Краков',
  country_id: null,
  country_name: 'Польша',
  country_code: 'pl',
  lat: '50.0614',
  lng: '19.9366',
  duration_min: 120,
  difficulty: 'easy',
  tags: null,
  pet_friendly: true,
  cover_url: null,
  rating_avg: null,
  rating_count: 0,
  user_rating: null,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useQuestsForLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses server near-location results without loading the full quests list', async () => {
    mockFetchQuestsNearLocation.mockResolvedValueOnce([
      {
        quest: apiQuest,
        score: 115,
        distance_km: 0.2,
      },
    ])

    const { result } = renderHook(
      () =>
        useQuestsForLocation(
          {
            cityName: 'Краков',
            countryName: 'Польша',
            countryCode: 'pl',
            coords: [{ lat: 50.0615, lng: 19.937 }],
          },
          { limit: 1 },
        ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1)
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('krakow-dragon')
  })

  it('loads the full quests list only when near-location is unavailable and returns fallback matches', async () => {
    mockFetchQuestsNearLocation.mockRejectedValueOnce(new ApiError(404, 'Not found'))
    mockFetchQuestsList.mockResolvedValueOnce([apiQuest])

    const { result } = renderHook(
      () =>
        useQuestsForLocation(
          {
            cityName: 'Краков',
            countryName: 'Польша',
            countryCode: 'pl',
            coords: [{ lat: 50.0615, lng: 19.937 }],
          },
          { limit: 1 },
        ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(mockFetchQuestsList).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('krakow-dragon')
  })
})
