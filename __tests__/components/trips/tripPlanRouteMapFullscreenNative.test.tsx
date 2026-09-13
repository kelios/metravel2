/**
 * #1897 — полноэкранный режим карты конструктора на native.
 *
 * На web карта разворачивается порталом и сворачивается по Escape; на
 * Android/iOS Escape нет, поэтому паритет — кнопка `maximize-2` открывает
 * `Modal` с той же картой, а `minimize-2` (или системный «назад») закрывает.
 * Контракт теста:
 *  1. до разворота модалки нет, кнопка подписана «развернуть»;
 *  2. разворот показывает модалку, карта в ней получает тот же маршрут
 *     (точки и линия парами [lng, lat]) — ничего не теряется;
 *  3. сворачивание убирает модалку, карта возвращается во встроенный слот с тем
 *     же маршрутом; закрытие двухфазное, поэтому unmount ждёт кадр.
 */
import React from 'react'
import { Modal } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const mockMapProps: Array<Record<string, unknown>> = []

jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')

  const MockNativeMap = (props: Record<string, unknown>) => {
    mockMapProps.push(props)
    return <View testID="native-map" />
  }

  return {
    __esModule: true,
    default: MockNativeMap,
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap'

const EXPAND = 'Развернуть карту на весь экран'
const COLLAPSE = 'Свернуть карту'

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]
const routeGeometry: Array<[number, number]> = [
  [27.56, 53.9],
  [27.58, 53.905],
  [27.6, 53.91],
]

describe('TripPlanRouteMap (native) — полноэкранный режим', () => {
  beforeEach(() => {
    mockMapProps.length = 0
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('разворачивает карту в модалку и сворачивает обратно без потери маршрута', () => {
    const { getByTestId, queryByTestId, getAllByTestId, getByLabelText, queryByLabelText } = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} routingState="ok" />,
    )

    expect(queryByTestId('trip-plan-map-fullscreen-modal')).toBeNull()
    expect(getByLabelText(EXPAND)).toBeTruthy()
    const inlineProps = mockMapProps.at(-1)!
    expect(inlineProps.routePoints).toEqual([[27.56, 53.9], [27.6, 53.91]])
    expect(inlineProps.fullRouteCoords).toEqual(routeGeometry)

    fireEvent.press(getByTestId('trip-plan-map-fullscreen'))

    expect(getByTestId('trip-plan-map-fullscreen-modal')).toBeTruthy()
    expect(getByTestId('trip-plan-map-fullscreen-placeholder')).toBeTruthy()
    expect(getByLabelText(COLLAPSE)).toBeTruthy()
    expect(queryByLabelText(EXPAND)).toBeNull()
    const fullscreenProps = mockMapProps.at(-1)!
    expect(fullscreenProps.routePoints).toEqual(inlineProps.routePoints)
    expect(fullscreenProps.fullRouteCoords).toEqual(inlineProps.fullRouteCoords)
    expect(fullscreenProps.mode).toBe('route')
    // Карта одна: встроенный слот отдаёт место заглушке, второй Leaflet-WebView
    // на слабом Android не монтируется.
    expect(getAllByTestId('native-map')).toHaveLength(1)

    fireEvent.press(getByTestId('trip-plan-map-fullscreen'))
    // Первая фаза: модалка ещё смонтирована, чтобы touch-каскад завершился.
    expect(getByTestId('trip-plan-map-fullscreen-modal')).toBeTruthy()
    act(() => {
      jest.runAllTimers()
    })

    expect(queryByTestId('trip-plan-map-fullscreen-modal')).toBeNull()
    expect(queryByTestId('trip-plan-map-fullscreen-placeholder')).toBeNull()
    expect(getByLabelText(EXPAND)).toBeTruthy()
    const restoredProps = mockMapProps.at(-1)!
    expect(restoredProps.routePoints).toEqual(inlineProps.routePoints)
    expect(restoredProps.fullRouteCoords).toEqual(inlineProps.fullRouteCoords)
  })

  it('системный «назад» на Android сворачивает карту, а не выходит с экрана', () => {
    const { getByTestId, queryByTestId, UNSAFE_getByType } = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} />,
    )

    fireEvent.press(getByTestId('trip-plan-map-fullscreen'))
    const requestClose = UNSAFE_getByType(Modal).props.onRequestClose as () => void
    act(() => {
      requestClose()
      jest.runAllTimers()
    })

    expect(queryByTestId('trip-plan-map-fullscreen-modal')).toBeNull()
    expect(getByTestId('trip-plan-map-fullscreen')).toBeTruthy()
  })

  it('«Изменить» из полноэкранного режима сворачивает карту и открывает редактор точки', () => {
    const onEditPoint = jest.fn()
    const { getByTestId, queryByTestId } = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} onEditPoint={onEditPoint} />,
    )

    fireEvent.press(getByTestId('trip-plan-map-fullscreen'))
    const fullscreenProps = mockMapProps.at(-1)!
    act(() => {
      ;(fullscreenProps.onRoutePointPress as (index: number) => void)(1)
    })
    fireEvent.press(getByTestId('trip-plan-map-edit-point'))
    act(() => {
      jest.runAllTimers()
    })

    expect(onEditPoint).toHaveBeenCalledWith(1)
    expect(queryByTestId('trip-plan-map-fullscreen-modal')).toBeNull()
  })
})
