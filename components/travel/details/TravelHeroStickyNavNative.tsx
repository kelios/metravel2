import React from 'react'
import { View } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'

import TravelHeroQuickJumps from './TravelHeroQuickJumps'
import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroExtrasModel } from './hooks/useTravelHeroExtrasModel'

type TravelHeroStickyNavNativeProps = {
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
  contentHorizontalPadding: number
  activeKey?: string
}

// Native-only sticky sub-nav (Карта / Описание / Точки). Rendered as a direct
// ScrollView child so it can be pinned via `stickyHeaderIndices` — RN has no
// `position: sticky`, and the in-hero copy is nested too deep to qualify (#341).
// Web keeps the in-hero CSS-sticky variant (TravelHeroExtras), this component is
// never mounted on web.
function TravelHeroStickyNavNative({
  sectionLinks,
  onQuickJump,
  contentHorizontalPadding,
  activeKey,
}: TravelHeroStickyNavNativeProps) {
  const styles = useTravelDetailsHeroStyles()
  const { quickJumpLinks, showQuickJumps } = useTravelHeroExtrasModel(sectionLinks)

  if (!showQuickJumps || quickJumpLinks.length === 0) return null

  return (
    <View style={[styles.quickJumpStickyNativeBar, { paddingHorizontal: contentHorizontalPadding }]}>
      <View style={[styles.quickJumpWrapper, styles.quickJumpStickyNativeInner]}>
        <TravelHeroQuickJumps
          links={quickJumpLinks}
          isMobile
          onQuickJump={onQuickJump}
          activeKey={activeKey}
        />
      </View>
    </View>
  )
}

export default React.memo(TravelHeroStickyNavNative)
