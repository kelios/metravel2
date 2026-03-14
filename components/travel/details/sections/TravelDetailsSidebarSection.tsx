import React, { useCallback, useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import NavigationArrows from '@/components/travel/NavigationArrows'
import NearTravelList from '@/components/travel/NearTravelList'
import PopularTravelList from '@/components/travel/PopularTravelList'

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
  const isWeb = Platform.OS === 'web'
  const progressiveEnabled = !isWeb || canRenderHeavy
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([])
  const handleTravelsLoaded = useCallback((travels: Travel[]) => setRelatedTravels(travels), [])

  // Unified progressive loading for both platforms
  const { setElementRef: setNearRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: progressiveEnabled,
  })

  const { setElementRef: setPopularRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: progressiveEnabled,
  })

  useEffect(() => {
    setRelatedTravels([])
  }, [travel.id, travel.slug])


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
          {travel.travelAddress && (
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

      {relatedTravels.length > 0 && (
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
