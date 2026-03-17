import { useEffect, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useTdTrace } from '@/hooks/useTdTrace'

type UseTravelDeferredSectionsModelArgs = {
  travelId?: number
}

export function useTravelDeferredSectionsModel({
  travelId,
}: UseTravelDeferredSectionsModelArgs) {
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS === 'web')
  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as unknown as Record<string, unknown>).webdriver)

  const tdTrace = useTdTrace()

  const { shouldLoad: shouldLoadMap, setElementRef: setMapRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 800,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadSidebar, setElementRef: setSidebarRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 900,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadComments, setElementRef: setCommentsRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 950,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadFooter, setElementRef: setFooterRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadAuthorSection, setElementRef: setAuthorSectionRef } = useProgressiveLoad({
    priority: 'high',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 500,
    enabled: canRenderHeavy,
  })
  const { shouldLoad: shouldLoadRating, setElementRef: setRatingRef } = useProgressiveLoad({
    priority: 'high',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 600,
    enabled: canRenderHeavy,
  })

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

  useEffect(() => {
    if (shouldLoadMap) tdTrace('deferred:map:visible')
  }, [shouldLoadMap, tdTrace])

  useEffect(() => {
    if (shouldLoadSidebar) tdTrace('deferred:sidebar:visible')
  }, [shouldLoadSidebar, tdTrace])

  useEffect(() => {
    if (shouldLoadComments) tdTrace('deferred:comments:visible')
  }, [shouldLoadComments, tdTrace])

  useEffect(() => {
    if (shouldLoadFooter) tdTrace('deferred:footer:visible')
  }, [shouldLoadFooter, tdTrace])

  return {
    canRenderHeavy,
    isWebAutomation,
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
