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

type MeasuredReserveSlack = {
  height: number
  width: number
  owner: HTMLElement
  runtime: HTMLElement
  reserveHeight: number | typeof TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT | undefined
  minHeight: string
  viewportHeight: number
  ownerWidth: number
  ownerHeight: number
}

// Absolute runtimes can contain other measured transitions. Their reserves can
// preserve their measured reserve slack so leaf and ancestor flow grow together.
// The highest measured owner with a visible following frame owns the anchor. Fall back to the leaf when no
// ancestor has one, then commit all heights before a single correction.
const measuredTransitions = new WeakMap<HTMLElement, {
  measure: () => boolean
  hasResponsiveWidthChange: () => boolean
  captureReserveSlack: () => void
}>()

function measureAncestorTransitions(node: HTMLElement) {
  const owner = findMeasuredScrollOwner(node)
  let ancestor = node.parentElement
  while (ancestor && ancestor !== owner) {
    measuredTransitions.get(ancestor)?.measure()
    ancestor = ancestor.parentElement
  }
}

function captureAncestorReserveSlack(node: HTMLElement) {
  const owner = findMeasuredScrollOwner(node)
  let ancestor = node.parentElement
  while (ancestor && ancestor !== owner) {
    measuredTransitions.get(ancestor)?.captureReserveSlack()
    ancestor = ancestor.parentElement
  }
}

// When releasing conserved slack, a drawn runtime is a fallback only if no
// visible following frame owns the transaction. Its post-insertion aggregate
// bounds cannot identify the reading anchor for a runtime payload mutation.
function findRuntimeReadingAnchor(node: HTMLElement, runtime: HTMLElement | null): ReserveReleaseAnchor | null {
  const owner = findMeasuredScrollOwner(node)
  const view = node.ownerDocument.defaultView
  if (!owner || !view || !runtime?.isConnected || !node.contains(runtime)) return null
  const bounds = owner.getBoundingClientRect()
  for (const child of Array.from(runtime.children)) {
    if (!(child instanceof view.HTMLElement)) continue
    const rect = child.getBoundingClientRect()
    if (/^(absolute|fixed|sticky)$/.test(view.getComputedStyle(child).position)) continue
    if (rect.width > 0 && rect.height > 0 &&
        rect.bottom > Math.max(0, bounds.top + owner.clientTop) && rect.top < Math.min(view.innerHeight, bounds.top + owner.clientTop + owner.clientHeight) &&
        rect.right > Math.max(0, bounds.left + owner.clientLeft) && rect.left < Math.min(view.innerWidth, bounds.left + owner.clientLeft + owner.clientWidth) &&
        isDrawnWithinOwner(child, owner)) return { anchor: child, owner, beforeTop: rect.top }
  }
  return null
}

function connectedDOMView(ref: View | null): HTMLElement | null {
  const node = ref as unknown as HTMLElement | null
  const view = node?.ownerDocument?.defaultView
  // Native/test-renderer handles and stale/disconnected DOM refs cannot own
  // web geometry. Do not attach an observer or mutate their style as fallback.
  return view && node instanceof view.HTMLElement && node.isConnected ? node : null
}

function isDrawnWithinOwner(node: HTMLElement, owner: HTMLElement): boolean {
  const view = node.ownerDocument.defaultView
  if (!view) return false
  let frame: HTMLElement | null = node
  while (frame) {
    const style = view.getComputedStyle(frame)
    if (style.opacity === '0' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none') return false
    if (frame === owner) return true
    frame = frame.parentElement
  }
  return false
}

function findMeasuredScrollOwner(node: HTMLElement): HTMLElement | null {
  const view = node.ownerDocument.defaultView
  if (!node.isConnected || !view) return null
  let owner = node.parentElement
  while (owner) {
    const overflowY = view.getComputedStyle(owner).overflowY
    if (/^(auto|scroll)$/.test(overflowY) && owner.scrollHeight > owner.clientHeight) break
    owner = owner.parentElement
  }
  return owner
}

function findReserveReleaseAnchor(node: HTMLElement): ReserveReleaseAnchor | null {
  const view = node.ownerDocument.defaultView
  const owner = findMeasuredScrollOwner(node)
  if (!view) return null
  if (!owner || owner.clientHeight <= 0) return null
  const ownerRect = owner.getBoundingClientRect()
  const top = Math.max(0, ownerRect.top + owner.clientTop)
  const bottom = Math.min(view.innerHeight, ownerRect.top + owner.clientTop + owner.clientHeight)
  const left = Math.max(0, ownerRect.left + owner.clientLeft)
  const right = Math.min(view.innerWidth, ownerRect.left + owner.clientLeft + owner.clientWidth)
  if (bottom <= top || right <= left) return null

  // The transition sits inside a section wrapper. Walk only within this owner
  // to the first visible following flow frame, never to the window/body.
  let frame: HTMLElement | null = node
  let anchor: HTMLElement | null = null
  while (frame && frame !== owner) {
    let sibling = frame.nextElementSibling
    while (sibling) {
      if (sibling instanceof view.HTMLElement) {
        const rect = sibling.getBoundingClientRect()
        const position = view.getComputedStyle(sibling).position
        if (!/^(absolute|fixed|sticky)$/.test(position) && rect.width > 0 && rect.height > 0 &&
            rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right &&
            isDrawnWithinOwner(sibling, owner)) {
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
  const rect = anchor.getBoundingClientRect()
  return { anchor, owner, beforeTop: rect.top }
}

function findMeasuredTransactionAnchor(node: HTMLElement): ReserveReleaseAnchor | null {
  const owner = findMeasuredScrollOwner(node)
  if (!owner) return null
  if (measuredTransitions.get(node)?.hasResponsiveWidthChange()) return null
  let capture = findReserveReleaseAnchor(node)
  let ancestor = node.parentElement
  while (ancestor && ancestor !== owner) {
    const transition = measuredTransitions.get(ancestor)
    if (transition) {
      if (transition.hasResponsiveWidthChange()) return null
      const following = findReserveReleaseAnchor(ancestor)
      if (following) capture = following
    }
    ancestor = ancestor.parentElement
  }
  return capture
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
  /** Optional sections may measure zero before data arrives or after it clears. */
  allowEmptyRuntime?: boolean
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
  allowEmptyRuntime = false,
  testID,
}: TravelDetailsDeferredTransitionProps) {
  const [internalRuntimeFrameReady, setInternalRuntimeFrameReady] = useState(false)
  const [runtimeMeasured, setRuntimeMeasured] = useState(false)
  const [optionalFlowFallback, setOptionalFlowFallback] = useState(false)
  const runtimeRef = useRef<View>(null)
  const measuredHeightRef = useRef<number | null>(null)
  const measuredWidthRef = useRef<number | null>(null)
  const reserveSlackRef = useRef<MeasuredReserveSlack | null>(null)
  const currentReserveSlackCaptureRef = useRef<(() => void) | null>(null)
  const currentMeasureRef = useRef<(() => boolean) | null>(null)
  const currentResponsiveWidthChangeRef = useRef<(() => boolean) | null>(null)
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
  const useOptionalFlowFallback = allowEmptyRuntime && !supportsResizeObservation && optionalFlowFallback
  const wantsRuntimeVisible = !useOptionalFlowFallback && !pending && (runtimeFrameReady || (runtimeVisibilityReady === true && supportsResizeObservation))

  useLayoutEffect(() => {
    if (Platform.OS === 'web') setOptionalFlowFallback(allowEmptyRuntime && !supportsResizeObservation)
  }, [allowEmptyRuntime, supportsResizeObservation])

  // Keep geometry ownership registered for the DOM lifetime. React cleans up
  // child-dependent effects before running the next leaf layout effect; deleting
  // parent ownership there would make that leaf capture the wrong inner frame.
  // Registered measurements validate current drawn DOM; observer callbacks keep
  // their captured generation fence.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const node = connectedDOMView(transitionRef.current)
    if (!node) return
    const transition = {
      measure: () => currentMeasureRef.current?.() ?? false,
      hasResponsiveWidthChange: () => currentResponsiveWidthChangeRef.current?.() ?? false,
      captureReserveSlack: () => currentReserveSlackCaptureRef.current?.(),
    }
    measuredTransitions.set(node, transition)
    return () => {
      if (measuredTransitions.get(node) === transition) measuredTransitions.delete(node)
    }
  }, [])

  // Runtime remains absolute at current width even while drawn. Its measured
  // outer border box plus current drawn reserve slack owns normal-flow height. Capture BEFORE changing
  // that height, then reconcile against the CURRENT offset/range: native browser
  // anchoring/clamping that already preserved the frame needs no second write.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const generationRef = observerGenerationRef
    const generation = ++generationRef.current
    currentMeasureRef.current = null
    currentResponsiveWidthChangeRef.current = null
    currentReserveSlackCaptureRef.current = null
    const node = connectedDOMView(transitionRef.current)
    const runtime = connectedDOMView(runtimeRef.current)
    if (!wantsRuntimeVisible) {
      releaseAnchorRef.current = null
      revealCorrectionRef.current = null
      measuredHeightRef.current = null
      measuredWidthRef.current = null
      reserveSlackRef.current = null
      if (node) node.style.height = ''
      if (runtimeMeasured) setRuntimeMeasured(false)
      if (reserveReleaseState !== 'reserved') setReserveReleaseState('reserved')
      return
    }
    const reserveSlackMatchesFrame = (slack: MeasuredReserveSlack) => !!node && !!runtime &&
      slack.runtime === runtime && slack.owner === findMeasuredScrollOwner(node) && slack.reserveHeight === reserveHeight &&
      slack.viewportHeight === node.ownerDocument.defaultView?.innerHeight && slack.ownerWidth === slack.owner.clientWidth && slack.ownerHeight === slack.owner.clientHeight &&
      (node.dataset.reserveReleaseState !== 'reserved' || slack.minHeight === node.ownerDocument.defaultView?.getComputedStyle(node).minHeight) &&
      Math.abs(slack.width - runtime.getBoundingClientRect().width) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX
    const measureRuntimeHeight = (expectedGeneration = generation) => {
      if (generationRef.current !== expectedGeneration || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime)) return false
      const { width, height } = runtime.getBoundingClientRect()
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height < 0 || (!allowEmptyRuntime && height === 0)) return false
      const slack = reserveSlackRef.current
      if (slack && !reserveSlackMatchesFrame(slack)) reserveSlackRef.current = null
      const flowHeight = height + (node.dataset.reserveReleaseState === 'reserved' ? reserveSlackRef.current?.height ?? 0 : 0)
      measuredWidthRef.current = width
      if (measuredHeightRef.current != null && Math.abs(measuredHeightRef.current - height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX && Math.abs(Number.parseFloat(node.style.height) - flowHeight) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX) return false
      // This imperative geometry owner deliberately runs within ResizeObserver's
      // pre-paint callback, rather than awaiting RNW onLayout's async UIManager.
      node.style.height = `${flowHeight}px`
      measuredHeightRef.current = height
      if (node.dataset.reserveReleaseState !== 'reserved') reserveSlackRef.current = null
      setRuntimeMeasured(true)
      return true
    }
    // A settled responsive frame reflows following content outside this height
    // transaction. Keep browser responsive anchoring; only same-width content
    // changes and the initial reserve release own an isolated anchor target.
    currentResponsiveWidthChangeRef.current = () => {
      // React cleans up parent effects before a leaf's layout commit. This
      // read-only DOM check still describes that connected parent's width;
      // only the imperative measurement requires the current generation.
      if (!runtimeFrameReady || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime) || measuredWidthRef.current == null) return false
      const width = runtime.getBoundingClientRect().width
      return Number.isFinite(width) && width > 0 && Math.abs(measuredWidthRef.current - width) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX
    }
    currentReserveSlackCaptureRef.current = () => {
      if (reserveSlackRef.current && !reserveSlackMatchesFrame(reserveSlackRef.current)) {
        reserveSlackRef.current = null
        return
      }
      if (reserveSlackRef.current || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime) ||
          node.dataset.reserveReleaseState !== 'reserved' || !/^(runtime|shown-pending)$/.test(node.dataset.deferredTransitionState ?? '') || measuredHeightRef.current == null) return
      const owner = findMeasuredScrollOwner(node)
      const view = node.ownerDocument.defaultView
      const width = runtime.getBoundingClientRect().width
      const flowHeight = node.getBoundingClientRect().height
      if (!owner || !view || !Number.isFinite(width) || width <= 0 || measuredWidthRef.current == null || Math.abs(width - measuredWidthRef.current) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX || !Number.isFinite(flowHeight)) return
      // Latch the prior drawn flow difference once, before any nested height
      // write. Subsequent measurements add this difference without collecting
      // it again from a flow height which already includes conserved slack.
      const height = Math.max(0, flowHeight - measuredHeightRef.current)
      if (height > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) reserveSlackRef.current = {
        height, width, owner, runtime, reserveHeight, minHeight: view.getComputedStyle(node).minHeight,
        viewportHeight: view.innerHeight, ownerWidth: owner.clientWidth, ownerHeight: owner.clientHeight,
      }
    }
    const commitMeasuredHeight = () => {
      if (!node || generationRef.current !== generation) return
      const obsoleteSlack = !!reserveSlackRef.current && !reserveSlackMatchesFrame(reserveSlackRef.current)
      if (obsoleteSlack) reserveSlackRef.current = null
      const nextHeight = runtime?.getBoundingClientRect().height
      if (nextHeight != null && Math.abs(nextHeight - (measuredHeightRef.current ?? 0)) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) {
        if (!obsoleteSlack) currentReserveSlackCaptureRef.current?.()
        captureAncestorReserveSlack(node)
      }
      const capture = obsoleteSlack ? null : findMeasuredTransactionAnchor(node)
      if (!measureRuntimeHeight()) return
      measureAncestorTransitions(node)
      const corrected = correctMeasuredAnchor(capture, node)
      if (corrected) {
        revealCorrectionRef.current = revealCorrectionRef.current === 'clamped' ? 'clamped' : corrected
        if ((allowEmptyRuntime && reserveHeight == null) || (reserveReleaseState !== 'reserved' && reserveReleaseState !== 'released')) setReserveReleaseState(revealCorrectionRef.current)
      }
    }
    // Child-dependent React cleanup may precede a leaf layout commit. The
    // registry owns this still-connected drawn DOM; stale observer callbacks
    // remain fenced by their captured generation above.
    currentMeasureRef.current = () => {
      const owner = node ? findMeasuredScrollOwner(node) : null
      return owner && runtime && isDrawnWithinOwner(runtime, owner) ? measureRuntimeHeight(generationRef.current) : false
    }
    commitMeasuredHeight()
    const observer = supportsResizeObservation && node && runtime && node.contains(runtime) ? new ResizeObserver(commitMeasuredHeight) : null
    if (runtime) observer?.observe(runtime)
    return () => {
      generationRef.current++
      observer?.disconnect()
    }
  }, [allowEmptyRuntime, children, reserveHeight, reserveReleaseState, runtimeFrameReady, runtimeMeasured, supportsResizeObservation, wantsRuntimeVisible])

  // Releasing the original reserve is separate from early visibility and every
  // measured growth update. Capture prior to the React style change; correct in
  // the subsequent synchronous layout commit, before the browser can paint it.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !wantsRuntimeVisible || !runtimeMeasured || !runtimeFrameReady || reserveHeight == null) return
    const node = connectedDOMView(transitionRef.current)
    if (reserveReleaseState === 'reserved') {
      releaseAnchorRef.current = node ? findMeasuredTransactionAnchor(node) ??
        (reserveSlackRef.current ? findRuntimeReadingAnchor(node, connectedDOMView(runtimeRef.current)) : null) : null
      setReserveReleaseState('released')
      return
    }
    if (reserveReleaseState === 'released') {
      const capture = releaseAnchorRef.current
      releaseAnchorRef.current = null
      if (node) measureAncestorTransitions(node)
      const corrected = node ? correctMeasuredAnchor(capture, node) : null
      if (revealCorrectionRef.current === 'clamped') setReserveReleaseState('clamped')
      else if (corrected) setReserveReleaseState(corrected)
    }
  }, [reserveHeight, reserveReleaseState, runtimeFrameReady, runtimeMeasured, wantsRuntimeVisible])

  if (Platform.OS !== 'web') {
    return <>{pending ? placeholder : children}</>
  }

  if (useOptionalFlowFallback) {
    return <View ref={transitionRef} testID={testID}>{pending ? placeholder : children}</View>
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
      reserveReleaseState: reserveHeight == null && (!allowEmptyRuntime || reserveReleaseState === 'reserved') ? 'not-reserved' : reserveReleaseState,
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
