import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import {
  AuthorSectionSkeleton,
  CommentsSkeleton,
  FooterSectionSkeleton,
  MapSectionSkeleton,
  RatingSectionSkeleton,
  SidebarSectionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'

// Shared by every reserved deferred section (footer #1604, sidebar and comments
// #1642): a full viewport of reserve keeps whatever follows the section below
// the fold, so releasing the reserve cannot move anything the user can see.
export const TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT = '100vh' as const

// A deferred section is "settled" once its real frame stops resizing, not when
// it first paints: comments render their header long before the thread, and the
// sidebar keeps growing while `Рядом`/`Популярные` resolve. The timeout is the
// fail-open valve — a section whose data never arrives must still become
// interactive instead of staying behind an inert placeholder forever.
const RUNTIME_SETTLE_QUIET_MS = 320
const RUNTIME_SETTLE_TIMEOUT_MS = 6000
const RUNTIME_SETTLE_HEIGHT_EPSILON_PX = 1

/**
 * Latches "the real frame stopped moving" for a deferred section. The caller
 * hands `onRuntimeFrameLayout` to the section's own outer frame — never to the
 * grid layer, which CSS stretches to the reserved row height and would report
 * the reserve instead of the content.
 */
export function useDeferredSectionRuntimeSettle({
  active,
  resetKey,
}: {
  active: boolean
  resetKey: unknown
}) {
  const [settled, setSettled] = useState(false)
  const measuredHeightRef = useRef<number | null>(null)
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearQuietTimer = useCallback(() => {
    if (quietTimerRef.current == null) return
    clearTimeout(quietTimerRef.current)
    quietTimerRef.current = null
  }, [])

  useEffect(() => {
    setSettled(false)
    measuredHeightRef.current = null
    clearQuietTimer()
    if (!active) return undefined

    const timeoutId = setTimeout(() => setSettled(true), RUNTIME_SETTLE_TIMEOUT_MS)
    return () => clearTimeout(timeoutId)
  }, [active, clearQuietTimer, resetKey])

  useEffect(() => clearQuietTimer, [clearQuietTimer])

  const onRuntimeFrameLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!active) return
      const { height, width } = event.nativeEvent.layout
      if (height <= 0 || width <= 0) return
      const previousHeight = measuredHeightRef.current
      if (
        previousHeight != null &&
        Math.abs(previousHeight - height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX
      ) {
        return
      }
      measuredHeightRef.current = height
      clearQuietTimer()
      quietTimerRef.current = setTimeout(() => setSettled(true), RUNTIME_SETTLE_QUIET_MS)
    },
    [active, clearQuietTimer],
  )

  return { onRuntimeFrameLayout, settled: settled && active }
}

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
      // react-native-web forwards only an allowlist of props, so raw `data-*`
      // never reaches the DOM — `dataSet` is the supported channel and is what
      // keeps `data-deferred-transition-state` readable by the CLS guards.
      {...({
        dataSet: {
          deferredTransitionState: pending
            ? 'placeholder'
            : runtimeFrameReady
              ? 'runtime'
              : 'measuring-runtime',
          deferredTransitionMobile: String(isMobile),
        },
      } as any)}
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
