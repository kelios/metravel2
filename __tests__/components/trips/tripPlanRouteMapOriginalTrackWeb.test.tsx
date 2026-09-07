/**
 * #1496 — фаза 2 импорта на web-карте планировщика.
 *
 * Контракт, который держит тест (Regression control карточки): оригинальная
 * геометрия из файла рисуется ОТДЕЛЬНОЙ полилинией и не подменяет собой линию
 * маршрута, построенную по упрощённым точкам; подгонка кадра охватывает обе
 * линии; без файла карта работает ровно как прежде.
 *
 * #1847 — многотрековый файл рисуется отдельной линией на каждый трек: склейка
 * проводила между несмежными треками прямую, которой в файле нет.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const mockPolylineProps: Array<Record<string, unknown>> = []
const mockFitBounds = jest.fn()
const mockLatLngBounds = jest.fn((positions: unknown) => positions)
const mockMap = { setView: jest.fn(), fitBounds: mockFitBounds, stop: jest.fn() }

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => mockLatLngBounds(positions),
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: (props: Record<string, unknown>) => {
        mockPolylineProps.push(props)
        return null
      },
      useMap: () => mockMap,
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <div data-testid="map-canvas">{children?.({})}</div>
  ),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const routeGeometry: Array<[number, number]> = [
  [27.56, 53.9],
  [27.58, 53.905],
  [27.6, 53.91],
]

// Оригинал уходит южнее упрощённой линии — так видно, что подгонка кадра его учла.
const originalTrackSegments: Array<Array<[number, number]>> = [[
  [27.56, 53.9],
  [27.57, 53.8],
  [27.59, 53.85],
  [27.6, 53.91],
]]

// Два кольца похода в разных концах региона — ровно тот файл, на котором
// склейка рисовала прямую через весь регион.
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

describe('TripPlanRouteMap.web — оригинальный трек', () => {
  beforeEach(() => {
    mockPolylineProps.length = 0
    mockFitBounds.mockClear()
    mockLatLngBounds.mockClear()
  })

  it('рисует оригинал отдельной линией поверх маршрута, не подменяя его', async () => {
    const screen = render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrackSegments={originalTrackSegments} />,
    )

    await waitFor(() => expect(mockPolylineProps.length).toBe(2))

    const [routeLine, originalLine] = mockPolylineProps
    // Линия маршрута осталась построенной по упрощённой геометрии.
    expect(routeLine.positions).toEqual([
      [53.9, 27.56],
      [53.905, 27.58],
      [53.91, 27.6],
    ])
    // Оригинал — самостоятельный слой со своими координатами и стилем.
    expect(originalLine.positions).toEqual([
      [53.9, 27.56],
      [53.8, 27.57],
      [53.85, 27.59],
      [53.91, 27.6],
    ])
    expect((originalLine.pathOptions as Record<string, unknown>).color).not.toBe(
      (routeLine.pathOptions as Record<string, unknown>).color,
    )
    expect(screen.getByTestId('trip-plan-map-original-track-legend')).toBeTruthy()
  })

  it('#1847 рисует каждый трек файла своей линией и не соединяет их между собой', async () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrackSegments={twoRingSegments}
      />,
    )

    // Линия маршрута плюс по линии на каждое кольцо — а не одна общая ломаная.
    await waitFor(() => expect(mockPolylineProps.length).toBe(3))

    const [, firstRing, secondRing] = mockPolylineProps
    expect(firstRing.positions).toEqual([
      [49.81, 6.42],
      [49.82, 6.43],
      [49.81, 6.42],
    ])
    expect(secondRing.positions).toEqual([
      [49.79, 6.3],
      [49.8, 6.31],
      [49.79, 6.3],
    ])
    // Шва нет: конец первого кольца не соседствует с началом второго ни в одной
    // из линий — именно эту прямую через регион и рисовала склейка.
    expect(firstRing.positions).not.toContainEqual([49.79, 6.3])
    expect(secondRing.positions).not.toContainEqual([49.81, 6.42])
    // Легенда по-прежнему одна на весь оригинал, а не по пункту на сегмент.
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
    expect(firstRing.pathOptions).toEqual(secondRing.pathOptions)
  })

  it('#1847 подгоняет кадр под все сегменты, а не только под первый', async () => {
    render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrackSegments={twoRingSegments}
      />,
    )

    await waitFor(() => expect(mockFitBounds).toHaveBeenCalled())

    const positions = mockLatLngBounds.mock.calls[0][0] as Array<[number, number]>
    expect(positions).toContainEqual([49.82, 6.43])
    expect(positions).toContainEqual([49.79, 6.3])
  })

  it('#1847 пропускает сегмент, от которого осталась одна точка', async () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        originalTrackSegments={[[[27.56, 53.9]]]}
      />,
    )

    await waitFor(() => expect(mockPolylineProps.length).toBe(1))
    expect(screen.queryByTestId('trip-plan-map-original-track-legend')).toBeNull()
  })

  it('подгоняет кадр под обе линии, а не только под упрощённую', async () => {
    render(
      <TripPlanRouteMap route={route} routeGeometry={routeGeometry} originalTrackSegments={originalTrackSegments} />,
    )

    await waitFor(() => expect(mockFitBounds).toHaveBeenCalled())

    const positions = mockLatLngBounds.mock.calls[0][0] as Array<[number, number]>
    expect(positions).toHaveLength(routeGeometry.length + originalTrackSegments[0].length)
    // Самая южная точка есть только у оригинала — без неё часть трека была бы за кадром.
    expect(Math.min(...positions.map(([lat]) => lat))).toBeCloseTo(53.8, 5)
  })

  it('без загруженного файла оставляет ровно одну линию и не показывает легенду', async () => {
    const screen = render(<TripPlanRouteMap route={route} routeGeometry={routeGeometry} />)

    await waitFor(() => expect(mockPolylineProps.length).toBe(1))
    expect(screen.queryByTestId('trip-plan-map-original-track-legend')).toBeNull()
  })

  it('fails closed to a dashed waypoint line when healthy state has no geometry', async () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={null}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
        originalTrackSegments={originalTrackSegments}
      />,
    )

    await waitFor(() => expect(mockPolylineProps.length).toBe(2))

    const [waypointLine, originalLine] = mockPolylineProps
    expect(waypointLine.positions).toEqual([
      [53.9, 27.56],
      [53.91, 27.6],
    ])
    expect(waypointLine.pathOptions).toEqual(
      expect.objectContaining({
        color: 'warningDark',
        weight: 4,
        opacity: 0.58,
        dashArray: '8 8',
      }),
    )
    expect(screen.queryByText('Маршрут построен ORS')).toBeNull()

    // The uploaded original is still a second independent layer; it never
    // becomes the route merely because the routed geometry is missing.
    expect(originalLine.positions).toEqual([
      [53.9, 27.56],
      [53.8, 27.57],
      [53.85, 27.59],
      [53.91, 27.6],
    ])
    expect((originalLine.pathOptions as Record<string, unknown>).dashArray).toBeUndefined()
    expect(screen.getByTestId('trip-plan-map-original-track-legend')).toBeTruthy()
  })

  it('keeps a dense healthy route solid and labels it as routed', async () => {
    const screen = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
      />,
    )

    await waitFor(() => expect(mockPolylineProps.length).toBe(1))

    expect(mockPolylineProps[0].pathOptions).toEqual(
      expect.objectContaining({
        color: 'primaryDark',
        weight: 5,
        opacity: 0.86,
        dashArray: undefined,
      }),
    )
    expect(screen.getByText('Маршрут построен ORS')).toBeTruthy()
  })

  it('uses the full fallback style when a non-finite geometry is rejected', async () => {
    render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={[
          [27.56, 53.9],
          [Number.NaN, 53.905],
          [27.6, 53.91],
        ]}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
      />,
    )

    await waitFor(() => expect(mockPolylineProps.length).toBe(1))

    expect(mockPolylineProps[0].positions).toEqual([
      [53.9, 27.56],
      [53.91, 27.6],
    ])
    expect(mockPolylineProps[0].pathOptions).toEqual(
      expect.objectContaining({
        color: 'warningDark',
        weight: 4,
        opacity: 0.58,
        dashArray: '8 8',
      }),
    )
  })
})
