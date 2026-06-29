import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type BelarusOutlineIconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export default function BelarusOutlineIcon({
  color,
  size = 20,
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
      <Path
        d="M4.6 8.3 7.2 5.6l3 1 3-1.9 2.6 1.4 3.6.8-.5 2.8 1.4 2.4-2.1 1.9.6 2.7-3.1 1.8-2.7-1.1-2.6 1.6-2.9-1.4-2.9.7-1.7-2.6 1.4-2.7-2.7-1.9Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
