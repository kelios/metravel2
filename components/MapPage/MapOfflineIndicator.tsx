/**
 * MapOfflineIndicator — ненавязчивый индикатор офлайна поверх карты.
 * Тайлы карты могут грузиться из кэша, поэтому это не блокирующая ошибка,
 * а компактная плашка вверху экрана. Кросс-платформенный (RN primitives).
 */
import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface MapOfflineIndicatorProps {
  visible: boolean
  /** Доп. верхний отступ (под header/safe-area), по умолчанию 0. */
  topInset?: number
}

const MapOfflineIndicatorInner: React.FC<MapOfflineIndicatorProps> = ({
  visible,
  topInset = 0,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  if (!visible) return null

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: topInset + 10 }]}
      testID="map-offline-indicator"
      accessibilityRole="alert"
      accessibilityLabel="Нет подключения к интернету. Карта работает из кэша."
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={13} color={colors.textOnPrimary} />
        <Text style={styles.text} numberOfLines={1}>
          Офлайн — карта из кэша
        </Text>
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 1015,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.textMuted,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 4px 14px rgba(0,0,0,0.18)' } as any)
        : colors.shadows.light),
    },
    text: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
  })

export const MapOfflineIndicator = React.memo(MapOfflineIndicatorInner)

export default MapOfflineIndicator
