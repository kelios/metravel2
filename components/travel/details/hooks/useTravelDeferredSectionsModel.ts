import { useEffect, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useTdTrace } from '@/hooks/useTdTrace'

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

function runWhenBrowserIdle(callback: () => void, fallbackMs = 250): () => void {
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

// #562: visibility (IntersectionObserver) is the primary trigger for every deferred
// section. Author/rating sit just below the fold and are almost always reached quickly,
// so they keep a short fallback that smooths over a missed observer. The heavy sections
// (map/sidebar/comments/footer) must NOT be force-mounted by a short fixed timer while
// they are still off-viewport — that spent CPU/network (comments, related travels) for
// content the user may never scroll to. Their fallback is a long safe backstop only;
// in practice the observer mounts them as they approach the viewport well before it.
const HEAVY_SECTION_FALLBACK_BACKSTOP_MS = 8000

const TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS = {
  author: {
    fallbackDelay: 500,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:author:visible',
  },
  comments: {
    fallbackDelay: HEAVY_SECTION_FALLBACK_BACKSTOP_MS,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:comments:visible',
  },
  footer: {
    fallbackDelay: HEAVY_SECTION_FALLBACK_BACKSTOP_MS,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:footer:visible',
  },
  map: {
    fallbackDelay: HEAVY_SECTION_FALLBACK_BACKSTOP_MS,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:map:visible',
  },
  rating: {
    fallbackDelay: 600,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:rating:visible',
  },
  sidebar: {
    fallbackDelay: HEAVY_SECTION_FALLBACK_BACKSTOP_MS,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:sidebar:visible',
  },
} as const

type UseTravelDeferredSectionsModelArgs = {
  travelId?: number
}

function useDeferredProgressiveSection(
  config: (typeof TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS)[keyof typeof TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS],
  enabled: boolean,
) {
  const tdTrace = useTdTrace()
  const section = useProgressiveLoad({
    ...config,
    enabled,
  })

  useEffect(() => {
    if (section.shouldLoad) tdTrace(config.traceKey)
  }, [config.traceKey, section.shouldLoad, tdTrace])

  return section
}

export function useTravelDeferredSectionsModel({
  travelId,
}: UseTravelDeferredSectionsModelArgs) {
  // On web the heavy travel tree (incl. the Leaflet map) must not mount in the same
  // synchronous commit as an SPA navigation, or the main thread freezes and the skeleton
  // overlay stays up (white screen). Start `false` on web and flip to `true` on browser idle,
  // and reset to `false` during render whenever travelId changes so a cached SPA swap behaves
  // like a fresh mount. Native keeps its eager `true` + InteractionManager behaviour below.
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS !== 'web')
  const [prevTravelId, setPrevTravelId] = useState(travelId)
  if (travelId !== prevTravelId) {
    setPrevTravelId(travelId)
    if (Platform.OS === 'web') setCanRenderHeavy(false)
  }
  const tdTrace = useTdTrace()

  const { shouldLoad: shouldLoadMap, setElementRef: setMapRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.map,
    canRenderHeavy,
  )
  const { shouldLoad: shouldLoadSidebar, setElementRef: setSidebarRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.sidebar,
    canRenderHeavy,
  )
  const { shouldLoad: shouldLoadComments, setElementRef: setCommentsRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.comments,
    canRenderHeavy,
  )
  const { shouldLoad: shouldLoadFooter, setElementRef: setFooterRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.footer,
    canRenderHeavy,
  )
  const { shouldLoad: shouldLoadAuthorSection, setElementRef: setAuthorSectionRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.author,
    canRenderHeavy,
  )
  const { shouldLoad: shouldLoadRating, setElementRef: setRatingRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.rating,
    canRenderHeavy,
  )

  useEffect(() => {
    tdTrace('deferred:mount', { travelId })
    return () => tdTrace('deferred:unmount', { travelId })
  }, [tdTrace, travelId])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (canRenderHeavy) return
    const cleanup = runWhenBrowserIdle(() => setCanRenderHeavy(true), 250)
    return cleanup
  }, [canRenderHeavy, travelId])

  useEffect(() => {
    if (canRenderHeavy) tdTrace('deferred:heavy:enabled')
  }, [canRenderHeavy, tdTrace])

  return {
    canRenderHeavy,
    setAuthorSectionRef,
    setCommentsRef,
    setFooterRef,
    setMapRef,
    setRatingRef,
    setSidebarRef,
    shouldLoadAuthorSection,
    shouldLoadComments,
    shouldLoadFooter,
    shouldLoadMap,
    shouldLoadRating,
    shouldLoadSidebar,
  }
}
