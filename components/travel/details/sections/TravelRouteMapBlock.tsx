import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'

import { MapSkeleton } from '@/components/travel/TravelDetailSkeletons'
import ToggleableMap from '@/components/travel/ToggleableMapSection'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useTravelRouteMapBlockModel } from '../hooks/useTravelRouteMapBlockModel'
import { translate as i18nT } from '@/i18n'


const TravelMap = React.lazy(() =>
  Promise.resolve(import('@/components/MapPage/TravelMap')).then((m) => ({ default: m.TravelMap })),
)

// Elevation profile pulls react-native-svg + chart logic (~700 LOC) and only
// renders for travels that ship GPX/track files. Defer it so travels without
// tracks don't pay for the chart code in the map-section chunk.
const RouteElevationProfile = React.lazy(
  () => import('@/components/travel/details/sections/RouteElevationProfile'),
)

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const

const MapFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <MapSkeleton />
    </View>
  )
}

export const TravelRouteMapBlock: React.FC<{
  downloadingRouteId: number | null
  handleDownloadRoute: (file: any) => void
  handleMapOpenChange: (open: boolean) => void
  hasMapData: boolean
  highlightedPoint: { coord: string; key: string } | null
  isLoading: boolean
  isRoutePreviewLoading: boolean
  keyPointLabels: any
  mapOpenTrigger: number
  mapResizeTrigger: number
  placeHints: Array<{ name: string; coord: string }>
  routePreviewItems: any[]
  shouldForceRenderMap: boolean
  shouldRender: boolean
  shouldRenderMapContent: boolean
  styles: any
  transportHints: string[]
  travel: Travel
}> = ({
  downloadingRouteId,
  handleDownloadRoute,
  handleMapOpenChange,
  hasMapData,
  highlightedPoint,
  isLoading,
  isRoutePreviewLoading,
  keyPointLabels,
  mapOpenTrigger,
  mapResizeTrigger,
  placeHints,
  routePreviewItems,
  shouldForceRenderMap,
  shouldRender,
  shouldRenderMapContent,
  styles,
  transportHints,
  travel,
}) => {
  const {
    routeLines,
    routeProfiles,
    shouldShowMapLoadingState,
    shouldShowRouteLine,
  } = useTravelRouteMapBlockModel({
    downloadingRouteId,
    handleDownloadRoute,
    hasMapData,
    isRoutePreviewLoading,
    keyPointLabels,
    routePreviewItems,
  })
  const colors = useThemedColors()

  return (
    <View
      testID="travel-details-map"
      style={[
        styles.sectionContainer,
        styles.contentStable,
        styles.webDeferredSection,
      ]}
      collapsable={false}
      accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelRouteMapBlock.karta_marshruta_0bb083af')}
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
      {...(Platform.OS === 'web'
        ? {
            'data-testid': 'travel-details-map',
            'data-section-key': 'map',
            'data-map-for-pdf': '1',
          }
        : {})}
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >{i18nT('travel:components.travel.details.sections.TravelRouteMapBlock.karta_marshruta_0bb083af')}</Text>
      <View style={SECTION_CONTENT_MARGIN_STYLE}>
        {hasMapData ? (
          <>
            <ToggleableMap
              // Keep the map open from the first render on web/mobile so marker interactions
              // remain available without an extra reveal click on travel details pages.
              initiallyOpen
              keepMounted={Platform.OS === 'web'}
              isLoading={isLoading && !shouldRender && !shouldForceRenderMap}
              loadingLabel={i18nT('travel:components.travel.details.sections.TravelRouteMapBlock.podgruzhaem_kartu_marshruta_a83bda14')}
              forceOpenTrigger={mapOpenTrigger || undefined}
              onOpenChange={handleMapOpenChange}
            >
              {shouldRenderMapContent ? (
                <Suspense fallback={<MapFallback />}>
                  <TravelMap
                    travelData={travel.travelAddress as any}
                    highlightedPoint={highlightedPoint ?? undefined}
                    resizeTrigger={mapResizeTrigger}
                    compact
                    height={560}
                    showRouteLine={shouldShowRouteLine}
                    routeLines={routeLines}
                  />
                </Suspense>
              ) : (
                <MapFallback />
              )}
            </ToggleableMap>
            {routeProfiles.length > 0 ? (
              <Suspense fallback={null}>
                {routeProfiles.map((profile) => (
                  <RouteElevationProfile
                    key={profile.key}
                    title={profile.title}
                    lineColor={profile.lineColor}
                    preview={profile.preview}
                    canDownloadTrack
                    onDownloadTrack={profile.onDownloadTrack}
                    isDownloadPending={profile.isDownloadPending}
                    placeHints={placeHints}
                    transportHints={transportHints}
                    keyPointLabels={profile.keyPointLabels}
                  />
                ))}
              </Suspense>
            ) : null}
          </>
        ) : shouldShowMapLoadingState ? (
          <MapFallback />
        ) : (
          <View style={styles.mapEmptyState}>
            <Feather name="map" size={32} color={colors.textMuted} />
            <Text style={[styles.mapEmptyText, { marginTop: 12 }]}>
              {i18nT('travel:components.travel.details.sections.TravelRouteMapBlock.marshrut_na_karte_ne_zadan_3baa427b')}</Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 4,
                opacity: 0.8,
              }}
            >
              {i18nT('travel:components.travel.details.sections.TravelRouteMapBlock.avtor_ne_dobavil_liniyu_marshruta_dlya_etogo_636d4fc3')}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default React.memo(TravelRouteMapBlock)
