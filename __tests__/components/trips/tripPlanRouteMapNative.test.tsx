/**
 * #1345 / #1306 — карта конструктора маршрута на native.
 *
 * Раньше здесь была текстовая карточка: в приложении маршрут на карте не
 * показывался вообще. Контракт, который держит тест:
 *  1. рендерится карта (WebView-стек /map), а не заглушка;
 *  2. маршрут уезжает в неё в формате native-карты: точки и линия парами
 *     [lng, lat], режим `route`, без запроса серверных кластеров;
 *  3. на карте есть кнопка «Слои» с тем же набором слоёв, что на web;
 *  4. переключение пишет в общий store — тот же, из которого читают /map и
 *     web-конструктор.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import { getDefaultOverlayState, useMapOverlaysStore } from '@/stores/mapOverlaysStore'

const mockMapProps: Array<Record<string, unknown>> = []

jest.mock('@/components/MapPage/Map', () => {
  const ReactModule = require('react') as typeof React
  const { View } = require('react-native')

  // Имя с заглавной буквы обязательно: иначе eslint не считает функцию
  // компонентом и запрещает хуки внутри (react-hooks/rules-of-hooks).
  const MockNativeMap = (props: Record<string, unknown>) => {
    mockMapProps.push(props)
    // Аннотацию типа тут писать нельзя: babel-plugin-jest-hoist считает имя
    // параметра из аннотации внешней переменной и отклоняет фабрику мока.
    const onReady = props.onMapUiApiReady
    // Native-мост отдаёт наверх узкий api: экрану нужен только тогл слоёв.
    const apiRef = ReactModule.useRef(null)
    if (!apiRef.current) apiRef.current = { setOverlayEnabled: jest.fn() }
    ReactModule.useEffect(() => {
      onReady?.(apiRef.current)
    }, [onReady])

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

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

describe('TripPlanRouteMap (native) — карта и слои', () => {
  beforeEach(() => {
    mockMapProps.length = 0
    useMapOverlaysStore.setState({ enabledOverlays: getDefaultOverlayState() })
  })

  it('рендерит карту вместо прежней текстовой заглушки', () => {
    const { getByTestId } = render(<TripPlanRouteMap route={route} />)

    expect(getByTestId('native-map')).toBeTruthy()
  })

  it('отдаёт карте маршрут парами [lng, lat] в режиме route без серверных кластеров', () => {
    render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={[
          [27.56, 53.9],
          [27.58, 53.905],
          [27.6, 53.91],
        ]}
      />,
    )

    const props = mockMapProps.at(-1)!
    expect(props.mode).toBe('route')
    expect(props.pointsOnly).toBe(true)
    expect(props.routePoints).toEqual([
      [27.56, 53.9],
      [27.6, 53.91],
    ])
    expect(props.fullRouteCoords).toHaveLength(3)
    expect(props.routeLineVisible).toBe(true)
    expect(props.routeLineApproximate).toBe(false)
    expect(props.coordinates).toEqual({ latitude: 53.9, longitude: 27.56 })
  })

  it('рисует pending/direct waypoint fallback только предупреждающим пунктиром', () => {
    const { getByText, queryByText, rerender } = render(
      <TripPlanRouteMap
        route={route}
        routeGeometry={null}
        routingState={{ provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] }}
      />,
    )

    let props = mockMapProps.at(-1)!
    expect(props.fullRouteCoords).toEqual([
      [27.56, 53.9],
      [27.6, 53.91],
    ])
    expect(props.routeLineVisible).toBe(true)
    expect(props.routeLineApproximate).toBe(true)
    expect(queryByText('Маршрут построен ORS')).toBeNull()
    expect(getByText('Линия приблизительная: проверьте дорогу или тропу перед поездкой.')).toBeTruthy()

    rerender(
      <TripPlanRouteMap
        route={route}
        routeGeometry={null}
        routingState={{
          provider: 'direct',
          isOptimal: false,
          fallbackReason: 'routing_provider_unavailable',
          warnings: [],
        }}
      />,
    )

    props = mockMapProps.at(-1)!
    expect(props.fullRouteCoords).toEqual([
      [27.56, 53.9],
      [27.6, 53.91],
    ])
    expect(props.routeLineVisible).toBe(true)
    expect(props.routeLineApproximate).toBe(true)
    expect(getByText('Приблизительный маршрут')).toBeTruthy()
  })

  it('показывает «Слои» с тем же набором, что на главной карте, и пишет выбор в общий store', () => {
    const { getByTestId, queryByTestId } = render(<TripPlanRouteMap route={route} />)

    expect(queryByTestId('map-mobile-layers-popover')).toBeNull()

    fireEvent.press(getByTestId('trip-plan-map-layers'))

    expect(getByTestId('map-mobile-layers-popover')).toBeTruthy()
    expect(getByTestId('map-overlay-osm-camping')).toBeTruthy()
    expect(getByTestId('map-overlay-osm-poi')).toBeTruthy()
    expect(getByTestId('map-overlay-osm-routes')).toBeTruthy()

    fireEvent.press(getByTestId('map-overlay-osm-camping'))

    expect(useMapOverlaysStore.getState().enabledOverlays['osm-camping']).toBe(true)
  })

  it('клик по карте добавляет точку, а в readonly — нет', () => {
    const onAddPointFromMap = jest.fn()

    const { rerender } = render(
      <TripPlanRouteMap route={route} onAddPointFromMap={onAddPointFromMap} />,
    )
    ;(mockMapProps.at(-1)!.onMapClick as (lng: number, lat: number) => void)(27.7, 53.95)
    expect(onAddPointFromMap).toHaveBeenCalledWith({ lat: 53.95, lng: 27.7 })

    onAddPointFromMap.mockClear()
    rerender(<TripPlanRouteMap route={route} readonly onAddPointFromMap={onAddPointFromMap} />)
    ;(mockMapProps.at(-1)!.onMapClick as (lng: number, lat: number) => void)(27.7, 53.95)
    expect(onAddPointFromMap).not.toHaveBeenCalled()
  })
})
