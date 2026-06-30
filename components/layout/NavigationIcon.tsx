import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

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
      <MapPinFrameIcon
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
      {/* голова */}
      <Circle cx="13.5" cy="4.6" r="1.9" stroke={color} strokeWidth={strokeWidth} />
      {/* корпус + ноги */}
      <Path
        d="M13.5 7.2 12 13l-2.4 4.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 13l2.6 3.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* руки */}
      <Path
        d="M13.5 9 16.6 10.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 9 10.6 11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// «Карта» = пин-локация внутри рамки карты. Пин в рамке отличается от
// свободного пина «Мест» (Feather map-pin) и пина-с-флажком «Квестов».
function MapPinFrameIcon({
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
      {/* рамка карты */}
      <Rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {/* пин-локация */}
      <Path
        d="M12 8.4a2.5 2.5 0 0 0-2.5 2.5c0 1.8 2.5 4.1 2.5 4.1s2.5-2.3 2.5-4.1A2.5 2.5 0 0 0 12 8.4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10.9" r="0.85" stroke={color} strokeWidth={strokeWidth} />
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
