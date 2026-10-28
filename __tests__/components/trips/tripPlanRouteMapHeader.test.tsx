import type { TestInstance } from 'test-renderer'
import { createWebMapTestRuntime, type WebMapTestRuntime } from '@/__tests__/helpers/webMapTestRuntime'
/**
 * #2059 — шапка карты конструктора не длиннее трёх строк (макет
 * `docs/features/trips-plan-route-tab-mock.md` §4): заголовок со счётчиком
 * «N точек», способ с цифрами и чипом статуса, причина приблизительного
 * маршрута. Подсказка про перетаскивание — в `accessibilityHint`, легенда трека —
 * внутри карты. Web и native рисуют одну и ту же шапку.
 */
import React from 'react'
import { render as renderNative, waitFor as waitForNative, fireEvent as fireEventNative, within as withinNative } from '@testing-library/react-native'

import type { RoutePoint, RoutingState } from '@/api/plannedTrips'

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
let TripPlanRouteMapWeb: typeof import('@/components/trips/planning/TripPlanRouteMap.web').default
const WebMap = (props: React.ComponentProps<typeof TripPlanRouteMapWeb>) => <TripPlanRouteMapWeb {...props} />

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
  ['web', WebMap],
  ['native', TripPlanRouteMapNative],
] as const

const headerRows = (screen: { getByTestId: (id: string) => { children: { length: number } } }) =>
  screen.getByTestId('trip-plan-map-header').children.length

describe.each(MAPS)('TripPlanRouteMap (%s) — шапка карты (#2059)', (_platform, Map) => {
  beforeEach(() => expect.extend(_platform === 'web' ? web.matchers : require('@testing-library/react-native/matchers')))

  it('у приблизительного маршрута три строки: заголовок со счётчиком, способ с чипом, причина', async () => {
    const mapElement = <Map
        route={route}
        routeGeometry={geometry}
        routingState={degraded}
        summary={{ distanceKm: 2429, durationMin: 0, elevationGainM: 0, stopsCount: 61, provider: 'direct' }}
        transport="foot"
        originalTrackSegments={originalTrack}
        onMovePoint={jest.fn()}
        onEditPoint={jest.fn()}
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(headerRows(screen)).toBe(3)
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('61 точка')
    expect(screen.getByTestId('trip-plan-map-route-status')).toHaveTextContent('Приблизительный маршрут')
    expect(screen.getByTestId('trip-plan-map-route-reason')).toBeTruthy()

    const headerNode = screen.getByTestId('trip-plan-map-header')
    const header = 'props' in headerNode ? withinNative(headerNode) : web.within(headerNode)
    // Подсказка жеста и легенда трека в шапку больше не попадают.
    expect(header.queryByText(/можно перетащить/)).toBeNull()
    expect(header.queryByText('Оригинальный трек из файла')).toBeNull()
    expect(screen.getAllByTestId('trip-plan-map-original-track-legend')).toHaveLength(1)
    expect(mapRootHint(screen.getByTestId('trip-plan-route-map'))).toMatch(/можно перетащить/)
  })

  it('у проложенного маршрута две строки и подписанный счётчик', async () => {
    const mapElement = <Map
        route={route.slice(0, 22)}
        routeGeometry={geometry.slice(0, 22)}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
        summary={{ distanceKm: 120, durationMin: 1500, elevationGainM: 0, stopsCount: 22, provider: 'ors' }}
        transport="foot"
        readonly
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(headerRows(screen)).toBe(2)
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('22 точки')
    expect(screen.queryByTestId('trip-plan-map-route-reason')).toBeNull()
    expect(mapRootHint(screen.getByTestId('trip-plan-route-map'))).toBeUndefined()
  })

  it('пустая карта — единственное место постоянной подсказки', async () => {
    const mapElement = <Map route={[]} transport="car" onAddPointFromMap={jest.fn()} />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(screen.getByTestId('trip-plan-map-point-count')).toHaveTextContent('0 точек')
    expect(screen.getByTestId('trip-plan-map-empty-hint')).toHaveTextContent(/Нажмите на карту/)
    expect(headerRows(screen)).toBeLessThanOrEqual(3)
  })

  // #2065: сама видимость и cooldown считает `useSavedRouteRetry` (см. его
  // тест) — здесь только контракт «шапка рисует переданное состояние».
  it('рисует «Повторить» рядом с причиной, когда retry.visible истинно', async () => {
    const onPress = jest.fn()
    const mapElement = <Map
        route={route}
        routeGeometry={geometry}
        routingState={degraded}
        summary={{ distanceKm: 2429, durationMin: 0, elevationGainM: 0, stopsCount: 61, provider: 'direct' }}
        transport="foot"
        retry={{ visible: true, pending: false, disabled: false, onPress }}
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    const retryButton = screen.getByTestId('trip-plan-map-route-retry')
    if ('props' in retryButton) await fireEventNative.press(retryButton)
    else web.fireEvent.click(retryButton)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('не рисует «Повторить», когда retry.visible ложь или retry не передан', async () => {
    const mapElement = <Map
        route={route}
        routeGeometry={geometry}
        routingState={degraded}
        summary={{ distanceKm: 2429, durationMin: 0, elevationGainM: 0, stopsCount: 61, provider: 'direct' }}
        transport="foot"
        retry={{ visible: false, pending: false, disabled: false, onPress: jest.fn() }}
      />
    const screen = _platform === 'web' ? web.render(mapElement) : await renderNative(mapElement)

    await (_platform === 'web' ? web.waitFor : waitForNative)(() => expect(screen.getByTestId('trip-plan-map-header')).toBeTruthy())
    expect(screen.queryByTestId('trip-plan-map-route-retry')).toBeNull()
  })
})

let webRootProps: Record<string, any> | null = null
const mapRootHint = (node: HTMLElement | TestInstance) => {
  if ('props' in node) return node.props.accessibilityHint
  expect(webRootProps).not.toBeNull()
  return webRootProps!.accessibilityHint
}
beforeEach(() => { webRootProps = null })

let web: WebMapTestRuntime<typeof TripPlanRouteMapWeb>
beforeAll(() => {
  web = createWebMapTestRuntime(React, () => require('@/components/trips/planning/TripPlanRouteMap.web').default, { observeViewProps: props => { if (props.testID === 'trip-plan-route-map') webRootProps = props } })
  TripPlanRouteMapWeb = web.subject
})
afterEach(() => web.cleanup())
afterAll(() => expect.extend(require('@testing-library/react-native/matchers')))
