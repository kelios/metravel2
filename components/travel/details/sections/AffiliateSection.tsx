import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import { isAffiliateEnabled } from '@/components/affiliate/affiliateConfig'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'

const LazyAffiliateOffers = React.lazy(() => import('@/components/affiliate/AffiliateOffers'))

const Fallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" accessibilityLabel="Загрузка предложений" />
    </View>
  )
}

export const AffiliateSection: React.FC<{
  travel: Travel
  styles: any
}> = ({ travel, styles }) => {
  // Web-only, contextual to the route's location, and off entirely until the
  // owner configures a Travelpayouts marker — so nothing ships until ready (FE-2).
  if (Platform.OS !== 'web' || !isAffiliateEnabled()) return null

  const city = travel.cityName?.trim()
  const country = travel.countryName?.trim()
  if (!city && !country) return null

  return (
    <Suspense fallback={<Fallback />}>
      <View
        style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
        collapsable={false}
        accessibilityLabel="Полезное в поездку"
        accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
        data-section-key="affiliate"
      >
        <Text
          style={styles.sectionHeaderText}
          accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
          aria-level={2 as any}
        >Полезное в поездку</Text>
        <Text style={styles.sectionSubtitle}>Экскурсии и жильё рядом с маршрутом</Text>

        <View style={{ marginTop: 12 }}>
          <LazyAffiliateOffers city={city} country={country} travelId={travel.id} />
        </View>
      </View>
    </Suspense>
  )
}

export default React.memo(AffiliateSection)
