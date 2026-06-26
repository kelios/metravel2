import React, { useCallback, useState } from 'react'
import { Modal, Platform, View, useWindowDimensions } from 'react-native'

import type { Travel } from '@/types/types'

import DataFreshnessNotice from '@/components/legal/DataFreshnessNotice'
import MapPlaceBottomCard from '@/components/MapPage/MapPlaceBottomCard'
import type { Point } from '@/components/MapPage/Map/types'
import { LAYOUT } from '@/constants/layout'
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors } from '@/hooks/useTheme'
import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useTravelDetailsMapSectionContentModel } from '../hooks/useTravelDetailsMapSectionContentModel'
import { useTravelDetailsMapSectionModel } from '../hooks/useTravelDetailsMapSectionModel'
import AffiliateSection from './AffiliateSection'
import ExcursionsSection from './ExcursionsSection'
import QuestForCitySection from './QuestForCitySection'
import TravelRouteMapBlock from './TravelRouteMapBlock'
import TravelWeatherBlock from './TravelWeatherBlock'
import TravelPointsBlock from './TravelPointsBlock'

function getTravelPointMapCardPoint(point: any): Point | null {
  const coord = String(point?.coord ?? '').trim()
  const address = String(point?.address ?? point?.name ?? '').trim()
  if (!coord || !address) return null

  return {
    id: point?.id ?? coord,
    coord,
    address,
    categoryName: point?.categoryName ?? point?.category,
    travelImageThumbUrl: point?.travelImageThumbUrl ?? point?.imageUrl,
    imageUrl: point?.imageUrl,
    updated_at: point?.updated_at,
  }
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
  const insets = useSafeAreaInsets()
  const [selectedPointCard, setSelectedPointCard] = useState<Point | null>(null)
  const nativeCardTopInset = (insets?.top ?? 0) + LAYOUT.headerHeight + 56
  const nativeCardBottomInset = LAYOUT.tabBarHeight + 16

  const {
    downloadingRouteId,
    handleDownloadRoute,
    handleMapOpenChange,
    handlePointCardPress,
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    highlightedPoint,
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
  const handleTravelPointCardPress = useCallback((point: any) => {
    if (Platform.OS !== 'web') {
      const cardPoint = getTravelPointMapCardPoint(point)
      if (cardPoint) setSelectedPointCard(cardPoint)
      return
    }

    handlePointCardPress(point)
  }, [handlePointCardPress])

  return (
    <>
      <DataFreshnessNotice style={{ marginBottom: 12 }} />

      <ExcursionsSection
        travel={travel}
        anchors={anchors}
        styles={styles}
        shouldForceRenderExcursions={shouldForceRenderExcursions}
      />

      <QuestForCitySection travel={travel} styles={styles} />

      <AffiliateSection travel={travel} styles={styles} />

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
        handlePointCardPress={handleTravelPointCardPress}
        styles={styles}
        travel={travel}
      />

      {Platform.OS !== 'web' ? (
        <Modal
          visible={Boolean(selectedPointCard)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedPointCard(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <MapPlaceBottomCard
              point={selectedPointCard}
              userLocation={null}
              onClose={() => setSelectedPointCard(null)}
              topInset={nativeCardTopInset}
              bottomInset={nativeCardBottomInset}
            />
          </View>
        </Modal>
      ) : null}
    </>
  )
}

export default React.memo(TravelDetailsMapSection)
