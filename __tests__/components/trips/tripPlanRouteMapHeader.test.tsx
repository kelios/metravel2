/**
 * #2059 — шапка карты конструктора не длиннее трёх строк (макет
 * `docs/features/trips-plan-route-tab-mock.md` §4): заголовок со счётчиком
 * «N точек», способ с цифрами и чипом статуса, причина приблизительного
 * маршрута. Подсказка про перетаскивание — в `accessibilityHint`, легенда трека —
 * внутри карты. Web и native рисуют одну и ту же шапку.
 */
import React from 'react'
import { render, waitFor, within } from '@testing-library/react-native'

import type { RoutePoint, RoutingState } from '@/api/plannedTrips'

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => positions,
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: () => null,
      useMap: () => ({ setView: jest.fn(), fitBounds: jest.fn(), stop: jest.fn() }),
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <div data-testid="map-canvas">{children?.({})}</div>
  ),
}))

jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: function MockNativeMap() {
      return <View testID="native-map" />
    },
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
  useTheme: () => ({ isDark: false }),
}))

import TripPlanRouteMapNative from '@/components/trips/planning/TripPlanRouteMap'
import TripPlanRouteMapWeb from '@/components/trips/planning/TripPlanRouteMap.web'

const route: RoutePoint[] = Array.from({ length: 61 }, (_, index) => ({
  id: `p${index}`,
  type: 'custom',
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [12 + index * 0.02, 47.5 + (index % 5) * 0.01],
  placeId: null,
}))
const geometry = route.map((point) => point.coordinates as [number, number])
const originalTrack = [geometry.slice(0, 10)]

const degraded: RoutingState = {
  provider: 'direct',
  isOptimal: false,
  fallbackReason: 'ors_http_404',
  warnings: ['ors_http_404'],
}

const MAPS = [
  ['web', TripPlanRouteMapWeb],
  ['native', TripPlanRouteMapNative],
] as const

const headerRows = (screen: ReturnType<typeof render>) =>
  screen.getByTestId('trip-plan-map-header').children.length

describe.each(MAPS)('TripPlanRouteMap (%s) — шапка карты (#2059)', (_platform, Map) => {
  it('у приблизительного маршрута три строки: заголовок со счётчиком, способ с чипом, причина', async () => {
    const screen = render(
      <Map
        route={route}
        routeGeometry={geometry}
        routingState={degraded}
        summary={{ distanceKm: 2429, durationMin: 0, elevationGainM: 0, stopsCount: 61, provider: 'direct' }}
        transport="foot"
        originalTrackSegments={originalTrack}
        onMovePoint={jest.fn()}
        onEditPoint={jest.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(headerRows(screen)).toBe(3)
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('61 точка')
    expect(screen.getByTestId('trip-plan-map-route-status')).toHaveTextContent('Приблизительный маршрут')
    expect(screen.getByTestId('trip-plan-map-route-reason')).toBeTruthy()

    const header = within(screen.getByTestId('trip-plan-map-header'))
    // Подсказка жеста и легенда трека в шапку больше не попадают.
    expect(header.queryByText(/можно перетащить/)).toBeNull()
    expect(header.queryByText('Оригинальный трек из файла')).toBeNull()
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
    expect(screen.getByTestId('trip-plan-route-map').props.accessibilityHint).toMatch(/можно перетащить/)
  })

  it('у проложенного маршрута две строки и подписанный счётчик', async () => {
    const screen = render(
      <Map
        route={route.slice(0, 22)}
        routeGeometry={geometry.slice(0, 22)}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
        summary={{ distanceKm: 120, durationMin: 1500, elevationGainM: 0, stopsCount: 22, provider: 'ors' }}
        transport="foot"
        readonly
      />,
    )

    await waitFor(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(headerRows(screen)).toBe(2)
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('22 точки')
    expect(screen.queryByTestId('trip-plan-map-route-reason')).toBeNull()
    expect(screen.getByTestId('trip-plan-route-map').props.accessibilityHint).toBeUndefined()
  })

  it('пустая карта — единственное место постоянной подсказки', async () => {
    const screen = render(<Map route={[]} transport="car" onAddPointFromMap={jest.fn()} />)

    await waitFor(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('0 точек')
    expect(screen.getByTestId('trip-plan-map-empty-hint')).toHaveTextContent(/Нажмите на карту/)
    expect(headerRows(screen)).toBeLessThanOrEqual(3)
  })
})
