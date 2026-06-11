import React from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
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
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
      collapsable={false}
      accessibilityLabel="Карта маршрута"
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
    >
      <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
      <View style={SECTION_CONTENT_MARGIN_STYLE}>
        {hasMapData ? (
          <>
            <ToggleableMap
              initiallyOpen
              keepMounted={false}
              isLoading={isLoading && !shouldRender && !shouldForceRenderMap}
              loadingLabel="Подгружаем карту маршрута..."
              forceOpenTrigger={mapOpenTrigger || undefined}
              onOpenChange={handleMapOpenChange}
            >
              {shouldRenderMapContent ? (
                <TravelMap
                  travelData={travel.travelAddress as any}
                  highlightedPoint={highlightedPoint ?? undefined}
                  resizeTrigger={mapResizeTrigger}
                  compact
                  height={560}
                  showRouteLine={shouldShowRouteLine}
                  routeLines={routeLines}
                />
              ) : (
                <MapFallback />
              )}
            </ToggleableMap>
            {routeProfiles.length > 0
              ? routeProfiles.map((profile) => (
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
                ))
              : null}
          </>
        ) : shouldShowMapLoadingState ? (
          <MapFallback />
        ) : (
          <View style={styles.mapEmptyState}>
            <Feather name="map" size={32} color={colors.textMuted} />
            <Text style={[styles.mapEmptyText, { marginTop: 12 }]}>Маршрут на карте не задан</Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                textAlign: 'center',
                marginTop: 4,
                opacity: 0.8,
              }}
            >
              Автор не добавил линию маршрута для этого путешествия
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default React.memo(TravelRouteMapBlock)
