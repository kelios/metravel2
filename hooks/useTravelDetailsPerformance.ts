import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { rIC } from '@/utils/rIC'

const NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS = 1000
const preloadTravelHeroSliderRuntime = () => import('@/components/travel/Slider.web')

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

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return
    if (!deferAllowed) return
    if (travelId == null) return

    let cancelled = false

    preloadTravelHeroSliderRuntime()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSliderReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [deferAllowed, lcpLoaded, travelId])

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

    let cleanupHeroIdle: (() => void) | null = null
    let cleanupRuntimeIdle: (() => void) | null = null

    cleanupHeroIdle = runWhenBrowserIdle(() => {
      setHeroEnhancersReady(true)
    }, 250)
    cleanupRuntimeIdle = runWhenBrowserIdle(() => {
      setPostLcpRuntimeReady(true)
    }, 500)

    return () => {
      cleanupHeroIdle?.()
      cleanupRuntimeIdle?.()
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
