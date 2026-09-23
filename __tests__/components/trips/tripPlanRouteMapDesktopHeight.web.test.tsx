/**
 * #2059 — на desktop ≥ 1280 карта конструктора высокая: `calc(100dvh − 180px)`
 * в пределах 420–760 px (макет §4). Ниже 1280 и в map-first раскладке высота
 * прежняя: встроенная карта 320 px, fill-карта тянется на сцену.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

let mockIsDesktop = true

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockIsDesktop }),
  useBreakpoints: () => ({ isDesktop: mockIsDesktop }),
}))
jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))
jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: { divIcon: (options: unknown) => options, latLngBounds: (positions: unknown) => positions },
    RL: {
      Marker: () => null,
      Popup: () => null,
      Polyline: () => null,
      useMap: () => ({ setView: jest.fn(), fitBounds: jest.fn(), stop: jest.fn() }),
      useMapEvents: () => null,
    },
  }),
}))
jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
  useTheme: () => ({ isDark: false }),
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

const route: RoutePoint[] = [
  { id: 'a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const TALL = 'clamp(420px, calc(100dvh - 180px), 760px)'

const shellHeight = async (element: React.ReactElement) => {
  const screen = render(element)
  await waitFor(() =>
    expect(screen.UNSAFE_queryAllByProps({ 'data-testid': 'trip-plan-map-layers' }).length).toBeGreaterThan(0),
  )
  const shell = screen.UNSAFE_getAllByType('div').find((node) =>
    node.findAll((child) => child.props?.['data-testid'] === 'trip-plan-map-layers').length > 0,
  )
  return shell?.props.style.height
}

describe('#2059 TripPlanRouteMap.web — высота карты на desktop', () => {
  it('desktop ≥ 1280: calc(100dvh − 180px) в пределах 420–760', async () => {
    mockIsDesktop = true
    expect(await shellHeight(<TripPlanRouteMap route={route} />)).toBe(TALL)
  })

  it('уже 1280 — прежние 320 px', async () => {
    mockIsDesktop = false
    expect(await shellHeight(<TripPlanRouteMap route={route} />)).toBe(320)
  })

  it('map-first раскладка остаётся на высоте сцены', async () => {
    mockIsDesktop = true
    expect(await shellHeight(<TripPlanRouteMap route={route} fill />)).toBe('100%')
  })
})
