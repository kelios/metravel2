/**
 * #1683 — точка с битыми координатами не роняет карту плана поездки.
 *
 * Контракт, который держит тест: пара координат уходит в Leaflet только после
 * общего предиката `isDrawableCoordinatePair` — и на web (маркер, линия,
 * подгонка кадра, центрирование на точке из списка), и на native (точки и
 * линия, которые карта плана отдаёт WebView). Битая точка молча пропускается,
 * остальной маршрут рисуется.
 *
 * Моки `Marker`, `Polyline`, `latLngBounds` и `setView` здесь НЕ passthrough:
 * они валидируют LatLng так же, как настоящий Leaflet, и бросают на
 * `NaN`/`Infinity`. Без этого тест не увидел бы реального падения — ровно эта
 * дыра была у `tripPlanRouteMapPopupCoordinates.test.tsx`.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const mockMarkerPositions: unknown[] = []
const mockPolylinePositions: unknown[][] = []
const mockBoundsPositions: unknown[][] = []
const mockSetViewPositions: unknown[] = []
const mockNativeMapProps: Array<Record<string, unknown>> = []

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => {
  // Проверка живёт внутри фабрики: babel-plugin-jest-hoist поднимает мок выше
  // модульных объявлений и запрещает ссылки на внешние переменные.
  const assertPair = (value: unknown, source: string) => {
    // Тот же класс ошибки, что бросает настоящий Leaflet на невалидном LatLng.
    const pair = value as [unknown, unknown]
    if (!Array.isArray(pair) || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) {
      throw new Error(`Invalid LatLng object: (${String(pair?.[0])}, ${String(pair?.[1])}) in ${source}`)
    }
  }

  return {
    loadLeafletRuntime: async () => ({
      L: {
        divIcon: (options: unknown) => options,
        latLngBounds: (positions: unknown) => {
          const list = positions as unknown[]
          list.forEach((pair) => assertPair(pair, 'latLngBounds'))
          mockBoundsPositions.push(list)
          return positions
        },
      },
      RL: {
        Marker: ({ position, children }: { position: unknown; children?: React.ReactNode }) => {
          assertPair(position, 'marker')
          mockMarkerPositions.push(position)
          return <>{children}</>
        },
        Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
        Polyline: ({ positions }: { positions: unknown[] }) => {
          positions.forEach((pair) => assertPair(pair, 'polyline'))
          mockPolylinePositions.push(positions)
          return null
        },
        useMap: () => ({
          setView: (position: unknown) => {
            assertPair(position, 'setView')
            mockSetViewPositions.push(position)
          },
          getZoom: () => 12,
          fitBounds: jest.fn(),
          stop: jest.fn(),
        }),
        useMapEvents: () => null,
      },
    }),
  }
})

jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <div data-testid="map-canvas">{children?.({})}</div>
  ),
}))

jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')

  // Имя с заглавной буквы обязательно: иначе eslint не считает функцию
  // компонентом (react-hooks/rules-of-hooks).
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

import TripPlanRouteMapWeb from '@/components/trips/planning/TripPlanRouteMap.web'
import TripPlanRouteMapNative from '@/components/trips/planning/TripPlanRouteMap'
import { isDrawableCoordinatePair } from '@/components/trips/planning/tripPlanFormatting'

// Контракт хранения: `RoutePoint.coordinates` = [lng, lat].
const START: [number, number] = [27.56, 53.9]
const FINISH: [number, number] = [27.6, 53.91]
const BROKEN_LAT: [number, number] = [26.247111, Number.NaN]
const BROKEN_LNG: [number, number] = [Number.POSITIVE_INFINITY, 56.006732]
// Трек намеренно не совпадает с точками маршрута: иначе тест не отличил бы
// «трек нарисован без битой пары» от «трек потерян целиком».
const TRACK_START: [number, number] = [27.55, 53.88]
const TRACK_END: [number, number] = [27.62, 53.93]

const point = (id: string, name: string, coordinates: [number, number] | null): RoutePoint => ({
  id,
  type: 'place',
  name,
  description: null,
  coordinates,
  placeId: null,
})

const routeWithBrokenPoints: RoutePoint[] = [
  point('a', 'Старт', START),
  point('broken-lat', 'Битая широта', BROKEN_LAT),
  point('broken-lng', 'Битая долгота', BROKEN_LNG),
  point('b', 'Финиш', FINISH),
]

const collectText = (node: unknown): string[] => {
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(collectText)
  if (node && typeof node === 'object' && 'children' in node) {
    return collectText((node as { children: unknown }).children)
  }
  return []
}

beforeEach(() => {
  mockMarkerPositions.length = 0
  mockPolylinePositions.length = 0
  mockBoundsPositions.length = 0
  mockSetViewPositions.length = 0
  mockNativeMapProps.length = 0
})

describe('isDrawableCoordinatePair', () => {
  it('пропускает только пару из двух конечных чисел', () => {
    expect(isDrawableCoordinatePair(START)).toBe(true)
    expect(isDrawableCoordinatePair(BROKEN_LAT)).toBe(false)
    expect(isDrawableCoordinatePair(BROKEN_LNG)).toBe(false)
    expect(isDrawableCoordinatePair([Number.NEGATIVE_INFINITY, 53.9])).toBe(false)
    expect(isDrawableCoordinatePair([27.56])).toBe(false)
    expect(isDrawableCoordinatePair(null)).toBe(false)
    expect(isDrawableCoordinatePair(undefined)).toBe(false)
  })
})

describe('TripPlanRouteMap.web — битые координаты точки', () => {
  it('рисует остальной маршрут и не строит маркер на битой паре', async () => {
    const screen = render(<TripPlanRouteMapWeb route={routeWithBrokenPoints} />)

    await waitFor(() => expect(collectText(screen.toJSON())).toContain('Старт'))

    // Маркеры Leaflet ждут [lat, lng] — порядок инвертирован относительно хранения.
    expect(mockMarkerPositions).toEqual([
      [START[1], START[0]],
      [FINISH[1], FINISH[0]],
    ])
    const text = collectText(screen.toJSON())
    expect(text).toContain('Финиш')
    expect(text).not.toContain('Битая широта')
    expect(text).not.toContain('Битая долгота')
  })

  it('не пускает битую пару в линию маршрута и подгонку кадра', async () => {
    const screen = render(<TripPlanRouteMapWeb route={routeWithBrokenPoints} />)

    await waitFor(() => expect(mockPolylinePositions.length).toBeGreaterThan(0))

    expect(mockPolylinePositions[0]).toEqual([
      [START[1], START[0]],
      [FINISH[1], FINISH[0]],
    ])
    await waitFor(() => expect(mockBoundsPositions.length).toBeGreaterThan(0))
    expect(mockBoundsPositions[0]).toEqual([
      [START[1], START[0]],
      [FINISH[1], FINISH[0]],
    ])
    expect(screen.toJSON()).toBeTruthy()
  })

  it('переживает битую пару в оригинальном треке', async () => {
    const screen = render(
      <TripPlanRouteMapWeb
        route={[point('a', 'Старт', START), point('b', 'Финиш', FINISH)]}
        originalTrack={[TRACK_START, BROKEN_LAT, TRACK_END]}
      />,
    )

    await waitFor(() => expect(collectText(screen.toJSON())).toContain('Старт'))

    // Трек рисуется своей линией без битой пары, а не исчезает и не роняет карту.
    expect(mockPolylinePositions).toContainEqual([
      [TRACK_START[1], TRACK_START[0]],
      [TRACK_END[1], TRACK_END[0]],
    ])
    expect(mockPolylinePositions.flat()).not.toContainEqual([BROKEN_LAT[1], BROKEN_LAT[0]])
  })
})

describe('TripPlanRouteMap.web — центрирование на точке из списка', () => {
  const validRoute = [point('a', 'Старт', START), point('b', 'Финиш', FINISH)]

  it('центрирует карту на валидной точке', async () => {
    render(
      <TripPlanRouteMapWeb
        route={validRoute}
        focusPoint={{ lat: FINISH[1], lng: FINISH[0], token: 1 }}
      />,
    )

    await waitFor(() => expect(mockSetViewPositions).toEqual([[FINISH[1], FINISH[0]]]))
  })

  it('не зовёт setView по битой паре: список отдаёт точку по наличию координат', async () => {
    // `RouteBuilder.handleFocusPoint` пропускает точку по `if (!coordinates)`,
    // поэтому в карту прилетает пара с NaN — гард маркера её не перехватывает.
    const screen = render(
      <TripPlanRouteMapWeb
        route={validRoute}
        focusPoint={{ lat: Number.NaN, lng: BROKEN_LAT[0], token: 2 }}
      />,
    )

    await waitFor(() => expect(collectText(screen.toJSON())).toContain('Старт'))

    expect(mockSetViewPositions).toEqual([])
  })
})

describe('TripPlanRouteMap (native) — битые координаты точки', () => {
  it('отдаёт карте только пары с конечными числами', () => {
    const { getByTestId } = render(<TripPlanRouteMapNative route={routeWithBrokenPoints} />)

    expect(getByTestId('native-map')).toBeTruthy()
    const props = mockNativeMapProps[0]
    expect(props.routePoints).toEqual([START, FINISH])
    // Без routed-геометрии линия строится по тем же точкам.
    expect(props.fullRouteCoords).toEqual([START, FINISH])
  })

  it('чистит битую пару из оригинального трека', () => {
    render(
      <TripPlanRouteMapNative
        route={[point('a', 'Старт', START), point('b', 'Финиш', FINISH)]}
        originalTrack={[START, BROKEN_LNG, FINISH]}
      />,
    )

    expect(mockNativeMapProps[0].originalTrackCoords).toEqual([START, FINISH])
  })
})
