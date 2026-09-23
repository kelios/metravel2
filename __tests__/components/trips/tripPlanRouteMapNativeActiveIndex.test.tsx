// #2071: native-карта конструктора (Leaflet в WebView) получает activeIndex —
// открытая в редакторе точка. Тот же приём мока, что и
// `tripPlanRouteMapNativeFocusIndices.test.tsx` (#2058/#2066): NativeMap
// подменён, а пропы, которые он получил бы, ловятся снаружи.
import React from 'react'
import { render } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

let mockNativeMapProps: Record<string, any> = {}
let mockMountCount = 0

jest.mock('@/components/MapPage/Map', () => {
  const ReactModule = require('react') as typeof React
  const { View } = require('react-native')

  const MockNativeMap = (props: Record<string, unknown>) => {
    mockNativeMapProps = props
    // #2071: если бы смена activeIndex пересоздавала WebView-компонент (новый
    // key/unmount+mount), этот счётчик монтирований вырос бы — тест ловит
    // именно ЭТО, а не просто читает пропы после rerender.
    ReactModule.useEffect(() => {
      mockMountCount += 1
    }, [])
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

describe('TripPlanRouteMap (native): activeIndex → routePointMarkers.activeIndex (#2071)', () => {
  beforeEach(() => {
    mockMountCount = 0
  })

  it('переводит activeIndex списка в позицию среди отрисованных маркеров и не пересоздаёт WebView', () => {
    const route: RoutePoint[] = [
      point(0, [19.94, 50.06]),
      point(1, null), // #1683: без координат — маркера нет, но номер в списке занимает.
      point(2, [11.58, 48.14]),
      point(3, [11.6, 48.1]),
    ]

    const utils = render(<TripPlanRouteMap route={route} activeIndex={2} />)

    // route[2] — второй ОТРИСОВАННЫЙ маркер (route[1] без координат пропущен).
    expect(mockNativeMapProps.routePointMarkers.activeIndex).toBe(1)
    expect(mockMountCount).toBe(1)

    utils.rerender(<TripPlanRouteMap route={route} activeIndex={3} />)
    expect(mockNativeMapProps.routePointMarkers.activeIndex).toBe(2)
    // Тот же экземпляр NativeMap: эффект монтирования не сработал повторно.
    expect(mockMountCount).toBe(1)

    utils.rerender(<TripPlanRouteMap route={route} activeIndex={null} />)
    expect(mockNativeMapProps.routePointMarkers.activeIndex).toBeNull()
    expect(mockMountCount).toBe(1)
  })

  it('activeIndex вне списка (нет такой точки) уходит в payload как null', () => {
    const route: RoutePoint[] = [point(0, [19.94, 50.06]), point(1, [11.58, 48.14])]
    render(<TripPlanRouteMap route={route} activeIndex={99} />)

    expect(mockNativeMapProps.routePointMarkers.activeIndex).toBeNull()
  })
})
