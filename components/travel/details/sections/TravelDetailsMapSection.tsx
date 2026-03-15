import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'
import { useMapLazyLoad } from '@/hooks/useMapLazyLoad'

import { MapSkeleton, PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/types/types'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { isWebAutomation } from '@/utils/isWebAutomation'
import type { TravelRouteFile } from '@/types/travelRoutes'
import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'
import { buildTravelRouteDownloadPath } from '@/api/travelRoutes'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'
import { useKeyPointLabels } from '@/hooks/useKeyPointLabels'
import PointList from '@/components/travel/PointList'
import ToggleableMap from '@/components/travel/ToggleableMapSection'
import { TravelMap } from '@/components/MapPage/TravelMap'
import WeatherWidget from '@/components/home/WeatherWidget'
import BelkrajWidget from '@/components/belkraj/BelkrajWidget'

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const
const EXCURSION_CONTAINER_STYLE = { marginTop: 12 } as const
const WEATHER_PLACEHOLDER_STYLE = { minHeight: 120 } as const

const BelkrajWidgetComponent = Platform.OS === 'web' ? BelkrajWidget : (() => null) as React.ComponentType<any>

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

const ExcursionsLazySection: React.FC<{ children: React.ReactNode; forceVisible?: boolean }> = ({
  children,
}) => {
  // All sections load immediately — no delays, no IntersectionObserver
  return <>{children}</>
}

export const TravelDetailsMapSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
  scrollToMapSection: () => void
  forceOpenKey?: string | null
}> = ({ travel, anchors, canRenderHeavy, scrollToMapSection, forceOpenKey = null }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()
  const [highlightedPoint, setHighlightedPoint] = useState<{ coord: string; key: string } | null>(null)
  const [mapOpenTrigger, setMapOpenTrigger] = useState(0)
  const [mapOpened, setMapOpened] = useState(false)
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(false)
  const [downloadingRouteId, setDownloadingRouteId] = useState<number | null>(null)
  const hasEmbeddedCoords = (travel.coordsMeTravel?.length ?? 0) > 0
  const hasTravelAddressPoints = (travel.travelAddress?.length ?? 0) > 0

  // Simplified lazy loading
  const { shouldRender, elementRef, isLoading } = useMapLazyLoad({
    enabled: true,
    hasData: true,
    canRenderHeavy,
    rootMargin: isWebAutomation ? '800px 0px 800px 0px' : '400px 0px 400px 0px',
    threshold: isWebAutomation ? 0 : 0.1,
  })

  const shouldForceRenderMap = forceOpenKey === 'map' || forceOpenKey === 'points' || mapOpenTrigger > 0
  const shouldRenderMapContent = shouldRender || shouldForceRenderMap || mapOpened
  const shouldForceRenderExcursions = forceOpenKey === 'excursions'

  // ✅ REFACTORED: Route file parsing extracted to useRouteFilePreviews hook
  const { routePreviewItems, resetRoutePreviewItems, primaryRoutePreview } = useRouteFilePreviews({
    travelId: travel?.id,
    canRenderHeavy,
    shouldRender,
    shouldForceRenderMap,
  })

  // ✅ REFACTORED: Key point labels extracted to useKeyPointLabels hook
  const { keyPointLabels, resetKeyPointLabels } = useKeyPointLabels(primaryRoutePreview)

  const hasMapData =
    hasEmbeddedCoords ||
    hasTravelAddressPoints ||
    routePreviewItems.some((item) => (item.preview?.linePoints.length ?? 0) > 0)

  const colors = useThemedColors()

  useEffect(() => {
    setHighlightedPoint(null)
    setMapOpenTrigger(0)
    setMapOpened(false)
    setMapResizeTrigger(0)
    setWeatherVisible(false)
    setDownloadingRouteId(null)
    resetRoutePreviewItems()
    resetKeyPointLabels()
  }, [travel.id, travel.slug, resetRoutePreviewItems, resetKeyPointLabels])

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

  return (
    <>
      {Platform.OS === 'web' && (travel.travelAddress?.length ?? 0) > 0 && (
        <Suspense fallback={<Fallback />}>
          <ExcursionsLazySection forceVisible={shouldForceRenderExcursions}>
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
                isLoading={isLoading && !shouldRender && !shouldForceRenderMap}
                loadingLabel="Подгружаем карту маршрута..."
                forceOpenTrigger={mapOpenTrigger || undefined}
                onOpenChange={(open) => {
                  if (Platform.OS !== 'web') return
                  if (open) {
                    setMapOpened(true)
                    setMapResizeTrigger((prev) => prev + 1)
                  }
                }}
              >
                {shouldRenderMapContent ? (
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
                <WeatherWidget points={travel.travelAddress as any} countryName={travel.countryName} />
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
