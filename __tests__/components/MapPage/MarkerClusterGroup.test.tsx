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
    // Mount adds the marker; it must NOT tear the (empty) group down first — the
    // sync effect diffs by key instead of clear+rebuild (#1347).
    expect(addLayersCalls).toBeGreaterThan(0)
    expect(clearLayersCalls).toBe(0)

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

  // #1347 — the server-cluster query re-keys on every viewport change, so the same
  // places arrive as a brand-new array on every pan. Rebuilding all markers there is
  // what froze the mobile map.
  it('diffs markers by key: a new array with the same points touches nothing', () => {
    const makeMarker = () => {
      const marker = {} as TestMarker & { off: jest.Mock; unbindPopup: jest.Mock }
      marker.bindPopup = jest.fn()
      marker.bindTooltip = jest.fn()
      marker.off = jest.fn()
      marker.unbindPopup = jest.fn()
      marker.on = jest.fn((): any => marker)
      return marker
    }
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      removeLayers: jest.fn(),
      removeLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = { addLayer: jest.fn(), removeLayer: jest.fn(), closePopup: jest.fn() }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => makeMarker()),
      divIcon: jest.fn(),
    }
    const markerIcon = {}
    const pointA = { id: 1, coord: '53.9,27.56', address: 'Минск' } as any
    const pointB = { id: 2, coord: '53.8,27.40', address: 'Дзержинск' } as any
    const props = (points: any[]) => ({
      L,
      useMap: () => map,
      points,
      markerIcon,
      PopupContent: () => null,
      Popup: () => null,
    })

    const { queryClient, rerender } = renderWithClient(
      <MarkerClusterGroup {...(props([pointA, pointB]) as any)} />,
    )
    expect(L.marker).toHaveBeenCalledTimes(2)
    expect(group.addLayers).toHaveBeenCalledTimes(1)

    // Same two points, fresh array + fresh objects (what a refetch produces).
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props([{ ...pointA }, { ...pointB }]) as any)} />
      </QueryClientProvider>,
    )
    expect(L.marker).toHaveBeenCalledTimes(2)
    expect(group.addLayers).toHaveBeenCalledTimes(1)
    expect(group.removeLayers).not.toHaveBeenCalled()
    expect(group.clearLayers).not.toHaveBeenCalled()

    // One point leaves, one arrives → exactly one create and one removal.
    const pointC = { id: 3, coord: '54.0,27.90', address: 'Логойск' } as any
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props([pointA, pointC]) as any)} />
      </QueryClientProvider>,
    )
    expect(L.marker).toHaveBeenCalledTimes(3)
    expect(group.addLayers).toHaveBeenCalledTimes(2)
    expect(group.addLayers.mock.calls[1][0]).toHaveLength(1)
    expect(group.removeLayers).toHaveBeenCalledTimes(1)
    expect(group.removeLayers.mock.calls[0][0]).toHaveLength(1)
    expect(group.clearLayers).not.toHaveBeenCalled()
  })

  // #1347 — the parent keeps a coord→marker index that MapUiApi.openPopupForCoord uses
  // to open a place card from the list. With clear+rebuild it was re-published on every
  // data change; the diff must keep it whole, including survivors.
  it('republishes the whole marker index after a diff, and only drops orphaned coords', () => {
    const makeMarker = () => {
      const marker: any = {}
      marker.bindPopup = jest.fn()
      marker.bindTooltip = jest.fn()
      marker.off = jest.fn()
      marker.unbindPopup = jest.fn()
      marker.on = jest.fn(() => marker)
      return marker
    }
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      removeLayers: jest.fn(),
      removeLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = { addLayer: jest.fn(), removeLayer: jest.fn(), closePopup: jest.fn() }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => makeMarker()),
      divIcon: jest.fn(),
    }
    // Two places share one address, plus a third elsewhere.
    const shared = '53.9,27.56'
    const a = { id: 1, coord: shared, address: 'Дом 1' } as any
    const b = { id: 2, coord: shared, address: 'Дом 2' } as any
    const c = { id: 3, coord: '54.0,27.90', address: 'Логойск' } as any

    const index = new Map<string, any>()
    const onMarkerInstance = jest.fn((coord: string, marker: any | null) => {
      if (marker) index.set(coord, marker)
      else index.delete(coord)
    })
    const markerIcon = {}
    const PopupContent = () => null
    const Popup = () => null
    const props = (points: any[]) => ({
      L,
      useMap: () => map,
      points,
      markerIcon,
      PopupContent,
      Popup,
      onMarkerInstance,
    })

    const { queryClient, rerender } = renderWithClient(
      <MarkerClusterGroup {...(props([a, b, c]) as any)} />,
    )
    expect(index.get(shared)).toBeTruthy()
    expect(index.get('54.0,27.90')).toBeTruthy()

    // b leaves. Its coord is still owned by a, so the shared entry must survive.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props([a, c]) as any)} />
      </QueryClientProvider>,
    )
    expect(index.get(shared)).toBeTruthy()
    expect(index.get('54.0,27.90')).toBeTruthy()

    // c leaves — nobody owns its coord any more.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props([a]) as any)} />
      </QueryClientProvider>,
    )
    expect(index.get(shared)).toBeTruthy()
    expect(index.has('54.0,27.90')).toBe(false)
  })

  // #1347 — a surviving key must not freeze stale content: the marker is never
  // re-created, so a changed address/coord has to be detected as a replacement.
  it('re-creates a marker when the same place changes coordinates or content', () => {
    const group = {
      addLayers: jest.fn(),
      addLayer: jest.fn(),
      removeLayers: jest.fn(),
      removeLayer: jest.fn(),
      clearLayers: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }
    const map = { addLayer: jest.fn(), removeLayer: jest.fn(), closePopup: jest.fn() }
    const L = {
      markerClusterGroup: jest.fn(() => group),
      marker: jest.fn(() => {
        const m: any = {}
        m.bindPopup = jest.fn()
        m.bindTooltip = jest.fn()
        m.off = jest.fn()
        m.unbindPopup = jest.fn()
        m.on = jest.fn(() => m)
        return m
      }),
      divIcon: jest.fn(),
    }
    // Stable identities: a fresh markerIcon/PopupContent per render would trip the
    // "marker options changed" rebuild and mask what this test measures.
    const markerIcon = {}
    const PopupContent = () => null
    const Popup = () => null
    const props = (point: any) => ({
      L,
      useMap: () => map,
      points: [point],
      markerIcon,
      PopupContent,
      Popup,
    })

    const { queryClient, rerender } = renderWithClient(
      <MarkerClusterGroup {...(props({ id: 7, coord: '53.9,27.56', address: 'Старый' }) as any)} />,
    )
    expect(L.marker).toHaveBeenCalledTimes(1)

    // Same id, same coord, new address → replaced.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props({ id: 7, coord: '53.9,27.56', address: 'Новый' }) as any)} />
      </QueryClientProvider>,
    )
    expect(L.marker).toHaveBeenCalledTimes(2)
    expect(group.removeLayers).toHaveBeenCalledTimes(1)

    // Same id, moved → replaced again.
    rerender(
      <QueryClientProvider client={queryClient}>
        <MarkerClusterGroup {...(props({ id: 7, coord: '54.1,27.90', address: 'Новый' }) as any)} />
      </QueryClientProvider>,
    )
    expect(L.marker).toHaveBeenCalledTimes(3)
    expect(group.removeLayers).toHaveBeenCalledTimes(2)
  })

  // #1624 — leaflet.markercluster builds cluster icons itself (`iconCreateFunction`
  // only supplies the divIcon html/size), so the group never gets a chance to set an
  // accessible name at construction time. Two independent hooks are supposed to catch
  // every cluster: a post-sync sweep over `map.eachLayer` (covers the very first
  // batch) and a `map.on('layeradd', ...)` listener (covers every later re-cluster).
  describe('cluster accessible names (#1624)', () => {
    class FakeMarkerCluster {
      _icon: any
      constructor(icon: any, childCount: number) {
        this._icon = icon
        this.getChildCount = () => childCount
      }
      getChildCount: () => number
    }

    const makeIcon = () => {
      const attrs: Record<string, string> = {}
      return {
        getAttribute: (key: string) => (key in attrs ? attrs[key] : null),
        setAttribute: (key: string, value: string) => {
          attrs[key] = value
        },
      }
    }

    it('labels every cluster icon found by the post-sync `map.eachLayer` sweep with a localized, pluralized name', () => {
      const clusterIcon = makeIcon()
      const fakeCluster = new FakeMarkerCluster(clusterIcon, 5)
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
        on: jest.fn(),
        off: jest.fn(),
        eachLayer: jest.fn((callback: (layer: any) => void) => {
          callback(fakeCluster)
        }),
      }
      const L = {
        markerClusterGroup: jest.fn(() => group),
        marker: jest.fn(() => marker),
        divIcon: jest.fn(),
        MarkerCluster: FakeMarkerCluster,
      }

      renderWithClient(
        <MarkerClusterGroup
          L={L}
          useMap={() => map}
          points={[{ id: 1, coord: '53.9,27.56', address: 'Минск' } as any]}
          markerIcon={{}}
          PopupContent={() => null}
          Popup={() => null}
        />,
      )

      expect(map.eachLayer).toHaveBeenCalled()
      expect(clusterIcon.getAttribute('aria-label')).toBe('Кластер: 5 мест')
    })

    it('labels a cluster reported later through the map layeradd event, and ignores non-cluster layers', () => {
      const clusterIcon = makeIcon()
      const fakeCluster = new FakeMarkerCluster(clusterIcon, 3)
      const plainMarkerIcon = makeIcon()
      const plainLayer = { _icon: plainMarkerIcon }
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
      const layerAddHandlers: Array<(event: any) => void> = []
      const map = {
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        on: jest.fn((eventName: string, handler: (event: any) => void) => {
          if (eventName === 'layeradd') layerAddHandlers.push(handler)
        }),
        off: jest.fn(),
      }
      const L = {
        markerClusterGroup: jest.fn(() => group),
        marker: jest.fn(() => marker),
        divIcon: jest.fn(),
        MarkerCluster: FakeMarkerCluster,
      }

      renderWithClient(
        <MarkerClusterGroup
          L={L}
          useMap={() => map}
          points={[{ id: 1, coord: '53.9,27.56', address: 'Минск' } as any]}
          markerIcon={{}}
          PopupContent={() => null}
          Popup={() => null}
        />,
      )

      expect(layerAddHandlers.length).toBeGreaterThan(0)

      // A regular marker layer is not an `L.MarkerCluster` — must stay untouched.
      layerAddHandlers.forEach((handler) => handler({ layer: plainLayer }))
      expect(plainMarkerIcon.getAttribute('aria-label')).toBeNull()

      // The actual cluster layer must be labelled.
      layerAddHandlers.forEach((handler) => handler({ layer: fakeCluster }))
      expect(clusterIcon.getAttribute('aria-label')).toBe('Кластер: 3 места')
    })

    it('does not throw when `L.MarkerCluster`, `map.on` or `map.eachLayer` are unavailable (degenerate host)', () => {
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
      // No `on`/`off`/`eachLayer` — matches every pre-existing test's map mock above.
      const map = { addLayer: jest.fn(), removeLayer: jest.fn() }
      const L = {
        markerClusterGroup: jest.fn(() => group),
        marker: jest.fn(() => marker),
        divIcon: jest.fn(),
      }

      expect(() =>
        renderWithClient(
          <MarkerClusterGroup
            L={L}
            useMap={() => map}
            points={[{ id: 1, coord: '53.9,27.56', address: 'Минск' } as any]}
            markerIcon={{}}
            PopupContent={() => null}
            Popup={() => null}
          />,
        ),
      ).not.toThrow()
    })
  })
})
