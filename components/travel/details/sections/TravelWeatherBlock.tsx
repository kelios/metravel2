import React, { Suspense } from 'react'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import type { Travel } from '@/types/types'
import { isWebAutomation } from '@/utils/isWebAutomation'

const WeatherWidget = React.lazy(() => import('@/components/home/WeatherWidget'))

const WEATHER_PLACEHOLDER_STYLE = {
  minHeight: 120,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}

const WeatherErrorFallback: React.FC<{ colors: any; onRetry: () => void }> = ({ colors, onRetry }) => (
  <View style={{ minHeight: 120, justifyContent: 'center', gap: DESIGN_TOKENS.spacing.sm, marginTop: DESIGN_TOKENS.spacing.sm } as any}>
    <Text style={{ color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm } as any}>
      Не удалось загрузить погоду
    </Text>
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Повторить загрузку погоды"
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
        Повторить
      </Text>
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
  if (!travel.travelAddress || (travel.travelAddress as any[]).length <= 0 || isWebAutomation) return null

  return (
    <View
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : 'none'}
      accessibilityLabel="Погода"
      style={[styles.sectionContainer, styles.contentStable, styles.webDeferredSection]}
    >
      <Text
        style={styles.sectionHeaderText}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >Погода</Text>
      <Text style={styles.sectionSubtitle}>Прогноз по точкам маршрута</Text>
      {!weatherVisible ? (
        <Pressable
          onPress={() => setWeatherVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Показать погоду по точкам маршрута"
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
            Показать погоду
          </Text>
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
                  <ActivityIndicator size="small" accessibilityLabel="Загрузка погоды" />
                </View>
              }
            >
              <WeatherWidget points={travel.travelAddress as any} countryName={travel.countryName} />
            </Suspense>
          </ErrorBoundary>
        </View>
      )}
    </View>
  )
}

export default React.memo(TravelWeatherBlock)
