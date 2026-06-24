import React, { Suspense } from 'react'
import { lazyWithRetry } from '@/utils/chunkReload'
import { useTravelDetailsDeferredScroll } from '@/components/travel/details/TravelDetailsDeferredScrollContext'

const TravelDetailsPostLcpRuntimeLazy = lazyWithRetry(
  () => import('@/components/travel/details/TravelDetailsPostLcpRuntime'),
  { name: 'TravelDetailsPostLcpRuntime' },
)

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
  // #565: scroll-derived state arrives via context so the root deferred element stays
  // stable across scroll; this slot is the boundary where scroll churn re-enters the tree.
  const { activeSection, contentHeight, viewportHeight, scrollY } =
    useTravelDetailsDeferredScroll()

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
