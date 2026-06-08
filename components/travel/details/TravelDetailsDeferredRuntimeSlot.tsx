import React, { Suspense } from 'react'
import { lazyWithRetry } from '@/utils/chunkReload'

const TravelDetailsPostLcpRuntimeLazy = lazyWithRetry(
  () => import('@/components/travel/details/TravelDetailsPostLcpRuntime'),
  { name: 'TravelDetailsPostLcpRuntime' },
)

type TravelDetailsDeferredRuntimeSlotProps = {
  activeSection: string | null
  anchors: any
  contentHeight: number
  criticalChromeReady: boolean
  deferredChromeReady: boolean
  forceOpenKey: string | null
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
  scrollToMapSection: () => void
  scrollViewRef: React.RefObject<any>
  scrollY: any
  sectionLinks: any[]
  travel: any
  viewportHeight: number
}

export default function TravelDetailsDeferredRuntimeSlot({
  activeSection,
  anchors,
  contentHeight,
  criticalChromeReady,
  deferredChromeReady,
  forceOpenKey,
  isMobile,
  onNavigate,
  screenWidth,
  scrollToComments,
  scrollToMapSection,
  scrollViewRef,
  scrollY,
  sectionLinks,
  travel,
  viewportHeight,
}: TravelDetailsDeferredRuntimeSlotProps) {
  if (!deferredChromeReady) return null

  return (
    <Suspense fallback={null}>
      <TravelDetailsPostLcpRuntimeLazy
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
    </Suspense>
  )
}
