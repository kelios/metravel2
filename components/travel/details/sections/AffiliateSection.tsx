import React from 'react'
import { Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import { getAffiliateOffers, isAffiliateEnabled } from '@/components/affiliate/affiliateConfig'
import AffiliateOffers from '@/components/affiliate/AffiliateOffers'
import { getCountryCodeByCoords } from '@/utils/geoCountry'

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
  // Contextual to the route's location, and off entirely until the owner
  // configures a Travelpayouts marker — so nothing ships until ready (FE-2).
  if (!isAffiliateEnabled()) return null

  const city = travel.cityName?.trim()
  const country = travel.countryName?.trim()
  // Reliable location signal = country code from the first map point's coords
  // (cityName is empty in the data); same approach as BelkrajWidget.
  const countryCode = resolveCountryCode(travel)
  if (!countryCode && !city && !country) return null

  // Don't render an orphan header when there are no offers to show.
  if (getAffiliateOffers({ city, country, countryCode, travelId: travel.id }).length === 0) return null

  const webRegionProps = Platform.OS === 'web'
    ? {
        accessibilityRole: 'region' as any,
        dataSet: { sectionKey: 'affiliate' },
      }
    : null

  const webHeadingProps = Platform.OS === 'web'
    ? {
        accessibilityRole: 'heading' as any,
        'aria-level': 2 as any,
      }
    : null

  return (
    <View
      style={[
        styles.sectionContainer,
        styles.contentStable,
        Platform.OS === 'web' ? styles.webDeferredSection : null,
      ]}
      collapsable={false}
      accessibilityLabel="Полезное в поездку"
      {...(webRegionProps ?? {})}
    >
      <Text
        style={styles.sectionHeaderText}
        {...(webHeadingProps ?? {})}
      >Полезное в поездку</Text>
      <Text style={styles.sectionSubtitle}>Экскурсии и жильё рядом с маршрутом</Text>

      <View style={{ marginTop: 12 }}>
        <AffiliateOffers
          city={city}
          country={country}
          countryCode={countryCode}
          travelId={travel.id}
        />
      </View>
    </View>
  )
}

export default React.memo(AffiliateSection)
