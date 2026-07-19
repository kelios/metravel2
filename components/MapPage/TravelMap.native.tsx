import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { useThemedColors } from '@/hooks/useTheme'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { LAYOUT } from '@/constants/layout'
import { DESIGN_COLORS } from '@/constants/designSystem'
import { getSafeExternalUrl } from '@/utils/safeExternalUrl'
import { openExternalUrl } from '@/utils/externalLinks'
import { getSiteBaseUrl } from '@/utils/seo'
import { buildTravelMapNativeHtml } from './Map/travelMapNativeHtml'
import { normalizePoint } from '@/components/map-core/types'
import MapPlaceBottomCard from '@/components/MapPage/MapPlaceBottomCard'
import ToastHost from '@/components/ui/ToastHost'
import { buildBirdMarkerHtml } from './Map/mapMarkerStyles'
import {
  DEFAULT_CENTER,
  extractTravelPoints,
  filterValidLatLngs,
  isValidLatLng,
  parseCoordString,
} from './Map/travelMapGeometry'

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

// #843 — shared brand «bird» divIcon HTML (same source as web/native /map). Theme-
// independent brand hex, so it is a stable module constant (no WebView reload churn).
const BIRD_MARKER_HTML = buildBirdMarkerHtml()

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
  resizeTrigger,
}) => {
  const colors = useThemedColors()
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPoint, setSelectedPoint] = useState<NativePoint | null>(null)
  const webViewRef = useRef<WebView>(null)
  const mapReadyRef = useRef(false)

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
    if (!selectedPoint) return
    const stillExists = safeTravelData.some((point) => point.coord === selectedPoint.coord)
    if (!stillExists) setSelectedPoint(null)
  }, [safeTravelData, selectedPoint])

  useEffect(() => {
    const coord = String(highlightedPoint?.coord ?? '').trim()
    if (!coord) return
    const point = safeTravelData.find((item) => item.coord === coord)
    if (point) setSelectedPoint(point)
  }, [highlightedPoint?.coord, safeTravelData])

  const mapHeight = height || (compact ? 400 : 600)
  const mapBorderRadius = compact ? 12 : 16
  const loaderOverlay = useMemo(() => withAlpha(colors.surface, 0.8), [colors.surface])
  const routeColor = DESIGN_COLORS.routeLine

  const htmlContent = useMemo(
    () =>
      buildTravelMapNativeHtml({
        points: safeTravelData,
        routes: normalizedRouteLines,
        highlightCoord: highlightedPoint?.coord ?? null,
        center,
        initialZoom,
        surfaceColor: colors.surface,
        routeColor,
        birdMarkerHtml: BIRD_MARKER_HTML,
      }),
    [
      safeTravelData,
      normalizedRouteLines,
      highlightedPoint,
      center,
      initialZoom,
      colors,
      routeColor,
    ],
  )

  const containerStyle = useMemo(
    () => ({ height: mapHeight, borderRadius: mapBorderRadius }),
    [mapHeight, mapBorderRadius],
  )

  // При смене html (новые данные) WebView перезагружается — сбрасываем флаг готовности.
  useEffect(() => {
    mapReadyRef.current = false
  }, [htmlContent])

  // При изменении resizeTrigger (раскрытие ToggleableMap / resize) просим WebView
  // пересчитать размер карты и заново подогнать рамку под все точки.
  useEffect(() => {
    if (resizeTrigger === undefined) return
    if (!mapReadyRef.current) return
    webViewRef.current?.injectJavaScript(
      "(function(){try{window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'RESIZE'})}));}catch(e){}})();true;",
    )
  }, [resizeTrigger])

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
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadEnd={() => {
          mapReadyRef.current = true
          setIsLoading(false)
        }}
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
      />
      <Modal
        visible={Boolean(selectedPoint)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPoint(null)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <MapPlaceBottomCard
            point={selectedPoint as any}
            userLocation={null}
            onClose={() => setSelectedPoint(null)}
            topInset={(insets?.top ?? 0) + LAYOUT.headerHeight}
            bottomInset={LAYOUT.tabBarHeight}
          />
          {/* #844 — the app-root Toast is mounted BELOW this native Modal, so save
              feedback (auth prompt / «Сохранено» / error) from «Мои точки» rendered
              behind the modal and looked like a no-op. A nested Toast inside the
              Modal surfaces it above the sheet (react-native-toast-message picks the
              last-mounted <Toast/> ref, then falls back to root on unmount). */}
          <ToastHost />
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
  },
})

export default TravelMap
