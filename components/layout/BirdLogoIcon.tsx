import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg'

// Фирменная птица MeTravel — векторная замена растрового logo_yellow_*.png.
// Бренд-цвета фиксированы (не темизируются): это знак бренда, а не UI-глиф.
// Палитра совпадает с MODERN_MATTE_PALETTE.brand/brandDark.
const BODY = '#f5842c'
const OUTLINE = '#e07020'
const BEAK = '#f7a24f'
const WING = '#c86a1e'
const LEG = '#d9701c'
const EYE = '#2f2a26'

type BirdLogoIconProps = {
  size?: number
  style?: StyleProp<ViewStyle>
}

export default function BirdLogoIcon({ size = 32, style }: BirdLogoIconProps) {
  const a11y =
    Platform.OS === 'web'
      ? ({ 'aria-hidden': true, focusable: false } as any)
      : ({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        } as const)

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style as any} {...a11y}>
      {/* лапки */}
      <G stroke={LEG} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M42 82 41 95" />
        <Path d="M41 95 35 99 M41 95 41 100 M41 95 47 99" />
        <Path d="M56 82 57 95" />
        <Path d="M57 95 51 99 M57 95 57 100 M57 95 63 99" />
      </G>
      {/* хвостик */}
      <Path d="M74 42 92 40 76 55 Z" fill={BODY} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
      {/* тело */}
      <Ellipse cx="46" cy="52" rx="35" ry="33" fill={BODY} stroke={OUTLINE} strokeWidth={2.4} />
      {/* клювик */}
      <Path d="M13 43 2 47 13 50 Z" fill={BEAK} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
      {/* крыло */}
      <Path
        d="M39 46 Q61 51 56 76 Q44 68 39 46 Z"
        fill="none"
        stroke={WING}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* глаз */}
      <Circle cx="30" cy="39" r="3.7" fill={EYE} />
      <Circle cx="31.2" cy="37.9" r="1.1" fill="#ffffff" />
    </Svg>
  )
}
