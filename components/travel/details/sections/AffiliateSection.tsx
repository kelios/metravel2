import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import { getAffiliateOffers, isAffiliateEnabled } from '@/components/affiliate/affiliateConfig'
import { getCountryCodeByCoords } from '@/utils/geoCountry'
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

/** ISO country code: explicit `countryCode`, else derived from the first point's coords. */
const resolveCountryCode = (travel: Travel): string | undefined => {
  const explicit = String((travel as any).countryCode ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(explicit)) return explicit

  const point = travel.travelAddress?.[0] as { coord?: string; lat?: number; lng?: number } | undefined
  if (!point) return undefined

  let lat = typeof point.lat === 'number' ? point.lat : NaN
  let lng = typeof point.lng === 'number' ? point.lng : NaN
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && point.coord) {
    const [a, b] = point.coord.split(',').map((s) => Number(s.trim()))
    lat = a
    lng = b
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
  return getCountryCodeByCoords(lat, lng)
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
  // Reliable location signal = country code from the first map point's coords
  // (cityName is empty in the data); same approach as BelkrajWidget.
  const countryCode = resolveCountryCode(travel)
  if (!countryCode && !city && !country) return null

  // Don't render an orphan header when there are no offers to show.
  if (getAffiliateOffers({ city, country, countryCode, travelId: travel.id }).length === 0) return null

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
          <LazyAffiliateOffers
            city={city}
            country={country}
            countryCode={countryCode}
            travelId={travel.id}
          />
        </View>
      </View>
    </Suspense>
  )
}

export default React.memo(AffiliateSection)
