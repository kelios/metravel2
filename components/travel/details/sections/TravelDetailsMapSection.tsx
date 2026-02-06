import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'
import { useMapLazyLoad } from '@/hooks/useMapLazyLoad'

import { MapSkeleton, PointListSkeleton } from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/types/types'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'

const PointList = withLazy(() => import('@/components/travel/PointList'))
const ToggleableMap = withLazy(() => import('@/components/travel/ToggleableMapSection'))
const TravelMap = withLazy(() =>
  import('@/components/MapPage/TravelMap').then((m) => ({ default: m.TravelMap }))
)

const WeatherWidget = withLazy(() => import('@/components/home/WeatherWidget'))

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
  scrollToMapSection: () => void
}> = ({ travel, anchors, canRenderHeavy, scrollToMapSection }) => {
  const styles = useTravelDetailsStyles()
  const { width } = useWindowDimensions()
  const hasMapData = (travel.coordsMeTravel?.length ?? 0) > 0

  const isWebAutomation =
    Platform.OS === 'web' && typeof navigator !== 'undefined' && Boolean((navigator as any).webdriver)

  // Simplified lazy loading (replaces 30+ lines with 5 lines!)
  const { shouldRender, elementRef, isLoading } = useMapLazyLoad({
    enabled: true,
    hasData: hasMapData,
    canRenderHeavy,
    rootMargin: isWebAutomation ? '800px 0px 800px 0px' : '400px 0px 400px 0px',
    threshold: isWebAutomation ? 0 : 0.1,
  })

  const colors = useThemedColors()
  const [highlightedPoint, setHighlightedPoint] = useState<{ coord: string; key: string } | null>(null)
  const [mapOpenTrigger, setMapOpenTrigger] = useState(0)
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(false)

  const handlePointCardPress = useCallback((point: any) => {
    const coord = String(point?.coord ?? '').trim()
    if (!coord) return
    setHighlightedPoint({ coord, key: `${coord}-${Date.now()}` })
    setMapOpenTrigger((prev) => prev + 1)
    scrollToMapSection()
  }, [scrollToMapSection])


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
        ref={(node) => {
          (anchors.map as any).current = node
          if (Platform.OS === 'web') {
            elementRef(node)
          }
        }}
        testID="travel-details-map"
        style={[
          styles.sectionContainer,
          styles.contentStable,
          styles.webDeferredSection,
          Platform.OS === 'web' ? ({ minHeight: 420 } as any) : null,
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
        <View style={{ marginTop: 12 }}>
          {hasMapData ? (
            <ToggleableMap
              initiallyOpen={!isMobileWeb}
              keepMounted={Platform.OS === 'web'}
              isLoading={isLoading && !shouldRender}
              loadingLabel="Подгружаем карту маршрута..."
              forceOpenTrigger={mapOpenTrigger || undefined}
              onOpenChange={(open) => {
                if (Platform.OS !== 'web') return
                if (open) {
                  setMapResizeTrigger((prev) => prev + 1)
                }
              }}
            >
              {shouldRender ? (
                <Suspense fallback={<MapFallback />}>
                  <TravelMap
                    travelData={travel.travelAddress as any}
                    highlightedPoint={highlightedPoint ?? undefined}
                    resizeTrigger={mapResizeTrigger}
                    compact
                    height={isMobileWeb ? 400 : 500}
                  />
                </Suspense>
              ) : (
                <MapFallback />
              )}
            </ToggleableMap>
          ) : (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
            </View>
          )}
        </View>
      </View>

      {/* 4.3: WeatherWidget — unified across all devices, lazy via button */}
      {travel.travelAddress && (travel.travelAddress as any[]).length > 0 && !isWebAutomation && (
        <View
          accessibilityRole="none"
          accessibilityLabel="Погода"
          style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        >
          <Text style={styles.sectionHeaderText}>Погода</Text>
          {!weatherVisible ? (
            <Pressable
              onPress={() => setWeatherVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Показать погоду"
              style={({ pressed }) => [{
                minHeight: 44,
                borderRadius: DESIGN_TOKENS.radii.md,
                paddingHorizontal: DESIGN_TOKENS.spacing.md,
                paddingVertical: DESIGN_TOKENS.spacing.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                alignSelf: 'flex-start',
                marginTop: DESIGN_TOKENS.spacing.sm,
              } as any]}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
                Показать погоду
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: DESIGN_TOKENS.spacing.sm }}>
              <Suspense fallback={<View style={{ minHeight: 120 }} />}>
                <WeatherWidget points={travel.travelAddress as any} />
              </Suspense>
            </View>
          )}
        </View>
      )}

      {travel.travelAddress && (travel.travelAddress as any[]).length > 0 && (
        <View
          ref={anchors.points}
          testID="travel-details-points"
          style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
          collapsable={false}
          accessibilityLabel="Координаты мест"
          {...(Platform.OS === 'web'
            ? { 'data-testid': 'travel-details-points', 'data-section-key': 'points' }
            : {})}
        >
          <Text style={styles.sectionHeaderText}>Координаты мест</Text>
          <View style={{ marginTop: 12 }}>
            <Suspense fallback={<PointListFallback />}>
              <PointList
                points={travel.travelAddress as any}
                baseUrl={travel.url}
                travelName={travel.name}
                onPointCardPress={handlePointCardPress}
              />
            </Suspense>
          </View>
        </View>
      )}
    </>
  )
}

export default React.memo(TravelDetailsMapSection)
