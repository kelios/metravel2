import React, { memo, useCallback, useId, useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'

import { translate as i18nT } from '@/i18n'
import { getCountryCodeByCoords } from '@/utils/geoCountry'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface TravelAddress {
  id: number
  address: string
  coord?: string
  lat?: number
  lng?: number
}

type Props = {
  points: TravelAddress[]
  countryCode?: string
  collapsedHeight?: number
  expandedHeight?: number
  allowScroll?: boolean
  cardsCount?: number
}

const BELKRAJ_ORIGIN = 'https://belkraj.by'
const MIN_WIDGET_HEIGHT = 320

const getEstimatedWidgetHeight = (cardsCount: number, width: number) => {
  if (!width || width <= 0) return 980

  const columns = width <= 470 ? 1 : width <= 700 ? 2 : 3
  const visibleCards = width > 470 && width <= 700
    ? cardsCount - Math.floor(cardsCount / 3)
    : cardsCount
  const rows = Math.max(1, Math.ceil(visibleCards / columns))
  const rowHeight = width <= 470 ? 168 : 420
  const rowGap = width <= 470 ? 12 : 24
  const topBlockHeight = 88
  const bottomActionHeight = 88

  return Math.max(
    MIN_WIDGET_HEIGHT,
    topBlockHeight + (rows * rowHeight) + (Math.max(0, rows - 1) * rowGap) + bottomActionHeight,
  )
}

const parsePointCoord = (point?: TravelAddress) => {
  if (!point) return null
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    return { lat: point.lat, lng: point.lng }
  }
  if (!point.coord) return null

  const [rawLat, rawLng] = point.coord.split(',').map((value) => value.trim())
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function BelkrajWidget({
  points,
  countryCode,
  collapsedHeight,
  expandedHeight = 1200,
  allowScroll = false,
  cardsCount = 6,
}: Props) {
  const { width } = useWindowDimensions()
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const reactId = useId()
  const widgetId = useMemo(() => `metravel-${reactId.replace(/[:]/g, '')}`, [reactId])

  const firstCoord = useMemo(() => parsePointCoord(points?.[0]), [points])
  const calculatedHeight = useMemo(
    () => getEstimatedWidgetHeight(cardsCount, width),
    [cardsCount, width],
  )
  const finalHeight = allowScroll
    ? Math.max(expandedHeight, collapsedHeight ?? calculatedHeight)
    : collapsedHeight ?? calculatedHeight

  const resolvedCountryCode = useMemo(() => {
    const normalized = String(countryCode || '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(normalized)) return normalized
    if (!firstCoord) return undefined
    return getCountryCodeByCoords(firstCoord.lat, firstCoord.lng)
  }, [countryCode, firstCoord])

  const widgetUrl = useMemo(() => {
    if (!firstCoord) return null
    const params = new URLSearchParams({
      lat: String(firstCoord.lat),
      lng: String(firstCoord.lng),
      term: 'place',
      theme: 'cards',
      partner: 'u180793',
      size: String(cardsCount),
      widgetId,
    })
    if (resolvedCountryCode) params.set('country', resolvedCountryCode)
    return `${BELKRAJ_ORIGIN}/partner/widget?${params.toString()}`
  }, [cardsCount, firstCoord, resolvedCountryCode, widgetId])

  const handleShouldStartLoad = useCallback((request: WebViewNavigation) => {
    const url = request.url
    if (!url || url === 'about:blank' || url.startsWith(BELKRAJ_ORIGIN)) return true

    void openExternalUrlInNewTab(url, {
      allowedProtocols: ['https:'],
      windowFeatures: 'noopener',
    })
    return false
  }, [])

  const isProd =
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'production'

  if (!firstCoord || !isProd || !widgetUrl) return null

  return (
    <View style={[styles.container, { height: finalHeight }]}>
      <WebView
        testID="belkraj-native-webview"
        source={{ uri: widgetUrl }}
        style={styles.webview}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="compatibility"
        androidLayerType="hardware"
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        accessibilityLabel={i18nT('shared:components.belkraj.BelkrajWidget.belkraj_partner_offers_b193ce0d')}
      />
    </View>
  )
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    minHeight: MIN_WIDGET_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})

export default memo(BelkrajWidget)
