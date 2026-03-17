import React from 'react'
import { Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import NavigationArrows from '@/components/travel/NavigationArrows'
import NearTravelList from '@/components/travel/NearTravelList'
import PopularTravelList from '@/components/travel/PopularTravelList'
import { useTravelDetailsSidebarSectionModel } from '../hooks/useTravelDetailsSidebarSectionModel'

const SIDEBAR_CONTENT_MARGIN_STYLE = { marginTop: 8 } as const

export const TravelDetailsSidebarSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  scrollY?: any
  viewportHeight?: number
  canRenderHeavy: boolean
  forceOpenKey?: string | null
}> = ({
  travel,
  anchors,
  canRenderHeavy,
  forceOpenKey: _forceOpenKey = null,
}) => {
  const styles = useTravelDetailsStyles()
  const {
    handleTravelsLoaded,
    hasValidTravelId,
    relatedTravels,
    setNearRef,
    setPopularRef,
    shouldShowNavigationArrows,
  } = useTravelDetailsSidebarSectionModel({
    canRenderHeavy,
    travel,
  })


  return (
    <>
      <View
        ref={(node) => {
          // Handle both anchor ref and progressive load ref
          if (anchors.near && typeof anchors.near === 'object') {
            (anchors.near as any).current = node;
          }
          setNearRef(node);
        }}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Рядом можно посмотреть"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'near' } : {})}
      >
        <Text style={styles.sectionHeaderText}>Рядом можно посмотреть</Text>
        <Text style={styles.sectionSubtitle}>Маршруты в радиусе ~60 км</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          {hasValidTravelId && (
            <View testID="travel-details-near-loaded">
              <NearTravelList
                travel={travel}
                onTravelsLoaded={handleTravelsLoaded}
                showHeader={false}
                embedded
              />
            </View>
          )}
        </View>
      </View>

      {shouldShowNavigationArrows && (
        <View
          style={[styles.sectionContainer, styles.navigationArrowsContainer]}
          accessibilityLabel="Навигация по похожим маршрутам"
          accessibilityRole="none"
          role="navigation"
        >
          <NavigationArrows currentTravel={travel} relatedTravels={relatedTravels} />
        </View>
      )}

      <View
        ref={(node) => {
          if (anchors.popular && typeof anchors.popular === 'object') {
            (anchors.popular as any).current = node;
          }
          setPopularRef(node);
        }}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Популярные маршруты"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'popular' } : {})}
      >
        <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        <Text style={styles.sectionSubtitle}>Самые просматриваемые направления за неделю</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          <View testID="travel-details-popular-loaded">
            <PopularTravelList title={null} showHeader={false} embedded />
          </View>
        </View>
      </View>
    </>
  )
}
