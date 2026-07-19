import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, View, Text } from 'react-native'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { translate as i18nT } from '@/i18n'
import { getAccessibilityRole } from '@/utils/a11y'


const EXCURSION_CONTAINER_STYLE = { marginTop: 12 } as const
const EXCURSION_FALLBACK_STYLE = { minHeight: 160, paddingVertical: 16, alignItems: 'center' as const }

const LazyBelkrajWidget = React.lazy(() => import('@/components/belkraj/BelkrajWidget'))

const Fallback = () => (
  <View style={EXCURSION_FALLBACK_STYLE}>
    <ActivityIndicator size="small" accessibilityLabel={i18nT('travel:components.travel.details.sections.ExcursionsSection.zagruzka_ekskursiy_49fb29be')} />
  </View>
)

const ExcursionsLazySection: React.FC<{ children: React.ReactNode; forceVisible?: boolean }> = ({
  children,
}) => {
  return <>{children}</>
}

// Web-a11y роли на RN-примитивах через канонический хелпер utils/a11y
// (getAccessibilityRole: web-роли 'region'/'heading' → типобезопасный
// AccessibilityRole, any локализован в хелпере). dataSet — RN-way: RN-web
// рендерит его тем же DOM-атрибутом data-section-key (селектор e2e сохранён).
const webRegionProps = Platform.OS === 'web'
  ? {
      accessibilityRole: getAccessibilityRole('region'),
      dataSet: { sectionKey: 'excursions' },
    }
  : null

const webHeadingProps = Platform.OS === 'web'
  ? {
      accessibilityRole: getAccessibilityRole('heading'),
      'aria-level': 2,
    }
  : null

export const ExcursionsSection: React.FC<{
  travel: Travel
  anchors: AnchorsMap
  styles: any
  shouldForceRenderExcursions: boolean
}> = ({ travel, anchors, styles, shouldForceRenderExcursions }) => {
  if ((travel.travelAddress?.length ?? 0) <= 0) return null

  return (
    <Suspense fallback={<Fallback />}>
      <ExcursionsLazySection forceVisible={shouldForceRenderExcursions}>
        <View
          ref={anchors.excursions}
          style={[styles.sectionContainer, styles.contentStable, styles.webOptionalDeferredSection]}
          collapsable={false}
          accessibilityLabel={i18nT('travel:components.travel.details.sections.ExcursionsSection.ekskursii_ff03bd20')}
          {...(webRegionProps ?? {})}
        >
          <Text
            style={styles.sectionHeaderText}
            {...(webHeadingProps ?? {})}
          >{i18nT('travel:components.travel.details.sections.ExcursionsSection.ekskursii_ff03bd20')}</Text>
          <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.ExcursionsSection.pokazhem_ekskursii_ryadom_s_tochkami_marshru_e864b7dc')}</Text>

          <View style={[EXCURSION_CONTAINER_STYLE, styles.excursionsWidgetCard]}>
            <LazyBelkrajWidget
              countryCode={travel.countryCode}
              points={travel.travelAddress as any}
              cardsCount={6}
            />
          </View>
        </View>
      </ExcursionsLazySection>
    </Suspense>
  )
}

export default React.memo(ExcursionsSection)
