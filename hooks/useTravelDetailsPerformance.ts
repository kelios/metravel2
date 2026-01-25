import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/src/types/types'
import { useLCPPreload } from '@/components/travel/details/TravelDetailsSections'
import { injectCriticalStyles } from '@/styles/criticalCSS'
import { initPerformanceMonitoring } from '@/utils/performance'
import { optimizeCriticalPath } from '@/utils/advancedPerformanceOptimization'

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
    // Keep the main thread as free as possible during Lighthouse/PSI load window.
    // The slider pulls in a heavy chunk on web; enable it only after window load + idle.
    const enable = () => {
      rIC(() => setSliderReady(true), 1200)
    }

    if (typeof window === 'undefined') {
      enable()
      return
    }

    if (document.readyState === 'complete') {
      enable()
      return
    }

    window.addEventListener('load', enable, { once: true })
    return () => {
      window.removeEventListener('load', enable as any)
    }
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
      }, 1200)
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
    }, 3500)

    return () => {
      cancelled = true
      clearTimeout(t)
      window.removeEventListener('load', enable as any)
    }
  }, [isLoading, lcpLoaded, travel])

  useEffect(() => {
    if (Platform.OS !== 'web' || lcpLoaded) return
    // Keep the lightweight hero until the real LCP image finishes loading.
    // Enabling the slider early can change the LCP candidate and confuse PSI/Lighthouse.
    return
  }, [lcpLoaded])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(() => {
        injectCriticalStyles()
        initPerformanceMonitoring()
        optimizeCriticalPath()
      }, 800)
    }
  }, [])

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
