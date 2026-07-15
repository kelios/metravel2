import React, { Suspense } from 'react'
import { Platform, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { withLazy } from '../TravelDetailsLazy'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { useThemedColors } from '@/hooks/useTheme'
import NavigationArrows from '@/components/travel/NavigationArrows'
import { useTravelDetailsSidebarSectionModel } from '../hooks/useTravelDetailsSidebarSectionModel'
import NearTravelList from '@/components/travel/NearTravelList'
import PopularTravelList from '@/components/travel/PopularTravelList'
import { getNearbyTravelsSubtitle } from '@/constants/nearby'
import { translate as i18nT } from '@/i18n'


const SIDEBAR_CONTENT_MARGIN_STYLE = { marginTop: 8 } as const
const LIST_FALLBACK_STYLE = { minHeight: 220 } as const

const NearTravelListLazy = withLazy(() =>
  Promise.resolve(import('@/components/travel/NearTravelList')).then((module) => ({
    default: module.default,
  })),
)

const PopularTravelListLazy = withLazy(() =>
  Promise.resolve(import('@/components/travel/PopularTravelList')).then((module) => ({
    default: module.default,
  })),
)
const NearTravelListComponent = Platform.OS === 'web' ? NearTravelListLazy : NearTravelList
const PopularTravelListComponent = Platform.OS === 'web' ? PopularTravelListLazy : PopularTravelList

export const TravelDetailsSidebarSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  canRenderHeavy: boolean
}> = ({
  travel,
  anchors,
  canRenderHeavy,
}) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const {
    handleTravelsLoaded,
    hasValidTravelId,
    nearInViewport,
    relatedTravels,
    setNearRef,
    setPopularRef,
    shouldShowNavigationArrows,
  } = useTravelDetailsSidebarSectionModel({
    canRenderHeavy,
    travel,
  })


  return (
    <>
      <View
        ref={(node) => {
          // Handle both anchor ref and progressive load ref
          if (anchors.near && typeof anchors.near === 'object') {
            (anchors.near as any).current = node;
          }
          setNearRef(node);
        }}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.ryadom_mozhno_posmotret_3f015f94')}
        accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'near' } : {})}
      >
        <View style={styles.sectionHeaderRow}>
          <Feather name="map-pin" size={18} color={colors.primaryDark} />
          <Text
            style={styles.sectionHeaderText}
            accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
            aria-level={2 as any}
          >{i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.ryadom_mozhno_posmotret_3f015f94')}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{getNearbyTravelsSubtitle()}</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          {hasValidTravelId && (
            <View testID="travel-details-near-loaded">
              <Suspense fallback={<View style={LIST_FALLBACK_STYLE} />}>
                <NearTravelListComponent
                  travel={travel}
                  onTravelsLoaded={handleTravelsLoaded}
                  showHeader={false}
                  embedded
                  fetchEnabled={nearInViewport}
                />
              </Suspense>
            </View>
          )}
        </View>
      </View>

      {shouldShowNavigationArrows && (
        <View
          style={[styles.sectionContainer, styles.navigationArrowsContainer]}
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.navigatsiya_po_pohozhim_marshrutam_cbec0b95')}
          role="navigation"
        >
          <NavigationArrows currentTravel={travel} relatedTravels={relatedTravels} />
        </View>
      )}

      <View
        ref={(node) => {
          if (anchors.popular && typeof anchors.popular === 'object') {
            (anchors.popular as any).current = node;
          }
          setPopularRef(node);
        }}
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.populyarnye_marshruty_e9bc8e8c')}
        accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
        {...(Platform.OS === 'web' ? { 'data-section-key': 'popular' } : {})}
      >
        <View style={styles.sectionHeaderRow}>
          <Feather name="trending-up" size={18} color={colors.primaryDark} />
          <Text
            style={styles.sectionHeaderText}
            accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
            aria-level={2 as any}
          >{i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.populyarnye_marshruty_e9bc8e8c')}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.samye_prosmatrivaemye_napravleniya_za_nedely_e8d2c61d')}</Text>
        <View style={SIDEBAR_CONTENT_MARGIN_STYLE}>
          <View testID="travel-details-popular-loaded">
            <Suspense fallback={<View style={LIST_FALLBACK_STYLE} />}>
              <PopularTravelListComponent title={null} showHeader={false} embedded />
            </Suspense>
          </View>
        </View>
      </View>
    </>
  )
}
