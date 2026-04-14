import { useEffect, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useTdTrace } from '@/hooks/useTdTrace'

const TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS = {
  author: {
    fallbackDelay: 500,
    priority: 'high' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:author:visible',
  },
  comments: {
    fallbackDelay: 950,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:comments:visible',
  },
  footer: {
    fallbackDelay: 1000,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:footer:visible',
  },
  map: {
    fallbackDelay: 800,
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
    fallbackDelay: 900,
    priority: 'low' as const,
    rootMargin: '200px',
    threshold: 0.1,
    traceKey: 'deferred:sidebar:visible',
  },
} as const

type UseTravelDeferredSectionsModelArgs = {
  travelId?: number
}

export function useTravelDeferredSectionsModel({
  travelId,
}: UseTravelDeferredSectionsModelArgs) {
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS === 'web')
  const tdTrace = useTdTrace()
  const useDeferredProgressiveSection = (config: (typeof TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS)[keyof typeof TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS]) => {
    const section = useProgressiveLoad({
      ...config,
      enabled: canRenderHeavy,
    })

    useEffect(() => {
      if (section.shouldLoad) tdTrace(config.traceKey)
    }, [config.traceKey, section.shouldLoad])

    return section
  }

  const { shouldLoad: shouldLoadMap, setElementRef: setMapRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.map,
  )
  const { shouldLoad: shouldLoadSidebar, setElementRef: setSidebarRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.sidebar,
  )
  const { shouldLoad: shouldLoadComments, setElementRef: setCommentsRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.comments,
  )
  const { shouldLoad: shouldLoadFooter, setElementRef: setFooterRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.footer,
  )
  const { shouldLoad: shouldLoadAuthorSection, setElementRef: setAuthorSectionRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.author,
  )
  const { shouldLoad: shouldLoadRating, setElementRef: setRatingRef } = useDeferredProgressiveSection(
    TRAVEL_DEFERRED_SECTION_LOAD_CONFIGS.rating,
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
