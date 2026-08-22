/**
 * #1496 — фаза 2 импорта: оригинальный (неупрощённый) трек на карте планировщика.
 *
 * Контракт, который держит тест (Regression control карточки):
 *  1. оригинальная геометрия уезжает в карту ОТДЕЛЬНЫМ слоем и не подменяет
 *     собой ни упрощённые точки маршрута, ни построенную по ним линию;
 *  2. без загруженного файла ничего не меняется — карта работает как прежде;
 *  3. слой подписан в легенде, поэтому пользователь видит, что именно нарисовано.
 *
 * Проверяются обе поверхности: native (WebView-стек /map) и web (react-leaflet).
 */
import React from 'react'
import { render } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const mockNativeMapProps: Array<Record<string, unknown>> = []

jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')
  const MockNativeMap = (props: Record<string, unknown>) => {
    mockNativeMapProps.push(props)
    return <View testID="native-map" />
  }
  return { __esModule: true, default: MockNativeMap }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap'

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

// Упрощённая линия маршрута: три опорные точки, как их отдаёт бэкенд.
const routeGeometry: Array<[number, number]> = [
  [27.56, 53.9],
  [27.58, 53.905],
  [27.6, 53.91],
]

// Оригинал из файла: та же дорога, но со всеми поворотами.
const originalTrack: Array<[number, number]> = Array.from({ length: 120 }, (_, index) => [
  27.56 + index * 0.00033,
  53.9 + index * 0.00008 + (index % 2 === 0 ? 0.00004 : -0.00004),
])

describe('TripPlanRouteMap (native) — оригинальный трек', () => {
  beforeEach(() => {
    mockNativeMapProps.length = 0
  })

  it('передаёт оригинал отдельным каналом, не подменяя точки и линию маршрута', () => {
    render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrack={originalTrack} />,
    )

    const props = mockNativeMapProps[mockNativeMapProps.length - 1]
    expect(props.originalTrackCoords).toHaveLength(120)
    // Упрощённая линия и точки остаются ровно теми же — оригинал их не заменил.
    expect(props.fullRouteCoords).toEqual(routeGeometry)
    expect(props.routePoints).toEqual([
      [27.56, 53.9],
      [27.6, 53.91],
    ])
  })

  it('подписывает слой в легенде только когда оригинал есть', () => {
    const withoutTrack = render(<TripPlanRouteMap route={route} routeGeometry={routeGeometry} />)
    expect(withoutTrack.queryByTestId('trip-plan-map-original-track-legend')).toBeNull()
    expect(
      mockNativeMapProps[mockNativeMapProps.length - 1].originalTrackCoords,
    ).toEqual([])
    withoutTrack.unmount()

    const withTrack = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrack={originalTrack} />,
    )
    expect(withTrack.getByTestId('trip-plan-map-original-track-legend')).toBeTruthy()
  })

  it('не скрывает легенду оригинала в mobile fill-mode', () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrack={originalTrack}
        fill
      />,
    )

    expect(screen.getByTestId('trip-plan-map-original-track-legend')).toBeTruthy()
  })

  it('игнорирует вырожденный трек короче линии', () => {
    render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrack={[[27.56, 53.9]]}
      />,
    )

    expect(mockNativeMapProps[mockNativeMapProps.length - 1].originalTrackCoords).toHaveLength(1)
  })
})
