// #2065: «Повторить» для сохранённого приблизительного маршрута — видимость,
// cooldown и вызов мутации в одном хуке для всех трёх поверхностей (шапка
// карты web/native, строка итога мобильной раскладки).
import { act, renderHook } from '@testing-library/react-native'

import type { RoutingState } from '@/api/plannedTrips'
import {
  SAVED_ROUTE_RETRY_COOLDOWN_MS,
  useSavedRouteRetry,
} from '@/components/trips/planning/useSavedRouteRetry'

const mockMutate = jest.fn()
const mockRefreshState: { isPending: boolean } = { isPending: false }

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRefreshTripRouteElevation: () => ({ mutate: mockMutate, isPending: mockRefreshState.isPending }),
}))

const degraded = (fallbackReason: string): RoutingState => ({
  provider: 'direct',
  isOptimal: false,
  fallbackReason,
  warnings: [],
})

beforeEach(() => {
  mockMutate.mockReset()
  mockRefreshState.isPending = false
})

describe('useSavedRouteRetry (#2065)', () => {
  // Таблица §2 `docs/features/trips-plan-route-tab-mock.md`: временные коды
  // получают «Повторить», постоянная причина (4xx кроме 401/403/429) — нет.
  const temporaryCodes = ['ors_http_502', 'ors_http_429', 'ors_request_failed', 'route_provider_unavailable']

  it.each(temporaryCodes)('владелец видит кнопку у временной причины %s', (code) => {
    const routingState = degraded(code)
    const { result } = renderHook(() =>
      useSavedRouteRetry({
        tripId: 205701,
        isOwner: true,
        routingState,
        savedRoutingState: routingState,
      }),
    )

    expect(result.current.visible).toBe(true)
  })

  it('владелец не видит кнопку у постоянной причины ors_http_404', () => {
    const routingState = degraded('ors_http_404')
    const { result } = renderHook(() =>
      useSavedRouteRetry({
        tripId: 205701,
        isOwner: true,
        routingState,
        savedRoutingState: routingState,
      }),
    )

    expect(result.current.visible).toBe(false)
  })

  it.each(temporaryCodes)('не-владелец не видит кнопку даже у временной причины %s', (code) => {
    const routingState = degraded(code)
    const { result } = renderHook(() =>
      useSavedRouteRetry({
        tripId: 205701,
        isOwner: false,
        routingState,
        savedRoutingState: routingState,
      }),
    )

    expect(result.current.visible).toBe(false)
  })

  it('кнопка скрыта, пока живое превью несохранённых правок владеет отображаемой тройкой', () => {
    // `useTripRouteDisplay` отдаёт `trip.routingState` без копирования только
    // когда правки совпадают с сохранёнными — здесь ссылки нарочно разные.
    const savedRoutingState = degraded('ors_http_502')
    const previewRoutingState = degraded('ors_http_502')
    const { result } = renderHook(() =>
      useSavedRouteRetry({
        tripId: 205701,
        isOwner: true,
        routingState: previewRoutingState,
        savedRoutingState,
      }),
    )

    expect(result.current.visible).toBe(false)
  })

  it('нажатие зовёт мутацию ровно один раз с tripId', () => {
    const routingState = degraded('ors_http_502')
    const { result, rerender } = renderHook(() =>
      useSavedRouteRetry({
        tripId: 205701,
        isOwner: true,
        routingState,
        savedRoutingState: routingState,
      }),
    )

    act(() => result.current.onPress())

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith(
      { tripId: 205701 },
      { onSettled: expect.any(Function) },
    )

    // Запрос в полёте — повторный тап тем же кликом ничего не шлёт.
    mockRefreshState.isPending = true
    rerender()
    act(() => result.current.onPress())
    expect(mockMutate).toHaveBeenCalledTimes(1)
  })

  it('disabled во время запроса и ещё 10 с после ответа, потом снова активна', () => {
    jest.useFakeTimers()
    try {
      const routingState = degraded('ors_http_502')
      const { result, rerender } = renderHook(() =>
        useSavedRouteRetry({
          tripId: 205701,
          isOwner: true,
          routingState,
          savedRoutingState: routingState,
        }),
      )

      expect(result.current.disabled).toBe(false)

      act(() => result.current.onPress())
      const onSettled = mockMutate.mock.calls[0][1].onSettled as () => void

      // Запрос в полёте: `isPending` держит хук в mock до симулированного ответа.
      mockRefreshState.isPending = true
      rerender()
      expect(result.current.pending).toBe(true)
      expect(result.current.disabled).toBe(true)

      // Ответ пришёл — pending снят, но cooldown только начался.
      act(() => {
        mockRefreshState.isPending = false
        onSettled()
      })
      rerender()
      expect(result.current.pending).toBe(false)
      expect(result.current.disabled).toBe(true)

      act(() => {
        jest.advanceTimersByTime(SAVED_ROUTE_RETRY_COOLDOWN_MS - 1)
      })
      expect(result.current.disabled).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(result.current.disabled).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })
})
