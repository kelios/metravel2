import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'

import NavigationArrows from '@/components/travel/NavigationArrows'
import { TravelListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/src/types/types'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'

const NearTravelList = withLazy(() => import('@/components/travel/NearTravelList'))
const PopularTravelList = withLazy(() => import('@/components/travel/PopularTravelList'))

const TravelListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.travelListFallback}>
      <TravelListSkeleton count={3} />
    </View>
  )
}

export const TravelDetailsSidebarSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  scrollY: any
  viewportHeight: number
  canRenderHeavy: boolean
}> = ({
  travel,
  anchors,
  scrollY: _scrollY, // Unused in simplified version
  viewportHeight: _viewportHeight, // Unused in simplified version
  canRenderHeavy,
}) => {
  const styles = useTravelDetailsStyles()
  const isWeb = Platform.OS === 'web'
  const progressiveEnabled = !isWeb || canRenderHeavy
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([])
  const handleTravelsLoaded = useCallback((travels: Travel[]) => setRelatedTravels(travels), [])

  // Unified progressive loading for both platforms
  const { shouldLoad: shouldLoadNear, setElementRef: setNearRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: progressiveEnabled,
  })

  const { shouldLoad: shouldLoadPopular, setElementRef: setPopularRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1200,
    enabled: progressiveEnabled,
  })

  const [hasLoadedNear, setHasLoadedNear] = useState(false)
  const [hasLoadedPopular, setHasLoadedPopular] = useState(false)

  // Keep content visible once loaded
  useEffect(() => {
    if (shouldLoadNear && !hasLoadedNear) setHasLoadedNear(true)
  }, [shouldLoadNear, hasLoadedNear])

  useEffect(() => {
    if (shouldLoadPopular && !hasLoadedPopular) setHasLoadedPopular(true)
  }, [shouldLoadPopular, hasLoadedPopular])

  const shouldRenderNear = shouldLoadNear || hasLoadedNear
  const shouldRenderPopular = shouldLoadPopular || hasLoadedPopular

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
        <View style={{ marginTop: 8 }}>
          {travel.travelAddress &&
            (shouldRenderNear ? (
              <View testID="travel-details-near-loaded">
                <Suspense fallback={<TravelListFallback />}>
                  <NearTravelList
                    travel={travel}
                    onTravelsLoaded={handleTravelsLoaded}
                    showHeader={false}
                    embedded
                  />
                </Suspense>
              </View>
            ) : (
              <View testID="travel-details-near-placeholder" style={styles.lazySectionReserved}>
                <TravelListFallback />
              </View>
            ))}
        </View>
      </View>

      {relatedTravels.length > 0 && (
        <View
          style={[styles.sectionContainer, styles.navigationArrowsContainer]}
          accessibilityLabel="Навигация по похожим маршрутам"
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
        <View style={{ marginTop: 8 }}>
          {shouldRenderPopular ? (
            <View testID="travel-details-popular-loaded">
              <Suspense fallback={<TravelListFallback />}>
                <PopularTravelList title={null} showHeader={false} embedded />
              </Suspense>
            </View>
          ) : (
            <View testID="travel-details-popular-placeholder" style={styles.lazySectionReserved}>
              <TravelListFallback />
            </View>
          )}
        </View>
      </View>
    </>
  )
}
