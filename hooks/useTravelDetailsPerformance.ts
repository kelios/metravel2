import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/src/types/types'
import { useLCPPreload } from '@/components/travel/details/TravelDetailsSections'
import { injectCriticalStyles } from '@/styles/criticalCSS'
import { initPerformanceMonitoring } from '@/utils/performanceMonitoring'
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
    rIC(() => setSliderReady(true), 600)
  }, [lcpLoaded])

  useEffect(() => {
    if (!isLoading) {
      setDeferAllowed(true)
    }
  }, [isLoading])

  useEffect(() => {
    if (lcpLoaded) setDeferAllowed(true)
    else rIC(() => setDeferAllowed(true), 800)
  }, [lcpLoaded])

  useEffect(() => {
    if (Platform.OS !== 'web' || lcpLoaded) return
    const timeout = setTimeout(() => setLcpLoaded(true), 2500)
    return () => clearTimeout(timeout)
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
    rIC(() => {
      Promise.allSettled([
        import('@/components/travel/TravelDescription'),
        import('@/components/travel/PointList'),
        import('@/components/travel/NearTravelList'),
        import('@/components/travel/PopularTravelList'),
        import('@/components/travel/ToggleableMapSection'),
      ])
    }, 1200)
  }, [lcpLoaded])

  return {
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
  }
}
