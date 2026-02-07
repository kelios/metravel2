import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { useLCPPreload } from '@/components/travel/details/TravelDetailsSections'

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

const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
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

    // LCP metric is already captured. Enable the slider after a short idle
    // delay so the browser can finish painting the static hero first.
    if (typeof window === 'undefined') {
      setSliderReady(true)
      return
    }

    let cancelled = false
    rIC(() => {
      if (!cancelled) setSliderReady(true)
    }, 200)

    return () => { cancelled = true }
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

    // On web, keep heavy/deferred sections unmounted until the LCP hero finishes loading.
    // This avoids network contention and main-thread work that can push LCP out dramatically.
    if (lcpLoaded) {
      setDeferAllowed(true)
      return
    }

    if (typeof window === 'undefined') return

    let cancelled = false
    const enable = () => {
      if (cancelled) return
      rIC(() => {
        if (!cancelled) setDeferAllowed(true)
      }, 400)
    }

    // After window load, allow heavy content in idle time.
    if (document.readyState === 'complete') {
      enable()
    } else {
      window.addEventListener('load', enable, { once: true })
    }

    // Safety net: do not block forever if image never loads.
    const t = setTimeout(() => {
      if (!cancelled) setDeferAllowed(true)
    }, 2000)

    return () => {
      cancelled = true
      clearTimeout(t)
      window.removeEventListener('load', enable as any)
    }
  }, [isLoading, lcpLoaded, travel])

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
    if (!lcpLoaded) return
    const connection = (window as any)?.navigator?.connection
    const effectiveType = String(connection?.effectiveType || '')
    const saveData = Boolean(connection?.saveData)
    const isConstrained =
      saveData || effectiveType.includes('2g') || effectiveType.includes('slow-2g')

    if (isConstrained) return

    rIC(() => {
      Promise.allSettled([
        import('@/components/travel/TravelDescription'),
        import('@/components/travel/PointList'),
        import('@/components/travel/NearTravelList'),
        import('@/components/travel/PopularTravelList'),
        // Removed ToggleableMapSection from eager prefetch to keep map bundles lazy
        // import('@/components/travel/ToggleableMapSection'),
      ])
    }, 3200)
  }, [lcpLoaded])

  return {
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
  }
}
