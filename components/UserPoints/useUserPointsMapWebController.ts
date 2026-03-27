import React from 'react'

import { useMapInstance } from '@/components/MapPage/Map/useMapInstance'
import { useMapApi } from '@/components/MapPage/Map/useMapApi'
import { WEB_MAP_BASE_LAYERS } from '@/config/mapWebLayers'
import type { MapUiApi } from '@/types/mapUi'
import type { ImportedPoint } from '@/types/userPoints'
import { isWebAutomation } from '@/utils/isWebAutomation'
import { createLeafletLayer } from '@/utils/mapWebLayers'

import { buildUserPointsTravelData, getUserPointsCenter, normalizeUserPoints } from './userPointsMapData'

type UserPointsMapWebControllerArgs = {
  points: ImportedPoint[]
  centerOverride?: { lat: number; lng: number }
  activePointId?: number | null
  mods: any
  colors: { primary: string }
  onMapUiApiReady?: (api: MapUiApi | null) => void
}

export function useUserPointsMapWebController({
  points,
  centerOverride,
  activePointId,
  mods,
  colors,
  onMapUiApiReady,
}: UserPointsMapWebControllerArgs) {
  const [mapInstance, setMapInstance] = React.useState<any>(null)
  const mapRef = React.useRef<any>(null)
  const baseLayerFallbackIndexRef = React.useRef(0)
  const baseLayerFallbackSwitchingRef = React.useRef(false)
  const markerByIdRef = React.useRef<Map<number, any>>(new Map())
  const markerByCoordRef = React.useRef<Map<string, any>>(new Map())

  const safePoints = React.useMemo(() => normalizeUserPoints(points), [points])
  const travelData = React.useMemo(() => buildUserPointsTravelData(safePoints), [safePoints])
  const center = React.useMemo(() => getUserPointsCenter(centerOverride, safePoints), [centerOverride, safePoints])
  const polylinePathOptions = React.useMemo(() => {
    return { color: colors.primary, weight: 4, opacity: 0.85 } as any
  }, [colors.primary])

  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L: mods?.L,
  })

  React.useEffect(() => {
    try {
      ;(leafletControlRef as any).markerByCoord = markerByCoordRef.current
    } catch {
      // noop
    }
  }, [leafletControlRef])

  React.useEffect(() => {
    const map = mapInstance
    const L = mods?.L
    if (!map || !L) return

    const canInitializeNow = () => {
      try {
        const c = map.getCenter?.()
        if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false
        const zoom = map.getZoom?.()
        if (!Number.isFinite(zoom)) return false
        const size = map.getSize?.()
        const x = size?.x
        const y = size?.y
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false
        if (x <= 0 || y <= 0) return false
        return true
      } catch {
        return false
      }
    }

    const ensureBaseLayer = () => {
      try {
        if (!canInitializeNow()) return

        const current = leafletBaseLayerRef.current
        if (current && map.hasLayer?.(current)) return

        const baseDef = WEB_MAP_BASE_LAYERS.find((layer) => layer.defaultEnabled) || WEB_MAP_BASE_LAYERS[0]
        if (!baseDef) return

        const baseLayer = createLeafletLayer(L, baseDef)
        if (!baseLayer) return

        leafletBaseLayerRef.current = baseLayer
        baseLayer.addTo(map)
      } catch (error: any) {
        try {
          if (typeof error?.message === 'string' && error.message.includes('infinite number of tiles')) {
            const current = leafletBaseLayerRef.current
            if (current && map.hasLayer?.(current)) map.removeLayer(current)
            leafletBaseLayerRef.current = null
          }
        } catch {
          // noop
        }
      }
    }

    ensureBaseLayer()

    const onTry = () => ensureBaseLayer()
    try {
      map.on?.('load', onTry)
      map.on?.('resize', onTry)
      map.on?.('moveend', onTry)
      map.on?.('zoomend', onTry)
    } catch {
      // noop
    }

    return () => {
      try {
        map.off?.('load', onTry)
        map.off?.('resize', onTry)
        map.off?.('moveend', onTry)
        map.off?.('zoomend', onTry)
      } catch {
        // noop
      }
    }
  }, [leafletBaseLayerRef, mapInstance, mods?.L])

  React.useEffect(() => {
    const map = mapInstance
    const L = mods?.L
    if (!map || !L) return

    const fallbackUrls = [
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
    ]

    const attachedLayerRef = { current: null as any }

    const attach = (layer: any) => {
      if (!layer || typeof layer.on !== 'function') return () => {}

      const onTileError = () => {
        try {
          if (baseLayerFallbackSwitchingRef.current) return
          baseLayerFallbackSwitchingRef.current = true

          const idx = baseLayerFallbackIndexRef.current
          const nextUrl = fallbackUrls[idx]
          if (!nextUrl) {
            baseLayerFallbackSwitchingRef.current = false
            return
          }

          baseLayerFallbackIndexRef.current = idx + 1

          const nextDef = {
            id: `__fallback_osm_${idx}`,
            title: 'OpenStreetMap (fallback)',
            kind: 'tile',
            url: nextUrl,
            attribution: '&copy; OpenStreetMap contributors',
            defaultEnabled: true,
          } as any

          const nextLayer = createLeafletLayer(L, nextDef)
          if (!nextLayer) {
            baseLayerFallbackSwitchingRef.current = false
            return
          }

          const current = leafletBaseLayerRef.current as any
          if (current && map.hasLayer?.(current)) {
            map.removeLayer(current)
          }

          leafletBaseLayerRef.current = nextLayer
          nextLayer.addTo(map)

          try {
            layer.off?.('tileerror', onTileError)
          } catch {
            // noop
          }

          attach(nextLayer)
          baseLayerFallbackSwitchingRef.current = false
        } catch {
          baseLayerFallbackSwitchingRef.current = false
        }
      }

      layer.on('tileerror', onTileError)
      return () => {
        try {
          layer.off?.('tileerror', onTileError)
        } catch {
          // noop
        }
      }
    }

    let detach: (() => void) | null = null

    const ensureAttached = () => {
      const nextLayer = leafletBaseLayerRef.current as any
      if (!nextLayer || nextLayer === attachedLayerRef.current) return

      try {
        detach?.()
      } catch {
        // noop
      }

      attachedLayerRef.current = nextLayer
      detach = attach(nextLayer)
    }

    ensureAttached()

    const onTry = () => ensureAttached()
    try {
      map.on?.('layeradd', onTry)
      map.on?.('load', onTry)
      map.on?.('resize', onTry)
    } catch {
      // noop
    }

    return () => {
      try {
        map.off?.('layeradd', onTry)
        map.off?.('load', onTry)
        map.off?.('resize', onTry)
      } catch {
        // noop
      }

      try {
        detach?.()
      } catch {
        // noop
      }
    }
  }, [leafletBaseLayerRef, mapInstance, mods?.L])

  useMapApi({
    map: mapInstance,
    L: mods?.L,
    onMapUiApiReady,
    travelData,
    userLocation: centerOverride ? { lat: centerOverride.lat, lng: centerOverride.lng } : null,
    routePoints: [],
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  })

  React.useEffect(() => {
    if (!mapInstance) return
    if (!centerOverride) return
    if (Number.isFinite(Number(activePointId))) return
    if (safePoints.length > 0) return
    const lat = centerOverride.lat
    const lng = centerOverride.lng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    try {
      const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 10
      const targetZoom = Math.max(12, Number.isFinite(currentZoom) ? currentZoom : 12)
      mapInstance.setView([lat, lng], targetZoom, { animate: true } as any)
    } catch {
      // noop
    }
  }, [activePointId, centerOverride, mapInstance, safePoints.length])

  React.useEffect(() => {
    if (!mapInstance) return
    const id = Number(activePointId)
    if (!Number.isFinite(id)) return
    const target = safePoints.find((point) => Number((point as any)?.id) === id)
    if (!target) return

    try {
      const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 12
      const nextZoom = Math.max(14, Number.isFinite(currentZoom) ? currentZoom : 14)
      mapInstance.setView([target.latitude, target.longitude], nextZoom, { animate: !isWebAutomation } as any)
    } catch {
      // noop
    }
  }, [activePointId, mapInstance, safePoints])

  React.useEffect(() => {
    if (!mapInstance) return
    const L = mods?.L
    if (!L) return
    if (Number.isFinite(Number(activePointId))) return
    if (!safePoints.length) return

    try {
      if (safePoints.length === 1) {
        const point = safePoints[0]
        mapInstance.setView([point.latitude, point.longitude], 14, { animate: !isWebAutomation } as any)
      } else {
        const bounds = L.latLngBounds(safePoints.map((point: any) => [point.latitude, point.longitude]))
        mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: !isWebAutomation } as any)
      }
    } catch {
      // noop
    }
  }, [activePointId, mapInstance, mods?.L, safePoints])

  const handleMapReady = React.useCallback((map: any) => {
    setMapInstance((prev: any) => (prev === map ? prev : map))

    if (isWebAutomation && typeof window !== 'undefined') {
      try {
        ;(window as any).__metravelUserPointsMap = map
      } catch {
        // noop
      }
    }
  }, [])

  const handleWhenReady = React.useCallback(() => {
    try {
      const map = mapRef.current
      if (!map) return
      handleMapReady(map)
    } catch {
      // noop
    }
  }, [handleMapReady])

  const registerPointMarker = React.useCallback(
    ({
      pointId,
      marker,
      coordKey,
      coordKeyFixed,
    }: {
      pointId: number
      marker: any | null
      coordKey?: string
      coordKeyFixed?: string
    }) => {
      try {
        if (!Number.isFinite(pointId)) return

        if (marker) {
          markerByIdRef.current.set(pointId, marker)
        } else {
          markerByIdRef.current.delete(pointId)
        }

        if (!marker) {
          if (coordKey) markerByCoordRef.current.delete(coordKey)
          if (coordKeyFixed) markerByCoordRef.current.delete(coordKeyFixed)
          return
        }

        if (coordKey) markerByCoordRef.current.set(coordKey, marker)
        if (coordKeyFixed) markerByCoordRef.current.set(coordKeyFixed, marker)
      } catch {
        // noop
      }
    },
    []
  )

  return {
    center,
    mapInstance,
    mapRef,
    polylinePathOptions,
    registerPointMarker,
    safePoints,
    handleMapReady,
    handleWhenReady,
  }
}
