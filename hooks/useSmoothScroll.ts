/**
 * Hook for smooth scrolling with snap points and spring animations
 * Provides better UX for section navigation
 */

import { useCallback, useEffect, useRef } from 'react'
import { Animated, Platform } from 'react-native'
import { getSpringConfig } from '@/utils/travelDetailsUIUX'

export interface UseSmoothScrollOptions {
  /** Scroll duration in ms for web */
  duration?: number
  /** Spring animation type */
  springType?: 'gentle' | 'snappy' | 'bouncy'
  /** Enable snap points */
  enableSnap?: boolean
  /** Snap threshold (0-1) */
  snapThreshold?: number
  /** Offset from top when scrolling to element */
  offset?: number
}

export interface UseSmoothScrollReturn {
  /** Smooth scroll to Y position */
  scrollTo: (y: number, animated?: boolean) => void
  /** Scroll to element by ID */
  scrollToElement: (elementId: string, animated?: boolean) => void
  /** Scroll to section by key */
  scrollToSection: (sectionKey: string, animated?: boolean) => void
  /** Current scroll position */
  scrollY: Animated.Value
}

interface ScrollableElement {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  addEventListener: (event: string, handler: () => void, options?: { passive?: boolean }) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

export function useSmoothScroll(
  scrollViewRef: React.RefObject<ScrollableElement>,
  options: UseSmoothScrollOptions = {}
): UseSmoothScrollReturn {
  const {
    springType = 'gentle',
    enableSnap = false,
    offset = 0,
  } = options

  const scrollY = useRef(new Animated.Value(0)).current
  const isScrolling = useRef(false)

  /**
   * Smooth scroll to Y position
   */
  const scrollTo = useCallback(
    (y: number, animated: boolean = true) => {
      if (!scrollViewRef.current) return

      const targetY = Math.max(0, y - offset)

      if (Platform.OS === 'web') {
        // Web: use native smooth scrolling
        scrollViewRef.current.scrollTo?.({
          y: targetY,
          animated: animated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        })
      } else {
        // Native: use Animated spring
        if (animated) {
          isScrolling.current = true
          const springConfig = getSpringConfig(springType)

          Animated.spring(scrollY, {
            toValue: targetY,
            ...springConfig,
            useNativeDriver: true,
          }).start(() => {
            isScrolling.current = false
            if (scrollViewRef.current) {
              scrollViewRef.current.scrollTo({ y: targetY, animated: false })
            }
          })
        } else {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: targetY, animated: false })
          }
        }
      }
    },
    [scrollViewRef, offset, scrollY, springType]
  )

  /**
   * Scroll to element by ID (web only)
   */
  const scrollToElement = useCallback(
    (elementId: string, animated: boolean = true) => {
      if (Platform.OS !== 'web') return

      const element = document.getElementById(elementId)
      if (!element) return

      const rect = element.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const targetY = rect.top + scrollTop

      scrollTo(targetY, animated)
    },
    [scrollTo]
  )

  /**
   * Scroll to section by key using data attribute
   */
  const scrollToSection = useCallback(
    (sectionKey: string, animated: boolean = true) => {
      if (Platform.OS === 'web') {
        const element = document.querySelector(`[data-section-key="${sectionKey}"]`)
        if (element) {
          const rect = element.getBoundingClientRect()
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const targetY = rect.top + scrollTop
          scrollTo(targetY, animated)
        }
      } else {
        // Native: assume refs are stored somewhere accessible
        // This would need to be connected to your anchor system
        console.warn('scrollToSection on native requires anchor refs')
      }
    },
    [scrollTo]
  )

  /**
   * Handle snap scrolling on scroll end
   */
  useEffect(() => {
    if (!enableSnap || Platform.OS !== 'web' || !scrollViewRef.current) return

    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      if (isScrolling.current) return

      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        // Find nearest snap point
        // This would require snap points to be passed or calculated
        // For now, just a placeholder
      }, 150)
    }

    const element = scrollViewRef.current
    element?.addEventListener?.('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(scrollTimeout)
      element?.removeEventListener?.('scroll', handleScroll)
    }
  }, [enableSnap, scrollViewRef])

  return {
    scrollTo,
    scrollToElement,
    scrollToSection,
    scrollY,
  }
}

/**
 * Get scroll behavior based on user preferences
 */
export function getScrollBehavior(): ScrollBehavior {
  if (Platform.OS !== 'web') return 'auto'

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return prefersReducedMotion ? 'auto' : 'smooth'
}

/**
 * Scroll to top with animation
 */
export function scrollToTop(
  scrollViewRef: React.RefObject<ScrollableElement>,
  animated: boolean = true
): void {
  if (!scrollViewRef.current) return

  if (Platform.OS === 'web') {
    window.scrollTo({
      top: 0,
      behavior: animated ? getScrollBehavior() : 'auto',
    })
  } else {
    scrollViewRef.current.scrollTo({ y: 0, animated })
  }
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement, offset: number = 0): boolean {
  if (Platform.OS !== 'web') return false

  const rect = element.getBoundingClientRect()
  return (
    rect.top >= -offset &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + offset &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}
