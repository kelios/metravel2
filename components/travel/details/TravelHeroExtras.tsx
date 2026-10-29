import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { Travel } from '@/types/types'
import OfflineSaveControl from '@/components/offline/OfflineSaveControl'
import QuickFacts from '@/components/travel/QuickFacts'
import TravelStatusButton from '@/components/travel/TravelStatusButton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { loadTravelOfflineAdapter } from '@/services/offline/loadTravelOfflineAdapter'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import TravelHeroQuickJumps from './TravelHeroQuickJumps'
import { useTravelHeroExtrasModel } from './hooks/useTravelHeroExtrasModel'
import { translate as i18nT } from '@/i18n'
import { buildTravelPath } from '@/utils/travelSeo'


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
  // Офлайн-копия — такое же действие уровня страницы, как «Добавить в план», поэтому
  // живёт с ним в одном ряду под галереей, а не отдельной плашкой над всей страницей.
  const handleSaveOffline = useCallback(
    async (includePhotos: boolean) => {
      // #1552: тяжёлый адаптер нужен только после явного действия читателя.
      const { saveTravelOffline } = await loadTravelOfflineAdapter()
      return saveTravelOffline(travel, { pinned: true, includePhotos })
    },
    [travel],
  )

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
          !isMobile && actionStyles.summaryRow,
        ]}
      >
        <QuickFacts travel={travel} onCategoryPress={handleCategoryPress} />
        {/* На широком экране действия идут за фактами по размеру содержимого.
            На мобильном статус делит отдельный ряд с иконочным офлайн-чипом. */}
        <View style={actionStyles.row}>
          <TravelStatusButton
            travelId={travel.id}
            travelTitle={travel.name}
            travelUrl={buildTravelPath(travel) ?? ''}
            travelImageUrl={travel.travel_image_thumb_url}
            travelCountry={travel.countryName}
            travelYear={travel.year}
            travelMonthName={travel.monthName}
            style={[actionStyles.status, isMobile && actionStyles.statusMobile]}
          />
          {travel.id ? (
            <OfflineSaveControl
              type="travel"
              sourceId={travel.id}
              onSave={handleSaveOffline}
              compact={isMobile}
              style={[actionStyles.offline, isMobile && actionStyles.offlineMobile]}
            />
          ) : null}
        </View>
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

const actionStyles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  status: {
    flexBasis: 'auto',
    flexShrink: 1,
    minWidth: 0,
  },
  statusMobile: {
    flexGrow: 1,
  },
  offline: {
    alignSelf: 'center',
    marginBottom: 0,
  },
  offlineMobile: {
    // Иконка сохраняет тач-таргет и не сжимается, когда статус занимает остаток.
    flexShrink: 0,
  },
})

export default React.memo(TravelHeroExtras)
