import { renderHook } from '@testing-library/react-native'
import * as leaflet from 'leaflet'

import type { PlaceRequest } from '@/api/placeRequests'
import { MAP_BOTTOM_CONTROLS_RESERVE_VAR } from '@/components/MapPage/Map/constants'
import { useMapPlaceRequestMarkers } from '@/components/MapPage/Map/useMapPlaceRequestMarkers.web'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { MapPlaceRequestsLayer } from '@/hooks/map/useMapPlaceRequests'

jest.mock('@/i18n/LocaleProvider', () => {
  const t = (_key: string, { name }: { name: string }) => `${name} · ищем историю`
  return { useTranslation: () => ({ t }) }
})

const place: PlaceRequest = {
  id: '89b3aaf4-7590-5e29-af5a-ecb918dd96f1', status: 'open',
  placeId: 'c380f3b9-340f-5cfc-8995-29608ed38f29', name: 'Дворец Булгаков', address: 'Жиличи',
  countryId: 1, region: 'mogilev', categoryId: 1, categoryName: 'Усадьба',
  lat: 53.479157, lng: 29.690125, prompt: 'Поделитесь своим фото.', preview: null, publicTravelUrl: null,
}

it('opens an accessible campaign pin without a route-map click and focuses only after startup', async () => {
  const node = document.createElement('div')
  document.body.appendChild(node)
  const map = leaflet.map(node).setView([53.9, 27.55], 9)
  const panInside = jest.spyOn(map, 'panInside').mockReturnValue(map)
  const openRequest = jest.fn()
  const setLegendHost = jest.fn<void, [HTMLElement | null]>()
  const mapClick = jest.fn()
  map.on('click', mapClick)
  const layer = { markers: [place], selectedId: place.id, focus: place, openRequest, setLegendHost }
  const { rerender, unmount } = await renderHook(
    ({ ready, currentLayer }: { ready: boolean; currentLayer?: MapPlaceRequestsLayer }) =>
      useMapPlaceRequestMarkers({ leaflet, map, layer: currentLayer, ready, accent: '#8a5353', foreground: '#fff' }),
    { initialProps: { ready: false, currentLayer: layer } },
  )
  try {
    expect(map.getZoom()).toBe(9)
    const legendHost = setLegendHost.mock.calls[0]?.[0]
    expect(legendHost).toBe(node.querySelector('.leaflet-bottom.leaflet-right')?.firstElementChild)
    expect(legendHost?.nextElementSibling?.classList.contains('leaflet-control-attribution')).toBe(true)
    legendHost?.click()
    const marker = node.querySelector<HTMLButtonElement>('.metravel-place-request-pin button')
    expect(marker?.getAttribute('aria-label')).toBe('Дворец Булгаков · ищем историю')
    expect(marker?.style.width).toBe('44px')
    expect(marker?.style.height).toBe('44px')
    marker?.focus()
    expect(document.activeElement).toBe(marker)
    expect(panInside).toHaveBeenCalledWith([place.lat, place.lng], {
      paddingTopLeft: [22, 40],
      paddingBottomRight: [22, 4],
    })
    marker?.click()
    expect(openRequest).toHaveBeenCalledWith(place.id)
    expect(mapClick).not.toHaveBeenCalled()

    await rerender({ ready: true, currentLayer: layer })
    expect(map.getCenter()).toEqual(leaflet.latLng(place.lat, place.lng))
    expect(map.getZoom()).toBe(14)
    const updated = { ...place, lat: 53.5 }
    await rerender({ ready: true, currentLayer: { ...layer, markers: [updated], focus: updated } })
    expect(node.querySelector('.metravel-place-request-pin button')).toBe(marker)
    expect(document.activeElement).toBe(marker)
    expect(map.getCenter()).toEqual(leaflet.latLng(updated.lat, updated.lng))
    await rerender({ ready: true, currentLayer: undefined })
    expect(node.querySelector('.metravel-place-request-pin')).toBeNull()
    expect(setLegendHost).toHaveBeenLastCalledWith(null)
    expect(legendHost?.isConnected).toBe(false)
  } finally {
    await unmount()
    map.remove()
    node.remove()
  }
})

it('updates the mobile search reserve when the shared Leaflet corner grows and clears it on disable', async () => {
  const OriginalResizeObserver = global.ResizeObserver
  const observe = jest.fn()
  const disconnect = jest.fn()
  let resize = () => {}
  global.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this)
    }
    observe = observe
    disconnect = disconnect
    unobserve = jest.fn()
  }
  const node = document.createElement('div')
  node.dataset.testid = 'map-screen-root'
  document.body.appendChild(node)
  const map = leaflet.map(node).setView([53.9, 27.55], 9)
  const setLegendHost = jest.fn<void, [HTMLElement | null]>()
  const layer = { markers: [], selectedId: null, focus: null, openRequest: jest.fn(), setLegendHost }
  try {
    const { rerender, unmount } = await renderHook(
      ({ currentLayer }: { currentLayer?: MapPlaceRequestsLayer }) =>
        useMapPlaceRequestMarkers({ leaflet, map, layer: currentLayer, ready: true, accent: '#8a5353', foreground: '#fff' }),
      { initialProps: { currentLayer: layer } },
    )
    const corner = setLegendHost.mock.calls[0]?.[0]?.parentElement
    expect(observe).toHaveBeenCalledWith(corner)
    Object.defineProperty(corner, 'offsetHeight', { value: 128 })
    resize()
    expect(node.style.getPropertyValue(MAP_BOTTOM_CONTROLS_RESERVE_VAR)).toBe(
      `calc(var(--mt-map-leaflet-corner-bottom, 8px) + 128px + ${DESIGN_TOKENS.spacing.sm}px)`,
    )
    await rerender({ currentLayer: undefined })
    expect(node.style.getPropertyValue(MAP_BOTTOM_CONTROLS_RESERVE_VAR)).toBe('')
    expect(disconnect).toHaveBeenCalledTimes(1)
    await unmount()
  } finally {
    global.ResizeObserver = OriginalResizeObserver
    map.remove()
    node.remove()
  }
})
