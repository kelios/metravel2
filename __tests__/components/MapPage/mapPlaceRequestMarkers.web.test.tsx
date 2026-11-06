import { renderHook } from '@testing-library/react-native'
import * as leaflet from 'leaflet'

import type { PlaceRequest } from '@/api/placeRequests'
import { useMapPlaceRequestMarkers } from '@/components/MapPage/Map/useMapPlaceRequestMarkers.web'
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
  const mapClick = jest.fn()
  map.on('click', mapClick)
  const layer = { markers: [place], selectedId: place.id, focus: place, openRequest }
  const { rerender, unmount } = await renderHook(
    ({ ready, currentLayer }: { ready: boolean; currentLayer?: MapPlaceRequestsLayer }) =>
      useMapPlaceRequestMarkers({ leaflet, map, layer: currentLayer, ready, accent: '#8a5353', foreground: '#fff' }),
    { initialProps: { ready: false, currentLayer: layer } },
  )
  try {
    expect(map.getZoom()).toBe(9)
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
  } finally {
    await unmount()
    map.remove()
    node.remove()
  }
})
