import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import Svg, { Path } from 'react-native-svg'

import type { NavigationIconName } from '@/constants/navigationIcons'
import BelarusOutlineIcon from './BelarusOutlineIcon'

type NavigationIconProps = {
  color: string
  name: NavigationIconName
  size?: number
  strokeWidth?: number
  style?: StyleProp<ViewStyle>
}

export default function NavigationIcon({
  color,
  name,
  size = 20,
  strokeWidth = 2,
  style,
}: NavigationIconProps) {
  if (name === 'belarus-outline') {
    return (
      <BelarusOutlineIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  if (name === 'quest-route') {
    return (
      <QuestRouteIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  if (name === 'coin-flip') {
    return (
      <CoinFlipIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  return <Feather name={name} size={size} color={color} style={style as any} />
}

function QuestRouteIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  const accessibilityProps =
    Platform.OS === 'web'
      ? ({ 'aria-hidden': true, focusable: false } as any)
      : ({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        } as const)

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...accessibilityProps}
    >
      <Path
        d="M12 11.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.7 20.2c.5-3.4 2.3-5.1 5.3-5.1s4.8 1.7 5.3 5.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.2 13.4 9 12l3.7 1.4 4.1-1.6v5.8l-4.1 1.6L9 17.8l-3.8 1.4v-5.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.6 4.4c0-1.1.8-1.9 2-1.9s2 .7 2 1.8c0 1.5-1.6 1.7-1.6 2.8M21 9.2h.01"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// «Случайный маршрут» = подбросить монетку: монета подлетает над раскрытой ладонью.
function CoinFlipIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  const accessibilityProps =
    Platform.OS === 'web'
      ? ({ 'aria-hidden': true, focusable: false } as any)
      : ({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        } as const)

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...accessibilityProps}
    >
      {/* монетка в воздухе */}
      <Path
        d="M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 3.6v2.8M10.6 5h2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* траектория подброса */}
      <Path
        d="M9 11.4 12 10l3 1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.5 2.6"
      />
      {/* раскрытая ладонь */}
      <Path
        d="M5 14.4c0 3.7 2.6 6.1 7 6.1s7-2.4 7-6.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.6 14.4h14.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
