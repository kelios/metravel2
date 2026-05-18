import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import MarkerClusterGroup from '@/components/MapPage/Map/MarkerClusterGroup'

const mockRootRender = jest.fn()
const mockRootUnmount = jest.fn()
const mockCreateRoot = jest.fn(() => ({
  render: mockRootRender,
  unmount: mockRootUnmount,
}))

jest.mock('react-dom/client', () => ({
  createRoot: (container: unknown) => mockCreateRoot(container),
}))

type TestMarker = {
  bindPopup: jest.Mock
  bindTooltip: jest.Mock
  openPopup?: jest.Mock
  on: jest.MockedFunction<(eventName: string, handler: (event: any) => void) => TestMarker>
}

describe('MarkerClusterGroup', () => {
  const originalDocument = global.document
  const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    return {
      queryClient,
      ...render(
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>,
      ),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).document = {
      createElement: jest.fn(() => ({
        className: '',
        setAttribute: jest.fn(),
        innerHTML: '',
      })),
    }
  })

  afterEach(() => {
    ;(global as any).document = originalDocument
  })

  it('forwards popup shell props and popupopen handler to imperative Leaflet markers', () => {
    const popupOpen = jest.fn()
    const markerHandlers = new Map<string, (event: any) => void>()
    const marker = {} as TestMarker
    marker.bindPopup = jest.fn()
    marker.bindTooltip = jest.fn()
    marker.on = jest.fn((eventName: string, handler: (event: any) => void): TestMarker => {
      markerHandlers.set(eventName, handler)
      return marker
    })
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      fitBounds: jest.fn(),
      getContainer: jest.fn(() => ({ clientWidth: 1280, clientHeight: 900 })),
    }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => marker),
      divIcon: jest.fn(),
    }

    renderWithClient(
      <MarkerClusterGroup
        L={L}
        useMap={() => map}
        points={[
          {
            id: 1,
            coord: '53.9,27.56',
            address: 'Минск',
          } as any,
        ]}
        markerIcon={{}}
        PopupContent={() => null}
        Popup={() => null}
        popupProps={{
          className: 'metravel-place-popup',
          keepInView: true,
          autoPanPaddingTopLeft: [24, 140],
          autoPanPaddingBottomRight: [24, 140],
          eventHandlers: {
            popupopen: popupOpen,
          },
        }}
      />,
    )

    expect(marker.bindPopup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        className: 'metravel-place-popup',
        keepInView: true,
        autoPanPaddingTopLeft: [24, 140],
        autoPanPaddingBottomRight: [24, 140],
      })
    )

    const popupEvent = { popup: { getElement: jest.fn() } }
    markerHandlers.get('popupopen')?.(popupEvent)

    expect(popupOpen).toHaveBeenCalledWith(popupEvent)
  })

  it('defers popup opening to marker click follow-up when a handler is present', () => {
    const markerHandlers = new Map<string, (event: any) => void>()
    const marker = {} as TestMarker
    marker.bindPopup = jest.fn()
    marker.bindTooltip = jest.fn()
    marker.openPopup = jest.fn()
    marker.on = jest.fn((eventName: string, handler: (event: any) => void): TestMarker => {
      markerHandlers.set(eventName, handler)
      return marker
    })
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => marker),
      divIcon: jest.fn(),
    }
    const onMarkerClick = jest.fn()

    renderWithClient(
      <MarkerClusterGroup
        L={L}
        useMap={() => map}
        points={[
          {
            id: 1,
            coord: '53.9,27.56',
            address: 'Минск',
          } as any,
        ]}
        markerIcon={{}}
        PopupContent={() => null}
        Popup={() => null}
        onMarkerClick={onMarkerClick}
      />,
    )

    markerHandlers.get('click')?.({
      originalEvent: { stopPropagation: jest.fn() },
      target: marker,
    })

    expect(marker.openPopup).not.toHaveBeenCalled()
    expect(onMarkerClick).toHaveBeenCalledTimes(1)
    expect(onMarkerClick.mock.calls[0][2]).toBe(marker)
  })

  it('renders popup content inside QueryClientProvider for the separate popup root', () => {
    const markerHandlers = new Map<string, (event: any) => void>()
    const marker = {} as TestMarker
    marker.bindPopup = jest.fn()
    marker.bindTooltip = jest.fn()
    marker.on = jest.fn((eventName: string, handler: (event: any) => void): TestMarker => {
      markerHandlers.set(eventName, handler)
      return marker
    })
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      closePopup: jest.fn(),
    }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => marker),
      divIcon: jest.fn(),
    }

    const { queryClient } = renderWithClient(
      <MarkerClusterGroup
        L={L}
        useMap={() => map}
        points={[
          {
            id: 1,
            coord: '53.9,27.56',
            address: 'Минск',
          } as any,
        ]}
        markerIcon={{}}
        PopupContent={() => null}
        Popup={() => null}
      />,
    )

    markerHandlers.get('popupopen')?.({})

    expect(mockCreateRoot).toHaveBeenCalledTimes(1)
    expect(mockRootRender).toHaveBeenCalledTimes(1)

    const popupTree = mockRootRender.mock.calls[0]?.[0]
    expect(React.isValidElement(popupTree)).toBe(true)
    expect(popupTree.type).toBe(QueryClientProvider)
    expect(popupTree.props.client).toBe(queryClient)
  })
})
