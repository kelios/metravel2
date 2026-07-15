import React, { useCallback } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { Travel } from '@/types/types'
import QuickFacts from '@/components/travel/QuickFacts'
import TravelStatusButton from '@/components/travel/TravelStatusButton'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import TravelHeroQuickJumps from './TravelHeroQuickJumps'
import { useTravelHeroExtrasModel } from './hooks/useTravelHeroExtrasModel'
import { translate as i18nT } from '@/i18n'


export const TravelHeroExtras: React.FC<{
  travel: Travel
  isMobile: boolean
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
  activeKey?: string
  suppressQuickJumps?: boolean
}> = ({ travel, isMobile, sectionLinks, onQuickJump, activeKey, suppressQuickJumps }) => {
  const styles = useTravelDetailsHeroStyles()
  const { quickJumpLinks, showQuickJumps } = useTravelHeroExtrasModel(sectionLinks)
  const router = useRouter()
  // Категории точек путешествия (Озеро/Река/Скала…) — это таксономия «Что посмотреть»
  // (categoryTravelAddress), как в фильтре карты, а не активити-категории путешествия.
  const handleCategoryPress = useCallback((category: string) => {
    router.push({ pathname: '/travelsby', params: { categoryTravelAddress: category } })
  }, [router])

  return (
    <>
      <View
        testID="travel-details-quick-facts"
        role="group"
        aria-label={i18nT('travel:components.travel.details.TravelHeroExtras.kratkie_fakty_e2e737ad')}
        style={[
          styles.sectionContainer,
          styles.contentStable,
          styles.quickFactsContainer,
        ]}
      >
        <QuickFacts travel={travel} onCategoryPress={handleCategoryPress} />
        <TravelStatusButton
          travelId={travel.id}
          travelTitle={travel.name}
          travelUrl={`/travels/${travel.slug || travel.id}`}
          travelImageUrl={travel.travel_image_thumb_url}
          travelCountry={travel.countryName}
          travelYear={travel.year}
          travelMonthName={travel.monthName}
        />
      </View>

      {!suppressQuickJumps && showQuickJumps && quickJumpLinks.length > 0 && (
        <View
          style={[
            styles.sectionContainer,
            styles.contentStable,
            styles.quickJumpWrapper,
            isMobile && styles.quickJumpStickyMobile,
          ]}
        >
          <TravelHeroQuickJumps
            links={quickJumpLinks}
            isMobile={isMobile}
            onQuickJump={onQuickJump}
            activeKey={activeKey}
          />
        </View>
      )}
    </>
  )
}

export default React.memo(TravelHeroExtras)
