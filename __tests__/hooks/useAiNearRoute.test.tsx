/**
 * #2911: `useAiNearRoute` — дебаунс точек 800 мс, ключ-отпечаток с округлением до 3 знаков,
 * ноль запросов без флага и при пустом маршруте. Таймеры настоящие: фальшивые вешают
 * cleanup RNTL (memory «Jest fake timers ломают RNTL waitFor»), а пауза — меньше секунды.
 */
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { AI_NEAR_ROUTE_DEBOUNCE_MS, nearRoutePointsKey, useAiNearRoute } from '@/hooks/useAiPicks'

const mockFetch = jest.fn()
jest.mock('@/api/aiPicks', () => ({
  ...jest.requireActual('@/api/aiPicks'),
  fetchNearRoute: (...args: unknown[]) => mockFetch(...args),
}))

const mockEnabled = jest.fn(() => true)
jest.mock('@/utils/aiPicksConfig', () => ({
  ...jest.requireActual('@/utils/aiPicksConfig'),
  isAiPicksEnabled: () => mockEnabled(),
}))

jest.mock('@/i18n', () => ({ ...jest.requireActual('@/i18n'), getActiveLocale: () => 'pl' }))

const POINTS = [
  { lat: 53.9006, lng: 27.559 },
  { lat: 53.6778, lng: 23.8294 },
]

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const sleep = async (ms: number) => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
  await act(async () => {})
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockFetch.mockReset()
  mockEnabled.mockReturnValue(true)
  mockFetch.mockResolvedValue([])
})

describe('useAiNearRoute (#2911)', () => {
  it('первый маршрут запрашивается сразу, правки ждут паузу 800 мс и дают один запрос', async () => {
    const hook = await renderHook(({ points }) => useAiNearRoute(points), { wrapper, initialProps: { points: [POINTS[0]] } })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ points: [POINTS[0]], locale: 'pl', limit: 8 })
    expect(mockFetch.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
    // Пока точки меняются, нового запроса нет: каждая правка отсчитывает паузу заново.
    await hook.rerender({ points: [...POINTS, { lat: 53.5, lng: 25 }] })
    await sleep(AI_NEAR_ROUTE_DEBOUNCE_MS / 2)
    await hook.rerender({ points: POINTS })
    await sleep(AI_NEAR_ROUTE_DEBOUNCE_MS / 2)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), { timeout: AI_NEAR_ROUTE_DEBOUNCE_MS * 2 })
    expect(mockFetch.mock.calls[1][0]).toMatchObject({ points: POINTS })
    expect(client.getQueryCache().find({ queryKey: queryKeys.aiNearRoute(nearRoutePointsKey(POINTS), 'pl') })).toBeTruthy()
  })

  it('без флага EXPO_PUBLIC_AI_PICKS и при пустом маршруте запросов нет', async () => {
    mockEnabled.mockReturnValue(false)
    const off = await renderHook(() => useAiNearRoute(POINTS), { wrapper })
    await sleep(20)
    expect(off.result.current.fetchStatus).toBe('idle')
    mockEnabled.mockReturnValue(true)
    const empty = await renderHook(() => useAiNearRoute([]), { wrapper })
    await sleep(20)
    expect(empty.result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('ключ — отпечаток точек до 3 знаков: сдвиг на метры кэш не сбрасывает', () => {
    const key = nearRoutePointsKey(POINTS)
    expect(key).toBe('53.901,27.559;53.678,23.829')
    expect(nearRoutePointsKey([{ lat: 53.9007, lng: 27.5591 }, { lat: 53.6779, lng: 23.8291 }])).toBe(key)
    expect(nearRoutePointsKey([POINTS[1], POINTS[0]])).not.toBe(key)
  })
})
