import React, { Suspense } from 'react'
import { Pressable, Text, View } from 'react-native'

import WeatherWidget from '@/components/home/WeatherWidget'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { Travel } from '@/types/types'
import { isWebAutomation } from '@/utils/isWebAutomation'

const WEATHER_PLACEHOLDER_STYLE = { minHeight: 120 } as const

export const TravelWeatherBlock: React.FC<{
  colors: any
  setWeatherVisible: (value: boolean) => void
  styles: any
  travel: Travel
  weatherVisible: boolean
}> = ({ colors, setWeatherVisible, styles, travel, weatherVisible }) => {
  if (!travel.travelAddress || (travel.travelAddress as any[]).length <= 0 || isWebAutomation) return null

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Погода"
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
    >
      <Text style={styles.sectionHeaderText}>Погода</Text>
      {!weatherVisible ? (
        <Pressable
          onPress={() => setWeatherVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Показать погоду"
          style={({ pressed }) => [{
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
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
            Показать погоду
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: DESIGN_TOKENS.spacing.sm }}>
          <Suspense fallback={<View style={WEATHER_PLACEHOLDER_STYLE} />}>
            <WeatherWidget points={travel.travelAddress as any} countryName={travel.countryName} />
          </Suspense>
        </View>
      )}
    </View>
  )
}

export default React.memo(TravelWeatherBlock)
