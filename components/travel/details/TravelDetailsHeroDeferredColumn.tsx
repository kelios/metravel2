import React from 'react'
import { Platform, View } from 'react-native'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { TravelHeroSection } from './TravelDetailsSections'
import type { AnchorsMap } from './TravelDetailsTypes'
import { TravelDetailsContentSection } from './sections/TravelDetailsContentSection'

type TravelDetailsHeroDeferredColumnProps = {
  anchors: AnchorsMap
  deferredContent: React.ReactNode
  deferHeroExtras: boolean
  forceOpenKey: string | null
  isMobile: boolean
  lcpLoaded: boolean
  onFirstImageLoad: () => void
  onQuickJump: (key: string) => void
  sectionLinks: TravelSectionLink[]
  travel: Travel
}

export default function TravelDetailsHeroDeferredColumn({
  anchors,
  deferredContent,
  deferHeroExtras,
  forceOpenKey,
  isMobile,
  lcpLoaded,
  onFirstImageLoad,
  onQuickJump,
  sectionLinks,
  travel,
}: TravelDetailsHeroDeferredColumnProps) {
  return (
    <>
      <View collapsable={false}>
        <TravelHeroSection
          travel={travel}
          anchors={anchors}
          isMobile={isMobile}
          renderSlider={Platform.OS !== 'web' ? true : lcpLoaded}
          onFirstImageLoad={onFirstImageLoad}
          sectionLinks={sectionLinks}
          onQuickJump={onQuickJump}
          deferExtras={deferHeroExtras}
        />
      </View>

      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />

      {deferredContent}
    </>
  )
}
