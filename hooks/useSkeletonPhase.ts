import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

export type SkeletonPhase = 'loading' | 'fading' | 'hidden'

interface UseSkeletonPhaseArgs {
  isDataReady: boolean
  isVisualReady?: boolean
  /**
   * Hard cap (ms) on how long the overlay may stay up after data is ready while
   * waiting for the visual-ready signal. The visual-ready signal (hero image
   * onLoad) is unreliable on SPA navigation — a browser-cached image can finish
   * before the handler attaches, so no load event fires and the overlay would
   * otherwise mask already-painted content indefinitely. When set, the overlay
   * lifts on `isDataReady` alone once this window elapses, independent of
   * `isVisualReady`. Disabled (no cap) when omitted.
   */
  visualReadyFallbackMs?: number
}

export function useSkeletonPhase({
  isDataReady,
  isVisualReady = isDataReady,
  visualReadyFallbackMs,
}: UseSkeletonPhaseArgs) {
  const [skeletonPhase, setSkeletonPhase] = useState<SkeletonPhase>('loading')
  const [visualReadyFallbackElapsed, setVisualReadyFallbackElapsed] =
    useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (
      typeof visualReadyFallbackMs !== 'number' ||
      visualReadyFallbackMs < 0 ||
      !isDataReady ||
      isVisualReady
    ) {
      setVisualReadyFallbackElapsed(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setVisualReadyFallbackElapsed(true)
    }, visualReadyFallbackMs)

    return () => clearTimeout(timeoutId)
  }, [isDataReady, isVisualReady, visualReadyFallbackMs])

  const isVisualReadyEffective = isVisualReady || visualReadyFallbackElapsed

  useEffect(() => {
    if (Platform.OS !== 'web') return

    if (!isDataReady || !isVisualReadyEffective) {
      setSkeletonPhase('loading')
      return
    }

    let cancelled = false
    const hide = () => {
      if (!cancelled) setSkeletonPhase('hidden')
    }

    if (typeof requestAnimationFrame === 'function') {
      const raf = requestAnimationFrame(hide)
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
      }
    } else {
      hide()
      return () => {
        cancelled = true
      }
    }
  }, [isDataReady, isVisualReadyEffective])

  return skeletonPhase
}
