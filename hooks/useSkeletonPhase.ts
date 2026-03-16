import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

export type SkeletonPhase = 'loading' | 'fading' | 'hidden'

interface UseSkeletonPhaseArgs {
  isDataReady: boolean
  isVisualReady?: boolean
}

export function useSkeletonPhase({
  isDataReady,
  isVisualReady = isDataReady,
}: UseSkeletonPhaseArgs) {
  const [skeletonPhase, setSkeletonPhase] = useState<SkeletonPhase>('loading')

  useEffect(() => {
    if (Platform.OS !== 'web') return

    if (!isDataReady || !isVisualReady) {
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
  }, [isDataReady, isVisualReady])

  return skeletonPhase
}
