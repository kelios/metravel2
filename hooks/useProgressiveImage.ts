/**
 * Hook for progressive image loading with blur-up effect
 * Optimizes perceived performance by showing low-quality placeholder first
 */

import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'

export interface ProgressiveImageOptions {
  /** Low quality image placeholder (LQIP) - ~1-2KB */
  placeholderSrc?: string
  /** Full quality image source */
  src: string
  /** Callback when full image is loaded */
  onLoad?: () => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Delay before starting to load full image (ms) */
  loadDelay?: number
  /** Enable blur effect during transition */
  enableBlur?: boolean
}

export interface UseProgressiveImageReturn {
  /** Current image source to display */
  currentSrc: string
  /** Whether full image is loaded */
  isLoaded: boolean
  /** Whether image is currently loading */
  isLoading: boolean
  /** Loading error if any */
  error: Error | null
  /** Whether to show blur effect */
  shouldBlur: boolean
  /** Blur intensity (0-20) */
  blurRadius: number
  /** Opacity for smooth transition */
  opacity: number
}

export function useProgressiveImage({
  placeholderSrc,
  src,
  onLoad,
  onError,
  loadDelay = 0,
  enableBlur = true,
}: ProgressiveImageOptions): UseProgressiveImageReturn {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || src)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      setIsLoading(false)
      onError?.(err)
    },
    [onError]
  )

  useEffect(() => {
    if (!src) return

    // Show placeholder immediately if available
    if (placeholderSrc && currentSrc !== placeholderSrc) {
      setCurrentSrc(placeholderSrc)
    }

    const timer = setTimeout(() => {
      setIsLoading(true)

      if (Platform.OS === 'web') {
        // Web: use Image API
        const img = new Image()
        img.onload = () => {
          setCurrentSrc(src)
          handleLoad()
        }
        img.onerror = () => {
          handleError(new Error('Failed to load image'))
        }
        img.src = src
      } else {
        // Native: direct load
        setCurrentSrc(src)
        handleLoad()
      }
    }, loadDelay)

    return () => clearTimeout(timer)
  }, [src, placeholderSrc, loadDelay, currentSrc, handleLoad, handleError])

  // Calculate blur and opacity based on loading state
  const shouldBlur = enableBlur && !isLoaded && Boolean(placeholderSrc)
  const blurRadius = shouldBlur ? (Platform.OS === 'web' ? 20 : 10) : 0
  const opacity = isLoaded ? 1 : placeholderSrc ? 0.9 : 0.5

  return {
    currentSrc,
    isLoaded,
    isLoading,
    error,
    shouldBlur,
    blurRadius,
    opacity,
  }
}

/**
 * Generate LQIP (Low Quality Image Placeholder) URL
 * Returns a tiny, highly compressed version for instant loading
 */
export function generateLQIP(imageUrl: string, options?: { width?: number; quality?: number }): string {
  const width = options?.width || 40
  const quality = options?.quality || 20

  // Check if it's our API that supports query params
  if (imageUrl.includes('/api/') || imageUrl.includes('/uploads/')) {
    const separator = imageUrl.includes('?') ? '&' : '?'
    return `${imageUrl}${separator}w=${width}&q=${quality}&blur=50`
  }

  return imageUrl
}

/**
 * Preload critical images to improve LCP
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web') {
      resolve()
      return
    }

    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Failed to preload ${src}`))
    img.src = src
  })
}

/**
 * Preload multiple images with priority
 */
export async function preloadImages(sources: Array<{ src: string; priority?: number }>): Promise<void> {
  // Sort by priority (higher first)
  const sorted = [...sources].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  // Preload in batches to avoid overwhelming the browser
  const batchSize = 3
  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize)
    await Promise.all(batch.map((item) => preloadImage(item.src).catch(() => undefined)))
  }
}
