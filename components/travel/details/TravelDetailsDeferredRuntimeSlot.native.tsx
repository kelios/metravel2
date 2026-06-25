import React from 'react'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'

type TravelDetailsDeferredRuntimeSlotProps = {
  anchors: any
  deferredChromeReady: boolean
  forceOpenKey: string | null
  isMobile: boolean
  scrollToMapSection: () => void
  travel: any
}

export default function TravelDetailsDeferredRuntimeSlot({
  anchors,
  deferredChromeReady,
  forceOpenKey,
  isMobile,
  scrollToMapSection,
  travel,
}: TravelDetailsDeferredRuntimeSlotProps) {
  if (!deferredChromeReady) return null

  return (
    <TravelDetailsPostLcpRuntime
      travel={travel}
      isMobile={isMobile}
      anchors={anchors}
      forceOpenKey={forceOpenKey}
      scrollToMapSection={scrollToMapSection}
    />
  )
}
