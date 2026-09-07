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
const originalTrackSegments: Array<Array<[number, number]>> = [
  Array.from({ length: 120 }, (_, index) => [
    27.56 + index * 0.00033,
    53.9 + index * 0.00008 + (index % 2 === 0 ? 0.00004 : -0.00004),
  ]),
]

// Два кольца похода в разных концах региона (#1847): склейка проводила между
// ними прямую через весь регион, которой в файле нет.
const twoRingSegments: Array<Array<[number, number]>> = [
  [
    [6.42, 49.81],
    [6.43, 49.82],
    [6.42, 49.81],
  ],
  [
    [6.3, 49.79],
    [6.31, 49.8],
    [6.3, 49.79],
  ],
]

describe('TripPlanRouteMap (native) — оригинальный трек', () => {
  beforeEach(() => {
    mockNativeMapProps.length = 0
  })

  it('передаёт оригинал отдельным каналом, не подменяя точки и линию маршрута', () => {
    render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrackSegments={originalTrackSegments} />,
    )

    const props = mockNativeMapProps[mockNativeMapProps.length - 1]
    expect(props.originalTrackSegments).toHaveLength(1)
    expect((props.originalTrackSegments as unknown[][])[0]).toHaveLength(120)
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
      mockNativeMapProps[mockNativeMapProps.length - 1].originalTrackSegments,
    ).toEqual([])
    withoutTrack.unmount()

    const withTrack = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrackSegments={originalTrackSegments} />,
    )
    expect(withTrack.getByTestId('trip-plan-map-original-track-legend')).toBeTruthy()
  })

  it('не скрывает легенду оригинала в mobile fill-mode', () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrackSegments={originalTrackSegments}
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
        originalTrackSegments={[[[27.56, 53.9]]]}
      />,
    )

    // Одна точка линией не станет — в WebView такой сегмент не уезжает вовсе.
    expect(mockNativeMapProps[mockNativeMapProps.length - 1].originalTrackSegments).toEqual([])
  })

  it('#1851 без точек маршрута объявляет центром начало оригинала, а не дефолтный Минск', () => {
    // Видимый кадр в этом случае ставит fitBounds внутри WebView; здесь
    // проверяется объявленный центр — страховка веток nativeMapHtml, которые
    // читают map.__userCenter, когда рисовать маршрут не от чего.
    render(<TripPlanRouteMap route={[]} originalTrackSegments={twoRingSegments} />)

    const props = mockNativeMapProps[mockNativeMapProps.length - 1]
    // Первая пара первого сегмента — [lng, lat], карта ждёт их разложенными.
    expect(props.coordinates).toEqual({ latitude: 49.81, longitude: 6.42 })
    // Сам трек по-прежнему уезжает целиком: центровка его не подменяет.
    expect(props.originalTrackSegments).toEqual(twoRingSegments)
    expect(props.routePoints).toEqual([])
  })

  it('#1851 при наличии точек маршрута центр берётся по-прежнему из них', () => {
    render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrackSegments={twoRingSegments} />,
    )

    const props = mockNativeMapProps[mockNativeMapProps.length - 1]
    expect(props.coordinates).toEqual({ latitude: 53.9, longitude: 27.56 })
  })

  it('#1847 отдаёт каждый трек файла отдельной линией, не склеивая их', () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrackSegments={twoRingSegments}
      />,
    )

    const props = mockNativeMapProps[mockNativeMapProps.length - 1]
    expect(props.originalTrackSegments).toEqual(twoRingSegments)
    // Легенда одна на весь оригинал, а не по пункту на сегмент.
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
  })
})
