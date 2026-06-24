import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { devWarn } from '@/utils/logger'
import { rIC } from '@/utils/rIC'

const NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS = 1000
const preloadTravelHeroSliderRuntime = () => Promise.resolve(import('@/components/travel/Slider.web'))

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

const runWhenBrowserIdle = (
  callback: () => void,
  fallbackMs = 250,
): (() => void) => {
  if (typeof window === 'undefined') {
    callback()
    return () => {}
  }

  const idleWindow = window as IdleCapableWindow
  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    if (!cancelled) callback()
  }, fallbackMs)
  let idleId: number | null = null

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleId = idleWindow.requestIdleCallback(
      () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (!cancelled) callback()
      },
      { timeout: fallbackMs },
    )
  }

  return () => {
    cancelled = true
    if (timeoutId) clearTimeout(timeoutId)
    if (idleId !== null && typeof idleWindow.cancelIdleCallback === 'function') {
      try {
        idleWindow.cancelIdleCallback(idleId)
      } catch {
        // noop
      }
    }
  }
}

export interface UseTravelDetailsPerformanceArgs {
  travel?: Travel
  isMobile: boolean
  isLoading: boolean
}

export interface UseTravelDetailsPerformanceReturn {
  lcpLoaded: boolean
  setLcpLoaded: Dispatch<SetStateAction<boolean>>
  sliderReady: boolean
  deferAllowed: boolean
  heroEnhancersReady: boolean
  postLcpRuntimeReady: boolean
}

export function useTravelDetailsPerformance({
  travel,
  isMobile: _isMobile,
  isLoading,
}: UseTravelDetailsPerformanceArgs): UseTravelDetailsPerformanceReturn {
  const travelId = travel?.id
  const hasHeroMedia = useMemo(() => {
    if (!travel) return false
    return Array.isArray(travel.gallery) && travel.gallery.length > 0
  }, [travel])
  const [lcpLoaded, setLcpLoaded] = useState(false)
  const [sliderReady, setSliderReady] = useState(Platform.OS !== 'web')
  const [deferAllowed, setDeferAllowed] = useState(false)
  const [heroEnhancersReady, setHeroEnhancersReady] = useState(
    Platform.OS !== 'web',
  )
  const [postLcpRuntimeReady, setPostLcpRuntimeReady] = useState(
    Platform.OS !== 'web',
  )

  // On web SPA navigation between two cached travels the container is not remounted
  // (no `key` on travelId) and `isLoading` never flips true→false, so the deferred-chrome
  // gates below would carry over `true` from the previous travel and mount the whole heavy
  // tree (incl. the Leaflet map) synchronously in the navigation commit — freezing the main
  // thread and leaving the skeleton overlay up (white screen). Reset the web gates during
  // render when travelId changes (the "adjust state during render" pattern) so the new travel
  // behaves like a fresh mount and the idle effects below re-reveal the chrome progressively.
  // Native is left untouched (gates start `true` there).
  const [prevTravelId, setPrevTravelId] = useState(travelId)
  if (travelId !== prevTravelId) {
    setPrevTravelId(travelId)
    if (Platform.OS === 'web') {
      setLcpLoaded(false)
      setSliderReady(false)
      setHeroEnhancersReady(false)
      setPostLcpRuntimeReady(false)
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return
    if (!deferAllowed) return
    if (travelId == null) return

    let cancelled = false

    preloadTravelHeroSliderRuntime()
      .catch((error) => {
        devWarn('[TravelDetailsPerformance] Failed to preload hero slider runtime', error)
      })
      .finally(() => {
        if (!cancelled) setSliderReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [deferAllowed, lcpLoaded, travelId])

  // Safety net: the first-screen gate (`lcpLoaded`) is normally released by the hero
  // image's load/error callback. On client-side (SPA) navigation that callback is
  // unreliable — a browser-cached hero image can finish before React attaches the
  // handler so no load event ever fires (this happens routinely when arriving from a
  // card that already rendered the same image). The skeleton overlay then covers the
  // already-painted content, which reads as a blank/white first screen on navigation.
  // Cap that window tightly: the overlay only exists to mask hero load, and the real
  // hero renders its own progressive/placeholder state underneath, so force the gate
  // open quickly. The happy path (onLoad / cache-hit synth) still releases instantly
  // well under this timeout.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (isLoading || travelId == null || !hasHeroMedia || lcpLoaded) return

    const timeoutId = setTimeout(() => {
      setLcpLoaded(true)
    }, 1200)

    return () => clearTimeout(timeoutId)
  }, [hasHeroMedia, isLoading, lcpLoaded, travelId])

  useEffect(() => {
    if (!isLoading) {
      setDeferAllowed(true)
      return
    }

    setDeferAllowed(false)
  }, [isLoading])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setHeroEnhancersReady(true)
      setPostLcpRuntimeReady(true)
      return
    }
    if (isLoading) {
      setHeroEnhancersReady(false)
      setPostLcpRuntimeReady(false)
      return
    }
    if (travelId == null) {
      setHeroEnhancersReady(true)
      setPostLcpRuntimeReady(false)
      return
    }
    if (!hasHeroMedia) {
      setHeroEnhancersReady(true)
      setPostLcpRuntimeReady(true)
      return
    }
    if (!lcpLoaded) {
      setHeroEnhancersReady(false)
      setPostLcpRuntimeReady(false)
      return
    }

    const isWebAutomation =
      typeof navigator !== 'undefined' &&
      Boolean((navigator as unknown as Record<string, unknown>).webdriver)

    if (isWebAutomation) {
      setHeroEnhancersReady(true)
      setPostLcpRuntimeReady(true)
      return
    }

    setHeroEnhancersReady(false)
    setPostLcpRuntimeReady(false)

    // #558: reveal all post-LCP chrome (hero enhancers + post-LCP runtime) on a single
    // real idle callback after LCP instead of a 250→500 ladder of fixed timers. The two
    // staged fallbacks serialised chrome appearance into a visible 0.75–1.5s reflow
    // cascade; flipping both gates in one commit removes the stepping while still keeping
    // the chrome strictly after LCP (this only runs once `lcpLoaded` is true).
    const cleanupIdle = runWhenBrowserIdle(() => {
      setHeroEnhancersReady(true)
      setPostLcpRuntimeReady(true)
    }, 250)

    return () => {
      cleanupIdle()
    }
  }, [hasHeroMedia, isLoading, lcpLoaded, travelId])

  useEffect(() => {
    if (Platform.OS === 'web') {
      let cancelled = false

      const runPerformanceMonitoring = () => {
        rIC(async () => {
          if (cancelled) return
          try {
            const { initPerformanceMonitoring } = await import('@/utils/performance')
            if (!cancelled && typeof initPerformanceMonitoring === 'function') {
              initPerformanceMonitoring()
            }
          } catch {
            // Non-critical — silently ignore if performance module fails to load
          }
        }, NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS)
      }

      if (isLoading) {
        return () => {
          cancelled = true
        }
      }

      if (travelId == null || typeof window === 'undefined') {
        runPerformanceMonitoring()
        return () => {
          cancelled = true
        }
      }

      const isWebAutomation =
        typeof navigator !== 'undefined' &&
        Boolean((navigator as unknown as Record<string, unknown>).webdriver)

      if (isWebAutomation) {
        runPerformanceMonitoring()
        return () => {
          cancelled = true
        }
      }

      const cleanupIdle = runWhenBrowserIdle(() => {
        if (cancelled) return
        runPerformanceMonitoring()
      }, 500)

      return () => {
        cancelled = true
        cleanupIdle()
      }
    }
    return undefined
  }, [isLoading, travelId])

  return useMemo(() => ({
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
    heroEnhancersReady,
    postLcpRuntimeReady,
  }), [
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
    heroEnhancersReady,
    postLcpRuntimeReady,
  ])
}
