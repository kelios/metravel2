import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type ViewInstance, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import {
  RUNTIME_SETTLE_HEIGHT_EPSILON_PX,
  type ReserveReleaseAnchor,
  claimOwnerRelease,
  connectedDOMView,
  findMeasuredScrollOwner,
  findReserveReleaseAnchor,
  findRuntimeReadingAnchor,
  heldSlackPlacement,
  isDrawnWithinOwner,
  isReserveSlackVisible,
  noteOwnerScrollWrite,
  ownerFrameKnown,
  ownerScrolledInCurrentFrame,
  ownerScrolledInFrame,
  startsBelowReadingLine,
  watchOwnerScroll,
} from './travelDetailsDeferredGeometry'

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
const RESERVE_RELEASE_SCROLL_QUIET_MS = 100

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
  payloadState: () => 'settled' | 'pending' | 'unknown'
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

function findMeasuredTransactionAnchor(node: HTMLElement, initialMeasurement = false): ReserveReleaseAnchor | null {
  const owner = findMeasuredScrollOwner(node)
  if (!owner) return null
  if (measuredTransitions.get(node)?.hasResponsiveWidthChange()) return null
  let capture = findReserveReleaseAnchor(node)
  // Where the height change enters the flow. A fresh ancestor payload inserts
  // siblings anywhere inside that ancestor, so its start bounds the change.
  let origin = node
  let ancestor = node.parentElement
  while (ancestor && ancestor !== owner) {
    const transition = measuredTransitions.get(ancestor)
    if (transition) {
      if (transition.hasResponsiveWidthChange()) return null
      const following = findReserveReleaseAnchor(ancestor)
      // A first measurement cannot treat new payload siblings as prior anchors.
      // Later measurements have a published reading frame; ancestor differences
      // can then be existing nested flow/reserve changes, not a fresh payload.
      const freshPayload = initialMeasurement && transition.payloadState() !== 'settled'
      if (freshPayload || following) capture = following
      if (freshPayload) origin = ancestor
    } else if (initialMeasurement && ancestor.hasAttribute('data-deferred-transition-state')) {
      // React commits child layout effects before a new parent's refs/registry.
      // Publish sizes normally, but let that parent own its first correction.
      capture = findReserveReleaseAnchor(ancestor)
      origin = ancestor
    }
    ancestor = ancestor.parentElement
  }
  // The first measurement replaces a placeholder wholesale, and an ancestor
  // payload starts at that ancestor: only this node's own later growth appends.
  const appends = !initialMeasurement && origin === node && node.dataset.deferredGrowthOrigin === 'end'
  return capture && startsBelowReadingLine(origin, owner, appends) ? null : capture
}

function correctMeasuredAnchor(capture: ReserveReleaseAnchor | null, node: HTMLElement): ReserveReleaseState | null {
  if (!capture || !node.isConnected || !capture.anchor.isConnected || !capture.owner.isConnected || !capture.owner.contains(node) || !capture.owner.contains(capture.anchor)) return null
  const { anchor, owner, beforeTop } = capture
  const delta = anchor.getBoundingClientRect().top - beforeTop
  const currentTop = owner.scrollTop
  // At the owner top the reader is looking at the page start (title, hero).
  // Growth there must push the following frame down; preserving that frame
  // would scroll the reader past the start of a freshly opened article (#2772).
  if (currentTop <= 0 && delta > 0) return null
  const targetTop = Math.max(0, Math.min(owner.scrollHeight - owner.clientHeight, currentTop + delta))
  if (targetTop !== currentTop) {
    owner.scrollTop = targetTop
    noteOwnerScrollWrite(owner)
  }
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
  /**
   * Where later growth of the resolved runtime enters the flow. `end` is for a
   * block that keeps its content and appends below it; the default treats the
   * whole block as changed from its start.
   */
  growthOrigin?: 'end'
  testID: string
}

type TravelDetailsMeasuredFlowProps = Pick<
  TravelDetailsDeferredTransitionProps,
  'children' | 'growthOrigin' | 'isMobile' | 'testID'
> & {
  pending?: boolean
  placeholder?: React.ReactNode
}

export function TravelDetailsMeasuredFlow({
  children,
  growthOrigin,
  isMobile,
  testID,
  pending = false,
  placeholder = null,
}: TravelDetailsMeasuredFlowProps) {
  return (
    <TravelDetailsDeferredTransition
      isMobile={isMobile}
      testID={testID}
      pending={pending}
      placeholder={placeholder}
      growthOrigin={growthOrigin}
      runtimeFrameReady
      allowEmptyRuntime
    >
      {children}
    </TravelDetailsDeferredTransition>
  )
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
  growthOrigin,
  testID,
}: TravelDetailsDeferredTransitionProps) {
  const [internalRuntimeFrameReady, setInternalRuntimeFrameReady] = useState(false)
  const [runtimeMeasured, setRuntimeMeasured] = useState(false)
  const [optionalFlowFallback, setOptionalFlowFallback] = useState(false)
  const runtimeRef = useRef<ViewInstance>(null)
  const placeholderRef = useRef<ViewInstance>(null)
  // Occupied flow height kept after the frame shrank (#3430): the shrink lands
  // below the viewport, or under the anchor in a frame without an owner scroll
  // once the section settled — never as a free move of drawn content.
  const heldFlowRef = useRef<number | null>(null)
  const measuredHeightRef = useRef<number | null>(null)
  const measuredWidthRef = useRef<number | null>(null)
  const reserveSlackRef = useRef<MeasuredReserveSlack | null>(null)
  const currentReserveSlackCaptureRef = useRef<(() => void) | null>(null)
  const currentMeasureRef = useRef<(() => boolean) | null>(null)
  const currentResponsiveWidthChangeRef = useRef<(() => boolean) | null>(null)
  const observerGenerationRef = useRef(0)
  const revealCorrectionRef = useRef<ReserveReleaseState | null>(null)
  const [reserveReleaseState, setReserveReleaseState] = useState<ReserveReleaseState>('reserved')
  const transitionRef = useRef<ViewInstance>(null)
  const releaseAnchorRef = useRef<ReserveReleaseAnchor | null>(null)
  const scrollActivityRef = useRef<{ owner: HTMLElement; lastActivity: number; releaseHeld: boolean } | null>(null)
  const [releaseAttempt, setReleaseAttempt] = useState(0)

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
      payloadState: (): 'settled' | 'pending' | 'unknown' => {
        const runtime = connectedDOMView(runtimeRef.current)
        const height = measuredHeightRef.current
        const width = measuredWidthRef.current
        if (!runtime || height == null || width == null) return 'unknown'
        const next = runtime.getBoundingClientRect()
        if (!Number.isFinite(next.height) || next.height < 0 || !Number.isFinite(next.width) || next.width <= 0 ||
            Math.abs(next.width - width) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) return 'unknown'
        return Math.abs(next.height - height) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX ? 'pending' : 'settled'
      },
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
      heldFlowRef.current = null
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
    // `shrinkAnchor` marks a transaction that may take a shrink: `null` without a
    // following anchor, `undefined` for ancestor measurements of an outer one.
    // `inTask`: called from a React commit rather than the frame's rendering steps.
    const measureRuntimeHeight = (expectedGeneration = generation, shrinkAnchor?: ReserveReleaseAnchor | null, inTask = false) => {
      if (generationRef.current !== expectedGeneration || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime)) return false
      const { width, height } = runtime.getBoundingClientRect()
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height < 0 || (!allowEmptyRuntime && height === 0)) return false
      const slack = reserveSlackRef.current
      if (slack && !reserveSlackMatchesFrame(slack)) reserveSlackRef.current = null
      // The occupied frame is the last published one, or the placeholder before the
      // first publication; a conserved reserve stays outside it (its own release).
      // A smaller frame keeps the occupied height until `releaseHeldFlow`.
      const placeholder = connectedDOMView(placeholderRef.current)
      const occupiedHeight = Math.max(measuredHeightRef.current ?? placeholder?.getBoundingClientRect().height ?? 0, heldFlowRef.current ?? 0)
      // A responsive reflow belongs to browser anchoring, never to a held frame.
      const sameWidth = measuredWidthRef.current == null || Math.abs(width - measuredWidthRef.current) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX
      if (shrinkAnchor !== undefined && sameWidth && height < occupiedHeight - RUNTIME_SETTLE_HEIGHT_EPSILON_PX) {
        const placement = heldSlackPlacement(node, height, occupiedHeight)
        const owner = findMeasuredScrollOwner(node)
        // A section still settling (`shown-pending`) keeps it too: its lists grow
        // back, and a release in between would publish both moves (#3430).
        if (placement !== 'below' && (!runtimeFrameReady || !shrinkAnchor || (owner && (ownerScrolledInCurrentFrame(owner) || (inTask && ownerFrameKnown(owner)))))) {
          heldFlowRef.current = occupiedHeight
        }
      }
      if (heldFlowRef.current != null && heldFlowRef.current <= height + RUNTIME_SETTLE_HEIGHT_EPSILON_PX) heldFlowRef.current = null
      const flowHeight = Math.max(height, heldFlowRef.current ?? 0) + (node.dataset.reserveReleaseState === 'reserved' ? reserveSlackRef.current?.height ?? 0 : 0)
      measuredWidthRef.current = width
      if (measuredHeightRef.current != null && Math.abs(measuredHeightRef.current - height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX && Math.abs(Number.parseFloat(node.style.height) - flowHeight) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX) return false
      // #3430: Chrome scores a height change in any frame that also scrolls, and
      // a same-frame anchor write does not cancel it. Fast scroll on article 470
      // at 1280 brought the sidebar's top into the scrollport (visible slice
      // 290px) and the route block grew in that frame, so the slice left
      // (CLS 0.255) even though the border box itself stayed 1838px. A reserved
      // section absorbs growth inside its own reserve. An unreserved growth with
      // a visible follower keeps the published height until a quiet frame.
      const publishedHeight = measuredHeightRef.current
      const owner = findMeasuredScrollOwner(node)
      if (!publishingHeldGrowth && publishedHeight != null && sameWidth && height > publishedHeight + RUNTIME_SETTLE_HEIGHT_EPSILON_PX && shrinkAnchor &&
          node.dataset.reserveReleaseState !== 'reserved' && owner &&
          (ownerScrolledInCurrentFrame(owner) || (inTask && ownerFrameKnown(owner)))) {
        growthHeld = true
        return false
      }
      growthHeld = false
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
      // A held frame (#3430) is part of the occupied height, not reserve slack.
      const height = Math.max(0, flowHeight - Math.max(measuredHeightRef.current, heldFlowRef.current ?? 0))
      if (height > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) reserveSlackRef.current = {
        height, width, owner, runtime, reserveHeight, minHeight: view.getComputedStyle(node).minHeight,
        viewportHeight: view.innerHeight, ownerWidth: owner.clientWidth, ownerHeight: owner.clientHeight,
      }
    }
    // Releases a held shrink in a frame without an owner scroll: below the viewport
    // it moves nothing drawn; elsewhere the following frame keeps its place by the
    // usual anchor transaction. Without an anchor, scroll or geometry retries.
    const releaseHeldFlow = () => {
      const held = heldFlowRef.current
      if (held == null || !runtimeFrameReady || generationRef.current !== generation || !node?.isConnected || !runtime?.isConnected || !node.contains(runtime)) return
      const placement = heldSlackPlacement(node, runtime.getBoundingClientRect().height, held)
      const capture = placement === 'below' ? null : findMeasuredTransactionAnchor(node)
      if (placement !== 'below' && !capture) return
      const owner = findMeasuredScrollOwner(node)
      if (owner && !claimOwnerRelease(owner, node)) {
        // Another release owns this painted frame: retry after it (the claim
        // lapses two frames later), through the tracked frame of this generation.
        if (heldReleaseView && heldReleaseFrame == null) {
          heldReleaseFrame = heldReleaseView.requestAnimationFrame(() => {
            heldReleaseFrame = null
            scheduleHeldRelease()
          })
        }
        return
      }
      heldFlowRef.current = null
      if (!measureRuntimeHeight(generation)) return
      measureAncestorTransitions(node)
      recordCorrection(correctMeasuredAnchor(capture, node))
    }
    function recordCorrection(corrected: ReserveReleaseState | null) {
      if (!corrected) return
      revealCorrectionRef.current = revealCorrectionRef.current === 'clamped' ? 'clamped' : corrected
      if ((allowEmptyRuntime && reserveHeight == null) || (reserveReleaseState !== 'reserved' && reserveReleaseState !== 'released')) setReserveReleaseState(revealCorrectionRef.current)
    }
    const heldReleaseView = node?.ownerDocument.defaultView ?? null
    let heldReleaseFrame: number | null = null
    let growthHeld = false
    let growthFrame: number | null = null
    // The quiet-frame callback already proved this frame did not scroll. The
    // timeline stamp can still look current, so the publish must not hold again.
    let publishingHeldGrowth = false
    // Assigned after `commitMeasuredHeight`. A growth that would move a visible
    // follower waits for the same quiet frame as a held shrink.
    let scheduleHeldGrowth = () => {}
    const scheduleHeldRelease = () => {
      if (heldReleaseFrame != null || !heldReleaseView || heldFlowRef.current == null || generationRef.current !== generation) return
      heldReleaseFrame = heldReleaseView.requestAnimationFrame((frameTime) => {
        heldReleaseFrame = null
        const owner = node ? findMeasuredScrollOwner(node) : null
        if (owner && ownerScrolledInFrame(owner, frameTime)) scheduleHeldRelease()
        else releaseHeldFlow()
      })
    }
    const heldReleaseOwner = node ? findMeasuredScrollOwner(node) : null
    const wakeHeldGeometry = () => {
      scheduleHeldRelease()
      scheduleHeldGrowth()
    }
    if (heldReleaseOwner) {
      watchOwnerScroll(heldReleaseOwner)
      heldReleaseOwner.addEventListener('scroll', wakeHeldGeometry, { passive: true })
    }
    heldReleaseView?.addEventListener('resize', wakeHeldGeometry, { passive: true })
    heldReleaseView?.addEventListener('orientationchange', wakeHeldGeometry, { passive: true })
    const commitMeasuredHeight = (inTask = false) => {
      if (!node || generationRef.current !== generation) return
      const nextFrame = node.isConnected && runtime?.isConnected && node.contains(runtime) ? runtime.getBoundingClientRect() : null
      // ResizeObserver can repeat the same frame. With no conserved slack and
      // no height write, there is no anchor transaction to capture or correct.
      if (!reserveSlackRef.current && nextFrame &&
          Number.isFinite(nextFrame.width) && Number.isFinite(nextFrame.height) && nextFrame.width > 0 &&
          nextFrame.height >= 0 && (allowEmptyRuntime || nextFrame.height > 0) &&
          measuredHeightRef.current != null && Math.abs(measuredHeightRef.current - nextFrame.height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX &&
          Math.abs(Number.parseFloat(node.style.height) - nextFrame.height) <= RUNTIME_SETTLE_HEIGHT_EPSILON_PX) {
        // A width-only reflow still establishes the baseline for subsequent
        // same-width growth, even though this notification owns no height write.
        measuredWidthRef.current = nextFrame.width
        return
      }
      const obsoleteSlack = !!reserveSlackRef.current && !reserveSlackMatchesFrame(reserveSlackRef.current)
      if (obsoleteSlack) reserveSlackRef.current = null
      const nextHeight = nextFrame?.height
      if (nextHeight != null && Math.abs(nextHeight - (measuredHeightRef.current ?? 0)) > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) {
        if (!obsoleteSlack) currentReserveSlackCaptureRef.current?.()
        captureAncestorReserveSlack(node)
      }
      const capture = obsoleteSlack ? null : findMeasuredTransactionAnchor(node, measuredHeightRef.current == null)
      const measured = measureRuntimeHeight(generation, capture, inTask)
      if (heldFlowRef.current != null) scheduleHeldRelease()
      if (growthHeld) scheduleHeldGrowth()
      if (!measured) return
      measureAncestorTransitions(node)
      recordCorrection(correctMeasuredAnchor(capture, node))
    }
    // Child-dependent React cleanup may precede a leaf layout commit. The
    // registry owns this still-connected drawn DOM; stale observer callbacks
    // remain fenced by their captured generation above.
    currentMeasureRef.current = () => {
      const owner = node ? findMeasuredScrollOwner(node) : null
      return owner && runtime && isDrawnWithinOwner(runtime, owner) ? measureRuntimeHeight(generationRef.current) : false
    }
    scheduleHeldGrowth = () => {
      if (growthFrame != null || !heldReleaseView || !growthHeld || generationRef.current !== generation || !node?.isConnected) return
      growthFrame = heldReleaseView.requestAnimationFrame((frameTime) => {
        growthFrame = null
        if (generationRef.current !== generation || !growthHeld) return
        const owner = findMeasuredScrollOwner(node)
        if (owner && ownerScrolledInFrame(owner, frameTime)) scheduleHeldGrowth()
        else {
          publishingHeldGrowth = true
          try { commitMeasuredHeight(false) } finally { publishingHeldGrowth = false }
        }
      })
    }
    commitMeasuredHeight(true)
    // A section that has just settled takes its held change in a quiet animation
    // frame; only where frames cannot be told apart, before paint in this commit.
    if (heldReleaseOwner && !ownerFrameKnown(heldReleaseOwner) && !ownerScrolledInCurrentFrame(heldReleaseOwner)) releaseHeldFlow()
    scheduleHeldRelease()
    const observer = supportsResizeObservation && node && runtime && node.contains(runtime) ? new ResizeObserver(() => commitMeasuredHeight()) : null
    if (runtime) observer?.observe(runtime)
    if (heldReleaseOwner) observer?.observe(heldReleaseOwner)
    return () => {
      generationRef.current++
      observer?.disconnect()
      heldReleaseOwner?.removeEventListener('scroll', wakeHeldGeometry)
      heldReleaseView?.removeEventListener('resize', wakeHeldGeometry)
      heldReleaseView?.removeEventListener('orientationchange', wakeHeldGeometry)
      if (heldReleaseFrame != null) heldReleaseView?.cancelAnimationFrame(heldReleaseFrame)
      if (growthFrame != null) heldReleaseView?.cancelAnimationFrame(growthFrame)
    }
  }, [allowEmptyRuntime, children, reserveHeight, reserveReleaseState, runtimeFrameReady, runtimeMeasured, supportsResizeObservation, wantsRuntimeVisible])

  // Wheel/touch input can precede the browser's actual scrolling by a frame.
  // Record both ends of that interval on the same owner used for anchoring.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || reserveHeight == null || reserveReleaseState !== 'reserved') return
    const node = connectedDOMView(transitionRef.current)
    const owner = node && findMeasuredScrollOwner(node)
    if (!owner) return
    const activity = { owner, lastActivity: -Infinity, releaseHeld: false }
    scrollActivityRef.current = activity
    const view = owner.ownerDocument.defaultView
    let retryFrame: number | null = null
    const markActivity = (event: Event) => {
      if (event.type !== 'scroll' || event.target === owner) activity.lastActivity = Date.now()
      // A release held for visible slack is retried after the scroll that may
      // carry the slack out of view has been laid out.
      if (activity.releaseHeld && event.type === 'scroll' && event.target === owner && view && retryFrame == null) {
        retryFrame = view.requestAnimationFrame(() => {
          retryFrame = null
          setReleaseAttempt((attempt) => attempt + 1)
        })
      }
    }
    const events = ['wheel', 'touchmove', 'scroll'] as const
    for (const event of events) owner.addEventListener(event, markActivity, { capture: true, passive: true })
    return () => {
      for (const event of events) owner.removeEventListener(event, markActivity, true)
      if (retryFrame != null) view?.cancelAnimationFrame(retryFrame)
      scrollActivityRef.current = null
    }
  }, [reserveHeight, reserveReleaseState])

  // Releasing the original reserve is separate from early visibility and every
  // measured growth update. Capture prior to the React style change; correct in
  // the subsequent synchronous layout commit, before the browser can paint it.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !wantsRuntimeVisible || !runtimeMeasured || !runtimeFrameReady || reserveHeight == null) return
    const node = connectedDOMView(transitionRef.current)
    if (reserveReleaseState === 'reserved') {
      const runtime = connectedDOMView(runtimeRef.current)
      const capture = node ? findMeasuredTransactionAnchor(node) ??
        (reserveSlackRef.current ? findRuntimeReadingAnchor(node, runtime) : null) : null
      const activity = scrollActivityRef.current
      // With no visible following frame the release would pull it into view.
      if (activity) activity.releaseHeld = !capture && !!node && !!runtime &&
        isReserveSlackVisible(node, runtime, activity.owner) && !findReserveReleaseAnchor(node)
      if (activity?.releaseHeld) return undefined
      if (node && runtime && capture && activity?.owner === capture.owner &&
          node.getBoundingClientRect().height - runtime.getBoundingClientRect().height > RUNTIME_SETTLE_HEIGHT_EPSILON_PX) {
        const wait = activity.lastActivity + RESERVE_RELEASE_SCROLL_QUIET_MS - Date.now()
        if (wait > 0) {
          // Keep the runtime interactive while holding the reserve. Try from a
          // fresh layout commit so the anchor is read after the scroll batch.
          const retry = setTimeout(() => setReleaseAttempt((attempt) => attempt + 1), wait)
          return () => clearTimeout(retry)
        }
      }
      const releaseOwner = node && findMeasuredScrollOwner(node)
      // #3430: a React commit is a task, and a later task of its frame may still
      // scroll (TMB 1280: a probe step after the comments release, 0.117). Where
      // frames are known the release lands in a quiet animation frame instead:
      // the reserve leaves the style there and the state follows.
      if (releaseOwner && node && ownerFrameKnown(releaseOwner)) {
        const view = releaseOwner.ownerDocument.defaultView
        let frame: number | null = null
        const release = (frameTime: number) => {
          frame = null
          if (!node.isConnected || !view) return
          // A scrolled frame may have brought the slack into view: decide again.
          if (ownerScrolledInFrame(releaseOwner, frameTime) || !claimOwnerRelease(releaseOwner, node)) {
            setReleaseAttempt((attempt) => attempt + 1)
            return
          }
          const anchor = findMeasuredTransactionAnchor(node) ??
            (reserveSlackRef.current ? findRuntimeReadingAnchor(node, connectedDOMView(runtimeRef.current)) : null)
          node.style.minHeight = '0px'
          // Conserved slack lives in this node's own height: drop it in this frame.
          measuredTransitions.get(node)?.measure()
          measureAncestorTransitions(node)
          const corrected = correctMeasuredAnchor(anchor, node)
          setReserveReleaseState(revealCorrectionRef.current === 'clamped' ? 'clamped' : corrected ?? 'released')
        }
        frame = view?.requestAnimationFrame(release) ?? null
        return () => { if (frame != null) view?.cancelAnimationFrame(frame) }
      }
      if (releaseOwner && node && !claimOwnerRelease(releaseOwner, node)) {
        const view = releaseOwner.ownerDocument.defaultView
        const retry = view?.requestAnimationFrame(() => setReleaseAttempt((attempt) => attempt + 1))
        return () => { if (retry != null) view?.cancelAnimationFrame(retry) }
      }
      releaseAnchorRef.current = capture
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
    return undefined
  }, [releaseAttempt, reserveHeight, reserveReleaseState, runtimeFrameReady, runtimeMeasured, wantsRuntimeVisible])

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
      ...(growthOrigin ? { deferredGrowthOrigin: growthOrigin } : null),
    },
  }

  return (
    <View
      testID={testID}
      ref={transitionRef}
      style={[
        styles.webTransition,
        !runtimeIsVisible && styles.hiddenMeasuringBounds,
        growthOrigin === 'end' && styles.appendingBounds,
        reserveHeight == null || (runtimeFrameReady && !pending && reserveReleaseState !== 'reserved')
          ? null
          : ({ minHeight: reserveHeight } as never),
      ]}
      {...transitionDataSet}
    >
      {keepPlaceholder ? (
        <View
          testID={`${testID}-placeholder`}
          ref={placeholderRef}
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
  // Content appended inside the runtime can resize it from a nested
  // ResizeObserver callback (react-native-web `onLayout`), after this runtime's
  // own notification for the frame was already delivered: the flow height is
  // then published one frame late. Until it is, the appended tail must not be
  // drawn over the following section — on prod the new elevation profiles
  // covered «Точки маршрута» for a frame (CLS 0.44–0.54, #3419).
  appendingBounds: Platform.select({
    web: { overflowY: 'clip' } as never,
    default: {},
  }),
  measuringRuntime: Platform.select({
    web: {
      opacity: 0,
    },
    default: {},
  }),
})
