import { useEffect, useRef } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { MapPlaceRequestsLayer } from '@/hooks/map/useMapPlaceRequests'
import { useTranslation } from '@/i18n/LocaleProvider'
import { MAP_BOTTOM_CONTROLS_RESERVE_VAR } from './constants'
import { beginProgrammaticMapMove, noteUserMapGesture } from './programmaticMoveSignal'

const PIN_SIZE = DESIGN_TOKENS.touchTarget.minWidth
const PIN_ANCHOR: [number, number] = [PIN_SIZE / 2, 40]
const FOCUS_ZOOM = 14

// Only this fixed artwork is parsed as HTML. Place names and theme values are
// assigned through DOM properties so neither can enter the markup.
const PIN_ART = '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">' +
  '<path d="M22 40S7 27 7 17a15 15 0 0 1 30 0c0 10-15 23-15 23Z" fill="var(--pin-accent)" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M22 25l-7-7a4 4 0 0 1 6-6l1 1 1-1a4 4 0 0 1 6 6Z" fill="currentColor"/>' +
  '</svg>'

type Coordinates = [number, number]
type MarkerMap = {
  setView: (coordinates: Coordinates, zoom: number, options: { animate: boolean }) => void
  panInside: (coordinates: Coordinates, options: {
    paddingTopLeft: Coordinates
    paddingBottomRight: Coordinates
  }) => void
}

type Pin = {
  button: HTMLButtonElement
  marker: { setLatLng: (coordinates: Coordinates) => void }
  coordinates: Coordinates
}

type PinGroup = {
  remove: () => void
  removeLayer: (marker: Pin['marker']) => void
}

type Options = {
  leaflet: typeof import('leaflet') | null
  map: MarkerMap | null
  layer?: MapPlaceRequestsLayer
  ready: boolean
  accent: string
  foreground: string
}

export function useMapPlaceRequestMarkers({ leaflet, map, layer, ready, accent, foreground }: Options) {
  const { t } = useTranslation()
  const markers = layer?.markers
  const openRequest = layer?.openRequest
  const setLegendHost = layer?.setLegendHost
  const focused = useRef<{ map: MarkerMap; key: string } | null>(null)
  const groupRef = useRef<PinGroup | null>(null)
  const pinsRef = useRef(new Map<string, Pin>())
  const selectedId = layer?.selectedId
  const focusLat = layer?.focus?.lat
  const focusLng = layer?.focus?.lng

  useEffect(() => {
    if (!leaflet || !map || !setLegendHost) return
    // Leaflet stacks bottom controls above attribution, including wrapped
    // credits and the map corner's shared dock/consent offset.
    const host = document.createElement('div')
    host.style.pointerEvents = 'none'
    leaflet.DomEvent.disableClickPropagation(host)
    leaflet.DomEvent.disableScrollPropagation(host)
    const control = leaflet.control({ position: 'bottomright' })
    control.onAdd = () => host
    control.addTo(map)
    const corner = host.parentElement
    const mapRoot = host.closest<HTMLElement>('[data-testid="map-screen-root"]')
    const updateReserve = () => {
      if (!mapRoot || !corner) return
      mapRoot.style.setProperty(
        MAP_BOTTOM_CONTROLS_RESERVE_VAR,
        `calc(var(--mt-map-leaflet-corner-bottom, 8px) + ${corner.offsetHeight}px + ${DESIGN_TOKENS.spacing.sm}px)`,
      )
    }
    updateReserve()
    const observer = mapRoot && corner && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateReserve)
      : null
    if (corner) observer?.observe(corner)
    setLegendHost(host)
    return () => {
      observer?.disconnect()
      mapRoot?.style.removeProperty(MAP_BOTTOM_CONTROLS_RESERVE_VAR)
      setLegendHost(null)
      control.remove()
    }
  }, [leaflet, map, setLegendHost])

  useEffect(() => {
    if (!leaflet || !map || !openRequest) return
    const group: PinGroup = leaflet.layerGroup().addTo(map)
    groupRef.current = group
    const pins = pinsRef.current
    return () => {
      group.remove()
      groupRef.current = null
      pins.clear()
    }
  }, [leaflet, map, openRequest])

  useEffect(() => {
    const group = groupRef.current
    if (!leaflet || !map || !group || !markers || !openRequest) return
    const pins = pinsRef.current
    const ids = new Set(markers.map(({ id }) => id))
    for (const [id, pin] of pins) {
      if (ids.has(id)) continue
      group.removeLayer(pin.marker)
      pins.delete(id)
    }

    for (const { id, name, lat, lng } of markers) {
      const accessibleName = t('places:contributions.map.marker', { name })
      const existing = pins.get(id)
      if (existing) {
        existing.button.title = name
        existing.button.setAttribute('aria-label', accessibleName)
        existing.button.style.color = foreground
        existing.button.style.setProperty('--pin-accent', accent)
        if (existing.coordinates[0] !== lat || existing.coordinates[1] !== lng) {
          existing.coordinates = [lat, lng]
          existing.marker.setLatLng(existing.coordinates)
        }
        continue
      }

      const button = document.createElement('button')
      button.type = 'button'
      button.title = name
      button.setAttribute('aria-label', accessibleName)
      button.style.cssText = 'display:block;padding:0;border:0;background:none;cursor:pointer;outline-offset:2px;'
      button.style.width = `${PIN_SIZE}px`
      button.style.height = `${PIN_SIZE}px`
      button.style.color = foreground
      button.style.setProperty('--pin-accent', accent)
      button.innerHTML = PIN_ART
      leaflet.DomEvent.disableClickPropagation(button)
      // Leaflet normally pans when its icon receives focus. Here the actual
      // focus target is the nested native button.
      button.addEventListener('focus', () => {
        const pin = pins.get(id)
        if (!pin) return
        map.panInside(pin.coordinates, {
          paddingTopLeft: PIN_ANCHOR,
          paddingBottomRight: [PIN_SIZE - PIN_ANCHOR[0], PIN_SIZE - PIN_ANCHOR[1]],
        })
      })
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        openRequest(id)
      })
      const marker = leaflet.marker([lat, lng], {
        keyboard: false,
        autoPanOnFocus: false,
        bubblingMouseEvents: false,
        zIndexOffset: 100,
        icon: leaflet.divIcon({
          className: 'metravel-place-request-pin',
          html: button,
          iconSize: [PIN_SIZE, PIN_SIZE],
          iconAnchor: PIN_ANCHOR,
        }),
      }).addTo(group)
      pins.set(id, { button, marker, coordinates: [lat, lng] })
    }
  }, [accent, foreground, leaflet, map, markers, openRequest, t])

  useEffect(() => {
    if (!selectedId) {
      focused.current = null
      return
    }
    if (!map || !ready || focusLat == null || focusLng == null) return
    const key = `${selectedId}:${focusLat}:${focusLng}`
    const previous = focused.current
    if (previous?.map === map && previous.key === key) return
    focused.current = { map, key }
    noteUserMapGesture(map)
    beginProgrammaticMapMove()
    map.setView([focusLat, focusLng], FOCUS_ZOOM, { animate: false })
  }, [focusLat, focusLng, map, ready, selectedId])
}
