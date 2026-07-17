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

  if (name === 'bike') {
    return (
      <BikeIcon
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
      style={style}
      {...getIconAccessibilityProps()}
    >
      {/* голова — залита, чтобы читалась на 22px */}
      <Circle cx="12" cy="4.3" r="2.1" fill={color} />
      {/* корпус → передняя нога (шаг), один контур */}
      <Path
        d="M12 6.6 11 12.6 14.4 19.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* задняя нога */}
      <Path
        d="M11 12.6 8.2 19.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* руки — единый мах через грудь (передняя→грудь→задняя) */}
      <Path
        d="M15 11 11.6 8.6 8.4 10.2"
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

// Квест = флаг-чек-поинт на древке: чистый, читаемый знак на мелком размере.
// Отличается от «Маршрутов» (точка→точка) и от простого пина «Мест»;
// совпадает с «flag»-мотивом бейджей квестов. Единый знак для дока, шапки и промо.
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
      {/* древко */}
      <Path
        d="M7 21V3.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* флаг-вымпел */}
      <Path
        d="M7 4 16.4 6.8 7 9.6Z"
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
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

// «Вело» = велосипед: два колеса + рама. Знак категории велоквестов;
// в Feather велосипеда нет, поэтому свой глиф в стилистике Feather-stroke.
function BikeIcon({
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
      {/* колёса */}
      <Circle cx="6" cy="16.2" r="3.6" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="18" cy="16.2" r="3.6" stroke={color} strokeWidth={strokeWidth} />
      {/* рама: заднее колесо → каретка → руль, седло */}
      <Path
        d="M6 16.2 9.4 9.6h5.2M12 16.2 9.4 9.6M12 16.2l3.4-6.1L18 16.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* руль и седло */}
      <Path
        d="M14.1 7.6h2.4M8 7.4h2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  )
}
