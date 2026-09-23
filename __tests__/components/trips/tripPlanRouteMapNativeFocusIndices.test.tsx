// #2058: native-карта конструктора (Leaflet в WebView) подгоняет кадр под
// точки дня через `MapUiApi.fitToCoords`; сама команда уходит в WebView.
import React from 'react'
import { render } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import {
  NATIVE_MAP_VIEW_COMMANDS_SCRIPT,
  buildNativeMapFitCoordsCommand,
} from '@/components/MapPage/Map/nativeMapViewCommandsScript'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'

const mockFitToCoords = jest.fn()

jest.mock('@/components/MapPage/Map', () => {
  const ReactModule = require('react') as typeof React
  const { View } = require('react-native')

  const MockNativeMap = (props: Record<string, unknown>) => {
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
      { maxZoom: FOCUS_POINT_ZOOM },
    )

    utils.rerender(<TripPlanRouteMap route={[...route]} focusIndices={focusIndices} />)
    expect(mockFitToCoords).toHaveBeenCalledTimes(1)

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [0], token: 2 }} />)
    expect(mockFitToCoords).toHaveBeenLastCalledWith([{ lat: 50.06, lng: 19.94 }], {
      maxZoom: FOCUS_POINT_ZOOM,
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
    expect(NATIVE_MAP_VIEW_COMMANDS_SCRIPT).toContain('window.__metravelMapFitCoords = function(coords, maxZoom)')
    expect(NATIVE_MAP_VIEW_COMMANDS_SCRIPT).toContain('map.fitBounds(L.latLngBounds(latLngs)')
  })
})
