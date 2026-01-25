import React, { useEffect, useState } from 'react'
import { Animated, InteractionManager, Platform } from 'react-native'
import type { Travel } from '@/src/types/types'

import type { AnchorsMap } from './TravelDetailsTypes'
import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'
import { TravelDetailsMapSection } from './sections/TravelDetailsMapSection'
import { TravelDetailsSidebarSection } from './sections/TravelDetailsSidebarSection'
import { TravelDetailsFooterSection } from './sections/TravelDetailsFooterSection'

const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
}

export const TravelDeferredSections: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollY: Animated.Value
  viewportHeight: number
  scrollRef: any
  scrollToMapSection: () => void
}> = ({
  travel,
  isMobile,
  forceOpenKey,
  anchors,
  scrollY,
  viewportHeight,
  scrollRef,
  scrollToMapSection,
}) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') return
    const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true))
    return () => task.cancel()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') {
      rIC(() => {
        setCanRenderHeavy(true)
      }, 1200)
    }
  }, [])

  return (
    <>
      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
        scrollRef={scrollRef}
      />

      <TravelDetailsMapSection
        travel={travel}
        anchors={anchors}
        canRenderHeavy={canRenderHeavy}
        scrollToMapSection={scrollToMapSection}
      />

      <TravelDetailsSidebarSection
        travel={travel}
        anchors={anchors}
        scrollY={scrollY}
        viewportHeight={viewportHeight}
        canRenderHeavy={canRenderHeavy}
      />

      <TravelEngagementSection travel={travel} isMobile={isMobile} />
    </>
  )
}

export const TravelEngagementSection: React.FC<{ travel: Travel; isMobile: boolean }> = (props) => {
  return <TravelDetailsFooterSection {...props} />
}
