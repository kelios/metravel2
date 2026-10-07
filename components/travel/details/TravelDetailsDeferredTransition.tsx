import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// #1642). Resolving a short frame can still move a visible following section
// when the user has reached the bottom. Release uses its measured viewport
// anchor and the actual inner scroll owner, before paint (#2329).
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

type ReserveReleaseAnchor = {
  anchor: HTMLElement
  owner: HTMLElement
  beforeTop: number
}

type ReserveReleaseState = 'reserved' | 'released' | 'anchored' | 'clamped'

function findReserveReleaseAnchor(node: HTMLElement): ReserveReleaseAnchor | null {
  if (!node.isConnected) return null
  const view = node.ownerDocument.defaultView
  if (!view) return null
  let owner = node.parentElement
  while (owner) {
    const overflowY = view.getComputedStyle(owner).overflowY
    if (/^(auto|scroll)$/.test(overflowY) && owner.scrollHeight > owner.clientHeight) break
    owner = owner.parentElement
  }
  if (!owner || owner.clientHeight <= 0) return null

  // The transition sits inside a section wrapper. Walk only within this owner
  // to the first genuine following flow frame, never to the window/body.
  let frame: HTMLElement | null = node
  let anchor: HTMLElement | null = null
  while (frame && frame !== owner) {
    let sibling = frame.nextElementSibling
    while (sibling) {
      if (sibling instanceof view.HTMLElement) {
        const rect = sibling.getBoundingClientRect()
        const position = view.getComputedStyle(sibling).position
        if (!/^(absolute|fixed|sticky)$/.test(position) && rect.width > 0 && rect.height > 0) {
          anchor = sibling
          break
        }
      }
      sibling = sibling.nextElementSibling
    }
    if (anchor) break
    frame = frame.parentElement
  }
  if (!anchor || !owner.contains(anchor)) return null
  const ownerRect = owner.getBoundingClientRect()
  const rect = anchor.getBoundingClientRect()
  const top = Math.max(0, ownerRect.top + owner.clientTop)
  const bottom = Math.min(view.innerHeight, ownerRect.top + owner.clientTop + owner.clientHeight)
  const left = Math.max(0, ownerRect.left + owner.clientLeft)
  const right = Math.min(view.innerWidth, ownerRect.left + owner.clientLeft + owner.clientWidth)
  if (bottom <= top || right <= left || rect.bottom <= top || rect.top >= bottom || rect.right <= left || rect.left >= right) return null
  return { anchor, owner, beforeTop: rect.top }
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
  const [reserveReleaseState, setReserveReleaseState] = useState<ReserveReleaseState>('reserved')
  const transitionRef = useRef<View>(null)
  const releaseAnchorRef = useRef<ReserveReleaseAnchor | null>(null)

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

  // Both state commits and the measured correction flush in layout effects,
  // before the browser can paint the shortened flow. Readiness/timers are not
  // changed; only the removal of an already existing reserve is ordered here.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || reserveHeight == null) return
    if (pending || !runtimeFrameReady) {
      releaseAnchorRef.current = null
      if (reserveReleaseState !== 'reserved') setReserveReleaseState('reserved')
      return
    }
    const node = transitionRef.current as unknown as HTMLElement | null
    if (reserveReleaseState === 'reserved') {
      releaseAnchorRef.current = node ? findReserveReleaseAnchor(node) : null
      setReserveReleaseState('released')
      return
    }
    const capture = releaseAnchorRef.current
    releaseAnchorRef.current = null
    if (!capture || !node?.isConnected || !capture.anchor.isConnected || !capture.owner.isConnected || !capture.owner.contains(node) || !capture.owner.contains(capture.anchor)) return
    const { anchor, owner, beforeTop } = capture
    const delta = anchor.getBoundingClientRect().top - beforeTop
    // Browser anchoring/clamping may already have corrected part or all of the
    // shrink. Use its CURRENT offset, never the stale pre-release scrollTop.
    const currentTop = owner.scrollTop
    const targetTop = Math.max(0, Math.min(owner.scrollHeight - owner.clientHeight, currentTop + delta))
    if (targetTop !== currentTop) owner.scrollTop = targetTop
    const residual = Math.abs(anchor.getBoundingClientRect().top - beforeTop)
    setReserveReleaseState(residual <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX ? 'anchored' : 'clamped')
  }, [pending, reserveHeight, reserveReleaseState, runtimeFrameReady])

  if (Platform.OS !== 'web') {
    return <>{pending ? placeholder : children}</>
  }

  const keepPlaceholder = pending || !runtimeFrameReady
  // react-native-web forwards only an allowlist of props, so raw `data-*` never
  // reaches the DOM — `dataSet` is the supported channel and is what keeps
  // `data-deferred-transition-state` readable by the CLS guards. Spread from a
  // variable: react-native's own `ViewProps` has no `dataSet`, and a spread of a
  // non-literal skips JSX excess-property checking without an `any` cast.
  const transitionDataSet = {
    dataSet: {
      deferredTransitionState: pending
        ? 'placeholder'
        : runtimeFrameReady
          ? 'runtime'
          : 'measuring-runtime',
      deferredTransitionMobile: String(isMobile),
      reserveReleaseState: reserveHeight == null ? 'not-reserved' : reserveReleaseState,
    },
  }

  return (
    <View
      testID={testID}
      ref={transitionRef}
      style={[
        styles.webTransition,
        reserveHeight == null || (runtimeFrameReady && !pending && reserveReleaseState !== 'reserved')
          ? null
          : ({ minHeight: reserveHeight } as never),
      ]}
      {...transitionDataSet}
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
