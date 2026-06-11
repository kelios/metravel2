import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Platform, View, useWindowDimensions } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { useLeafletLoader } from '@/hooks/useLeafletLoader'
import { useMapMarkers } from '@/hooks/useMapMarkers'
import { attachOsmPoiOverlay } from '@/utils/mapWebOverlays/osmPoiOverlay'
import { attachOsmCampingOverlay } from '@/utils/mapWebOverlays/osmCampingOverlay'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import MapMarkers from './Map/MapMarkers'
import ClusterLayer from './Map/ClusterLayer'
import RouteLineLayer from './Map/RouteLineLayer'
import { createMapPopupComponent } from './Map/createMapPopupComponent'
import { useLeafletIcons } from './Map/useLeafletIcons'
import {
  DEFAULT_CENTER,
  calculatePopupPan,
  extractTravelPoints,
  filterValidLatLngs,
  getPopupSize,
  ignoreTravelMapRuntimeError,
  isValidLatLng,
  parseCoordString,
} from './Map/travelMapGeometry'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { normalizePoint } from '@/components/map-core/types'
import { queryKeys } from '@/api/queryKeys'

const IS_WEB = Platform.OS === 'web'

const NOOP = () => {}

interface TravelMapProps {
  travelData: any[]
  highlightedPoint?: { coord: string; key: string }
  compact?: boolean
  initialZoom?: number
  height?: number
  enableClustering?: boolean
  resizeTrigger?: number
  enableOverlays?: boolean
  showRouteLine?: boolean
  routeLineCoords?: [number, number][]
  routeLines?: Array<{ coords: [number, number][]; color?: string }>
}

export const TravelMap: React.FC<TravelMapProps> = ({
  travelData = [],
  highlightedPoint,
  compact = false,
  initialZoom = 11,
  height,
  enableClustering = false,
  resizeTrigger,
  enableOverlays = false,
  showRouteLine = false,
  routeLineCoords: routeLineCoordsProp,
  routeLines: routeLinesProp,
}) => {
  const queryClient = useQueryClient()
  const colors = useThemedColors()
  const themeContextValue = useTheme()
  const { width: viewportWidth } = useWindowDimensions()

  const safeTravelData = useMemo<any[]>(
    () => (Array.isArray(travelData) ? travelData.map((item, i) => normalizePoint(item, i)) : []),
    [travelData],
  )

  const mapRef = useRef<any>(null)
  const containerRef = useRef<any>(null)
  const markerByCoordRef = useRef<Map<string, any>>(new Map())
  const mountedRef = useRef(true)
  const [mapReady, setMapReady] = useState(false)
  const overlayControllersRef = useRef<Map<string, any>>(new Map())
  const popupCleanupsRef = useRef<Set<() => void>>(new Set())

  // Сбрасываем кэш маркеров при смене данных ДО перерегистрации детьми через ref-колбэк,
  // иначе highlight-эффект достанет устаревший маркер и вызовет openPopup на снятом слое.
  const lastTravelDataRef = useRef(safeTravelData)
  if (lastTravelDataRef.current !== safeTravelData) {
    lastTravelDataRef.current = safeTravelData
    markerByCoordRef.current.clear()
  }

  useEffect(() => {
    mountedRef.current = true
    // Контейнеры стабильны на всё время жизни компонента — захватываем ссылки для cleanup.
    const popupCleanups = popupCleanupsRef.current
    const markerByCoord = markerByCoordRef.current
    const overlayControllers = overlayControllersRef.current
    return () => {
      mountedRef.current = false
      // Снимаем observer'ы/listener'ы открытых попапов до обнуления mapRef.
      popupCleanups.forEach((fn) => {
        try {
          fn()
        } catch {
          ignoreTravelMapRuntimeError()
        }
      })
      popupCleanups.clear()
      mapRef.current = null
      // Освобождаем ссылки на снятые Leaflet-слои/оверлеи, чтобы не держать их после unmount.
      markerByCoord.clear()
      overlayControllers.clear()
    }
  }, [])

  const { L, RL: rl, loading: leafletLoading, ready: leafletReady } = useLeafletLoader({
    enabled: IS_WEB,
    useIdleCallback: true,
  })

  const customIcons = useLeafletIcons(L)

  const center = useMemo<[number, number]>(() => {
    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      const first = routeLinesProp[0]?.coords?.[0]
      if (Array.isArray(first) && isValidLatLng(first[0], first[1])) {
        return [first[0], first[1]]
      }
    }
    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length > 0) {
      const [lat, lng] = routeLineCoordsProp[0]
      if (isValidLatLng(lat, lng)) return [lat, lng]
    }
    if (safeTravelData.length === 0) return DEFAULT_CENTER
    return parseCoordString(safeTravelData[0]?.coord) ?? DEFAULT_CENTER
  }, [safeTravelData, routeLineCoordsProp, routeLinesProp])

  const hintCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center])

  const { shouldRenderClusters, clusters, markers, markerOpacity } = useMapMarkers({
    travelData: safeTravelData,
    mapZoom: initialZoom,
    expandedClusterKey: null,
    mode: 'radius',
    hintCenter,
  })

  const PopupComponent = useMemo(() => {
    if (!rl) return null
    return createMapPopupComponent({
      colors,
      themeContextValue,
      userLocation: null,
      compactLayout: compact,
      fullscreenOnMobile: true,
      invalidateUserPoints: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
      },
    })
  }, [colors, compact, queryClient, rl, themeContextValue])

  const handlePopupOpen = useCallback((e: any) => {
    const popupEl: HTMLElement | null = e?.popup?.getElement?.()
    const map = mapRef.current
    const mapEl: HTMLElement | null = map?.getContainer?.()
    if (!popupEl || !mapEl || typeof window === 'undefined') return

    const run = () => {
      try {
        const { dx, dy } = calculatePopupPan(popupEl, mapEl)
        if (!dx && !dy) return
        map?.panBy?.([dx, dy], { animate: true, duration: 0.35 } as any)
      } catch {
        ignoreTravelMapRuntimeError()
      }
    }

    let rafId = 0
    const scheduleRun = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(run)
      })
    }
    scheduleRun()

    let resizeObserver: ResizeObserver | null = null
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null
    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      if (cleanupTimer) {
        clearTimeout(cleanupTimer)
        cleanupTimer = null
      }
      map?.off?.('popupclose', cleanup)
      // Снимаем себя из набора активных cleanup'ов — чтобы unmount не дёргал повторно.
      popupCleanupsRef.current.delete(cleanup)
    }
    // Регистрируем cleanup, чтобы гарантированно снять observer/listener при unmount карты,
    // если попап не успел закрыться (popupclose) до размонтирования.
    popupCleanupsRef.current.add(cleanup)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleRun())
      resizeObserver.observe(popupEl)
      const popupContentEl = popupEl.querySelector('.leaflet-popup-content')
      if (popupContentEl instanceof HTMLElement) resizeObserver.observe(popupContentEl)
    }

    map?.on?.('popupclose', cleanup)
    cleanupTimer = setTimeout(cleanup, 1000)
  }, [])

  const popupProps = useMemo(() => {
    const { maxWidth, minWidth, autoPanPaddingTopLeft, autoPanPaddingBottomRight } = getPopupSize(
      viewportWidth,
      compact,
    )
    return {
      autoPan: true,
      closeOnClick: false,
      keepInView: true,
      className: 'metravel-place-popup',
      maxWidth,
      minWidth,
      autoPanPaddingTopLeft,
      autoPanPaddingBottomRight,
      eventHandlers: { popupopen: handlePopupOpen },
    }
  }, [compact, handlePopupOpen, viewportWidth])

  const routeLineCoords = useMemo<[number, number][]>(() => {
    if (!showRouteLine) return []
    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length >= 2) {
      return filterValidLatLngs(routeLineCoordsProp)
    }
    if (safeTravelData.length < 2) return []
    return extractTravelPoints(safeTravelData)
  }, [showRouteLine, routeLineCoordsProp, safeTravelData])

  const normalizedRouteLines = useMemo(() => {
    if (!showRouteLine) return [] as Array<{ coords: [number, number][]; color?: string }>
    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      return routeLinesProp
        .map((line) => ({
          color: line?.color,
          coords: Array.isArray(line?.coords) ? filterValidLatLngs(line.coords) : [],
        }))
        .filter((line) => line.coords.length >= 2)
    }
    if (routeLineCoords.length >= 2) return [{ coords: routeLineCoords }]
    return []
  }, [showRouteLine, routeLineCoords, routeLinesProp])

  const hasRenderableMapData = safeTravelData.length > 0 || normalizedRouteLines.length > 0

  useEffect(() => {
    if (!highlightedPoint || !mapRef.current) return
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const marker = markerByCoordRef.current.get(highlightedPoint.coord)
      if (marker && typeof marker.openPopup === 'function') {
        const map = mapRef.current
        if (typeof map.setView === 'function') {
          map.setView(marker.getLatLng(), 14, { animate: true })
        }
        timer = setTimeout(() => {
          // Точка могла смениться/компонент размонтироваться за время задержки —
          // не открываем попап на устаревшем/снятом маркере.
          if (!mountedRef.current || !mapRef.current) return
          try {
            marker.openPopup()
          } catch {
            ignoreTravelMapRuntimeError()
          }
        }, 300)
      }
    } catch (err) {
      console.warn('[TravelMap] Failed to highlight point:', err)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [highlightedPoint])

  useEffect(() => {
    if (!IS_WEB || !mapRef.current || resizeTrigger === undefined) return
    const map = mapRef.current
    const invalidate = () => {
      try {
        map?.invalidateSize?.({ animate: true, pan: false })
      } catch {
        ignoreTravelMapRuntimeError()
      }
    }
    const rafId =
      typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(invalidate) : undefined
    const timer = setTimeout(invalidate, 300)
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      clearTimeout(timer)
    }
  }, [resizeTrigger])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const invalidate = () => {
      try {
        map?.invalidateSize?.({ animate: false, pan: false })
      } catch {
        ignoreTravelMapRuntimeError()
      }
    }
    invalidate()
    const timer = setTimeout(invalidate, 200)
    return () => clearTimeout(timer)
  }, [mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !L) return
    const map = mapRef.current

    const points: [number, number][] = []
    if (Array.isArray(routeLinesProp) && routeLinesProp.length > 0) {
      for (const line of routeLinesProp) {
        if (Array.isArray(line?.coords)) {
          points.push(...filterValidLatLngs(line.coords))
        }
      }
    }
    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length > 0) {
      points.push(...filterValidLatLngs(routeLineCoordsProp))
    }
    points.push(...extractTravelPoints(safeTravelData))
    if (points.length === 0) return

    const timer = setTimeout(() => {
      try {
        if (typeof map.fitBounds !== 'function') return
        const leafletPoints = points.map(([lat, lng]) => L.latLng(lat, lng))
        const bounds = L.latLngBounds(leafletPoints)
        map.fitBounds(bounds.pad(0.15), { animate: false, maxZoom: 15 })
      } catch {
        ignoreTravelMapRuntimeError()
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [mapReady, L, safeTravelData, routeLineCoordsProp, routeLinesProp])

  useEffect(() => {
    if (!IS_WEB || !mapReady || !mapRef.current || !L) return
    if (!enableOverlays || compact) return

    const map = mapRef.current
    const controllers = overlayControllersRef.current

    const removeAll = () => {
      controllers.forEach((controller) => {
        try {
          controller.stop?.()
          if (controller.layer && map) map.removeLayer(controller.layer)
        } catch {
          ignoreTravelMapRuntimeError()
        }
      })
      controllers.clear()
    }
    removeAll()

    try {
      const poi = attachOsmPoiOverlay(L, map, {
        maxAreaKm2: 2500,
        debounceMs: 700,
        categories: ['Достопримечательности', 'Видовые места', 'Культура'],
      })
      if (poi?.layer) {
        poi.layer.addTo(map)
        controllers.set('osm-poi', poi)
        poi.start()
      }
    } catch {
      ignoreTravelMapRuntimeError()
    }

    try {
      const camping = attachOsmCampingOverlay(L, map, { maxAreaKm2: 2500, debounceMs: 700 })
      if (camping?.layer) {
        camping.layer.addTo(map)
        controllers.set('osm-camping', camping)
        camping.start()
      }
    } catch {
      ignoreTravelMapRuntimeError()
    }

    return removeAll
  }, [mapReady, L, enableOverlays, compact])

  const mapHeight = height || (compact ? 400 : 600)
  const mapBorderRadius = compact ? 12 : 16
  const mapContainerStyle = useMemo(
    () => ({ height: mapHeight, borderRadius: mapBorderRadius }),
    [mapBorderRadius, mapHeight],
  )

  const handleMarkerInstance = useCallback((coord: any, marker: any) => {
    try {
      const key = String(coord ?? '').trim()
      if (key) markerByCoordRef.current.set(key, marker)
    } catch {
      ignoreTravelMapRuntimeError()
    }
  }, [])

  if (!leafletReady || leafletLoading) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!hasRenderableMapData) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.emptyContainer]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    )
  }

  if (!L || !rl) return null

  const { MapContainer, TileLayer } = rl
  if (!MapContainer || !TileLayer) return null

  const shouldCluster = enableClustering && shouldRenderClusters

  return (
    <View
      ref={containerRef}
      style={[styles.mapContainer, mapContainerStyle]}
      testID="travel-map"
      {...(IS_WEB ? { 'data-testid': 'travel-map' } : {})}
    >
      <MapContainer
        center={center}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%', minHeight: mapHeight }}
        zoomControl
        scrollWheelZoom
        dragging
        ref={(map: any) => {
          if (!mountedRef.current) return
          if (map && !mapRef.current) mapRef.current = map
        }}
        whenReady={() => {
          if (!mountedRef.current) return
          // ref-колбэк react-leaflet обычно вызывается до whenReady, но подстрахуемся:
          // если mapRef ещё не установлен, откладываем флаг на кадр, иначе эффекты по
          // mapReady тихо выйдут на `!mapRef.current` и не перезапустятся (карта без fitBounds).
          if (mapRef.current) {
            setMapReady(true)
          } else if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
              if (mountedRef.current && mapRef.current) setMapReady(true)
            })
          } else {
            setMapReady(true)
          }
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          crossOrigin="anonymous"
        />

        {showRouteLine &&
          rl.useMap &&
          normalizedRouteLines.map((routeLine, index) => (
            <RouteLineLayer
              key={`route-line-${index}-${routeLine.coords.length}`}
              routeLineCoords={routeLine.coords}
              routeColor={routeLine.color}
              colors={colors}
              useMap={rl.useMap}
              L={L}
            />
          ))}

        {customIcons?.meTravel && markers.length > 0 && !shouldCluster && PopupComponent && (
          <MapMarkers
            points={markers}
            icon={customIcons.meTravel}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            onMarkerClick={NOOP}
            hintCenter={hintCenter}
            useMap={rl.useMap}
            onMarkerInstance={handleMarkerInstance}
          />
        )}

        {customIcons?.meTravel && markers.length > 0 && shouldCluster && PopupComponent && (
          <ClusterLayer
            L={L}
            clusters={clusters as any}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            markerIcon={customIcons.meTravel}
            markerOpacity={markerOpacity}
            expandedClusterKey={null}
            expandedClusterItems={null as any}
            hintCenter={hintCenter}
            onClusterZoom={NOOP}
            onMarkerClick={NOOP}
            useMap={rl.useMap}
            onMarkerInstance={handleMarkerInstance}
          />
        )}
      </MapContainer>
    </View>
  )
}

const styles: any = {
  mapContainer: {
    width: '100%',
    overflow: IS_WEB ? 'visible' : 'hidden',
    position: 'relative',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center' },
}
