import React from 'react'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'

type TravelDetailsDeferredRuntimeSlotProps = {
  anchors: any
  deferredChromeReady: boolean
  forceOpenKey: string | null
  isMobile: boolean
  scrollY?: any
  settledScrollOffsetY?: number
  scrollToMapSection: () => void
  travel: any
  viewportHeight?: number
}

export default function TravelDetailsDeferredRuntimeSlot({
  anchors,
  deferredChromeReady,
  forceOpenKey,
  isMobile,
  scrollY,
  settledScrollOffsetY,
  scrollToMapSection,
  travel,
  viewportHeight,
}: TravelDetailsDeferredRuntimeSlotProps) {
  if (!deferredChromeReady) return null

  return (
    <TravelDetailsPostLcpRuntime
      travel={travel}
      isMobile={isMobile}
      anchors={anchors}
      forceOpenKey={forceOpenKey}
      scrollY={scrollY}
      settledScrollOffsetY={settledScrollOffsetY}
      scrollToMapSection={scrollToMapSection}
      viewportHeight={viewportHeight}
    />
  )
}
