import React from 'react'
import { type ViewInstance, Pressable, Text as RNText, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import type { getMapMobileTopOverlayStyles } from './MapMobileTopOverlay.styles'

type Props = {
  testID: string
  targetRef?: React.Ref<ViewInstance>
  onPress?: () => void
  icon: React.ComponentProps<typeof Feather>['name']
  /** Короткая видимая подпись под иконкой («Сбросить», «Маршрут»). */
  label: string
  /** Полное имя для скринридера; начинается с видимой подписи или содержит её. */
  accessibilityLabel: string
  active?: boolean
  colors: ThemedColors
  styles: ReturnType<typeof getMapMobileTopOverlayStyles>
}

/**
 * #2777 (MAP-TOOLBAR-ICON-SEMANTICS) — кнопка верхнего ряда карты с видимой
 * подписью: непривычные действия (сброс фильтров, вход в маршрут) больше не
 * угадываются по глифу. Геометрия и расчёт ширины на 320 —
 * `MAP_TOOLBAR_LABELED_BUTTON_WIDTH` в MapMobileTopOverlay.styles.ts; таргет —
 * собственная рамка 48dp без hitSlop (#2236).
 */
export function MapToolbarLabeledButton({
  testID,
  targetRef,
  onPress,
  icon,
  label,
  accessibilityLabel,
  active = false,
  colors,
  styles,
}: Props) {
  return (
    <Pressable
      testID={testID}
      ref={targetRef}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.labeledButtonTouch, pressed && styles.iconButtonPressed]}
    >
      <View style={[styles.labeledButton, active && styles.iconButtonActive]} pointerEvents="none">
        <Feather name={icon} size={16} color={colors.text} />
        <RNText style={styles.labeledButtonText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </RNText>
      </View>
    </Pressable>
  )
}
