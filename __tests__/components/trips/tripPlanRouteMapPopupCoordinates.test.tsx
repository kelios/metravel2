/**
 * #1679 — попап точки на карте плана поездки печатает координаты через общий
 * форматтер, а не своей копией формата.
 *
 * Контракт, который держит тест: строка координат в попапе приходит из
 * `formatRoutePointCoordinates` (того же, что печатает карточку точки), поэтому
 * смена точности или разделителя не может развести два места; пара без
 * координат не печатает пустую строку и не роняет попап.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const mockFormatRoutePointCoordinates = jest.fn(
  (coordinates: [number, number] | null | undefined) =>
    (
      jest.requireActual(
        '@/components/trips/planning/tripPlanFormatting',
      ) as typeof import('@/components/trips/planning/tripPlanFormatting')
    ).formatRoutePointCoordinates(coordinates),
)

jest.mock('@/components/trips/planning/tripPlanFormatting', () => ({
  ...jest.requireActual('@/components/trips/planning/tripPlanFormatting'),
  formatRoutePointCoordinates: (coordinates: [number, number] | null | undefined) =>
    mockFormatRoutePointCoordinates(coordinates),
}))

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

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

// Контракт хранения: `RoutePoint.coordinates` = [lng, lat] (api/plannedTripsTypes.ts).
const COORDINATES: [number, number] = [26.247111, 56.006732]

const point = (
  coordinates: [number, number] | null,
  name = 'Точка',
  id = 'a',
): RoutePoint => ({
  id,
  type: 'place',
  name,
  description: null,
  coordinates,
  placeId: null,
})

const collectText = (node: unknown): string[] => {
  if (typeof node === 'string') return [node]
  if (Array.isArray(node)) return node.flatMap(collectText)
  if (node && typeof node === 'object' && 'children' in node) {
    return collectText((node as { children: unknown }).children)
  }
  return []
}

describe('TripPlanRouteMap.web — координаты в попапе точки', () => {
  beforeEach(() => {
    mockFormatRoutePointCoordinates.mockClear()
  })

  it('печатает строку общего форматтера, а не собственную копию формата', async () => {
    const screen = render(<TripPlanRouteMap route={[point(COORDINATES)]} />)

    await waitFor(() => expect(collectText(screen.toJSON())).toContain('Точка'))

    expect(mockFormatRoutePointCoordinates).toHaveBeenCalledWith(COORDINATES)
    // Ровно та же строка, что печатает карточка точки: lat, lng и пять знаков.
    expect(collectText(screen.toJSON())).toContain('56.00673, 26.24711')
  })

  it('не печатает пустую строку координат для битой пары', async () => {
    // #1683 передвинул гард выше по потоку: битая точка больше не доходит до
    // попапа, потому что на ней не строится и сам маркер. Соседняя валидная
    // точка держит рендер и показывает, что упала ровно одна пара, а не карта.
    const screen = render(
      <TripPlanRouteMap route={[point(COORDINATES), point([Number.NaN, 56.006732], 'Битая', 'b')]} />,
    )

    await waitFor(() => expect(collectText(screen.toJSON())).toContain('Точка'))

    const text = collectText(screen.toJSON())
    expect(text).not.toContain('Битая')
    expect(mockFormatRoutePointCoordinates).not.toHaveBeenCalledWith([Number.NaN, 56.006732])
    // Инлайн-копия напечатала бы здесь «NaN, 56.00673».
    expect(text.some((line) => line.includes('NaN'))).toBe(false)
  })
})
