import React from 'react';
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type BelarusOutlineIconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
};

export default function BelarusOutlineIcon({
  color,
  size = 20,
  strokeWidth = 2,
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
      {...accessibilityProps}
    >
      <Path
        d="M6 7.1 8.5 5.3l3.2.2 2.2-1.1 2.3.8 1.1 1.6 3.1.6-1.6 2 2 1.5-2.2 1.5.5 2.3-2.8.6-1.7 2.4-2.6-1.2-2.3 1.4-2.1-1.7-2.9.1 1.1-2.5-2.1-1.7 2.4-1.6L6 7.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
