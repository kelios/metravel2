import React, { memo } from 'react'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import { TravelHeroSection } from './TravelDetailsSections'
import type { AnchorsMap } from './TravelDetailsTypes'
import TravelAuthorQuickLink from './TravelAuthorQuickLink'
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
  suppressHeroQuickJumps?: boolean
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
  suppressHeroQuickJumps,
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
        suppressHeroQuickJumps={suppressHeroQuickJumps}
      />

      {deferredContent}
    </>
  )
}

// Hero block in isolation — used by the native sticky layout (CriticalShell) so the
// sub-nav can be a direct ScrollView child between the hero and the content sections.
export function TravelDetailsHeroBlock({
  anchors,
  deferHeroExtras,
  isMobile,
  onFirstImageLoad,
  onQuickJump,
  sectionLinks,
  travel,
  activeKey,
  suppressHeroQuickJumps,
}: Omit<
  TravelDetailsHeroDeferredColumnProps,
  'deferredContent' | 'forceOpenKey'
>) {
  return (
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
      suppressQuickJumps={suppressHeroQuickJumps}
    />
  )
}

// Content sections (description / video / insights) without the hero — paired with
// TravelDetailsHeroBlock by the native sticky layout.
export function TravelDetailsContentBlock({
  anchors,
  forceOpenKey,
  isMobile,
  travel,
}: Pick<
  TravelDetailsHeroDeferredColumnProps,
  'anchors' | 'forceOpenKey' | 'isMobile' | 'travel'
>) {
  return (
    <TravelDetailsContentSection
      travel={travel}
      isMobile={isMobile}
      anchors={anchors}
      forceOpenKey={forceOpenKey}
    />
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
  suppressHeroQuickJumps,
}: Omit<TravelDetailsHeroDeferredColumnProps, 'deferredContent'>) {
  return (
    <>
      {/* No wrapping View here: on web a wrapper div (RNW default overflow:hidden) becomes the
          containing block for the sticky sub-nav inside the hero, clipping it to the hero block so
          it scrolls away with the gallery (#341). Keeping the hero + content sections as direct
          fragment siblings lets `position: sticky` pin across the whole article. */}
      {isMobile ? <TravelAuthorQuickLink travel={travel} /> : null}

      <TravelDetailsHeroBlock
        travel={travel}
        anchors={anchors}
        deferHeroExtras={deferHeroExtras}
        isMobile={isMobile}
        onFirstImageLoad={onFirstImageLoad}
        onQuickJump={onQuickJump}
        sectionLinks={sectionLinks}
        activeKey={activeKey}
        suppressHeroQuickJumps={suppressHeroQuickJumps}
      />

      <TravelDetailsContentBlock
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />
    </>
  )
})
