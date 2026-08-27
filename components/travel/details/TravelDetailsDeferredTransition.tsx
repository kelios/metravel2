import React, { useCallback, useEffect, useState } from 'react'
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import {
  AuthorSectionSkeleton,
  CommentsSkeleton,
  FooterSectionSkeleton,
  MapSectionSkeleton,
  RatingSectionSkeleton,
  SidebarSectionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'

export const TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT = '100vh' as const

type TravelDetailsDeferredTransitionProps = {
  children: React.ReactNode
  isMobile: boolean
  pending: boolean
  placeholder: React.ReactNode
  reserveHeight?: number | typeof TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT
  runtimeFrameReady?: boolean
  testID: string
}

export function TravelDetailsDeferredTransition({
  children,
  isMobile,
  pending,
  placeholder,
  reserveHeight,
  runtimeFrameReady: controlledRuntimeFrameReady,
  testID,
}: TravelDetailsDeferredTransitionProps) {
  const [internalRuntimeFrameReady, setInternalRuntimeFrameReady] = useState(false)

  useEffect(() => {
    if (pending) setInternalRuntimeFrameReady(false)
  }, [pending])

  const handleRuntimeLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (controlledRuntimeFrameReady != null) return
      const { height, width } = event.nativeEvent.layout
      if (height > 0 && width > 0) setInternalRuntimeFrameReady(true)
    },
    [controlledRuntimeFrameReady],
  )

  const runtimeFrameReady = controlledRuntimeFrameReady ?? internalRuntimeFrameReady

  if (Platform.OS !== 'web') {
    return <>{pending ? placeholder : children}</>
  }

  const keepPlaceholder = pending || !runtimeFrameReady

  return (
    <View
      testID={testID}
      style={[
        styles.webTransition,
        reserveHeight == null || runtimeFrameReady
          ? null
          : ({ minHeight: reserveHeight } as never),
      ]}
      {...{
        'data-deferred-transition-state': pending
          ? 'placeholder'
          : runtimeFrameReady
            ? 'runtime'
            : 'measuring-runtime',
        'data-deferred-transition-mobile': String(isMobile),
      }}
    >
      {keepPlaceholder ? (
        <View
          testID={`${testID}-placeholder`}
          pointerEvents="none"
          style={styles.webLayer}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...{ 'aria-hidden': true }}
        >
          {placeholder}
        </View>
      ) : null}

      {!pending ? (
        <View
          testID={`${testID}-runtime`}
          onLayout={controlledRuntimeFrameReady == null ? handleRuntimeLayout : undefined}
          pointerEvents={runtimeFrameReady ? 'auto' : 'none'}
          style={[styles.webLayer, !runtimeFrameReady && styles.measuringRuntime]}
          accessibilityElementsHidden={!runtimeFrameReady}
          importantForAccessibility={runtimeFrameReady ? 'auto' : 'no-hide-descendants'}
          {...(!runtimeFrameReady ? { 'aria-hidden': true, inert: true } : {})}
        >
          {children}
        </View>
      ) : null}
    </View>
  )
}

export function TravelDetailsDeferredSectionsSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <View>{isMobile ? <AuthorSectionSkeleton /> : null}</View>
      <View>
        <RatingSectionSkeleton />
      </View>
      <View>
        <MapSectionSkeleton />
      </View>
      <View>
        <SidebarSectionSkeleton />
      </View>
      <View>
        <CommentsSkeleton />
      </View>
      <View style={{ minHeight: TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT } as never}>
        <FooterSectionSkeleton isMobile={isMobile} />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  webTransition: Platform.select({
    web: {
      display: 'grid',
      minWidth: 0,
      width: '100%',
    } as never,
    default: {},
  }),
  webLayer: Platform.select({
    web: {
      gridArea: '1 / 1',
      minWidth: 0,
      width: '100%',
    } as never,
    default: {},
  }),
  measuringRuntime: Platform.select({
    web: {
      opacity: 0,
    },
    default: {},
  }),
})
