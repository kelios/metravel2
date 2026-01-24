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
    if (!isLoading) {
      setDeferAllowed(true)
    }
  }, [isLoading])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!travel) return
    setDeferAllowed(true)
  }, [travel])

  useEffect(() => {
    if (lcpLoaded) setDeferAllowed(true)
    else rIC(() => setDeferAllowed(true), 800)
  }, [lcpLoaded])

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
