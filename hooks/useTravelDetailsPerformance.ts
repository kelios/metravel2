import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
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
  isMobile: _isMobile,
  isLoading,
}: UseTravelDetailsPerformanceArgs): UseTravelDetailsPerformanceReturn {
  const [lcpLoaded, setLcpLoaded] = useState(false)
  const [sliderReady, setSliderReady] = useState(Platform.OS !== 'web')
  const [deferAllowed, setDeferAllowed] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return

    // LCP metric is already captured. Before swapping to the Slider,
    // ensure its chunk is downloaded to avoid a withLazy fallback flash.
    let cancelled = false
    import('@/components/travel/Slider')
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSliderReady(true)
      })
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
      // Defer non-critical performance utilities well past LCP/TBT window.
      // Critical CSS is already inlined in +html.tsx — no need to inject again.
      rIC(async () => {
        const [{ initPerformanceMonitoring }] =
          await Promise.all([
            import('@/utils/performance'),
          ])
        initPerformanceMonitoring()
      }, 3000)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!travel) return
    const connection = (window as any)?.navigator?.connection
    const effectiveType = String(connection?.effectiveType || '')
    const saveData = Boolean(connection?.saveData)
    const isConstrained =
      saveData || effectiveType.includes('2g') || effectiveType.includes('slow-2g')

    if (isConstrained) return

    // Prefetch the Slider chunk after idle so it doesn't compete with hero
    // image paint for main thread time. The 800ms timeout is a safety net.
    rIC(() => {
      import('@/components/travel/Slider').catch(() => {})
    }, 800)

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

  return useMemo(() => ({
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
  }), [lcpLoaded, setLcpLoaded, sliderReady, deferAllowed])
}
