import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { rIC } from '@/utils/rIC'
import { initPerformanceMonitoring } from '@/utils/performance'

const NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS = 1000
const preloadTravelHeroSliderRuntime = () => import('@/components/travel/Slider.web')

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
  postLcpRuntimeReady: boolean
}

export function useTravelDetailsPerformance({
  travel,
  isMobile: _isMobile,
  isLoading,
}: UseTravelDetailsPerformanceArgs): UseTravelDetailsPerformanceReturn {
  const [lcpLoaded, setLcpLoaded] = useState(false)
  const [sliderReady, setSliderReady] = useState(Platform.OS !== 'web')
  const [deferAllowed, setDeferAllowed] = useState(false)
  const [postLcpRuntimeReady, setPostLcpRuntimeReady] = useState(
    Platform.OS !== 'web',
  )

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!lcpLoaded) return
    if (!deferAllowed) return
    if (!travel) return

    let cancelled = false

    preloadTravelHeroSliderRuntime()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSliderReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [deferAllowed, lcpLoaded, travel])

  useEffect(() => {
    if (!isLoading) {
      setDeferAllowed(true)
      return
    }

    setDeferAllowed(false)
  }, [isLoading])

  useEffect(() => {
    if (!deferAllowed) {
      setPostLcpRuntimeReady(false)
      return
    }

    setPostLcpRuntimeReady(true)
  }, [deferAllowed])

  useEffect(() => {
    if (Platform.OS === 'web') {
      let cancelled = false

      const runPerformanceMonitoring = () => {
        rIC(async () => {
          if (cancelled) return
          try {
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

      if (!travel || typeof window === 'undefined') {
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

      let revealed = false
      const reveal = () => {
        if (revealed || cancelled) return
        revealed = true
        runPerformanceMonitoring()
      }

      window.addEventListener('pointerdown', reveal, { passive: true, once: true })
      window.addEventListener('keydown', reveal, { once: true })
      window.addEventListener('wheel', reveal, { passive: true, once: true })

      return () => {
        cancelled = true
        revealed = true
        window.removeEventListener('pointerdown', reveal as EventListener)
        window.removeEventListener('keydown', reveal as EventListener)
        window.removeEventListener('wheel', reveal as EventListener)
      }
    }
    return undefined
  }, [isLoading, travel])

  return useMemo(() => ({
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
    postLcpRuntimeReady,
  }), [lcpLoaded, setLcpLoaded, sliderReady, deferAllowed, postLcpRuntimeReady])
}
