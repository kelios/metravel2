// #2058: native-карта конструктора (Leaflet в WebView) подгоняет кадр под
// точки дня через `MapUiApi.fitToCoords`; сама команда уходит в WebView.
import React from 'react'
import { act, render, within } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import {
  NATIVE_MAP_VIEW_COMMANDS_SCRIPT,
  buildNativeMapFitCoordsCommand,
} from '@/components/MapPage/Map/nativeMapViewCommandsScript'
import { NATIVE_ROUTE_POINT_MARKERS_SCRIPT } from '@/components/MapPage/Map/nativeRoutePointMarkersScript'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'
import { ROUTE_MAP_FIT_PADDING } from '@/components/trips/planning/tripPlanMapMarkers'

const mockFitToCoords = jest.fn()
let mockNativeMapProps: Record<string, any> = {}

jest.mock('@/components/MapPage/Map', () => {
  const ReactModule = require('react') as typeof React
  const { View } = require('react-native')

  const MockNativeMap = (props: Record<string, unknown>) => {
    mockNativeMapProps = props
    const onReady = props.onMapUiApiReady
    const apiRef = ReactModule.useRef(null)
    if (!apiRef.current) apiRef.current = { setOverlayEnabled: jest.fn(), fitToCoords: mockFitToCoords }
    ReactModule.useEffect(() => {
      onReady?.(apiRef.current)
    }, [onReady])
    return <View testID="native-map" />
  }

  return { __esModule: true, default: MockNativeMap }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap'

const point = (index: number, coordinates: [number, number] | null): RoutePoint => ({
  id: `p${index}`,
  type: 'custom',
  name: `Точка ${index + 1}`,
  description: null,
  coordinates,
  placeId: null,
})

const route: RoutePoint[] = [
  point(0, [19.94, 50.06]),
  point(1, [11.58, 48.14]),
  point(2, [11.6, 48.1]),
  point(3, null),
]

describe('TripPlanRouteMap (native): focusIndices', () => {
  beforeEach(() => {
    mockFitToCoords.mockClear()
  })

  it('отдаёт WebView координаты точек дня один раз на токен', () => {
    const focusIndices = { indices: [1, 2, 3], token: 1 }
    const utils = render(<TripPlanRouteMap route={route} focusIndices={focusIndices} />)

    expect(mockFitToCoords).toHaveBeenCalledTimes(1)
    expect(mockFitToCoords).toHaveBeenCalledWith(
      [
        { lat: 48.14, lng: 11.58 },
        { lat: 48.1, lng: 11.6 },
      ],
      // #2059: те же отступы под каплю и кнопки карты, что у web-фокуса дня.
      { maxZoom: FOCUS_POINT_ZOOM, padding: ROUTE_MAP_FIT_PADDING },
    )

    utils.rerender(<TripPlanRouteMap route={[...route]} focusIndices={focusIndices} />)
    expect(mockFitToCoords).toHaveBeenCalledTimes(1)

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [0], token: 2 }} />)
    expect(mockFitToCoords).toHaveBeenLastCalledWith([{ lat: 50.06, lng: 19.94 }], {
      maxZoom: FOCUS_POINT_ZOOM,
      padding: ROUTE_MAP_FIT_PADDING,
    })
  })

  it('без пригодных координат команду не шлёт', () => {
    render(<TripPlanRouteMap route={route} focusIndices={{ indices: [3], token: 1 }} />)

    expect(mockFitToCoords).not.toHaveBeenCalled()
  })

  it('команда WebView: fitBounds по парам [lat, lng], функция объявлена в HTML-скрипте', () => {
    expect(buildNativeMapFitCoordsCommand([{ lat: 48.14, lng: 11.58 }, { lat: NaN, lng: 1 }], 14)).toBe(
      'window.__metravelMapFitCoords && window.__metravelMapFitCoords([[48.14,11.58]], 14)',
    )
    expect(NATIVE_MAP_VIEW_COMMANDS_SCRIPT).toContain('window.__metravelMapFitCoords = function(coords, maxZoom, padding)')
    expect(NATIVE_MAP_VIEW_COMMANDS_SCRIPT).toContain('map.fitBounds(L.latLngBounds(latLngs)')
  })

  it('#2059 команда несёт отступы планировщика третьим аргументом', () => {
    expect(buildNativeMapFitCoordsCommand([{ lat: 48.14, lng: 11.58 }], 14, ROUTE_MAP_FIT_PADDING)).toBe(
      'window.__metravelMapFitCoords && window.__metravelMapFitCoords([[48.14,11.58]], 14, '
        + '{"topLeft":[28,116],"bottomRight":[28,28],"maxShare":0.4})',
    )
  })

  // Скрипт исполняется в WebView — здесь он прогоняется на фейковой карте, чтобы
  // проверить сами параметры fitBounds, а не только текст команды.
  const runFitCoords = (size: { x: number; y: number }, padding?: unknown) => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      getZoom: () => 5,
      getSize: () => size,
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
    }
    const L = { latLngBounds: (latLngs: unknown) => ({ latLngs }) }
    const window: Record<string, (...args: unknown[]) => unknown> = {}
    new Function('map', 'L', 'window', `var __metravelProgrammaticMoveUntil = 0;\n${NATIVE_MAP_VIEW_COMMANDS_SCRIPT}\n${NATIVE_ROUTE_POINT_MARKERS_SCRIPT}`)(
      map,
      L,
      window,
    )
    window.__metravelMapFitCoords([[48.14, 11.58], [48.1, 11.6]], 14, padding)
    return map.fitBounds.mock.calls[0]?.[1]
  }

  it('#2059 в WebView кадр дня отступает под каплю и кнопки, но не больше 40 % стороны', () => {
    expect(runFitCoords({ x: 390, y: 354 }, ROUTE_MAP_FIT_PADDING)).toEqual({
      maxZoom: 14,
      paddingTopLeft: [28, 116],
      paddingBottomRight: [28, 28],
    })
    // Низкая карта: верхний отступ упирается в 40 % высоты, а не съедает кадр.
    expect(runFitCoords({ x: 390, y: 200 }, ROUTE_MAP_FIT_PADDING)).toEqual({
      maxZoom: 14,
      paddingTopLeft: [28, 80],
      paddingBottomRight: [28, 28],
    })
    // /map и прочие вызовы без отступов планировщика остаются на прежних 50 px.
    expect(runFitCoords({ x: 390, y: 354 })).toEqual({ maxZoom: 14, padding: [50, 50] })
  })

  it('#2059 маркер с номером из списка правит свою точку, даже если перед ней точка без координат', () => {
    const onMovePoint = jest.fn()
    const withGap: RoutePoint[] = [
      point(0, [19.94, 50.06]),
      point(1, null),
      point(2, [11.58, 48.14]),
      point(3, [11.6, 48.1]),
    ]
    const utils = render(<TripPlanRouteMap route={withGap} onMovePoint={onMovePoint} onEditPoint={jest.fn()} />)

    // Точка «2» без координат маркера не получает, но номер в списке занимает.
    expect(mockNativeMapProps.routePointMarkers.labels).toEqual(['1', '3', '4'])

    // WebView сообщает позицию маркера среди переданных пар: второй маркер — точка «3».
    act(() => mockNativeMapProps.onRoutePointMove(1, 48.2, 11.7))
    expect(onMovePoint).toHaveBeenCalledWith({ index: 2, lat: 48.2, lng: 11.7 })

    act(() => mockNativeMapProps.onRoutePointPress(1))
    expect(within(utils.getByTestId('trip-plan-map-point-actions')).getByText('Точка 3')).toBeTruthy()
  })
})
