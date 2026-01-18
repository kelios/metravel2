import React, { Suspense, useEffect, useState } from 'react'
import { Animated, InteractionManager, LayoutChangeEvent, Platform, Text, View } from 'react-native'

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
  relatedTravels: Travel[]
  setRelatedTravels: React.Dispatch<React.SetStateAction<Travel[]>>
  scrollY: Animated.Value
  viewportHeight: number
  canRenderHeavy: boolean
}> = ({
  travel,
  anchors,
  relatedTravels,
  setRelatedTravels,
  scrollY,
  viewportHeight,
  canRenderHeavy,
}) => {
  const styles = useTravelDetailsStyles()
  const isWeb = Platform.OS === 'web'
  const preloadMargin = 0
  const progressiveEnabled = !isWeb || canRenderHeavy

  const { shouldLoad: shouldLoadNearWeb, setElementRef: setNearRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.25,
    fallbackDelay: 2500,
    enabled: progressiveEnabled,
  })
  const { shouldLoad: shouldLoadPopularWeb, setElementRef: setPopularRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.25,
    fallbackDelay: 2600,
    enabled: progressiveEnabled,
  })

  const [nearTop, setNearTop] = useState<number | null>(null)
  const [popularTop, setPopularTop] = useState<number | null>(null)
  const [shouldLoadNearNative, setShouldLoadNearNative] = useState(false)
  const [shouldLoadPopularNative, setShouldLoadPopularNative] = useState(false)

  useEffect(() => {
    if (isWeb) return
    if (!viewportHeight || viewportHeight <= 0) return

    const id = scrollY.addListener(({ value }) => {
      const bottomY = value + viewportHeight + preloadMargin

      if (nearTop != null) {
        const nextNear = bottomY >= nearTop
        setShouldLoadNearNative((prev) => (prev === nextNear ? prev : nextNear))
      }

      if (popularTop != null) {
        const nextPopular = bottomY >= popularTop
        setShouldLoadPopularNative((prev) => (prev === nextPopular ? prev : nextPopular))
      }
    })

    return () => {
      scrollY.removeListener(id)
    }
  }, [isWeb, nearTop, popularTop, preloadMargin, scrollY, viewportHeight])

  const shouldLoadNear = isWeb ? shouldLoadNearWeb : shouldLoadNearNative
  const shouldLoadPopular = isWeb ? shouldLoadPopularWeb : shouldLoadPopularNative

  const [hasLoadedNear, setHasLoadedNear] = useState(false)
  const [hasLoadedPopular, setHasLoadedPopular] = useState(false)

  useEffect(() => {
    if (shouldLoadNear && !hasLoadedNear) setHasLoadedNear(true)
  }, [shouldLoadNear, hasLoadedNear])

  useEffect(() => {
    if (shouldLoadPopular && !hasLoadedPopular) setHasLoadedPopular(true)
  }, [shouldLoadPopular, hasLoadedPopular])

  const shouldRenderNear = shouldLoadNear || hasLoadedNear
  const shouldRenderPopular = shouldLoadPopular || hasLoadedPopular

  const [canMountNear, setCanMountNear] = useState(false)
  const [canMountPopular, setCanMountPopular] = useState(false)

  useEffect(() => {
    if (!shouldRenderNear || canMountNear) return
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof (window as any).requestIdleCallback === 'function'
    ) {
      const id = (window as any).requestIdleCallback(() => setCanMountNear(true), { timeout: 1200 })
      return () => {
        try {
          ;(window as any).cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }

    const task = InteractionManager.runAfterInteractions(() => setCanMountNear(true))
    return () => task.cancel()
  }, [shouldRenderNear, canMountNear])

  useEffect(() => {
    if (!shouldRenderPopular || canMountPopular) return
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof (window as any).requestIdleCallback === 'function'
    ) {
      const id = (window as any).requestIdleCallback(() => setCanMountPopular(true), {
        timeout: 1200,
      })
      return () => {
        try {
          ;(window as any).cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }

    const task = InteractionManager.runAfterInteractions(() => setCanMountPopular(true))
    return () => task.cancel()
  }, [shouldRenderPopular, canMountPopular])

  return (
    <>
      <View
        ref={anchors.near}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Рядом можно посмотреть"
        onLayout={
          isWeb
            ? undefined
            : (e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y
                setNearTop((prev) => (prev === y ? prev : y))
              }
        }
        {...(Platform.OS === 'web' ? { 'data-section-key': 'near' } : {})}
      >
        {Platform.OS === 'web' ? (
          <View
            collapsable={false}
            // @ts-ignore
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setNearRefWeb(target)
            }}
          />
        ) : (
          <View />
        )}
        <Text style={styles.sectionHeaderText}>Рядом можно посмотреть</Text>
        <Text style={styles.sectionSubtitle}>Маршруты в радиусе ~60 км</Text>
        <View style={{ marginTop: 8 }}>
          {travel.travelAddress &&
            (shouldRenderNear && canMountNear ? (
              <View testID="travel-details-near-loaded">
                <Suspense fallback={<TravelListFallback />}>
                  <NearTravelList
                    travel={travel}
                    onTravelsLoaded={(travels) => setRelatedTravels(travels)}
                    showHeader={false}
                    embedded
                  />
                </Suspense>
              </View>
            ) : (
              <View testID="travel-details-near-placeholder" style={styles.lazySectionReserved}>
                <TravelListSkeleton count={3} />
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
        ref={anchors.popular}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Популярные маршруты"
        onLayout={
          isWeb
            ? undefined
            : (e: LayoutChangeEvent) => {
                const y = e.nativeEvent.layout.y
                setPopularTop((prev) => (prev === y ? prev : y))
              }
        }
        {...(Platform.OS === 'web' ? { 'data-section-key': 'popular' } : {})}
      >
        {Platform.OS === 'web' ? (
          <View
            collapsable={false}
            // @ts-ignore
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setPopularRefWeb(target)
            }}
          />
        ) : (
          <View />
        )}
        <Text style={styles.sectionHeaderText}>Популярные маршруты</Text>
        <Text style={styles.sectionSubtitle}>Самые просматриваемые направления за неделю</Text>
        <View style={{ marginTop: 8 }}>
          {shouldRenderPopular && canMountPopular ? (
            <View testID="travel-details-popular-loaded">
              <Suspense fallback={<TravelListFallback />}>
                <PopularTravelList title={null} showHeader={false} embedded />
              </Suspense>
            </View>
          ) : (
            <View testID="travel-details-popular-placeholder" style={styles.lazySectionReserved}>
              <TravelListSkeleton count={3} />
            </View>
          )}
        </View>
      </View>
    </>
  )
}
