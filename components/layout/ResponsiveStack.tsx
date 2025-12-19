/**
 * ResponsiveStack - вертикальный или горизонтальный стек с адаптивными отступами
 * Автоматически меняет направление и gap в зависимости от размера экрана
 */

import React from 'react';
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
  const { isTablet, isDesktop } = useResponsive();

  // Определяем gap
  const stackGap = typeof gap === 'number' 
    ? gap 
    : useResponsiveValue(gap || { default: METRICS.spacing.m });

  // Определяем направление
  const getDirection = () => {
    if (direction === 'responsive') {
      return isTablet || isDesktop ? 'row' : 'column';
    }
    return direction === 'horizontal' ? 'row' : 'column';
  };

  // Преобразуем align в flexbox свойства
  const getAlignItems = () => {
    const map = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      stretch: 'stretch',
    };
    return map[align];
  };

  // Преобразуем justify в flexbox свойства
  const getJustifyContent = () => {
    const map = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      'space-between': 'space-between',
      'space-around': 'space-around',
    };
    return map[justify];
  };

  return (
    <View
      style={[
        styles.container,
        {
          flexDirection: getDirection() as 'row' | 'column',
          gap: stackGap,
          alignItems: getAlignItems() as any,
          justifyContent: getJustifyContent() as any,
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
