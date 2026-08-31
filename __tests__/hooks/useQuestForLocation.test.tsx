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
 * Фикстура краковская, и это существенно.
 *
 * С `cfdf6b5f` (#1149) хук отсекал `/quests/near-location/` статическим
 * Беларусь-only гейтом, поэтому #1179 перевела фикстуру на Минск. #1647 снял
 * этот гейт: квесты Кракова опубликованы, прод на запросе travel 737 отдаёт
 * `count=37`, и страна больше не имеет права запрещать запрос. Возврат к
 * краковской локации здесь — тот самый regression control.
 */
const apiQuest: ApiQuestMeta = {
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Краковский дракон',
  points: '9',
  city_id: 'krakow',
  city_name: 'Краков',
  country_id: null,
  country_name: 'Польша',
  country_code: 'pl',
  lat: '50.0546',
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

/** Ровно то, что travel 737 отдаёт в `QuestForCitySection` (составной cityName, #1369). */
const KRAKOW_QUERY = {
  cityName: 'Dominikanów · Краков · Малопольское воеводство · Польша',
  countryName: 'Польша',
  countryCode: 'pl',
  coords: [{ lat: 50.086575, lng: 19.9663028 }],
}

describe('useQuestsForLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('спрашивает сервер про зарубежную локацию и не грузит полный список квестов', async () => {
    mockFetchQuestsNearLocation.mockResolvedValueOnce([
      {
        quest: apiQuest,
        score: 300,
        distance_km: 3.46,
      },
    ])

    const { result } = renderHook(() => useQuestsForLocation(KRAKOW_QUERY, { limit: 6 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1)
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('krakow-dragon')
    expect(result.current.matches[0].distanceKm).toBe(3.46)
  })

  /**
   * `country_code` уходит в запрос отдельно от имени: по имени бэкенд сверяется
   * только с `title_ru`/`title_en` страны, и незнакомое ему имя фильтр не
   * снимает, а рубит выдачу — кандидат дальше 15 км считается «другой страной».
   * А запрос совсем без признаков страны и города вырождается в ранжирование по
   * дистанции по всему каталогу (прод 2026-08-31: Вьетнам по одним координатам →
   * 165 матчей, ближайший Тбилиси в 6950 км).
   */
  it('передаёт серверу город, страну, код страны и первую координату', async () => {
    mockFetchQuestsNearLocation.mockResolvedValueOnce([])

    const { result } = renderHook(() => useQuestsForLocation(KRAKOW_QUERY, { limit: 6 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1))

    expect(mockFetchQuestsNearLocation).toHaveBeenCalledWith(
      {
        city: 'Dominikanów · Краков · Малопольское воеводство · Польша',
        country: 'Польша',
        country_code: 'pl',
        lat: 50.086575,
        lng: 19.9663028,
        limit: 6,
      },
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(result.current.matches).toEqual([])
  })

  it('загружает полный список квестов только когда near-location недоступен (404)', async () => {
    mockFetchQuestsNearLocation.mockRejectedValueOnce(new ApiError(404, 'Not found'))
    mockFetchQuestsList.mockResolvedValueOnce([apiQuest])

    const { result } = renderHook(() => useQuestsForLocation(KRAKOW_QUERY, { limit: 6 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockFetchQuestsList).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsList).toHaveBeenCalledTimes(1)
    expect(result.current.matches).toHaveLength(1)
    expect(result.current.matches[0].quest.id).toBe('krakow-dragon')
  })

  /**
   * Инвариант #734: пустой HTTP 200 — авторитетный ответ «здесь квестов нет».
   * Широкий `/api/quests/` поднимается только на 404, иначе каждая статья без
   * квестов тянула бы весь каталог.
   */
  it('пустой ответ сервера не поднимает широкую загрузку каталога', async () => {
    mockFetchQuestsNearLocation.mockResolvedValueOnce([])

    const { result } = renderHook(
      () =>
        useQuestsForLocation(
          {
            cityName: 'Далат, Đà Lạt District, Ламдонг, 02633, Вьетнам',
            countryName: 'Вьетнам',
            countryCode: 'vn',
            coords: [{ lat: 11.923253, lng: 108.4537353 }],
          },
          { limit: 6 },
        ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).toHaveBeenCalledTimes(1)
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toEqual([])
  })

  /** Единственный оставшийся клиентский гейт: без локации сети быть не должно. */
  it('без локации не делает ни одного запроса', async () => {
    const { result } = renderHook(
      () => useQuestsForLocation({ cityName: '  ', countryName: null, coords: [] }, { limit: 6 }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetchQuestsNearLocation).not.toHaveBeenCalled()
    expect(mockFetchQuestsList).not.toHaveBeenCalled()
    expect(result.current.matches).toEqual([])
  })
})
