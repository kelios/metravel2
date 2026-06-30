import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

type BelarusOutlineIconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

// Реальный контур Беларуси (Natural Earth 110m) из worldGeometry.json (BY),
// исходный viewBox 0 0 1000 500 (equirectangular — долгота не сжата по cos(lat),
// поэтому сырой контур растянут ~2:1 и выглядит «сплюснутым»). Неравномерный
// scale (X×0.759, Y×1.3) компенсирует искажение → знакомые пропорции ~1.15:1,
// силуэт центрирован и заполняет 24×24. Заливка — узнаваемее тонкого контура.
const BELARUS_PATH =
  'M578.3,94L581.2,94.7L581.6,95.4L583,95L585.8,95.7L586,97L585.4,97.7L587.2,99.6L588.3,100.1L588.1,100.6L590,101.1L590.8,101.8L589.7,102.4L587.5,102.3L587,102.6L587.6,103.5L588.3,105.3L585.9,105.4L585.1,106L584.9,107.4L583.8,107.2L581.3,107.3L580.5,106.7L579.5,107.1L578.4,106.7L576.3,106.7L573.2,106L570.4,105.8L568.2,105.9L566.7,106.6L565.4,106.7L565.3,105.5L564.4,104.2L566.1,103.6L566.1,102.5L565.4,101.5L565.2,100.2L567.9,100.3L570.9,99.2L571.6,97.6L573.9,96.8L573.6,95.5L575.3,95L578.3,94Z';

export default function BelarusOutlineIcon({
  color,
  size = 20,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  strokeWidth = 2,
  style,
}: BelarusOutlineIconProps) {
  const accessibilityProps =
    Platform.OS === 'web'
      ? ({ 'aria-hidden': true, focusable: false } as any)
      : ({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        } as const);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style as any}
      {...accessibilityProps}
    >
      <G transform="translate(-426.4 -118.91) scale(0.759 1.3)">
        <Path d={BELARUS_PATH} fill={color} stroke={color} strokeWidth={0.6} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}
