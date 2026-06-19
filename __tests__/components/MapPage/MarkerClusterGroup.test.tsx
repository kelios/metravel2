import React from 'react'
import { act, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import MarkerClusterGroup from '@/components/MapPage/Map/MarkerClusterGroup'

const mockCreatePortal = jest.fn(
  (
    children: React.ReactNode,
    _container: Element | DocumentFragment,
    key?: string | null,
  ) => <React.Fragment key={key ?? undefined}>{children}</React.Fragment>,
)

jest.mock('react-dom', () => ({
  createPortal: (
    children: React.ReactNode,
    container: Element | DocumentFragment,
    key?: string | null,
  ) => mockCreatePortal(children, container, key),
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

  it('renders popup content through a portal into the Leaflet popup container', () => {
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
      />,
    )

    act(() => {
      markerHandlers.get('popupopen')?.({})
    })

    expect(mockCreatePortal).toHaveBeenCalledTimes(1)

    const popupTree = mockCreatePortal.mock.calls[0]?.[0]
    const popupContainer = mockCreatePortal.mock.calls[0]?.[1]
    expect(React.isValidElement(popupTree)).toBe(true)
    expect(popupTree.type).toBeDefined()
    expect(popupTree.props.point.id).toBe(1)
    expect(popupTree.props.closePopup).toEqual(expect.any(Function))
    expect(popupContainer?.className).toBe('metravel-cluster-popup-root')
  })

  it('does not bind or open Leaflet popup when mobile bottom-card mode suppresses popups', () => {
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
        suppressLeafletPopupOnSelect
        onMarkerClick={onMarkerClick}
      />,
    )

    expect(marker.bindPopup).not.toHaveBeenCalled()

    markerHandlers.get('click')?.({
      originalEvent: { stopPropagation: jest.fn() },
      target: marker,
    })

    expect(marker.openPopup).not.toHaveBeenCalled()
    expect(onMarkerClick).toHaveBeenCalledTimes(1)
    expect(mockCreatePortal).not.toHaveBeenCalled()
  })

  it('keeps Leaflet markers mounted when only popup React content changes', () => {
    const marker = {} as TestMarker
    marker.bindPopup = jest.fn()
    marker.bindTooltip = jest.fn()
    marker.on = jest.fn((): TestMarker => marker)
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
    const points = [
      {
        id: 1,
        coord: '53.9,27.56',
        address: 'Минск',
      } as any,
    ]
    const markerIcon = {}
    const FirstPopupContent = () => null
    const SecondPopupContent = () => null

    const { queryClient, rerender } = renderWithClient(
      <MarkerClusterGroup
        L={L}
        useMap={() => map}
        points={points}
        markerIcon={markerIcon}
        PopupContent={FirstPopupContent}
        Popup={() => null}
      />,
    )

    const clearLayersCalls = group.clearLayers.mock.calls.length
    const addLayersCalls = group.addLayers.mock.calls.length
    expect(clearLayersCalls).toBeGreaterThan(0)
    expect(addLayersCalls).toBeGreaterThan(0)

    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup
          L={L}
          useMap={() => map}
          points={points}
          markerIcon={markerIcon}
          PopupContent={SecondPopupContent}
          Popup={() => null}
        />
      </QueryClientProvider>,
    )

    expect(group.clearLayers).toHaveBeenCalledTimes(clearLayersCalls)
    expect(group.addLayers).toHaveBeenCalledTimes(addLayersCalls)
  })
})
