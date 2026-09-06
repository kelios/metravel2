/**
 * MapOfflineIndicator — ненавязчивый индикатор офлайна поверх карты.
 * Тайлы карты могут грузиться из кэша, поэтому это не блокирующая ошибка,
 * а компактная плашка вверху экрана. Кросс-платформенный (RN primitives).
 */
import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MAP_OFFLINE_INDICATOR_HEIGHT } from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


/**
 * #1812 — воздух от верхнего края карты там, где над плашкой ничего не стоит
 * (десктоп). На мобиле позицию считает `getMapTopStackOffsets` и передаёт
 * целиком: скрытое слагаемое внутри компонента заставляло вычитать его на
 * стороне вызова.
 */
const DEFAULT_TOP = 10

interface MapOfflineIndicatorProps {
  visible: boolean
  /** Позиция плашки от верха карты целиком, включая safe-area и ярусы над ней. */
  top?: number
}

const MapOfflineIndicatorInner: React.FC<MapOfflineIndicatorProps> = ({
  visible,
  top = DEFAULT_TOP,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  if (!visible) return null

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top }]}
      testID="map-offline-indicator"
      accessibilityRole="alert"
      accessibilityLabel={i18nT('map:components.MapPage.MapOfflineIndicator.net_podklyucheniya_k_internetu_karta_rabotae_edb3f192')}
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={13} color={colors.textOnPrimary} />
        <Text style={styles.text} numberOfLines={1}>
          {i18nT('map:components.MapPage.MapOfflineIndicator.oflayn_karta_iz_kesha_e279b297')}</Text>
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
      // #1812 — высота объявлена в источнике правды по вертикали карты: под
      // плашкой стоит гео-баннер, и его сдвиг обязан считаться от РЕАЛЬНОЙ
      // высоты пилюли, а не от суммы паддингов «на глаз». Это ПОЛ, а не
      // фиксированная высота: вертикальных полей нет, поэтому при обычном
      // масштабе шрифта пилюля ровно такая, как заявлено, а при системном
      // укрупнении текста растёт, вместо того чтобы обрезать сообщение.
      minHeight: MAP_OFFLINE_INDICATOR_HEIGHT,
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
