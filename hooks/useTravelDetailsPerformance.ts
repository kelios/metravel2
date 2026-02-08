import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { useLCPPreload } from '@/components/travel/details/TravelDetailsSections'
import { rIC } from '@/utils/rIC'

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
}

export function useTravelDetailsPerformance({
  travel,
  isMobile,
  isLoading,
}: UseTravelDetailsPerformanceArgs): UseTravelDetailsPerformanceReturn {
  const [lcpLoaded, setLcpLoaded] = useState(false)
  const [sliderReady, setSliderReady] = useState(Platform.OS !== 'web')
  const [deferAllowed, setDeferAllowed] = useState(false)

  useLCPPreload(travel, isMobile)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return

    // LCP metric is already captured. Enable the slider immediately —
    // the Slider now receives firstImagePreloaded=true so the first slide
    // skips the shimmer overlay, making the swap visually seamless.
    setSliderReady(true)
  }, [lcpLoaded])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (!isLoading) setDeferAllowed(true)
      return
    }

    // If loading is complete but we still don't have travel data (e.g. missing param / error state),
    // allow deferred UI immediately. The heavy sections won't mount meaningfully without data,
    // and this keeps tests and non-happy paths deterministic.
    if (!isLoading && !travel) {
      setDeferAllowed(true)
      return
    }

    // Deferred sections (description, map, points, comments) should render as soon
    // as travel data is available — they don't need to wait for the hero image.
    // Only the Slider swap (sliderReady) is gated on LCP image load.
    if (travel) {
      setDeferAllowed(true)
      return
    }

    if (typeof window === 'undefined') return

    // Safety net: do not block forever if data never arrives.
    let cancelled = false
    const t = setTimeout(() => {
      if (!cancelled) setDeferAllowed(true)
    }, 1200)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [isLoading, travel])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(async () => {
        const [{ injectCriticalStyles }, { initPerformanceMonitoring }, { optimizeCriticalPath }] =
          await Promise.all([
            import('@/styles/criticalCSS'),
            import('@/utils/performance'),
            import('@/utils/advancedPerformanceOptimization'),
          ])
        injectCriticalStyles()
        initPerformanceMonitoring()
        optimizeCriticalPath()
      }, 800)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return
    if (typeof window === 'undefined') return
    const nav: any = typeof navigator !== 'undefined' ? (navigator as any) : (window as any).navigator
    if (!nav || !nav.serviceWorker || !nav.serviceWorker.ready) return

    // Prefetch travel-critical JS via Service Worker after LCP to reduce INP/TTI on subsequent navigations.
    // Guarded to run at most once per session.
    if ((window as any).__metravelPrefetchTravelDone) return
    ;(window as any).__metravelPrefetchTravelDone = true

    rIC(async () => {
      try {
        const reg = await nav.serviceWorker.ready
        const active = reg && reg.active
        if (active && typeof active.postMessage === 'function') {
          active.postMessage({ type: 'PREFETCH_TRAVEL_RESOURCES', url: window.location.href })
        }
      } catch {
        // noop
      }
    }, 3200)
  }, [lcpLoaded])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!travel) return
    const connection = (window as any)?.navigator?.connection
    const effectiveType = String(connection?.effectiveType || '')
    const saveData = Boolean(connection?.saveData)
    const isConstrained =
      saveData || effectiveType.includes('2g') || effectiveType.includes('slow-2g')

    if (isConstrained) return

    // Prefetch the Slider chunk immediately so it's ready when LCP finishes
    // and sliderReady becomes true — eliminates chunk download during swap.
    import('@/components/travel/Slider').catch(() => {})

    // Prefetch deferred section chunks so they are ready when
    // TravelDeferredSections mounts.
    rIC(() => {
      Promise.allSettled([
        import('@/components/travel/TravelDescription'),
        import('@/components/travel/PointList'),
        import('@/components/travel/NearTravelList'),
        import('@/components/travel/PopularTravelList'),
        // Removed ToggleableMapSection from eager prefetch to keep map bundles lazy
        // import('@/components/travel/ToggleableMapSection'),
      ])
    }, 1600)
  }, [travel])

  return {
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
  }
}
