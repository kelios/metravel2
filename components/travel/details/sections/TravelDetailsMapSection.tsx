import React from 'react'
import { View, useWindowDimensions } from 'react-native'

import type { Travel } from '@/types/types'

import { useThemedColors } from '@/hooks/useTheme'
import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useTravelDetailsMapSectionContentModel } from '../hooks/useTravelDetailsMapSectionContentModel'
import { useTravelDetailsMapSectionModel } from '../hooks/useTravelDetailsMapSectionModel'
import ExcursionsSection from './ExcursionsSection'
import TravelRouteMapBlock from './TravelRouteMapBlock'
import TravelWeatherBlock from './TravelWeatherBlock'
import TravelPointsBlock from './TravelPointsBlock'

export const TravelDetailsMapSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
  scrollToMapSection: () => void
  forceOpenKey?: string | null
}> = ({ travel, anchors, canRenderHeavy, scrollToMapSection, forceOpenKey = null }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()

  const {
    downloadingRouteId,
    handleDownloadRoute,
    handleMapOpenChange,
    handlePointCardPress,
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    highlightedPoint,
    isMobileWeb,
    mapOpenTrigger,
    mapOpened,
    mapResizeTrigger,
    placeHints,
    setWeatherVisible,
    shouldForceRenderExcursions,
    shouldForceRenderMap,
    transportHints,
    weatherVisible,
  } = useTravelDetailsMapSectionModel({
    travel,
    forceOpenKey,
    scrollToMapSection,
    width,
  })

  const {
    hasMapData,
    isLoading,
    isRoutePreviewLoading,
    keyPointLabels,
    routePreviewItems,
    setMapSectionRef,
    shouldRender,
    shouldRenderMapContent,
  } = useTravelDetailsMapSectionContentModel({
    anchors,
    canRenderHeavy,
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    mapOpened,
    shouldForceRenderMap,
    travel,
  })

  const colors = useThemedColors()

  return (
    <>
      <ExcursionsSection
        travel={travel}
        anchors={anchors}
        styles={styles}
        shouldForceRenderExcursions={shouldForceRenderExcursions}
      />

      <View
        ref={setMapSectionRef}
      >
        <TravelRouteMapBlock
          downloadingRouteId={downloadingRouteId}
          handleDownloadRoute={handleDownloadRoute}
          handleMapOpenChange={handleMapOpenChange}
          hasMapData={hasMapData}
          highlightedPoint={highlightedPoint}
          isLoading={isLoading}
          isMobileWeb={isMobileWeb}
          isRoutePreviewLoading={isRoutePreviewLoading}
          keyPointLabels={keyPointLabels}
          mapOpenTrigger={mapOpenTrigger}
          mapResizeTrigger={mapResizeTrigger}
          placeHints={placeHints}
          routePreviewItems={routePreviewItems}
          shouldForceRenderMap={shouldForceRenderMap}
          shouldRender={shouldRender}
          shouldRenderMapContent={shouldRenderMapContent}
          styles={styles}
          transportHints={transportHints}
          travel={travel}
        />
      </View>

      <TravelWeatherBlock
        colors={colors}
        setWeatherVisible={setWeatherVisible}
        styles={styles}
        travel={travel}
        weatherVisible={weatherVisible}
      />

      <TravelPointsBlock
        anchors={anchors}
        handlePointCardPress={handlePointCardPress}
        styles={styles}
        travel={travel}
      />
    </>
  )
}

export default React.memo(TravelDetailsMapSection)
