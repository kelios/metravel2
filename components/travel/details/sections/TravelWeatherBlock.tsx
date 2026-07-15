import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import type { Travel } from '@/types/types'
import { isWebAutomation } from '@/utils/isWebAutomation'
import { translate as i18nT } from '@/i18n'


const WeatherWidget = React.lazy(() => import('@/components/home/WeatherWidget'))

// WeatherWidget ждёт { coord: 'lat,lng', address }. API детали отдаёт точки как
// { coord, address } (так же читает PointList), но типы/некоторые источники дают
// { coords, name } или { lat, lng }. Поддерживаем все три, иначе виджет получает
// пустой coord и рендерит null (#579).
export const toWeatherPoints = (
  travelAddress: Travel['travelAddress'],
): { coord: string; address?: string }[] =>
  (travelAddress ?? [])
    .map((item) => {
      if (typeof item === 'string') return { coord: item.trim() }
      const p = item as any
      const coord =
        (typeof p?.coord === 'string' && p.coord) ||
        (typeof p?.coords === 'string' && p.coords) ||
        (p?.lat != null && p?.lng != null ? `${p.lat},${p.lng}` : '')
      return { coord: String(coord).trim(), address: p?.address ?? p?.name }
    })
    .filter((p) => p.coord.length > 0)

const WEATHER_PLACEHOLDER_STYLE = {
  minHeight: 120,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}

const WeatherErrorFallback: React.FC<{ colors: any; onRetry: () => void }> = ({ colors, onRetry }) => (
  <View style={{ minHeight: 120, justifyContent: 'center', gap: DESIGN_TOKENS.spacing.sm, marginTop: DESIGN_TOKENS.spacing.sm } as any}>
    <Text style={{ color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
      {i18nT('travel:components.travel.details.sections.TravelWeatherBlock.ne_udalos_zagruzit_pogodu_28c03dd5')}</Text>
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.povtorit_zagruzku_pogody_6dea5a7f')}
      style={({ pressed }) => [{
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        minHeight: 44,
        alignSelf: 'flex-start',
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      } as any]}
    >
      <Feather name="refresh-cw" size={16} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
        {i18nT('travel:components.travel.details.sections.TravelWeatherBlock.povtorit_5e33f7a9')}</Text>
    </Pressable>
  </View>
)

export const TravelWeatherBlock: React.FC<{
  colors: any
  setWeatherVisible: (value: boolean) => void
  styles: any
  travel: Travel
  weatherVisible: boolean
}> = ({ colors, setWeatherVisible, styles, travel, weatherVisible }) => {
  const [retryKey, setRetryKey] = React.useState(0)
  const weatherPoints = React.useMemo(() => toWeatherPoints(travel.travelAddress), [travel.travelAddress])
  if (weatherPoints.length <= 0 || isWebAutomation) return null

  return (
    <View
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : 'none'}
      accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pogoda_853f5c3c')}
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >{i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pogoda_853f5c3c')}</Text>
      <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.TravelWeatherBlock.prognoz_po_tochkam_marshruta_926029bd')}</Text>
      {!weatherVisible ? (
        <Pressable
          onPress={() => setWeatherVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pokazat_pogodu_po_tochkam_marshruta_a15c8883')}
          style={({ pressed }) => [{
            flexDirection: 'row',
            alignItems: 'center',
            gap: DESIGN_TOKENS.spacing.xs,
            minHeight: 44,
            borderRadius: DESIGN_TOKENS.radii.md,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
            alignSelf: 'flex-start',
            marginTop: DESIGN_TOKENS.spacing.sm,
          } as any]}
        >
          <Feather name="cloud" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
            {i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pokazat_pogodu_19f2da8f')}</Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: DESIGN_TOKENS.spacing.sm }}>
          <ErrorBoundary
            key={retryKey}
            fallback={
              <WeatherErrorFallback colors={colors} onRetry={() => setRetryKey((k) => k + 1)} />
            }
          >
            <Suspense
              fallback={
                <View style={WEATHER_PLACEHOLDER_STYLE}>
                  <ActivityIndicator size="small" accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.zagruzka_pogody_40fbc4c5')} />
                </View>
              }
            >
              <WeatherWidget points={weatherPoints} countryName={travel.countryName} />
            </Suspense>
          </ErrorBoundary>
        </View>
      )}
    </View>
  )
}

export default React.memo(TravelWeatherBlock)
