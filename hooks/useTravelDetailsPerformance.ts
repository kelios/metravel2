import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { rIC } from '@/utils/rIC'
import { initPerformanceMonitoring } from '@/utils/performance'

const NON_TRAVEL_PERFORMANCE_INIT_DELAY_MS = 1000

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

    const isWebAutomation =
      typeof navigator !== 'undefined' &&
      Boolean((navigator as unknown as Record<string, unknown>).webdriver)

    if (isWebAutomation) {
      let cancelled = false
      import('@/components/travel/Slider')
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSliderReady(true)
        })
      return () => {
        cancelled = true
      }
    }

    if (typeof window === 'undefined') return

    let cancelled = false
    let revealed = false

    const isHeroInteraction = (target: EventTarget | null) => {
      if (typeof document === 'undefined') return false
      if (!(target instanceof Node)) return false

      const heroRoot = document.querySelector(
        '[data-testid="travel-details-hero-slider-container"]',
      )
      return Boolean(heroRoot && heroRoot.contains(target))
    }

    const revealFromPointer = (event: Event) => {
      if (!isHeroInteraction(event.target)) return
      if (revealed || cancelled) return
      revealed = true
      import('@/components/travel/Slider')
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSliderReady(true)
        })
    }

    const revealFromKeyboard = () => {
      if (typeof document === 'undefined') return
      const active = document.activeElement
      if (!isHeroInteraction(active)) return
      if (revealed || cancelled) return
      revealed = true
      import('@/components/travel/Slider')
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSliderReady(true)
        })
    }

    window.addEventListener('pointerdown', revealFromPointer, {
      passive: true,
      once: true,
    })
    window.addEventListener('keydown', revealFromKeyboard, { once: true })

    return () => {
      cancelled = true
      revealed = true
      window.removeEventListener(
        'pointerdown',
        revealFromPointer as EventListener,
      )
      window.removeEventListener('keydown', revealFromKeyboard as EventListener)
    }
  }, [deferAllowed, lcpLoaded, travel])

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

    // On web we gate heavy deferred sections until LCP hero is painted.
    // This prevents map/comments chunks + route downloads from competing with LCP.
    if (travel && lcpLoaded) {
      setDeferAllowed(true)
      return
    }

    if (travel && !lcpLoaded) {
      setDeferAllowed(false)
      return
    }

    setDeferAllowed(false)
  }, [isLoading, lcpLoaded, travel])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (!isLoading) setPostLcpRuntimeReady(true)
      return
    }

    if (!deferAllowed) {
      setPostLcpRuntimeReady(false)
      return
    }

    const isWebAutomation =
      typeof navigator !== 'undefined' &&
      Boolean((navigator as unknown as Record<string, unknown>).webdriver)

    if (isWebAutomation || !travel) {
      setPostLcpRuntimeReady(true)
      return
    }

    setPostLcpRuntimeReady(false)

    let revealed = false

    const reveal = () => {
      if (revealed) return
      revealed = true
      setPostLcpRuntimeReady(true)
    }

    window.addEventListener('pointerdown', reveal, { passive: true, once: true })
    window.addEventListener('keydown', reveal, { once: true })
    window.addEventListener('wheel', reveal, { passive: true, once: true })

    return () => {
      revealed = true
      window.removeEventListener('pointerdown', reveal as EventListener)
      window.removeEventListener('keydown', reveal as EventListener)
      window.removeEventListener('wheel', reveal as EventListener)
    }
  }, [deferAllowed, isLoading, travel])

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
  }, [isLoading, travel])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!travel) return
    if (!postLcpRuntimeReady) return
    const connection = (window as { navigator?: { connection?: { effectiveType?: string; saveData?: boolean } } })?.navigator?.connection
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
  }, [travel, postLcpRuntimeReady])

  return useMemo(() => ({
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
    postLcpRuntimeReady,
  }), [lcpLoaded, setLcpLoaded, sliderReady, deferAllowed, postLcpRuntimeReady])
}
