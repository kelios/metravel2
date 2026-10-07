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
type RuntimeSettleVisit = {
  active: boolean
  resetKey: unknown
  disposed: boolean
  measuredHeight: number | null
  quietTimer: ReturnType<typeof setTimeout> | null
}

export function useDeferredSectionRuntimeSettle({
  active,
  resetKey,
}: {
  active: boolean
  resetKey: unknown
}) {
  const currentVisitRef = useRef<RuntimeSettleVisit | null>(null)
  // The readiness belongs to this exact active/key visit already in render.
  // A passive reset cannot safely fence the first new travel commit.
  if (!currentVisitRef.current || currentVisitRef.current.active !== active || !Object.is(currentVisitRef.current.resetKey, resetKey)) {
    currentVisitRef.current = { active, resetKey, disposed: false, measuredHeight: null, quietTimer: null }
  }
  const visit = currentVisitRef.current
  const [settledVisit, setSettledVisit] = useState<RuntimeSettleVisit | null>(null)

  const clearQuietTimer = useCallback((target: RuntimeSettleVisit) => {
    if (target.quietTimer == null) return
    clearTimeout(target.quietTimer)
    target.quietTimer = null
  }, [])

  useLayoutEffect(() => {
    visit.disposed = false
    return () => {
      visit.disposed = true
      visit.measuredHeight = null
      clearQuietTimer(visit)
    }
  }, [clearQuietTimer, visit])

  useEffect(() => {
    if (!visit.active) return undefined
    const timeoutId = setTimeout(() => {
      if (!visit.disposed && currentVisitRef.current === visit) setSettledVisit(visit)
    }, RUNTIME_SETTLE_TIMEOUT_MS)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [visit])

  const onRuntimeFrameLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!visit.active || visit.disposed || currentVisitRef.current !== visit) return
      const { height, width } = event.nativeEvent.layout
      if (height <= 0 || width <= 0) return
      const previousHeight = visit.measuredHeight
      if (previousHeight != null && Math.abs(previousHeight - height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX) return
      visit.measuredHeight = height
      clearQuietTimer(visit)
      visit.quietTimer = setTimeout(() => {
        if (!visit.disposed && currentVisitRef.current === visit) setSettledVisit(visit)
      }, RUNTIME_SETTLE_QUIET_MS)
    },
    [clearQuietTimer, visit],
  )

  return { onRuntimeFrameLayout, settled: active && settledVisit === visit }
}

type ReserveReleaseAnchor = {
  anchor: HTMLElement
  owner: HTMLElement
  beforeTop: number
}

type ReserveReleaseState = 'reserved' | 'released' | 'anchored' | 'clamped'

function connectedDOMView(ref: View | null): HTMLElement | null {
  const node = ref as unknown as HTMLElement | null
  const view = node?.ownerDocument?.defaultView
  // Native/test-renderer handles and stale/disconnected DOM refs cannot own
  // web geometry. Do not attach an observer or mutate their style as fallback.
  return view && node instanceof view.HTMLElement && node.isConnected ? node : null
}

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

function correctMeasuredAnchor(capture: ReserveReleaseAnchor | null, node: HTMLElement): ReserveReleaseState | null {
  if (!capture || !node.isConnected || !capture.anchor.isConnected || !capture.owner.isConnected || !capture.owner.contains(node) || !capture.owner.contains(capture.anchor)) return null
  const { anchor, owner, beforeTop } = capture
  const delta = anchor.getBoundingClientRect().top - beforeTop
  const currentTop = owner.scrollTop
  const targetTop = Math.max(0, Math.min(owner.scrollHeight - owner.clientHeight, currentTop + delta))
  if (targetTop !== currentTop) owner.scrollTop = targetTop
  return Math.abs(anchor.getBoundingClientRect().top - beforeTop) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX ? 'anchored' : 'clamped'
}

type TravelDetailsDeferredTransitionProps = {
  children: React.ReactNode
  isMobile: boolean
  pending: boolean
  placeholder: React.ReactNode
  reserveHeight?: number | typeof TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT
  runtimeFrameReady?: boolean
  /** Web sidebar may show its actual loading tree before the full frame settles. */
  runtimeVisibilityReady?: boolean
  testID: string
}

export function TravelDetailsDeferredTransition({
  children,
  isMobile,
  pending,
  placeholder,
  reserveHeight,
  runtimeFrameReady: controlledRuntimeFrameReady,
  runtimeVisibilityReady,
  testID,
}: TravelDetailsDeferredTransitionProps) {
  const [internalRuntimeFrameReady, setInternalRuntimeFrameReady] = useState(false)
  const [runtimeMeasured, setRuntimeMeasured] = useState(false)
  const runtimeRef = useRef<View>(null)
  const measuredHeightRef = useRef<number | null>(null)
  const observerGenerationRef = useRef(0)
  const revealCorrectionRef = useRef<ReserveReleaseState | null>(null)
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

  // Early visibility needs a pre-paint resize signal. Unsupported observers
  // retain default settle visibility instead of claiming safe early growth.
  const supportsResizeObservation = Platform.OS === 'web' && typeof ResizeObserver !== 'undefined'
  const wantsRuntimeVisible = !pending && (runtimeFrameReady || (runtimeVisibilityReady === true && supportsResizeObservation))

  // Runtime remains absolute at current width even while drawn. Its measured
  // outer border box alone owns the normal-flow height. Capture BEFORE changing
  // that height, then reconcile against the CURRENT offset/range: native browser
  // anchoring/clamping that already preserved the frame needs no second write.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const generationRef = observerGenerationRef
    const generation = ++generationRef.current
    const node = connectedDOMView(transitionRef.current)
    const runtime = connectedDOMView(runtimeRef.current)
    if (!wantsRuntimeVisible) {
      releaseAnchorRef.current = null
      revealCorrectionRef.current = null
      measuredHeightRef.current = null
      if (node) node.style.height = ''
      if (runtimeMeasured) setRuntimeMeasured(false)
      if (reserveReleaseState !== 'reserved') setReserveReleaseState('reserved')
      return
    }
    const commitMeasuredHeight = () => {
      if (generationRef.current !== generation || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime)) return
      const { width, height } = runtime.getBoundingClientRect()
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
      if (measuredHeightRef.current != null && Math.abs(measuredHeightRef.current - height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX) return
      const capture = findReserveReleaseAnchor(node)
      // This imperative geometry owner deliberately runs within ResizeObserver's
      // pre-paint callback, rather than awaiting RNW onLayout's async UIManager.
      node.style.height = `${height}px`
      measuredHeightRef.current = height
      const corrected = correctMeasuredAnchor(capture, node)
      if (corrected) {
        revealCorrectionRef.current = revealCorrectionRef.current === 'clamped' ? 'clamped' : corrected
        if (reserveReleaseState !== 'reserved' && reserveReleaseState !== 'released') setReserveReleaseState(revealCorrectionRef.current)
      }
      setRuntimeMeasured(true)
    }
    commitMeasuredHeight()
    const observer = supportsResizeObservation && node && runtime && node.contains(runtime) ? new ResizeObserver(commitMeasuredHeight) : null
    if (runtime) observer?.observe(runtime)
    return () => {
      generationRef.current++
      observer?.disconnect()
    }
  }, [children, reserveReleaseState, runtimeMeasured, supportsResizeObservation, wantsRuntimeVisible])

  // Releasing the original reserve is separate from early visibility and every
  // measured growth update. Capture prior to the React style change; correct in
  // the subsequent synchronous layout commit, before the browser can paint it.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !wantsRuntimeVisible || !runtimeMeasured || !runtimeFrameReady || reserveHeight == null) return
    const node = connectedDOMView(transitionRef.current)
    if (reserveReleaseState === 'reserved') {
      releaseAnchorRef.current = node ? findReserveReleaseAnchor(node) : null
      setReserveReleaseState('released')
      return
    }
    if (reserveReleaseState === 'released') {
      const capture = releaseAnchorRef.current
      releaseAnchorRef.current = null
      const corrected = node ? correctMeasuredAnchor(capture, node) : null
      if (revealCorrectionRef.current === 'clamped') setReserveReleaseState('clamped')
      else if (corrected) setReserveReleaseState(corrected)
    }
  }, [reserveHeight, reserveReleaseState, runtimeFrameReady, runtimeMeasured, wantsRuntimeVisible])

  if (Platform.OS !== 'web') {
    return <>{pending ? placeholder : children}</>
  }

  const runtimeIsVisible = wantsRuntimeVisible && runtimeMeasured
  const keepPlaceholder = !runtimeIsVisible
  // react-native-web forwards only an allowlist of props, so raw `data-*` never
  // reaches the DOM — `dataSet` is the supported channel and is what keeps
  // `data-deferred-transition-state` readable by the CLS guards. Spread from a
  // variable: react-native's own `ViewProps` has no `dataSet`, and a spread of a
  // non-literal skips JSX excess-property checking without an `any` cast.
  const transitionDataSet = {
    dataSet: {
      deferredTransitionState: pending
        ? 'placeholder'
        : runtimeIsVisible
          ? runtimeFrameReady ? 'runtime' : 'shown-pending'
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
        !runtimeIsVisible && styles.hiddenMeasuringBounds,
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
          ref={runtimeRef}
          onLayout={controlledRuntimeFrameReady == null ? handleRuntimeLayout : undefined}
          pointerEvents={runtimeIsVisible ? 'auto' : 'none'}
          style={[styles.webLayer, styles.isolatedRuntime, !runtimeIsVisible && styles.measuringRuntime]}
          accessibilityElementsHidden={!runtimeIsVisible}
          importantForAccessibility={runtimeIsVisible ? 'auto' : 'no-hide-descendants'}
          {...(!runtimeIsVisible ? { 'aria-hidden': true, inert: true } : {})}
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
      position: 'relative',
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
  isolatedRuntime: Platform.select({
    web: { position: 'absolute', top: 0, left: 0, right: 0 },
    default: {},
  }),
  hiddenMeasuringBounds: Platform.select({
    web: { overflow: 'hidden' },
    default: {},
  }),
  measuringRuntime: Platform.select({
    web: {
      opacity: 0,
    },
    default: {},
  }),
})
