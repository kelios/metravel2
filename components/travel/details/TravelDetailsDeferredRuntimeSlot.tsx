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
  scrollY?: any
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
  scrollToMapSection,
  travel,
  viewportHeight,
}: TravelDetailsDeferredRuntimeSlotProps) {
  if (!deferredChromeReady) return null

  return (
    <Suspense fallback={null}>
      <TravelDetailsPostLcpRuntimeLazy
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
        scrollY={scrollY}
        scrollToMapSection={scrollToMapSection}
        viewportHeight={viewportHeight}
      />
    </Suspense>
  )
}
