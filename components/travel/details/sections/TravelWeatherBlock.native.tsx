import React from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import WeatherWidget from '@/components/home/WeatherWidget'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { Travel } from '@/types/types'
import { isWebAutomation } from '@/utils/isWebAutomation'
import { translate as i18nT } from '@/i18n'


export const TravelWeatherBlock: React.FC<{
  colors: any
  setWeatherVisible: (value: boolean) => void
  styles: any
  travel: Travel
  weatherVisible: boolean
}> = ({ colors, setWeatherVisible, styles, travel, weatherVisible }) => {
  const weatherPoints = React.useMemo(
    () =>
      (travel.travelAddress ?? [])
        .map((item) => {
          if (typeof item === 'string') return { coord: item.trim() }
          const p = item as any
          const coord =
            (typeof p?.coord === 'string' && p.coord) ||
            (typeof p?.coords === 'string' && p.coords) ||
            (p?.lat != null && p?.lng != null ? `${p.lat},${p.lng}` : '')
          return { coord: String(coord).trim(), address: p?.address ?? p?.name }
        })
        .filter((p) => p.coord.length > 0),
    [travel.travelAddress],
  )
  if (weatherPoints.length <= 0 || isWebAutomation) return null

  return (
    <View
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : 'none'}
      accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pogoda_9e3017f3')}
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        {i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pogoda_9e3017f3')}</Text>
      <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.TravelWeatherBlock.prognoz_po_tochkam_marshruta_53153181')}</Text>
      {!weatherVisible ? (
        <Pressable
          onPress={() => setWeatherVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pokazat_pogodu_po_tochkam_marshruta_295a8bca')}
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
            {i18nT('travel:components.travel.details.sections.TravelWeatherBlock.pokazat_pogodu_0db4f2e2')}</Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: DESIGN_TOKENS.spacing.sm }}>
          <WeatherWidget points={weatherPoints} countryName={travel.countryName} />
        </View>
      )}
    </View>
  )
}

export default React.memo(TravelWeatherBlock)
