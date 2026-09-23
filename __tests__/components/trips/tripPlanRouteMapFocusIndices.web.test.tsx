// #2058: web-карта конструктора подгоняет кадр под точки дня из списка.
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'

const mockFitBounds = jest.fn()
const mockSetView = jest.fn()
const mockMap = { setView: mockSetView, fitBounds: mockFitBounds, stop: jest.fn(), getZoom: () => 10 }

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => ({ positions }),
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: () => null,
      useMap: () => mockMap,
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => {
  const ReactModule = require('react') as typeof React
  return {
    MapCanvas: ({
      children,
      onMapRef,
    }: {
      children?: (engine: unknown) => React.ReactNode
      onMapRef?: (map: unknown) => void
    }) => {
      const mapRef = ReactModule.useRef({
        getCenter: () => ({ lat: 47.5, lng: 11 }),
        getZoom: () => 10,
      })
      ReactModule.useEffect(() => {
        onMapRef?.(mapRef.current)
      }, [onMapRef])
      return <>{children?.({})}</>
    },
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

const point = (index: number, lng: number, lat: number): RoutePoint => ({
  id: `p${index}`,
  type: 'custom',
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [lng, lat],
  placeId: null,
})

// День 1 — Краков, день 2 — три точки под Мюнхеном.
const route: RoutePoint[] = [
  point(0, 19.94, 50.06),
  point(1, 11.58, 48.14),
  point(2, 11.6, 48.1),
  point(3, 11.7, 48.05),
]

const EXPAND = 'Развернуть карту на весь экран'

describe('TripPlanRouteMap (web): focusIndices', () => {
  beforeEach(() => {
    mockFitBounds.mockClear()
    mockSetView.mockClear()
  })

  it('подгоняет кадр под точки дня, а не под весь маршрут', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [1, 2, 3], token: 1 }} />)

    expect(mockFitBounds).toHaveBeenCalledTimes(1)
    expect(mockFitBounds).toHaveBeenLastCalledWith(
      { positions: [[48.14, 11.58], [48.1, 11.6], [48.05, 11.7]] },
      { padding: [28, 28], maxZoom: FOCUS_POINT_ZOOM },
    )
  })

  it('день из одной точки центрует карту на ней', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockSetView.mockClear()

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [0], token: 1 }} />)

    expect(mockSetView).toHaveBeenLastCalledWith([50.06, 19.94], FOCUS_POINT_ZOOM)
  })

  it('тот же токен не повторяет подгонку ни на рендере, ни после разворота на весь экран', async () => {
    const focusIndices = { indices: [1, 2, 3], token: 1 }
    const utils = render(<TripPlanRouteMap route={route} focusIndices={focusIndices} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    const dayFits = () =>
      mockFitBounds.mock.calls.filter(([bounds]) => (bounds as { positions: unknown[] }).positions.length === 3)
    expect(dayFits()).toHaveLength(1)

    utils.rerender(<TripPlanRouteMap route={[...route]} focusIndices={focusIndices} />)
    fireEvent(utils.getByLabelText(EXPAND), 'click')

    expect(dayFits()).toHaveLength(1)

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [1, 2, 3], token: 2 }} />)
    expect(dayFits()).toHaveLength(2)
  })

  it('точки без пригодных координат кадр не трогают', async () => {
    const broken: RoutePoint[] = [
      ...route,
      { ...point(4, 0, 0), coordinates: null },
    ]
    const utils = render(<TripPlanRouteMap route={broken} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()
    mockSetView.mockClear()

    utils.rerender(<TripPlanRouteMap route={broken} focusIndices={{ indices: [4], token: 1 }} />)

    expect(mockFitBounds).not.toHaveBeenCalled()
    expect(mockSetView).not.toHaveBeenCalled()
  })
})
