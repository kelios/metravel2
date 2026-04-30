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
        d="M9.5 3.2 11.8 2.5l1.7.8 1.7-.5 1.5 1.2 1.5-.1.9 1.2 2 .4-.6 1.5 2.1 1-1.4 1.4 1.4 1.6-1.9 1 .5 1.9-2.2.4-1.1 1.9-1.9-.2-1 2.2-2-1-1.8 1.2-1.6-1.5-1.8.5-1-1.8-2.1.3-1.1-1.5-2.3-.5 1.5-2.1-1.2-1.4 2.7-.9-.2-1.8 2.1-.4.7-1.8 1.5-.2 1.2-2.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
