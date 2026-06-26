import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import { getSafeExternalUrl } from '@/utils/safeExternalUrl'
import { openExternalUrl } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'
import { normalizePoint } from '@/components/map-core/types'
import MapPlaceBottomCard from '@/components/MapPage/MapPlaceBottomCard'
import {
  DEFAULT_CENTER,
  extractTravelPoints,
  filterValidLatLngs,
  isValidLatLng,
  parseCoordString,
} from './Map/travelMapGeometry'
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers'

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
  showPointPageAction?: boolean
}

type NativePoint = {
  coord: string
  address: string
  travelImageThumbUrl?: string
  categoryName?: string
  articleUrl?: string
  urlTravel?: string
}

const withAlpha = (color: string, alpha: number) => {
  if (!color || color.startsWith('rgba') || color.startsWith('rgb')) return color
  if (color.startsWith('#')) {
    const raw = color.replace('#', '')
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0')
    return `#${hex}${alphaHex}`
  }
  return color
}

export const TravelMap: React.FC<TravelMapProps> = ({
  travelData = [],
  highlightedPoint,
  compact = false,
  initialZoom = 11,
  height,
  showPointPageAction = false,
  showRouteLine = false,
  routeLineCoords: routeLineCoordsProp,
  routeLines: routeLinesProp,
}) => {
  const colors = useThemedColors()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPoint, setSelectedPoint] = useState<NativePoint | null>(null)

  const safeTravelData = useMemo<NativePoint[]>(() => {
    if (!Array.isArray(travelData)) return []
    return travelData
      .map((item, i) => normalizePoint(item, i))
      .filter((p) => parseCoordString(p.coord) !== null)
      .map((p) => ({
        coord: p.coord,
        address: p.address || '',
        travelImageThumbUrl: p.travelImageThumbUrl,
        categoryName: typeof p.categoryName === 'string' ? p.categoryName : undefined,
        articleUrl: showPointPageAction ? p.articleUrl : undefined,
        urlTravel: showPointPageAction ? p.urlTravel : undefined,
      }))
  }, [showPointPageAction, travelData])

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
    if (Array.isArray(routeLineCoordsProp) && routeLineCoordsProp.length >= 2) {
      return [{ coords: filterValidLatLngs(routeLineCoordsProp) }]
    }
    if (safeTravelData.length >= 2) {
      return [{ coords: extractTravelPoints(safeTravelData) }]
    }
    return []
  }, [showRouteLine, routeLinesProp, routeLineCoordsProp, safeTravelData])

  const center = useMemo<[number, number]>(() => {
    if (normalizedRouteLines.length > 0) {
      const first = normalizedRouteLines[0]?.coords?.[0]
      if (Array.isArray(first) && isValidLatLng(first[0], first[1])) return [first[0], first[1]]
    }
    if (highlightedPoint?.coord) {
      const parsed = parseCoordString(highlightedPoint.coord)
      if (parsed) return parsed
    }
    if (safeTravelData.length === 0) return DEFAULT_CENTER
    return parseCoordString(safeTravelData[0]?.coord) ?? DEFAULT_CENTER
  }, [normalizedRouteLines, highlightedPoint, safeTravelData])

  const hasRenderableMapData = safeTravelData.length > 0 || normalizedRouteLines.length > 0

  useEffect(() => {
    if (!highlightedPoint?.coord) return
    const match = safeTravelData.find((point) => point.coord === highlightedPoint.coord)
    if (match) setSelectedPoint(match)
  }, [highlightedPoint?.coord, highlightedPoint?.key, safeTravelData])

  useEffect(() => {
    if (!selectedPoint) return
    const stillExists = safeTravelData.some((point) => point.coord === selectedPoint.coord)
    if (!stillExists) setSelectedPoint(null)
  }, [safeTravelData, selectedPoint])

  const mapHeight = height || (compact ? 400 : 600)
  const mapBorderRadius = compact ? 12 : 16
  const loaderOverlay = useMemo(() => withAlpha(colors.surface, 0.8), [colors.surface])
  const routeColor = DESIGN_COLORS.routeLine
  const markerColor = DESIGN_COLORS.mapPin

  const markerSvg = `
    <svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <circle cx="16" cy="15.5" r="12.5" fill="${markerColor}"/>
        <path d="M22 28.5C19.2 34.8 16 41.8 16 41.8C16 41.8 12.8 34.8 10 28.5H22Z" fill="${markerColor}"/>
        <circle cx="16" cy="15.5" r="5.2" fill="${colors.textOnDark}" />
        <circle cx="16" cy="15.5" r="3.2" fill="${markerColor}" />
      </g>
    </svg>
  `
  const markerSvgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(markerSvg)}`

  const htmlContent = useMemo(() => {
    const points = JSON.stringify(safeTravelData)
    const routes = JSON.stringify(normalizedRouteLines)
    const highlightCoord = highlightedPoint?.coord ? JSON.stringify(highlightedPoint.coord) : 'null'

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .leaflet-popup-content-wrapper { background-color: ${colors.surface}; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: true }).setView([${center[0]}, ${center[1]}], ${initialZoom});
        L.tileLayer('${getOsmNativeTileUrl()}', {
          attribution: '© OpenStreetMap',
          maxZoom: ${OSM_PROXY_MAX_ZOOM}
        }).addTo(map);

        const points = ${points};
        const routes = ${routes};
        const highlightCoord = ${highlightCoord};
        const bounds = L.latLngBounds();

        function sendOpenUrl(rawUrl) {
          try {
            if (!rawUrl) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: rawUrl }));
            }
          } catch {}
        }
        function sendPointSelect(coord) {
          try {
            if (!coord) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POINT_SELECT', coord: coord }));
            }
          } catch {}
        }
        function sendClearSelectedPoint() {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLEAR_SELECTED_POINT' }));
            }
          } catch {}
        }

        map.on('click', function() {
          sendClearSelectedPoint();
        });

        routes.forEach(function(route) {
          if (!route || !Array.isArray(route.coords) || route.coords.length < 2) return;
          const latlngs = route.coords.map(function(c) { return [c[0], c[1]]; });
          L.polyline(latlngs, { color: route.color || '${routeColor}', weight: 4, opacity: 0.85 }).addTo(map);
          latlngs.forEach(function(ll) { bounds.extend(ll); });
        });

        const markerIcon = L.icon({
          iconUrl: '${markerSvgUrl}',
          iconSize: [32, 48],
          iconAnchor: [16, 48],
          popupAnchor: [0, -48]
        });

        let highlightedMarker = null;

        points.forEach(function(point) {
          if (!point.coord) return;
          const parts = point.coord.split(',').map(function(s) { return Number(String(s).trim()); });
          const lat = parts[0];
          const lng = parts[1];
          if (!isFinite(lat) || !isFinite(lng)) return;

          const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
          marker.on('click', function(e) {
            try {
              if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
              map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
              sendPointSelect(point.coord);
            } catch {}
          });

          if (highlightCoord && point.coord === highlightCoord) highlightedMarker = marker;
          bounds.extend([lat, lng]);
        });

        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.15), { padding: [40, 40], maxZoom: 15 });
        }

        if (highlightedMarker) {
          setTimeout(function() {
            try {
              map.setView(highlightedMarker.getLatLng(), 14, { animate: true });
            } catch {}
          }, 300);
        }
      </script>
    </body>
    </html>
    `
  }, [
    safeTravelData,
    normalizedRouteLines,
    highlightedPoint,
    center,
    initialZoom,
    colors,
    markerSvgUrl,
    routeColor,
  ])

  const containerStyle = useMemo(
    () => ({ height: mapHeight, borderRadius: mapBorderRadius }),
    [mapHeight, mapBorderRadius],
  )

  if (!hasRenderableMapData) {
    return (
      <View style={[styles.container, containerStyle, styles.centered, { backgroundColor: colors.backgroundSecondary }]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    )
  }

  return (
    <View style={[styles.container, containerStyle, { backgroundColor: colors.surface }]}>
      {isLoading && (
        <View style={[styles.loader, { backgroundColor: loaderOverlay }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadEnd={() => setIsLoading(false)}
        onMessage={async (event) => {
          const raw = String(event?.nativeEvent?.data ?? '')
          if (!raw) return
          try {
            const parsed = JSON.parse(raw)
            if (parsed?.type === 'POINT_SELECT') {
              const coord = String(parsed?.coord ?? '').trim()
              const point = safeTravelData.find((item) => item.coord === coord)
              if (point) setSelectedPoint(point)
              return
            }
            if (parsed?.type === 'CLEAR_SELECTED_POINT') {
              setSelectedPoint(null)
              return
            }
            if (parsed?.type === 'OPEN_URL') {
              const baseUrl = getSiteBaseUrl()
              const safeUrl = getSafeExternalUrl(parsed?.url, { allowRelative: true, baseUrl })
              if (!safeUrl) return
              await openExternalUrl(safeUrl, { allowRelative: true, baseUrl })
            }
          } catch {
            // noop
          }
        }}
        scrollEnabled
        pinchZoomEnabled
      />
      <Modal
        visible={Boolean(selectedPoint)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPoint(null)}
      >
        <View style={styles.modalRoot}>
          <MapPlaceBottomCard
            point={selectedPoint as any}
            userLocation={null}
            onClose={() => setSelectedPoint(null)}
          />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  centered: { alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1, width: '100%' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
})

export default TravelMap
