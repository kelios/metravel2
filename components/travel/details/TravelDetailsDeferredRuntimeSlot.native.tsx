import React from 'react'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'
import { useTravelDetailsDeferredScroll } from '@/components/travel/details/TravelDetailsDeferredScrollContext'

type TravelDetailsDeferredRuntimeSlotProps = {
  anchors: any
  criticalChromeReady: boolean
  deferredChromeReady: boolean
  forceOpenKey: string | null
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
  scrollToMapSection: () => void
  scrollViewRef: React.RefObject<any>
  sectionLinks: any[]
  travel: any
}

export default function TravelDetailsDeferredRuntimeSlot({
  anchors,
  criticalChromeReady,
  deferredChromeReady,
  forceOpenKey,
  isMobile,
  onNavigate,
  screenWidth,
  scrollToComments,
  scrollToMapSection,
  scrollViewRef,
  sectionLinks,
  travel,
}: TravelDetailsDeferredRuntimeSlotProps) {
  const { activeSection, contentHeight, viewportHeight, scrollY } =
    useTravelDetailsDeferredScroll()

  if (!deferredChromeReady) return null

  return (
    <TravelDetailsPostLcpRuntime
      travel={travel}
      isMobile={isMobile}
      screenWidth={screenWidth}
      anchors={anchors}
      sectionLinks={sectionLinks}
      onNavigate={onNavigate}
      activeSection={activeSection}
      forceOpenKey={forceOpenKey}
      scrollY={scrollY}
      contentHeight={contentHeight}
      viewportHeight={viewportHeight}
      scrollViewRef={scrollViewRef}
      criticalChromeReady={criticalChromeReady}
      scrollToMapSection={scrollToMapSection}
      scrollToComments={scrollToComments}
    />
  )
}
