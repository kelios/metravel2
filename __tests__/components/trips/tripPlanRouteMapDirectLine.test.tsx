import { createWebMapTestRuntime, type WebMapTestRuntime } from '@/__tests__/helpers/webMapTestRuntime'
/**
 * #2057 — шапка карты планировщика у приблизительного маршрута.
 *
 * Прод trip 47 (пешком, 23.09.2026): ORS ответил HTTP 404 — дороги между частью
 * точек нет (ночной поезд, два перелёта), а шапка карты писала «Сервис
 * построения маршрутов временно недоступен…» и «Пешком 2 429 км · 481 ч 57 мин»,
 * где время — дистанция по прямой, делённая на 1,4 м/с.
 *
 * На desktop шапка карты — единственное место причины (макет
 * `docs/features/trips-plan-route-tab-mock.md` §2). Native рисует ту же шапку
 * через тот же форматтер, поэтому контракт проверяется на обеих картах.
 */
import React from 'react'
import { render as renderNative, waitFor as waitForNative } from '@testing-library/react-native'

import type { RoutePoint, RouteSummary, RoutingState } from '@/api/plannedTrips'

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
}))

import TripPlanRouteMapNative from '@/components/trips/planning/TripPlanRouteMap'
let TripPlanRouteMapWeb: typeof import('@/components/trips/planning/TripPlanRouteMap.web').default
const WebMap = (props: React.ComponentProps<typeof TripPlanRouteMapWeb>) => <TripPlanRouteMapWeb {...props} />

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Эхтернах', description: null, coordinates: [6.4214, 49.8117], placeId: null },
  { id: 'b', type: 'place', name: 'Аэропорт Мюнхена', description: null, coordinates: [11.786, 48.3538], placeId: null },
  { id: 'c', type: 'place', name: 'Люксембург', description: null, coordinates: [6.2044, 49.6233], placeId: null },
]

// Бэкенд у прямой линии отдаёт геометрию по самим точкам.
const directGeometry = route.map((point) => point.coordinates as [number, number])

const directSummary: RouteSummary = {
  distanceKm: 2429,
  durationMin: 28917,
  elevationGainM: 0,
  stopsCount: 61,
  provider: 'direct',
}

const degraded = (code: string): RoutingState => ({
  provider: 'direct',
  isOptimal: false,
  fallbackReason: code,
  warnings: [code],
})

const NO_ROUTE_FOOT =
  'Не получилось проложить маршрут пешком между всеми точками — часть отрезков показана по прямой. Так бывает на перелётах и переездах.'
const UNAVAILABLE = 'Сервис построения маршрутов временно недоступен — линия показана приблизительно.'
const DURATION = /\d\s*(ч|мин)(?![а-яё])/

const MAPS = [
  ['web', WebMap],
  ['native', TripPlanRouteMapNative],
] as const

describe.each(MAPS)('TripPlanRouteMap (%s) — шапка приблизительного маршрута (#2057)', (_platform, Map) => {
  beforeEach(() => expect.extend(_platform === 'web' ? web.matchers : require('@testing-library/react-native/matchers')))

  it('называет 4xx честно, подписывает дистанцию «по прямой» и не печатает время', async () => {
    const mapElement = <Map
        route={route}
        routeGeometry={directGeometry}
        routingState={degraded('ors_http_404')}
        summary={directSummary}
        transport="foot"
        readonly
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    const reason = await (_platform === 'web' ? web.waitFor : waitForNative)(() => screen.getByTestId('trip-plan-map-route-reason'))
    expect(reason).toHaveTextContent(NO_ROUTE_FOOT)
    expect(screen.getAllByText(/Не получилось проложить маршрут/)).toHaveLength(1)
    expect(screen.queryByText(/временно недоступен/)).toBeNull()
    // Intl prints the thousands separator as NBSP or NNBSP. DOM getByText
    // compares the normalized node to the raw query, so a literal NBSP misses.
    // The phrase, the digits and the suffix stay exact.
    expect(screen.getByText(/^≈ 2\s429 км по прямой$/)).toBeTruthy()
    expect(screen.queryByText(DURATION)).toBeNull()
    expect(screen.getByText('Приблизительный маршрут')).toBeTruthy()
  })

  it.each(['ors_http_502', 'ors_http_429', 'ors_request_failed', 'route_provider_unavailable'])(
    'для временной причины %s оставляет «временно недоступен»',
    async (code) => {
      const mapElement = <Map
          route={route}
          routeGeometry={directGeometry}
          routingState={degraded(code)}
          summary={directSummary}
          transport="foot"
          readonly
        />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

      const reason = await (_platform === 'web' ? web.waitFor : waitForNative)(() => screen.getByTestId('trip-plan-map-route-reason'))
      expect(reason).toHaveTextContent(UNAVAILABLE)
    },
  )

  it('у проложенного маршрута держит дистанцию и время, без строки причины', async () => {
    const mapElement = <Map
        route={route}
        routeGeometry={[directGeometry[0], [9, 49.2], directGeometry[1], [8.5, 49], directGeometry[2]]}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
        summary={{ distanceKm: 252, durationMin: 252, elevationGainM: 120, stopsCount: 3, provider: 'ors' }}
        transport="car"
        readonly
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByText('252 км · 4 ч 12 мин')).toBeTruthy())
    expect(screen.queryByTestId('trip-plan-map-route-reason')).toBeNull()
  })
})

let web: WebMapTestRuntime<typeof TripPlanRouteMapWeb>
beforeAll(() => {
  web = createWebMapTestRuntime(React, () => require('@/components/trips/planning/TripPlanRouteMap.web').default)
  TripPlanRouteMapWeb = web.subject
})
afterEach(() => web.cleanup())
afterAll(() => expect.extend(require('@testing-library/react-native/matchers')))
