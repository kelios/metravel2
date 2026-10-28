import React from 'react'
import { render } from '@testing-library/react-native'

import ServerClusterLayer, {
  syncServerClusterLayer,
} from '@/components/MapPage/Map/ServerClusterLayer'
import type { ClusterData } from '@/components/MapPage/Map/types'

// #2451 — the /map backend cluster layer is one imperative L.layerGroup with a
// keyed diff: surviving keys keep their Leaflet marker (and DOM node).

type FakeMarker = {
  latlng: [number, number]
  options: any
  el: HTMLElement
  handlers: Record<string, (event: any) => void>
  on: jest.Mock
  off: jest.Mock
  setLatLng: jest.Mock
  setIcon: jest.Mock
  getElement: () => HTMLElement
}

const makeLeaflet = () => {
  const markers: FakeMarker[] = []
  const group: any = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    clearLayers: jest.fn(),
    remove: jest.fn(),
  }
  group.addTo = jest.fn(() => group)
  const L = {
    layerGroup: jest.fn(() => group),
    divIcon: jest.fn((options: any) => ({ options })),
    DomEvent: { stopPropagation: jest.fn() },
    marker: jest.fn((latlng: [number, number], options: any) => {
      const el = document.createElement('div')
      const marker: FakeMarker = {
        latlng,
        options,
        el,
        handlers: {},
        on: jest.fn((name: string, handler: (event: any) => void) => {
          marker.handlers[name] = handler
          return marker
        }),
        off: jest.fn(),
        setLatLng: jest.fn(),
        setIcon: jest.fn(),
        getElement: () => el,
      }
      markers.push(marker)
      return marker
    }),
  }
  return { L, group, markers }
}

const cluster = (lat: number, lng: number, count: number, spread = 0.1): ClusterData => ({
  key: `${lat.toFixed(4)}|${lng.toFixed(4)}|${count}`,
  count,
  center: [lat, lng],
  bounds: [
    [lat - spread, lng - spread],
    [lat + spread, lng + spread],
  ],
  items: [],
})

describe('ServerClusterLayer', () => {
  const map = { id: 'map' }
  const useMap = () => map

  const renderLayer = async (L: any, clusters: ClusterData[], extra: Record<string, unknown> = {}) =>
    await render(<ServerClusterLayer L={L} useMap={useMap} clusters={clusters} {...extra} />)

  it('adds one marker per cluster into a single layer group on the map', async () => {
    const { L, group, markers } = makeLeaflet()
    await renderLayer(L, [cluster(53.9, 27.5, 12), cluster(52.1, 23.7, 40)])

    expect(L.layerGroup).toHaveBeenCalledTimes(1)
    expect(group.addTo).toHaveBeenCalledWith(map)
    expect(group.addLayer).toHaveBeenCalledTimes(2)
    expect(markers.map((m) => m.latlng)).toEqual([
      [53.9, 27.5],
      [52.1, 23.7],
    ])
    // Accessible name on the real icon node (#1624).
    expect(markers[0].el.getAttribute('aria-label')).toBeTruthy()
    expect(markers[0].el.getAttribute('aria-label')).toContain('12')
  })

  it('does not touch Leaflet when the same set arrives again in a new array (0 add / 0 remove)', async () => {
    const { L, group } = makeLeaflet()
    const view = await renderLayer(L, [cluster(53.9, 27.5, 12), cluster(52.1, 23.7, 40)])
    group.addLayer.mockClear()

    await view.rerender(
      <ServerClusterLayer
        L={L}
        useMap={useMap}
        clusters={[cluster(52.1, 23.7, 40), cluster(53.9, 27.5, 12)]}
      />,
    )

    expect(group.addLayer).not.toHaveBeenCalled()
    expect(group.removeLayer).not.toHaveBeenCalled()
    expect(L.marker).toHaveBeenCalledTimes(2)
    expect(L.layerGroup).toHaveBeenCalledTimes(1)
  })

  it('replaces exactly the cluster that changed (1 remove + 1 add)', async () => {
    const { L, group, markers } = makeLeaflet()
    const view = await renderLayer(L, [cluster(53.9, 27.5, 12), cluster(52.1, 23.7, 40)])
    group.addLayer.mockClear()

    await view.rerender(
      <ServerClusterLayer
        L={L}
        useMap={useMap}
        clusters={[cluster(53.9, 27.5, 12), cluster(52.1, 23.7, 41)]}
      />,
    )

    expect(group.removeLayer).toHaveBeenCalledTimes(1)
    expect(group.removeLayer).toHaveBeenCalledWith(markers[1])
    expect(group.addLayer).toHaveBeenCalledTimes(1)
    expect(group.addLayer).toHaveBeenCalledWith(markers[2])
  })

  it('reuses one cached icon instance per visual class', async () => {
    const { L, markers } = makeLeaflet()
    await renderLayer(L, [cluster(53.9, 27.5, 12), cluster(52.1, 23.7, 12)])

    expect(markers[0].options.icon).toBe(markers[1].options.icon)
    expect(L.divIcon).toHaveBeenCalledTimes(1)
  })

  it('zooms to the CURRENT bounds of the tapped key and stamps the tap guard', async () => {
    const { L, markers } = makeLeaflet()
    const onClusterZoom = jest.fn()
    const onClusterTap = jest.fn()
    const view = await renderLayer(L, [cluster(53.9, 27.5, 12)], { onClusterZoom, onClusterTap })

    // Same key, wider bounds in a later response → no new marker, fresh bounds.
    const wider = cluster(53.9, 27.5, 12, 0.3)
    await view.rerender(
      <ServerClusterLayer
        L={L}
        useMap={useMap}
        clusters={[wider]}
        onClusterZoom={onClusterZoom}
        onClusterTap={onClusterTap}
      />,
    )
    expect(markers).toHaveLength(1)

    const stopPropagation = jest.fn()
    markers[0].handlers.click({ originalEvent: { stopPropagation } })

    expect(stopPropagation).toHaveBeenCalled()
    expect(onClusterTap).toHaveBeenCalledTimes(1)
    expect(onClusterZoom).toHaveBeenCalledWith({
      center: [53.9, 27.5],
      bounds: wider.bounds,
      key: '53.9000|27.5000|12',
      items: [],
    })
  })

  it('removes the whole group only on unmount', async () => {
    const { L, group } = makeLeaflet()
    const view = await renderLayer(L, [cluster(53.9, 27.5, 12)])
    expect(group.remove).not.toHaveBeenCalled()
    await view.unmount()
    expect(group.remove).toHaveBeenCalledTimes(1)
  })
})

describe('syncServerClusterLayer', () => {
  it('reports the diff and skips invalid or duplicate entries', () => {
    const { L, group } = makeLeaflet()
    const entries = new Map()
    const handlersRef = { current: {} }
    const a = cluster(53.9, 27.5, 12)
    const bad = { ...cluster(1, 1, 3), center: [Number.NaN, 1] as [number, number] }

    expect(
      syncServerClusterLayer({ L, group, entries, clusters: [a, a, bad], isDark: false, handlersRef }),
    ).toEqual({ added: 1, removed: 0, updated: 0 })
    expect(
      syncServerClusterLayer({ L, group, entries, clusters: [{ ...a }], isDark: false, handlersRef }),
    ).toEqual({ added: 0, removed: 0, updated: 0 })
    // Theme switch: same marker, new icon.
    expect(
      syncServerClusterLayer({ L, group, entries, clusters: [a], isDark: true, handlersRef }),
    ).toEqual({ added: 0, removed: 0, updated: 1 })
    expect(
      syncServerClusterLayer({ L, group, entries, clusters: [], isDark: true, handlersRef }),
    ).toEqual({ added: 0, removed: 1, updated: 0 })
  })
})
