import React from 'react'
import { View } from 'react-native'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { Travel } from '@/types/types'
import QuickFacts from '@/components/travel/QuickFacts'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import TravelHeroQuickJumps from './TravelHeroQuickJumps'
import { useTravelHeroExtrasModel } from './hooks/useTravelHeroExtrasModel'

export const TravelHeroExtras: React.FC<{
  travel: Travel
  isMobile: boolean
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
}> = ({ travel, isMobile, sectionLinks, onQuickJump }) => {
  const styles = useTravelDetailsHeroStyles()
  const { quickJumpLinks, showQuickJumps } = useTravelHeroExtrasModel(sectionLinks)

  return (
    <>
      <View
        testID="travel-details-quick-facts"
        accessibilityRole="none"
        accessibilityLabel="Краткие факты"
        style={[
          styles.sectionContainer,
          styles.contentStable,
          styles.quickFactsContainer,
        ]}
      >
        <QuickFacts travel={travel} />
      </View>

      {showQuickJumps && quickJumpLinks.length > 0 && (
        <View
          style={[
            styles.sectionContainer,
            styles.contentStable,
            styles.quickJumpWrapper,
          ]}
        >
          <TravelHeroQuickJumps
            links={quickJumpLinks}
            isMobile={isMobile}
            onQuickJump={onQuickJump}
          />
        </View>
      )}
    </>
  )
}

export default React.memo(TravelHeroExtras)
