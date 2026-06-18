import React, { useEffect, useRef } from 'react'
import { Platform, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { ROOT_MAP_PROPS } from './shared'

const MAP_LAYOUT_INVALIDATE_EVENT = 'metravel:map-layout-invalidate'

type MapScreenShellProps = {
  styles: any
  seoBlock: React.ReactNode
  /**
   * The Leaflet/RN-Maps canvas. Rendered ONCE here, at a stable position in the
   * tree, so flipping the mobile↔desktop breakpoint never re-parents (and thus
   * never unmounts/remounts) the map. #217.
   */
  mapComponent: React.ReactNode
  /**
   * Breakpoint-specific chrome (panel/collapsed strip on desktop; top overlay +
   * bottom sheet + FABs on mobile). Rendered as a SIBLING of the stable map
   * host — never as its parent.
   */
  chrome: React.ReactNode
  /** Shared, breakpoint-independent overlays (offline indicator, onboarding…). */
  overlays?: React.ReactNode
  isMobile: boolean
}

/**
 * Stable map host. The map node lives in one fixed tree position for both
 * breakpoints; `chrome` renders around it (desktop: flex sibling to the left of
 * the map; mobile: absolute overlays + bottom sheet on top of the map).
 */
export function MapScreenShell({
  styles,
  seoBlock,
  mapComponent,
  chrome,
  overlays,
  isMobile,
}: MapScreenShellProps) {
  // #217 — the map node now survives a breakpoint flip, but its host geometry
  // changes (desktop: inset card next to the panel; mobile: full-bleed). Nudge
  // Leaflet to re-measure right after the layout swaps. useMapWebLayoutEffects
  // listens for this event and coalesces the work onto a single rAF.
  const firstRenderRef = useRef(true)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      window.dispatchEvent(new Event(MAP_LAYOUT_INVALIDATE_EVENT))
      raf2 = requestAnimationFrame(() => {
        window.dispatchEvent(new Event(MAP_LAYOUT_INVALIDATE_EVENT))
      })
    })
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event(MAP_LAYOUT_INVALIDATE_EVENT))
    }, 260)
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      clearTimeout(timer)
    }
  }, [isMobile])

  return (
    // #217 (gesture layer) — RNGH root MUST be an ANCESTOR of both the map host
    // and the chrome, never a sibling overlaid on top of the map. The mobile
    // chrome is an absoluteFill overlay; if its own GestureHandlerRootView sat
    // over the map, the native RNGestureHandlerRootView (ReactViewGroup) would
    // claim the ACTION_DOWN for its subtree's orchestrator and the map WebView —
    // a SIBLING below, outside that root — would never receive the touch, even
    // with pointerEvents="box-none". Hoisting the single root here puts the map
    // and chrome under ONE orchestrator, so box-none on the chrome correctly
    // routes empty-area touches down to the map. On web GestureHandlerRootView
    // is a plain flex View (no-op). The app root is a plain View on the current
    // Android dev-client (see app/_layout.tsx), so this is the only RNGH root in
    // the native map tree.
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container} {...ROOT_MAP_PROPS}>
        {seoBlock}
        <View style={styles.mapContainer}>
          {/* Desktop chrome (panel) is a flex sibling rendered BEFORE the map so
              it sits to the left in the flex-row. Mobile chrome is absolutely
              positioned, so order is irrelevant there. */}
          {!isMobile && chrome}
          <View style={styles.mapHost}>{mapComponent}</View>
          {isMobile && chrome}
        </View>
        {overlays}
      </View>
    </GestureHandlerRootView>
  )
}
