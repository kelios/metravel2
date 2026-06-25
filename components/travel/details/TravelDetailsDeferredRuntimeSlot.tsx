import React, { Suspense } from 'react'
import { lazyWithRetry } from '@/utils/chunkReload'

const TravelDetailsPostLcpRuntimeLazy = lazyWithRetry(
  () => import('@/components/travel/details/TravelDetailsPostLcpRuntime'),
  { name: 'TravelDetailsPostLcpRuntime' },
)

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
    <Suspense fallback={null}>
      <TravelDetailsPostLcpRuntimeLazy
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
        scrollToMapSection={scrollToMapSection}
      />
    </Suspense>
  )
}
