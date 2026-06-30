import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import Svg, { Circle, Path } from 'react-native-svg'

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
      <QuestSearchIcon
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
      />
    )
  }

  if (name === 'dice') {
    return (
      <DiceIcon
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
        d="M6.9 12.9c1.7-.9 3.3-.9 5 0 1.7.9 3.3.9 5 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Квест = цель/чек-поинт на карте: маркер-пин с флажком-вымпелом.
// Отличается от «Маршрутов» (точка→точка) и от простого пина «Мест».
// Единый знак для нижнего дока, шапки и промо-блоков.
function QuestMarkerFlagIcon({
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
      {/* маркер-пин */}
      <Path
        d="M12 2.6a5.6 5.6 0 0 0-5.6 5.6c0 4.1 5.6 11.2 5.6 11.2s5.6-7.1 5.6-11.2A5.6 5.6 0 0 0 12 2.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* флажок-вымпел внутри пина */}
      <Path
        d="M10.1 5.3v6.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.1 5.5 14 6.8l-3.9 1.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function QuestSearchIcon(
  props: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
    style?: StyleProp<ViewStyle>
  },
) {
  return <QuestMarkerFlagIcon {...props} />
}

function QuestRouteIcon(
  props: Required<Pick<NavigationIconProps, 'color' | 'size' | 'strokeWidth'>> & {
    style?: StyleProp<ViewStyle>
  },
) {
  return <QuestMarkerFlagIcon {...props} />
}

// «Случайный маршрут» = игральная кость: универсальный знак «рандом».
function DiceIcon({
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
      {/* корпус кости */}
      <Path
        d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {/* грань «5» */}
      <Circle cx="8.4" cy="8.4" r="1.15" fill={color} />
      <Circle cx="15.6" cy="8.4" r="1.15" fill={color} />
      <Circle cx="12" cy="12" r="1.15" fill={color} />
      <Circle cx="8.4" cy="15.6" r="1.15" fill={color} />
      <Circle cx="15.6" cy="15.6" r="1.15" fill={color} />
    </Svg>
  )
}
