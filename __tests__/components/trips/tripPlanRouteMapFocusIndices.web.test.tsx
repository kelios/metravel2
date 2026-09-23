// #2058: web-карта конструктора подгоняет кадр под точки дня из списка.
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types'

const mockFitBounds = jest.fn()
const mockSetView = jest.fn()
// Подписки на `zoomend`: по ним подгонка, пришедшая во время анимации зума,
// дожидается её конца (`afterZoomAnimation`).
const mockZoomEndHandlers = new Set<() => void>()
const mockMap = {
  setView: mockSetView,
  fitBounds: mockFitBounds,
  stop: jest.fn(),
  getZoom: () => 10,
  _animatingZoom: false,
  on: jest.fn((type: string, handler: () => void) => {
    if (type === 'zoomend') mockZoomEndHandlers.add(handler)
  }),
  off: jest.fn((type: string, handler: () => void) => {
    if (type === 'zoomend') mockZoomEndHandlers.delete(handler)
  }),
}
/** Leaflet закончил анимацию зума: `_animatingZoom` снят, затем `zoomend`. */
const finishZoomAnimation = () => {
  mockMap._animatingZoom = false
  act(() => {
    Array.from(mockZoomEndHandlers).forEach((handler) => handler())
  })
}

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
    mockMap._animatingZoom = false
    mockZoomEndHandlers.clear()
  })

  it('#2059 подгонка под весь маршрут отступает под каплю маркера и кнопки карты', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))

    expect(mockFitBounds).toHaveBeenCalledTimes(1)
    expect(mockFitBounds.mock.calls[0][1]).toEqual({
      paddingTopLeft: [28, 116],
      paddingBottomRight: [28, 28],
      maxZoom: 13,
    })
  })

  it('подгоняет кадр под точки дня, а не под весь маршрут', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [1, 2, 3], token: 1 }} />)

    expect(mockFitBounds).toHaveBeenCalledTimes(1)
    expect(mockFitBounds).toHaveBeenLastCalledWith(
      { positions: [[48.14, 11.58], [48.1, 11.6], [48.05, 11.7]] },
      // #2059: сверху — кнопки карты и высота капли, снизу — атрибуция.
      { paddingTopLeft: [28, 116], paddingBottomRight: [28, 28], maxZoom: FOCUS_POINT_ZOOM },
    )
  })

  it('день из одной точки центрует карту на ней', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockSetView.mockClear()

    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [0], token: 1 }} />)

    expect(mockSetView).toHaveBeenLastCalledWith([50.06, 19.94], FOCUS_POINT_ZOOM)
  })

  it('догрузившийся трек из файла не перебивает показанный день, оптовая замена маршрута — перебивает', async () => {
    const focusIndices = { indices: [1, 2, 3], token: 1 }
    const utils = render(<TripPlanRouteMap route={route} focusIndices={focusIndices} routeReplacementToken={0} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()

    // Трек приходит позже точек: подгонка под «весь маршрут + трек» раньше
    // уводила кадр с дня, и перетаскивание в нём попадало в пустое место.
    const track: [number, number][] = [[19.9, 50.0], [11.5, 48.2]]
    utils.rerender(
      <TripPlanRouteMap route={route} focusIndices={focusIndices} routeReplacementToken={0} originalTrackSegments={[track]} />,
    )
    expect(mockFitBounds).not.toHaveBeenCalled()

    utils.rerender(
      <TripPlanRouteMap route={route} focusIndices={focusIndices} routeReplacementToken={1} originalTrackSegments={[track]} />,
    )
    expect(mockFitBounds).toHaveBeenCalledTimes(1)
  })

  it('разворот дня во время анимации зума ждёт её конца: Leaflet выбросил бы подгонку молча', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()

    // Подгонка под весь маршрут ещё анимирует зум, а человек уже развернул день.
    mockMap._animatingZoom = true
    const focusIndices = { indices: [1, 2, 3], token: 1 }
    utils.rerender(<TripPlanRouteMap route={route} focusIndices={focusIndices} />)
    expect(mockFitBounds).not.toHaveBeenCalled()

    // Пока запрос ждёт, точка дня переехала: кадр встанет по свежим координатам,
    // а подгонка под весь маршрут показанный день уже не перебивает.
    const moved = [...route.slice(0, 3), point(3, 11.8, 48.0)]
    utils.rerender(<TripPlanRouteMap route={moved} focusIndices={focusIndices} />)
    expect(mockFitBounds).not.toHaveBeenCalled()

    finishZoomAnimation()
    expect(mockFitBounds).toHaveBeenCalledTimes(1)
    expect(mockFitBounds).toHaveBeenLastCalledWith(
      { positions: [[48.14, 11.58], [48.1, 11.6], [48.0, 11.8]] },
      expect.objectContaining({ maxZoom: FOCUS_POINT_ZOOM }),
    )
    expect(mockZoomEndHandlers.size).toBe(0)

    // Токен применён: следующая анимация тот же день не повторяет.
    utils.rerender(<TripPlanRouteMap route={[...moved]} focusIndices={focusIndices} />)
    expect(mockFitBounds).toHaveBeenCalledTimes(1)
  })

  it('точка из списка во время анимации зума центруется после неё', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockSetView.mockClear()

    mockMap._animatingZoom = true
    utils.rerender(<TripPlanRouteMap route={route} focusPoint={{ lat: 48.1, lng: 11.6, token: 1 }} />)
    expect(mockSetView).not.toHaveBeenCalled()

    finishZoomAnimation()
    expect(mockSetView).toHaveBeenCalledTimes(1)
    expect(mockSetView).toHaveBeenLastCalledWith([48.1, 11.6], FOCUS_POINT_ZOOM)
  })

  it('отмонтированная карта не подгоняет кадр по запоздалому zoomend', async () => {
    const utils = render(<TripPlanRouteMap route={route} />)
    await waitFor(() => utils.getByLabelText(EXPAND))
    mockFitBounds.mockClear()

    mockMap._animatingZoom = true
    utils.rerender(<TripPlanRouteMap route={route} focusIndices={{ indices: [1, 2, 3], token: 1 }} />)
    utils.unmount()

    expect(mockZoomEndHandlers.size).toBe(0)
    finishZoomAnimation()
    expect(mockFitBounds).not.toHaveBeenCalled()
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
