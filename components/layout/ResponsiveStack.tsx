/**
 * ResponsiveStack - вертикальный или горизонтальный стек с адаптивными отступами
 * Автоматически меняет направление и gap в зависимости от размера экрана
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive, useResponsiveValue } from '@/hooks/useResponsive';
import { METRICS } from '@/constants/layout';

interface ResponsiveStackProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal' | 'responsive';
  gap?: number | {
    smallPhone?: number;
    phone?: number;
    largePhone?: number;
    tablet?: number;
    desktop?: number;
    default: number;
  };
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  wrap?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export default function ResponsiveStack({
  children,
  direction = 'vertical',
  gap,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  style,
  testID,
}: ResponsiveStackProps) {
  const { isTablet, isLargeTablet, isDesktop } = useResponsive();

  // Определяем gap
  const gapConfig = typeof gap === 'number'
    ? { default: gap }
    : gap || { default: METRICS.spacing.m };
  const responsiveGap = useResponsiveValue(gapConfig);
  const stackGap = typeof gap === 'number' ? gap : responsiveGap;

  const resolvedDirection = useMemo(() => {
    if (direction === 'responsive') {
      return (isTablet || isLargeTablet || isDesktop) ? 'row' : 'column';
    }
    return direction === 'horizontal' ? 'row' : 'column';
  }, [direction, isTablet, isLargeTablet, isDesktop]);

  const resolvedAlignItems = useMemo(() => {
    const map = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      stretch: 'stretch',
    };
    return map[align];
  }, [align]);

  const resolvedJustifyContent = useMemo(() => {
    const map = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      'space-between': 'space-between',
      'space-around': 'space-around',
    };
    return map[justify];
  }, [justify]);

  return (
    <View
      style={[
        styles.container,
        {
          flexDirection: resolvedDirection as 'row' | 'column',
          gap: stackGap,
          alignItems: resolvedAlignItems as any,
          justifyContent: resolvedJustifyContent as any,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
