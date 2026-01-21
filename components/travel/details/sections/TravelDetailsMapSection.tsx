import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Text, View, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'
import { useLazyMap } from '@/hooks/useLazyMap'

import { MapSkeleton, PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/src/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'

const PointList = withLazy(() => import('@/components/travel/PointList'))
const ToggleableMap = withLazy(() => import('@/components/travel/ToggleableMapSection'))
const MapClientSide = withLazy(() => import('@/components/Map'))

const BelkrajWidgetComponent =
  Platform.OS === 'web'
    ? withLazy(() => import('@/components/belkraj/BelkrajWidget'))
    : (() => null) as React.ComponentType<any>

const Fallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" />
    </View>
  )
}

const MapFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <MapSkeleton />
    </View>
  )
}

const PointListFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <PointListSkeleton />
    </View>
  )
}

const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
}

const ExcursionsLazySection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisible(true)
      return
    }

    if (visible) return
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setVisible(true)
      return
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const rawNode = containerRef.current as any
    const targetNode = rawNode?._nativeNode || rawNode?._domNode || rawNode || null
    if (!targetNode) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: '200px 0px 0px 0px',
        threshold: 0.1,
      }
    )

    observer.observe(targetNode as Element)

    return () => {
      observer.disconnect()
    }
  }, [visible])

  if (Platform.OS !== 'web') {
    return <>{children}</>
  }

  return (
    <View ref={containerRef} collapsable={false}>
      {visible ? children : null}
    </View>
  )
}

export const TravelDetailsMapSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
}> = ({ travel, anchors, canRenderHeavy }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()
  const hasMapData = (travel.coordsMeTravel?.length ?? 0) > 0
  const [mapLazyEnabled, setMapLazyEnabled] = useState(Platform.OS !== 'web')
  const { shouldLoad: shouldLoadMap, setElementRef } = useLazyMap({
    enabled: mapLazyEnabled,
    rootMargin: '0px',
    threshold: 0.2,
  })
  const shouldRenderMap = canRenderHeavy && (Platform.OS !== 'web' || shouldLoadMap) && hasMapData
  const [hasMountedMap, setHasMountedMap] = useState(false)
  const [highlightedPoint, setHighlightedPoint] = useState<{ coord: string; key: string } | null>(null)
  const handlePointCardPress = useCallback((point: any) => {
    const coord = String(point?.coord ?? '').trim()
    if (!coord) return
    setHighlightedPoint({ coord, key: `${coord}-${Date.now()}` })
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!canRenderHeavy) return
    rIC(() => setMapLazyEnabled(true), 2000)
  }, [canRenderHeavy])

  useEffect(() => {
    if (shouldRenderMap && !hasMountedMap) {
      setHasMountedMap(true)
    }
  }, [shouldRenderMap, hasMountedMap])

  const shouldMountMap = hasMapData && (hasMountedMap || shouldRenderMap)

  const isMobileWeb = Platform.OS === 'web' && width <= METRICS.breakpoints.tablet

  return (
    <>
      {Platform.OS === 'web' && (travel.travelAddress?.length ?? 0) > 0 && (
        <Suspense fallback={<Fallback />}>
          <ExcursionsLazySection>
            <View
              ref={anchors.excursions}
              style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
              collapsable={false}
              accessibilityLabel="Экскурсии"
              {...(Platform.OS === 'web' ? { 'data-section-key': 'excursions' } : {})}
            >
              <Text style={styles.sectionHeaderText}>Экскурсии</Text>
              <Text style={styles.sectionSubtitle}>Покажем экскурсии рядом с точками маршрута</Text>

              <View style={{ marginTop: 12, minHeight: 600 }}>
                <BelkrajWidgetComponent
                  countryCode={travel.countryCode}
                  points={travel.travelAddress as any}
                  collapsedHeight={600}
                />
              </View>
            </View>
          </ExcursionsLazySection>
        </Suspense>
      )}

      <View
        ref={anchors.map}
        testID="travel-details-map"
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Карта маршрута"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'map', 'data-map-for-pdf': '1' } : {})}
      >
        {Platform.OS === 'web' && (
          <View
            collapsable={false}
            // @ts-ignore
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null
              setElementRef(target as any)
            }}
          />
        )}
        <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
        <Text style={styles.sectionSubtitle}>Посмотрите последовательность точек на живой карте</Text>
        <View style={{ marginTop: 12 }}>
          {hasMapData ? (
            <ToggleableMap
              initiallyOpen={!isMobileWeb}
              keepMounted={false}
              isLoading={!shouldRenderMap}
              loadingLabel="Подгружаем карту маршрута..."
            >
              {shouldMountMap ? (
                <Suspense fallback={<MapFallback />}>
                  <MapClientSide
                    travel={{ data: travel.travelAddress as any }}
                    highlightedPointRequest={highlightedPoint}
                  />
                </Suspense>
              ) : null}
            </ToggleableMap>
          ) : (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
            </View>
          )}
        </View>
      </View>

      <View
        ref={anchors.points}
        testID="travel-details-points"
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Координаты мест"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'points' } : {})}
      >
        <Text style={styles.sectionHeaderText}>Координаты мест</Text>
        <View style={{ marginTop: 12 }}>
          {travel.travelAddress && (
            <Suspense fallback={<PointListFallback />}>
            <PointList
              points={travel.travelAddress as any}
              baseUrl={travel.url}
              travelName={travel.name}
              onPointCardPress={handlePointCardPress}
            />
            </Suspense>
          )}
        </View>
      </View>
    </>
  )
}

export default React.memo(TravelDetailsMapSection)
