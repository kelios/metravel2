import React from 'react'
let render: typeof import('@testing-library/react/pure').render
let fireEvent: typeof import('@testing-library/react/pure').fireEvent
let waitFor: typeof import('@testing-library/react/pure').waitFor
let cleanup: typeof import('@testing-library/react/pure').cleanup
let act: typeof import('react').act
let TripPlanRouteMap: typeof import('@/components/trips/planning/TripPlanRouteMap.web').default

import type { RoutePoint } from '@/api/plannedTrips'

const mockCanvasProps: Array<{ containerKey?: string; center?: [number, number]; zoom?: number }> = []
const mockFitBounds = jest.fn()
const mockSetView = jest.fn()
const mockStop = jest.fn()
const mockMap = { setView: mockSetView, fitBounds: mockFitBounds, stop: mockStop }
const mockView = { lat: 53.5, lng: 27.5, zoom: 14 }


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
        mapRef.current = {
          getCenter: () => ({ lat: mockView.lat, lng: mockView.lng }),
          getZoom: () => mockView.zoom,
        }
      }
      ReactModule.useEffect(() => {
        onMapRef?.(mapRef.current)
      }, [onMapRef])

      return <div key={containerKey} data-testid="map-canvas">{children?.({})}</div>
    },
  }
})


const EXPAND = 'Развернуть карту на весь экран'
const COLLAPSE = 'Свернуть карту'


// This subject renders HTML popup/button/portal content. Exercise it through
// the real web renderer, while Leaflet remains the deterministic test boundary.
const reanimated = require('react-native-reanimated')
const worklets = require('react-native-worklets')
const reactQuery = require('@tanstack/react-query')
beforeAll(() => {
  jest.resetModules()
  // Preserve the React singleton used by the JSX in this test file.
  // The reanimated factory in setup.ts crashes if resetModules runs it again.
  jest.doMock('react', () => React)
  jest.doMock('react-native-reanimated', () => reanimated)
  jest.doMock('react-native-worklets', () => worklets)
  jest.doMock('@tanstack/react-query', () => reactQuery)
  jest.doMock('react-native', () => {
    const web = jest.requireActual('react-native-web')
    return web
  })
  jest.doMock('@expo/vector-icons/Feather', () => ({
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement('span', { 'aria-hidden': true, 'data-icon': name }),
  }))
  jest.doMock('@/hooks/useTheme', () => ({
    useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
    useTheme: () => ({ isDark: false }),
  }))
  ;({ render, fireEvent, waitFor, cleanup } = require('@testing-library/react/pure'))
  act = React.act
  TripPlanRouteMap = require('@/components/trips/planning/TripPlanRouteMap.web').default
})
afterEach(() => cleanup())

const route: RoutePoint[] = [
  { id: 'a', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const renderMap = async (routeOverride = route) => {
  const utils = await render(<TripPlanRouteMap route={routeOverride} />)
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
    mockFitBounds.mockClear()
    mockSetView.mockClear()
    mockStop.mockClear()
    mockView.lat = 53.5
    mockView.lng = 27.5
    mockView.zoom = 14
    document.body.style.overflow = ''
  })

  it('keeps the toggle addressable by its testID', async () => {
    const { getByTestId } = await renderMap()

    expect(getByTestId('trip-plan-map-fullscreen')).toBeTruthy()
  })

  it('toggles the map between the inline box and the full viewport', async () => {
    const { getByLabelText } = await renderMap()

    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)

    fireEvent.click(getByLabelText(EXPAND))

    expect(getByLabelText(COLLAPSE)).toBeTruthy()
    // Свой контейнер на каждый режим: leaflet иначе ругается «container is
    // already initialized», когда карта переезжает в портал.
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-fs$/)

    fireEvent.click(getByLabelText(COLLAPSE))

    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
  })

  // Портал пересобирает MapContainer, поэтому вид карты обязан переехать руками —
  // иначе разворот сбрасывал бы пользователя обратно на общий план маршрута.
  it('carries the current center and zoom into the fullscreen map', async () => {
    const { getByLabelText } = await renderMap()

    fireEvent.click(getByLabelText(EXPAND))

    expect(mockCanvasProps.at(-1)?.center).toEqual([53.5, 27.5])
    expect(mockCanvasProps.at(-1)?.zoom).toBe(14)
  })

  it('closes the fullscreen map on Escape and gives the page its scroll back', async () => {
    const { getByLabelText } = await renderMap()

    fireEvent.click(getByLabelText(EXPAND))
    expect(document.body.style.overflow).toBe('hidden')

    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(document.body.style.overflow).toBe('')
  })

  // #1928: снимок вида должен сниматься на каждом выходе, не только на кнопке.
  it('keeps the panned fullscreen view when closing with Escape', async () => {
    const { getByLabelText } = await renderMap()

    fireEvent.click(getByLabelText(EXPAND))
    mockView.lat = 54.1
    mockView.lng = 28.2
    mockView.zoom = 16

    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
    expect(mockCanvasProps.at(-1)?.center).toEqual([54.1, 28.2])
    expect(mockCanvasProps.at(-1)?.zoom).toBe(16)
  })

  it('keeps the panned fullscreen view when opening the point editor', async () => {
    const onEditPoint = jest.fn()
    const { getByLabelText, getByTestId } = await render(
      <TripPlanRouteMap route={route} onEditPoint={onEditPoint} />,
    )
    await waitFor(() => getByLabelText(EXPAND))

    fireEvent.click(getByLabelText(EXPAND))
    mockView.lat = 54.2
    mockView.lng = 28.3
    mockView.zoom = 15

    fireEvent.click(getByTestId('trip-plan-map-edit-point-1'))

    expect(onEditPoint).toHaveBeenCalledWith(1)
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
    expect(mockCanvasProps.at(-1)?.center).toEqual([54.2, 28.3])
    expect(mockCanvasProps.at(-1)?.zoom).toBe(15)
  })

  // Точки ставятся кликом по карте — в развёрнутом виде это должно работать так же.
  it('keeps the same map canvas mounted in fullscreen', async () => {
    const { getByLabelText, getByTestId } = await renderMap()

    fireEvent.click(getByLabelText(EXPAND))

    expect(getByTestId('map-canvas')).toBeTruthy()
  })

  // #1911: редактор точки живёт в панели под картой, а фулскрин — портал в body
  // поверх всей страницы. Без сворачивания карты «Изменить» выглядело как
  // неработающая кнопка: обработчик вызывался, редактор открывался под порталом.
  // На native это уже так (#1897), web оставался со старым поведением.
  it('collapses the fullscreen map before opening the point editor', async () => {
    const onEditPoint = jest.fn()
    const { getByLabelText, getByTestId } = await render(
      <TripPlanRouteMap route={route} onEditPoint={onEditPoint} />,
    )
    await waitFor(() => getByLabelText(EXPAND))

    fireEvent.click(getByLabelText(EXPAND))
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-fs$/)

    fireEvent.click(getByTestId('trip-plan-map-edit-point-1'))

    expect(onEditPoint).toHaveBeenCalledWith(1)
    // Карта вернулась в инлайн-раскладку, и страница снова скроллится.
    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
    expect(document.body.style.overflow).toBe('')
  })

  it('does not change plain (non-fullscreen) editing', async () => {
    const onEditPoint = jest.fn()
    const { getByLabelText, getByTestId } = await render(
      <TripPlanRouteMap route={route} onEditPoint={onEditPoint} />,
    )
    await waitFor(() => getByLabelText(EXPAND))

    fireEvent.click(getByTestId('trip-plan-map-edit-point-0'))

    expect(onEditPoint).toHaveBeenCalledWith(0)
    expect(getByLabelText(EXPAND)).toBeTruthy()
    expect(mockCanvasProps.at(-1)?.containerKey).toMatch(/-inline$/)
  })

  it('stops an active fitBounds transition when the Leaflet map is removed', async () => {
    const { unmount } = await renderMap()

    expect(mockFitBounds).toHaveBeenCalledTimes(1)
    expect(mockStop).not.toHaveBeenCalled()
    await unmount()

    expect(mockStop).toHaveBeenCalledTimes(1)
  })

  it('stops an active setView transition when a single-point map is removed', async () => {
    const { unmount } = await renderMap([route[0]])

    expect(mockSetView).toHaveBeenCalledWith([53.9, 27.56], 12)
    expect(mockStop).not.toHaveBeenCalled()
    await unmount()

    expect(mockStop).toHaveBeenCalledTimes(1)
  })

  it('registers cleanup for a remounted fullscreen map after bounds were already fitted', async () => {
    const { getByLabelText, unmount } = await renderMap()

    expect(mockStop).not.toHaveBeenCalled()
    fireEvent.click(getByLabelText(EXPAND))
    expect(mockStop).toHaveBeenCalledTimes(1)

    await unmount()
    expect(mockStop).toHaveBeenCalledTimes(2)
  })
})
