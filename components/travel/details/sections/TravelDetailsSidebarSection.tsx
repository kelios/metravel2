import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { withLazy } from '../TravelDetailsLazy'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useThemedColors } from '@/hooks/useTheme'
import NavigationArrows from '@/components/travel/NavigationArrows'
import { useTravelDetailsSidebarSectionModel } from '../hooks/useTravelDetailsSidebarSectionModel'

const SIDEBAR_CONTENT_MARGIN_STYLE = { marginTop: 8 } as const
const LIST_FALLBACK_STYLE = { minHeight: 220 } as const

const NearTravelListLazy = withLazy(() =>
  import('@/components/travel/NearTravelList').then((module) => ({
    default: module.default,
  })),
)

const PopularTravelListLazy = withLazy(() =>
  import('@/components/travel/PopularTravelList').then((module) => ({
    default: module.default,
  })),
)

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
  const colors = useThemedColors()
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
        <View style={styles.sectionHeaderRow}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <Text style={styles.sectionHeaderText}>Рядом можно посмотреть</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Маршруты в радиусе ~60 км</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          {hasValidTravelId && (
            <View testID="travel-details-near-loaded">
              <Suspense fallback={<View style={LIST_FALLBACK_STYLE} />}>
                <NearTravelListLazy
                  travel={travel}
                  onTravelsLoaded={handleTravelsLoaded}
                  showHeader={false}
                  embedded
                />
              </Suspense>
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
        <View style={styles.sectionHeaderRow}>
          <Feather name="trending-up" size={18} color={colors.primary} />
          <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Самые просматриваемые направления за неделю</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          <View testID="travel-details-popular-loaded">
            <Suspense fallback={<View style={LIST_FALLBACK_STYLE} />}>
              <PopularTravelListLazy title={null} showHeader={false} embedded />
            </Suspense>
          </View>
        </View>
      </View>
    </>
  )
}
