import React, { Suspense, useEffect, useState } from 'react'
const TravelDetailsPostLcpRuntimeLazy = React.lazy(() =>
  import('@/components/travel/details/TravelDetailsPostLcpRuntime'),
)

type DeferProps = {
  when: boolean
  children: React.ReactNode
}

const Defer: React.FC<DeferProps> = ({ when, children }) => {
  const [ready, setReady] = useState(when)

  useEffect(() => {
    if (when) {
      setReady(true)
      return
    }
    setReady(false)
  }, [when])

  return ready ? <>{children}</> : null
}

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
  return (
    <Defer when={deferredChromeReady}>
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
    </Defer>
  )
}
