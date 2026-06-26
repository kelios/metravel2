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

  if (name === 'route-walk') {
    return (
      <RouteWalkIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  if (name === 'map-fold') {
    return (
      <MapFoldIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  if (name === 'quest-map-person') {
    return (
      <QuestMapPersonIcon
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

function getIconAccessibilityProps() {
  return Platform.OS === 'web'
    ? ({ 'aria-hidden': true, focusable: false } as any)
    : ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const)
}

function RouteWalkIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...getIconAccessibilityProps()}
    >
      <Path
        d="M6 18.3a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.2 4.1a3.2 3.2 0 0 0-3.2 3.2c0 2.8 3.2 6.3 3.2 6.3s3.2-3.5 3.2-6.3a3.2 3.2 0 0 0-3.2-3.2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.2 7.3h.01"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.9 15.7c2.9-.5 3.2-3.2 5.2-3.7 1-.3 1.8.1 2.6.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function MapFoldIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...getIconAccessibilityProps()}
    >
      <Path
        d="M4.3 6.6 8.8 4.8l6.4 1.8 4.5-1.8v12.6l-4.5 1.8-6.4-1.8-4.5 1.8V6.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.8 4.8v12.6M15.2 6.6v12.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 9.5a2.1 2.1 0 0 0-2.1 2.1c0 1.8 2.1 4.1 2.1 4.1s2.1-2.3 2.1-4.1A2.1 2.1 0 0 0 12 9.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11.6h.01"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function QuestMapPersonIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...getIconAccessibilityProps()}
    >
      <Path
        d="M6.4 19.5V4.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.4 5.2h9.1l-1.4 3 1.4 3H6.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m10.8 6.9.8 1.5 1.7.2-1.2 1.1.3 1.7-1.6-.8-1.5.8.3-1.7-1.2-1.1 1.7-.2.7-1.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function QuestRouteIcon({
  color,
  size,
  strokeWidth,
  style,
}: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...getIconAccessibilityProps()}
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
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...getIconAccessibilityProps()}
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
