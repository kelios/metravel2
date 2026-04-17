import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'

import { MapSkeleton } from '@/components/travel/TravelDetailSkeletons'
import ToggleableMap from '@/components/travel/ToggleableMapSection'
import { TravelMap } from '@/components/MapPage/TravelMap'
import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'
import type { Travel } from '@/types/types'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useTravelRouteMapBlockModel } from '../hooks/useTravelRouteMapBlockModel'

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
  isMobileWeb: boolean
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
  isMobileWeb,
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

  return (
    <View
      testID="travel-details-map"
      style={[
        styles.sectionContainer,
        styles.contentStable,
        styles.webDeferredSection,
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
          </>
        ) : shouldShowMapLoadingState ? (
          <MapFallback />
        ) : (
          <View style={styles.mapEmptyState}>
            <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default React.memo(TravelRouteMapBlock)
