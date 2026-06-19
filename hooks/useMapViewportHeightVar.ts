import { useEffect } from 'react'
import { Platform } from 'react-native'

/**
 * CSS custom property holding the *measured* visible-viewport height (px) used
 * by the map screen container instead of relying on the `dvh`/`vh` CSS units.
 *
 * Why: in iOS in-app WebViews (Instagram / Threads WKWebView) `100dvh` resolves
 * incorrectly — frequently to 0 — which collapses the Leaflet container to no
 * height and the map renders as a grey box. Safari resolves `dvh` correctly, so
 * the bug only reproduces inside the in-app browser. The screen container reads
 * this var with a breakpoint-specific chrome reserve: when this hook has run the
 * JS measurement wins everywhere; otherwise it degrades to `100svh` (the stable
 * SMALL viewport, far more reliable than `dvh` in WebViews). The map screen
 * subtracts only the chrome it actually needs for the current breakpoint.
 */
export const MAP_VIEWPORT_HEIGHT_CSS_VAR = '--metravel-map-vh'

function readViewportHeight(): number {
  if (typeof window === 'undefined') return 0
  const visual = window.visualViewport?.height
  if (typeof visual === 'number' && Number.isFinite(visual) && visual > 0) {
    return visual
  }
  const inner = window.innerHeight
  return typeof inner === 'number' && Number.isFinite(inner) && inner > 0 ? inner : 0
}

/**
 * Keeps `--metravel-map-vh` on <html> in sync with the real visible viewport
 * height. Web-only no-op on native. Mount it once on the map screen.
 */
export function useMapViewportHeightVar(): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const root = document.documentElement
    if (!root) return

    let rafId: number | null = null

    const apply = () => {
      const height = readViewportHeight()
      if (height > 0) {
        root.style.setProperty(MAP_VIEWPORT_HEIGHT_CSS_VAR, `${Math.round(height)}px`)
      }
    }

    const schedule = () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(apply)
    }

    apply()

    const vv = window.visualViewport
    try {
      vv?.addEventListener('resize', schedule)
      vv?.addEventListener('scroll', schedule)
    } catch {
      // noop
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      try {
        vv?.removeEventListener('resize', schedule)
        vv?.removeEventListener('scroll', schedule)
      } catch {
        // noop
      }
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      // Leave the variable in place on unmount: a stale value is harmless (it is
      // only read by the map container, which is gone) and clearing it risks a
      // flash of collapsed height if the screen remounts before the next frame.
    }
  }, [])
}

// Expo Router treats *.ts files under app/ as routes; this file lives under
// hooks/ so no default export is required.
