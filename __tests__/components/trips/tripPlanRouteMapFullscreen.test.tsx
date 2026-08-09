import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

const mockCanvasProps: Array<{ containerKey?: string; center?: [number, number]; zoom?: number }> = []

// Развёрнутая карта уходит порталом в document.body; react-test-renderer порталы
// в DOM-контейнер не умеет, поэтому в тесте портал рендерит узел на месте.
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
      useMap: () => ({ setView: jest.fn(), fitBounds: jest.fn() }),
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => {
  const ReactModule = require('react') as typeof React

  return {
    MapCanvas: ({
      children,
      containerKey,
      center,
      zoom,
      onMapRef,
    }: {
      children?: (engine: unknown) => React.ReactNode
      containerKey?: string
      center?: [number, number]
      zoom?: number
      onMapRef?: (map: unknown) => void
    }) => {
      mockCanvasProps.push({ containerKey, center, zoom })
      // Реальный MapCanvas отдаёт leaflet-инстанс наверх — компонент снимает с него
      // центр/зум перед разворотом. Инстанс ОДИН на смонтированный контейнер и
      // приезжает эффектом: карта конструктора держит его состоянием, и новый
      // объект на каждый рендер закрутил бы бесконечный цикл, которого в проде нет.
      const mapRef = ReactModule.useRef<unknown>(null)
      if (!mapRef.current) {
        mapRef.current = { getCenter: () => ({ lat: 53.5, lng: 27.5 }), getZoom: () => 14 }
      }
      ReactModule.useEffect(() => {
        onMapRef?.(mapRef.current)
      }, [onMapRef])

      return <div data-testid="map-canvas">{children?.({})}</div>
    },
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

const EXPAND = 'Развернуть карту на весь экран'
const COLLAPSE = 'Свернуть карту'

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const renderMap = async () => {
  const utils = render(<TripPlanRouteMap route={route} />)
  await waitFor(() => utils.getByLabelText(EXPAND))
  return utils
}

// #1301: карту конструктора нужно разворачивать на весь экран. `position: fixed`
// внутри ScrollView RN-Web зажимается его же трансформом, поэтому разворот — это
// портал в document.body. Портал пересобирает MapContainer, значит контракт такой:
// свой containerKey на режим и перенос центра/зума руками.
describe('TripPlanRouteMap fullscreen (web)', () => {
  beforeEach(() => {
    mockCanvasProps.length = 0
    document.body.style.overflow = ''
  })

  it('keeps the toggle addressable by its testID', async () => {
    const { UNSAFE_getByProps } = await renderMap()

    expect(UNSAFE_getByProps({ 'data-testid': 'trip-plan-map-fullscreen' })).toBeTruthy()
  })

  it('toggles the map between the inline box and the full viewport', async () => {
    const { getByLabelText } = await renderMap()

    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)

    fireEvent(getByLabelText(EXPAND), 'click')

    expect(getByLabelText(COLLAPSE)).toBeTruthy()
    // Свой контейнер на каждый режим: leaflet иначе ругается «container is
    // already initialized», когда карта переезжает в портал.
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-fs$/)

    fireEvent(getByLabelText(COLLAPSE), 'click')

    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
  })

  // Портал пересобирает MapContainer, поэтому вид карты обязан переехать руками —
  // иначе разворот сбрасывал бы пользователя обратно на общий план маршрута.
  it('carries the current center and zoom into the fullscreen map', async () => {
    const { getByLabelText } = await renderMap()

    fireEvent(getByLabelText(EXPAND), 'click')

    expect(mockCanvasProps.at(-1)?.center).toEqual([53.5, 27.5])
    expect(mockCanvasProps.at(-1)?.zoom).toBe(14)
  })

  it('closes the fullscreen map on Escape and gives the page its scroll back', async () => {
    const { getByLabelText } = await renderMap()

    fireEvent(getByLabelText(EXPAND), 'click')
    expect(document.body.style.overflow).toBe('hidden')

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(document.body.style.overflow).toBe('')
  })

  // Точки ставятся кликом по карте — в развёрнутом виде это должно работать так же.
  it('keeps the same map canvas mounted in fullscreen', async () => {
    const { getByLabelText, UNSAFE_getByProps } = await renderMap()

    fireEvent(getByLabelText(EXPAND), 'click')

    expect(UNSAFE_getByProps({ 'data-testid': 'map-canvas' })).toBeTruthy()
  })
})
