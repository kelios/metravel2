// [FE-634] T3 — SVG-хорплет мира для scratch-карты профиля.
// Серая заливка (surfaceMuted) для не посещённых стран, акцент (primary) для
// посещённых. Кросс-платформенно (react-native-svg работает на web и native),
// без web-only API. visited-набор приходит пропсом (источник — T2).
// Флаг-маркеры (T4) и инфо по тапу (T6) монтируются поверх через children/коллбэк.

import React, { useMemo } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'

import { useTheme, useThemedColors } from '@/hooks/useTheme'

import {
  WORLD_MAP_VIEWBOX,
  getWorldMapUnvisitedFill,
  worldCountryCodes,
  worldCountryGeometry,
} from './worldGeometry'

export interface WorldChoroplethMapProps {
  /** ISO alpha-2 (UPPERCASE) посещённых стран. */
  visitedCodes: ReadonlySet<string>
  /** Выделенная страна (тап/клик), подсвечивается сильнее. */
  selectedCode?: string | null
  /** Тап/клик по стране — отдаёт ISO alpha-2. Работает на web и native. */
  onCountryPress?: (code: string) => void
  /** Накладывается поверх карты (например, флаг-маркеры T4). */
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

function WorldChoroplethMapComponent({
  visitedCodes,
  selectedCode,
  onCountryPress,
  children,
  style,
}: WorldChoroplethMapProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const unvisitedFill = getWorldMapUnvisitedFill(isDark)

  // react-native-svg типизирует onPress пересечением (event => object) & (event => void).
  // Наш void-обработчик валиден в рантайме, но не проходит по второй ветви типа — кастуем.
  type PathPress = React.ComponentProps<typeof Path>['onPress']

  const paths = useMemo(
    () =>
      worldCountryCodes.map((code) => {
        const geom = worldCountryGeometry[code]
        const visited = visitedCodes.has(code)
        const selected = selectedCode === code
        const fill = selected
          ? colors.primaryDark
          : visited
            ? colors.primary
            : unvisitedFill
        return (
          <Path
            key={code}
            id={`wc-${code}`}
            d={geom.d}
            fill={fill}
            stroke={colors.background}
            strokeWidth={selected ? 1.2 : 0.4}
            onPress={
              onCountryPress
                ? ((() => onCountryPress(code)) as unknown as PathPress)
                : undefined
            }
          />
        )
      }),
    [
      visitedCodes,
      selectedCode,
      onCountryPress,
      colors.primary,
      colors.primaryDark,
      unvisitedFill,
      colors.background,
    ]
  )

  return (
    <View style={[{ width: '100%', aspectRatio: 2 }, style]}>
      <Svg width="100%" height="100%" viewBox={WORLD_MAP_VIEWBOX}>
        <G>{paths}</G>
      </Svg>
      {children}
    </View>
  )
}

export const WorldChoroplethMap = React.memo(WorldChoroplethMapComponent)
export default WorldChoroplethMap
