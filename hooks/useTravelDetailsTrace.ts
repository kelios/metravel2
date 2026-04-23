import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useTdTrace } from '@/hooks/useTdTrace'
import type { Travel } from '@/types/types'

interface TravelDetailsTraceArgs {
  travel: Travel | undefined
  isLoading: boolean
  isError: boolean
  isMissingParam: boolean
  slug: string
  skeletonPhase: 'loading' | 'fading' | 'hidden'
  lcpLoaded: boolean
  sliderReady: boolean
  deferAllowed: boolean
  postLcpRuntimeReady: boolean
}

export function useTravelDetailsTrace({
  travel,
  isLoading,
  isError,
  isMissingParam,
  slug,
  skeletonPhase,
  lcpLoaded,
  sliderReady,
  deferAllowed,
  postLcpRuntimeReady,
}: TravelDetailsTraceArgs) {
  const tdTrace = useTdTrace()

  useEffect(() => {
    tdTrace('container:mount')
    return () => tdTrace('container:unmount')
  }, [tdTrace])

  useEffect(() => {
    tdTrace(`skeleton:${skeletonPhase}`)
  }, [skeletonPhase, tdTrace])

  useEffect(() => {
    tdTrace(
      isMissingParam ? 'data:missing-param' : isError ? 'data:error' : travel ? 'data:ready' : 'data:loading',
      {
        hasTravel: Boolean(travel),
        isLoading,
        isError,
        slug,
        travelId: travel?.id,
      }
    )
  }, [isMissingParam, isError, travel, isLoading, slug, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    tdTrace(lcpLoaded ? 'hero:lcpLoaded' : 'hero:lcpPending')
  }, [lcpLoaded, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    tdTrace(sliderReady ? 'hero:sliderReady' : 'hero:sliderPending')
  }, [sliderReady, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    tdTrace(deferAllowed ? 'defer:allowed' : 'defer:blocked')
  }, [deferAllowed, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    tdTrace(postLcpRuntimeReady ? 'postLcpRuntime:ready' : 'postLcpRuntime:pending')
  }, [postLcpRuntimeReady, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    if (
      !(window as unknown as Record<string, unknown>).__METRAVEL_TD_TRACE &&
      !/(?:\?|&)tdtrace=1(?:&|$)/.test(window.location.search)
    ) {
      return
    }

    let cleanup: (() => void) | null = null
    let cancelled = false

    void import('@/hooks/travelDetailsLayoutTrace')
      .then((mod) => {
        if (!cancelled) cleanup = mod.startTravelDetailsLayoutTrace(tdTrace)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [tdTrace])

  return tdTrace
}
