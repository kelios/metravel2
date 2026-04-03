import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { rIC } from '@/utils/rIC'
import { initPerformanceMonitoring } from '@/utils/performance'

const NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS = 1000
const HERO_ENHANCERS_FALLBACK_MS = 1800
const POST_LCP_RUNTIME_FALLBACK_MS = 7000
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
  heroEnhancersReady: boolean
  postLcpRuntimeReady: boolean
}

export function useTravelDetailsPerformance({
  travel,
  isMobile: _isMobile,
  isLoading,
}: UseTravelDetailsPerformanceArgs): UseTravelDetailsPerformanceReturn {
  const travelId = travel?.id
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

    let heroFallbackId: ReturnType<typeof setTimeout> | null = null
    let runtimeFallbackId: ReturnType<typeof setTimeout> | null = null
    let heroRevealed = false
    let runtimeRevealed = false

    const revealHeroEnhancers = () => {
      if (heroRevealed) return
      heroRevealed = true
      setHeroEnhancersReady(true)
    }

    const revealPostLcpRuntime = () => {
      if (runtimeRevealed) return
      runtimeRevealed = true
      setPostLcpRuntimeReady(true)
    }

    const revealAll = () => {
      revealHeroEnhancers()
      revealPostLcpRuntime()
      cleanup()
    }

    const cleanup = () => {
      if (heroFallbackId) clearTimeout(heroFallbackId)
      if (runtimeFallbackId) clearTimeout(runtimeFallbackId)
      window.removeEventListener('pointerdown', revealAll as EventListener)
      window.removeEventListener('touchstart', revealAll as EventListener)
      window.removeEventListener('keydown', revealAll as EventListener)
      window.removeEventListener('scroll', revealAll as EventListener)
      window.removeEventListener('wheel', revealAll as EventListener)
    }

    window.addEventListener('pointerdown', revealAll, { passive: true, once: true })
    window.addEventListener('touchstart', revealAll, { passive: true, once: true })
    window.addEventListener('keydown', revealAll, { once: true })
    window.addEventListener('scroll', revealAll, { passive: true, once: true })
    window.addEventListener('wheel', revealAll, { passive: true, once: true })
    heroFallbackId = setTimeout(revealHeroEnhancers, HERO_ENHANCERS_FALLBACK_MS)
    runtimeFallbackId = setTimeout(revealPostLcpRuntime, POST_LCP_RUNTIME_FALLBACK_MS)

    return cleanup
  }, [isLoading, lcpLoaded, travelId])

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
