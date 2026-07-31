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

/**
 * Локация фикстуры — белорусская, и это существенно.
 *
 * Городские квесты MeTravel есть только по Беларуси, поэтому с `cfdf6b5f` хук
 * отсекает `/quests/near-location/` вне зоны покрытия (`isWithinQuestCoverage`,
 * #1149): запрос стоил 0.77–1.85 с TTFB с `cache-control: no-store` и стабильно
 * отвечал пустым списком. Прежняя фикстура была краковская, `country_code: 'pl'`,
 * то есть заведомо вне покрытия — после появления гейта обе проверки ниже стали
 * ждать вызовов, которых по контракту хука больше не бывает.
 */
const apiQuest: ApiQuestMeta = {
  id: 1,
  quest_id: 'minsk-legends',
  title: 'Легенды старого Минска',
  points: '9',
  city_id: 'minsk',
  city_name: 'Минск',
  country_id: null,
  country_name: 'Беларусь',
  country_code: 'by',
  lat: '53.9023',
  lng: '27.5619',
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

/** Локация в зоне покрытия — Минск, рядом с координатой квеста из фикстуры. */
const MINSK_QUERY = {
  cityName: 'Минск',
  countryName: 'Беларусь',
  countryCode: 'by',
  coords: [{ lat: 53.9026, lng: 27.5625 }],
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

    const { result } = renderHook(() => useQuestsForLocation(MINSK_QUERY, { limit: 1 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1)
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('minsk-legends')
  })

  it('loads the full quests list only when near-location is unavailable and returns fallback matches', async () => {
    mockFetchQuestsNearLocation.mockRejectedValueOnce(new ApiError(404, 'Not found'))
    mockFetchQuestsList.mockResolvedValueOnce([apiQuest])

    const { result } = renderHook(() => useQuestsForLocation(MINSK_QUERY, { limit: 1 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFetchQuestsList).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('minsk-legends')
  })

  /**
   * Инвариант, ради которого гейт и вводился (#1149). На уровне хука он не был
   * покрыт ничем: `__tests__/utils/questForLocationCoverage.test.ts` проверяет
   * только сам предикат, а не то, что хук из-за него не ходит в сеть. Именно
   * поэтому расхождение хука с этим файлом никто не заметил.
   */
  it('вне зоны покрытия квестов не делает ни одного запроса', async () => {
    const { result } = renderHook(
      () =>
        useQuestsForLocation(
          {
            cityName: 'Далат',
            countryName: 'Вьетнам',
            countryCode: 'vn',
            coords: [{ lat: 11.923253, lng: 108.4537353 }],
          },
          { limit: 1 },
        ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).not.toHaveBeenCalled()
    // Клиентский fallback тоже не поднимается: он включается только на 404, а
    // запроса не было вовсе.
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toEqual([])
  })
})
