import React, { memo } from 'react'
import { View } from 'react-native'

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
  onFirstImageLoad: () => void
  onQuickJump: (key: string) => void
  sectionLinks: TravelSectionLink[]
  travel: Travel
  activeKey?: string
}

export default function TravelDetailsHeroDeferredColumn({
  anchors,
  deferredContent,
  deferHeroExtras,
  forceOpenKey,
  isMobile,
  onFirstImageLoad,
  onQuickJump,
  sectionLinks,
  travel,
  activeKey,
}: TravelDetailsHeroDeferredColumnProps) {
  return (
    <>
      <TravelDetailsPrimaryColumn
        travel={travel}
        anchors={anchors}
        deferHeroExtras={deferHeroExtras}
        forceOpenKey={forceOpenKey}
        isMobile={isMobile}
        onFirstImageLoad={onFirstImageLoad}
        onQuickJump={onQuickJump}
        sectionLinks={sectionLinks}
        activeKey={activeKey}
      />

      {deferredContent}
    </>
  )
}

const TravelDetailsPrimaryColumn = memo(function TravelDetailsPrimaryColumn({
  anchors,
  deferHeroExtras,
  forceOpenKey,
  isMobile,
  onFirstImageLoad,
  onQuickJump,
  sectionLinks,
  travel,
  activeKey,
}: Omit<TravelDetailsHeroDeferredColumnProps, 'deferredContent'>) {
  return (
    <>
      <View collapsable={false}>
        <TravelHeroSection
          travel={travel}
          anchors={anchors}
          isMobile={isMobile}
          renderSlider
          onFirstImageLoad={onFirstImageLoad}
          sectionLinks={sectionLinks}
          onQuickJump={onQuickJump}
          deferExtras={deferHeroExtras}
          activeKey={activeKey}
        />
      </View>

      <TravelDetailsContentSection
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />
    </>
  )
})
