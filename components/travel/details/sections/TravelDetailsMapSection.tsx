import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'
import { useMapLazyLoad } from '@/hooks/useMapLazyLoad'

import { MapSkeleton, PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/types/types'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'
import { isWebAutomation } from '@/utils/isWebAutomation'
import type { ParsedRoutePreview, TravelRouteFile } from '@/types/travelRoutes'
import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'
import {
  buildTravelRouteDownloadPath,
  downloadTravelRouteFileBlob,
  listTravelRouteFiles,
} from '@/api/travelRoutes'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { parseRouteFilePreviews } from '@/utils/routeFileParser'

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const
const EXCURSION_CONTAINER_STYLE = { marginTop: 12 } as const
const WEATHER_PLACEHOLDER_STYLE = { minHeight: 120 } as const
const SUPPORTED_ROUTE_EXTENSIONS = new Set(['gpx', 'kml'])

type RoutePreviewItem = {
  file: TravelRouteFile
  preview: ParsedRoutePreview
  color: string
  label: string
}

const PointList = withLazy(() => import('@/components/travel/PointList'))
const ToggleableMap = withLazy(() => import('@/components/travel/ToggleableMapSection'))
const TravelMap = withLazy(() =>
  import('@/components/MapPage/TravelMap').then((m) => ({ default: m.TravelMap }))
)

const WeatherWidget = withLazy(() => import('@/components/home/WeatherWidget'))

const BelkrajWidgetComponent =
  Platform.OS === 'web'
    ? withLazy(() => import('@/components/belkraj/BelkrajWidget'))
    : (() => null) as React.ComponentType<any>

const Fallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" />
    </View>
  )
}

const MapFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <MapSkeleton />
    </View>
  )
}

const PointListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <PointListSkeleton />
    </View>
  )
}

const ExcursionsLazySection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisible(true)
      return
    }

    if (visible) return
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setVisible(true)
      return
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const rawNode = containerRef.current as any
    const targetNode = rawNode?._nativeNode || rawNode?._domNode || rawNode || null
    if (!targetNode) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: '200px 0px 0px 0px',
        threshold: 0.1,
      }
    )

    observer.observe(targetNode as Element)

    // Safety-net: if IO never triggers (e.g., element clipped inside ScrollView),
    // force visibility after timeout to prevent content deadlock.
    const fallback = setTimeout(() => {
      setVisible(true)
      observer.disconnect()
    }, 4000)

    return () => {
      clearTimeout(fallback)
      observer.disconnect()
    }
  }, [visible])

  if (Platform.OS !== 'web') {
    return <>{children}</>
  }

  return (
    <View ref={containerRef} collapsable={false}>
      {visible ? children : null}
    </View>
  )
}

export const TravelDetailsMapSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
  scrollToMapSection: () => void
}> = ({ travel, anchors, canRenderHeavy, scrollToMapSection }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()
  const [routePreviewItems, setRoutePreviewItems] = useState<RoutePreviewItem[]>([])
  const primaryRoutePreview = routePreviewItems[0]?.preview ?? null
  const hasMapData =
    (travel.coordsMeTravel?.length ?? 0) > 0 ||
    routePreviewItems.some((item) => (item.preview?.linePoints.length ?? 0) > 0)

  // Simplified lazy loading (replaces 30+ lines with 5 lines!)
  const { shouldRender, elementRef, isLoading } = useMapLazyLoad({
    enabled: true,
    hasData: hasMapData,
    canRenderHeavy,
    rootMargin: isWebAutomation ? '800px 0px 800px 0px' : '400px 0px 400px 0px',
    threshold: isWebAutomation ? 0 : 0.1,
  })

  const colors = useThemedColors()
  const routeColorPalette = useMemo(
    () => [
      colors.primary,
      colors.info,
      colors.success,
      colors.warning,
      colors.accent,
      colors.primaryDark,
      colors.infoDark,
      colors.successDark,
      colors.warningDark,
      colors.accentDark,
    ],
    [
      colors.accent,
      colors.accentDark,
      colors.info,
      colors.infoDark,
      colors.primary,
      colors.primaryDark,
      colors.success,
      colors.successDark,
      colors.warning,
      colors.warningDark,
    ],
  )
  const [highlightedPoint, setHighlightedPoint] = useState<{ coord: string; key: string } | null>(null)
  const [mapOpenTrigger, setMapOpenTrigger] = useState(0)
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(false)
  const [downloadingRouteId, setDownloadingRouteId] = useState<number | null>(null)
  const [keyPointLabels, setKeyPointLabels] = useState<{
    startName?: string | null
    peakName?: string | null
    finishName?: string | null
  }>({})

  useEffect(() => {
    let active = true

    const loadRouteFiles = async () => {
      if (!travel?.id) {
        if (active) {
          setRoutePreviewItems([])
        }
        return
      }
      try {
        const files = await listTravelRouteFiles(travel.id)
        if (!active) return

        const supportedFiles = files.filter((file) => {
          const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
            .toLowerCase()
            .replace(/^\./, '')
          return SUPPORTED_ROUTE_EXTENSIONS.has(ext)
        })

        if (supportedFiles.length === 0) {
          setRoutePreviewItems([])
          return
        }

        const parsedResults = await Promise.allSettled(
          supportedFiles.map(async (file, index) => {
            const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
              .toLowerCase()
              .replace(/^\./, '')
            const downloaded = await downloadTravelRouteFileBlob(travel.id, file.id)
            const previews = parseRouteFilePreviews(downloaded.text, ext)
            const validPreviews = previews.filter((preview) => (preview?.linePoints?.length ?? 0) >= 2)
            if (validPreviews.length === 0) return [] as RoutePreviewItem[]

            return validPreviews.map((preview, previewIndex) => ({
              file,
              preview,
              color: routeColorPalette[(index + previewIndex) % routeColorPalette.length],
              label:
                validPreviews.length > 1
                  ? `${file.original_name || 'Маршрут'} • трек ${previewIndex + 1}`
                  : file.original_name || 'Маршрут',
            }))
          }),
        )

        if (!active) return

        const readyItems = parsedResults
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((item): item is RoutePreviewItem => Boolean(item))

        setRoutePreviewItems(readyItems)
      } catch {
        if (active) {
          setRoutePreviewItems([])
        }
      }
    }

    void loadRouteFiles()
    return () => {
      active = false
    }
  }, [routeColorPalette, travel?.id])

  const notifyDownloadUnavailable = useCallback(() => {
    if (Platform.OS === 'web') {
      try {
        window.alert?.('Файл маршрута недоступен для скачивания')
      } catch {
        // noop
      }
      return
    }
    Alert.alert?.('Недоступно', 'Файл маршрута недоступен для скачивания')
  }, [])

  const handleDownloadRoute = useCallback(async (file: TravelRouteFile) => {
    if (downloadingRouteId === file.id) return
    if (!travel?.id) {
      notifyDownloadUnavailable()
      return
    }
    setDownloadingRouteId(file.id)
    try {
      const rawUrl =
        String(file.download_url ?? '').trim() ||
        buildTravelRouteDownloadPath(travel.id, file.id)
      await openExternalUrlInNewTab(rawUrl, {
        allowRelative: true,
        baseUrl:
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.EXPO_PUBLIC_API_URL as string) || undefined,
      })
    } catch {
      notifyDownloadUnavailable()
    } finally {
      setDownloadingRouteId(null)
    }
  }, [downloadingRouteId, notifyDownloadUnavailable, travel?.id])

  const handlePointCardPress = useCallback((point: any) => {
    const coord = String(point?.coord ?? '').trim()
    if (!coord) return
    setHighlightedPoint({ coord, key: `${coord}-${Date.now()}` })
    setMapOpenTrigger((prev) => prev + 1)
    scrollToMapSection()
  }, [scrollToMapSection])


  const isMobileWeb = Platform.OS === 'web' && width <= METRICS.breakpoints.tablet

  const placeHints = useMemo(() => {
    const points = Array.isArray(travel?.travelAddress) ? travel.travelAddress : []
    return points
      .map((point: any) => {
        const coord = String(point?.coord ?? '').trim()
        if (!coord) return null
        const name = String(point?.name ?? point?.address ?? '').trim()
        if (!name) return null
        return { name, coord }
      })
      .filter((item): item is { name: string; coord: string } => Boolean(item))
  }, [travel?.travelAddress])

  const transportHints = useMemo(() => {
    const raw = (travel as any)?.transports ?? (travel as any)?.transportsTravel ?? (travel as any)?.transportMode ?? null
    const values = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    const labels = values
      .map((v) => String(v ?? '').toLowerCase().trim())
      .map((token) => {
        if (!token) return ''
        if (token.includes('car') || token.includes('маш')) return 'Машина'
        if (token.includes('bike') || token.includes('вело')) return 'Велосипед'
        if (token.includes('foot') || token.includes('walk') || token.includes('пеш')) return 'Пешком'
        return String(token).charAt(0).toUpperCase() + String(token).slice(1)
      })
      .filter(Boolean)
    return Array.from(new Set(labels))
  }, [travel])

  useEffect(() => {
    let active = true
    const linePoints = Array.isArray(primaryRoutePreview?.linePoints) ? primaryRoutePreview?.linePoints : []
    if (!linePoints || linePoints.length < 2) {
      setKeyPointLabels({})
      return () => {
        active = false
      }
    }

    const parseCoord = (coord: string): { lat: number; lng: number } | null => {
      const [latStr, lngStr] = String(coord ?? '').replace(/;/g, ',').split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }

    const startCoord = parseCoord(String(linePoints[0]?.coord ?? ''))
    const finishCoord = parseCoord(String(linePoints[linePoints.length - 1]?.coord ?? ''))

    let peakPoint = linePoints[0] ?? null
    for (const p of linePoints) {
      if (
        Number.isFinite((p as any)?.elevation as number) &&
        (!Number.isFinite((peakPoint as any)?.elevation as number) || Number((p as any).elevation) > Number((peakPoint as any).elevation))
      ) {
        peakPoint = p
      }
    }
    const peakCoord = parseCoord(String((peakPoint as any)?.coord ?? ''))

    const fetchReverseName = async (lat: number, lng: number): Promise<string | null> => {
      try {
        const primary = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`
        )
        if (primary.ok) {
          const data = await primary.json()
          const locality =
            data?.city ||
            data?.locality ||
            data?.principalSubdivision ||
            data?.address?.city ||
            data?.address?.town ||
            data?.address?.village ||
            data?.address?.municipality ||
            null
          if (locality) return String(locality)
        }
      } catch {
        // fallback below
      }

      try {
        const nominatim = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`
        )
        if (!nominatim.ok) return null
        const data = await nominatim.json()
        const addr = data?.address ?? {}
        return (
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.suburb ||
          addr.hamlet ||
          data?.name ||
          (typeof data?.display_name === 'string' ? String(data.display_name).split(',')[0]?.trim() : null) ||
          null
        )
      } catch {
        return null
      }
    }

    const fetchNearestPeakName = async (lat: number, lng: number): Promise<string | null> => {
      const endpoint = process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter'
      const query = `[out:json][timeout:20];node(around:5000,${lat},${lng})["natural"="peak"]["name"];out body 1;`
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: `data=${encodeURIComponent(query)}`,
        })
        if (!response.ok) return null
        const data = await response.json()
        const first = Array.isArray(data?.elements) ? data.elements[0] : null
        const rawName = first?.tags?.name
        if (!rawName) return null
        return String(rawName)
      } catch {
        return null
      }
    }

    const loadLabels = async () => {
      const [startName, finishName] = await Promise.all([
        startCoord ? fetchReverseName(startCoord.lat, startCoord.lng) : Promise.resolve(null),
        finishCoord ? fetchReverseName(finishCoord.lat, finishCoord.lng) : Promise.resolve(null),
      ])

      let peakName: string | null = null
      if (peakCoord) {
        peakName = await fetchNearestPeakName(peakCoord.lat, peakCoord.lng)
        if (!peakName) {
          peakName = await fetchReverseName(peakCoord.lat, peakCoord.lng)
        }
      }

      if (!active) return
      setKeyPointLabels({ startName, peakName, finishName })
    }

    void loadLabels()
    return () => {
      active = false
    }
  }, [primaryRoutePreview])

  return (
    <>
      {Platform.OS === 'web' && (travel.travelAddress?.length ?? 0) > 0 && (
        <Suspense fallback={<Fallback />}>
          <ExcursionsLazySection>
            <View
              ref={anchors.excursions}
              style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
              collapsable={false}
              accessibilityLabel="Экскурсии"
              {...(Platform.OS === 'web' ? { 'data-section-key': 'excursions' } : {})}
            >
              <Text style={styles.sectionHeaderText}>Экскурсии</Text>
              <Text style={styles.sectionSubtitle}>Покажем экскурсии рядом с точками маршрута</Text>

              <View style={[EXCURSION_CONTAINER_STYLE, styles.excursionsWidgetCard]}>
                <BelkrajWidgetComponent
                  countryCode={travel.countryCode}
                  points={travel.travelAddress as any}
                  collapsedHeight={760}
                />
              </View>
            </View>
          </ExcursionsLazySection>
        </Suspense>
      )}

      <View
        ref={(node) => {
          (anchors.map as any).current = node
          if (Platform.OS === 'web') {
            elementRef(node)
          }
        }}
        testID="travel-details-map"
        style={[
          styles.sectionContainer,
          styles.contentStable,
          styles.webDeferredSection,
          Platform.OS === 'web' ? ({ minHeight: 420 } as any) : null,
        ]}
        collapsable={false}
        accessibilityLabel="Карта маршрута"
        {...(Platform.OS === 'web'
          ? {
              'data-testid': 'travel-details-map',
              'data-section-key': 'map',
              'data-map-for-pdf': '1',
            }
          : {})}
      >
        <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
        <View style={SECTION_CONTENT_MARGIN_STYLE}>
          {hasMapData ? (
            <>
              <ToggleableMap
                initiallyOpen={!isMobileWeb}
                keepMounted={Platform.OS === 'web'}
                isLoading={isLoading && !shouldRender}
                loadingLabel="Подгружаем карту маршрута..."
                forceOpenTrigger={mapOpenTrigger || undefined}
                onOpenChange={(open) => {
                  if (Platform.OS !== 'web') return
                  if (open) {
                    setMapResizeTrigger((prev) => prev + 1)
                  }
                }}
              >
                {shouldRender ? (
                  <Suspense fallback={<MapFallback />}>
                    <TravelMap
                      travelData={travel.travelAddress as any}
                      highlightedPoint={highlightedPoint ?? undefined}
                      resizeTrigger={mapResizeTrigger}
                      compact
                      height={isMobileWeb ? 400 : 500}
                      showRouteLine={routePreviewItems.some((item) => (item.preview?.linePoints.length ?? 0) >= 2)}
                      routeLines={routePreviewItems.map((item) => ({
                        color: item.color,
                        coords: (item.preview?.linePoints ?? []).map((p) => {
                          const [latStr, lngStr] = String(p.coord ?? '').replace(/;/g, ',').split(',')
                          return [Number(latStr), Number(lngStr)] as [number, number]
                        }),
                      }))}
                    />
                  </Suspense>
                ) : (
                  <MapFallback />
                )}
              </ToggleableMap>
              {routePreviewItems.map((item, index) => (
                <RouteElevationProfile
                  key={`route-profile-${item.file.id}-${index}`}
                  title={`Профиль высот: ${item.label || `Трек ${index + 1}`}`}
                  lineColor={item.color}
                  preview={item.preview}
                  canDownloadTrack
                  onDownloadTrack={() => handleDownloadRoute(item.file)}
                  isDownloadPending={downloadingRouteId === item.file.id}
                  placeHints={placeHints}
                  transportHints={transportHints}
                  keyPointLabels={index === 0 ? keyPointLabels : undefined}
                />
              ))}
            </>
          ) : (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
            </View>
          )}
        </View>

      </View>

      {/* 4.3: WeatherWidget — unified across all devices, lazy via button */}
      {travel.travelAddress && (travel.travelAddress as any[]).length > 0 && !isWebAutomation && (
        <View
          accessibilityRole="none"
          accessibilityLabel="Погода"
          style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        >
          <Text style={styles.sectionHeaderText}>Погода</Text>
          {!weatherVisible ? (
            <Pressable
              onPress={() => setWeatherVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Показать погоду"
              style={({ pressed }) => [{
                minHeight: 44,
                borderRadius: DESIGN_TOKENS.radii.md,
                paddingHorizontal: DESIGN_TOKENS.spacing.md,
                paddingVertical: DESIGN_TOKENS.spacing.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                alignSelf: 'flex-start',
                marginTop: DESIGN_TOKENS.spacing.sm,
              } as any]}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
                Показать погоду
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: DESIGN_TOKENS.spacing.sm }}>
              <Suspense fallback={<View style={WEATHER_PLACEHOLDER_STYLE} />}>
                <WeatherWidget points={travel.travelAddress as any} />
              </Suspense>
            </View>
          )}
        </View>
      )}

      {travel.travelAddress && (travel.travelAddress as any[]).length > 0 && (
        <View
          ref={anchors.points}
          testID="travel-details-points"
          style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
          collapsable={false}
          accessibilityLabel="Координаты мест"
          {...(Platform.OS === 'web'
            ? { 'data-testid': 'travel-details-points', 'data-section-key': 'points' }
            : {})}
        >
          <Text style={styles.sectionHeaderText}>Координаты мест</Text>
          <View style={SECTION_CONTENT_MARGIN_STYLE}>
            <Suspense fallback={<PointListFallback />}>
              <PointList
                points={travel.travelAddress as any}
                baseUrl={travel.url}
                travelName={travel.name}
                onPointCardPress={handlePointCardPress}
              />
            </Suspense>
          </View>
        </View>
      )}
    </>
  )
}

export default React.memo(TravelDetailsMapSection)
