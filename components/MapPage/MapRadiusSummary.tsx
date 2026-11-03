import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { formatRadiusLabel, resolveMapRadiusKm } from '@/constants/mapConfig'
import type { CoordinatesSource } from '@/hooks/map/useMapCoordinates'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

export function formatMapRadiusSummary(radius: string | number, source: CoordinatesSource) {
  const distance = formatRadiusLabel(resolveMapRadiusKm(radius))

  switch (source) {
    case 'geolocation':
      return i18nT('map:radiusSummary.currentLocation', { distance })
    case 'cache':
      return i18nT('map:radiusSummary.lastLocation', { distance })
    case 'manual':
      return i18nT('map:radiusSummary.selectedPoint', { distance })
    case 'default':
      return i18nT('map:radiusSummary.minsk', { distance })
  }
}

export const MAP_RADIUS_SUMMARY_HEIGHT = 32

export function MapRadiusSummary({
  label,
  colors,
  style,
}: {
  label: string
  colors: ThemedColors
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      pointerEvents="none"
      testID="map-radius-summary"
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: MAP_RADIUS_SUMMARY_HEIGHT,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: MAP_RADIUS_SUMMARY_HEIGHT / 2,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
})
