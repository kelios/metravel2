/**
 * ResponsiveGrid - адаптивная сетка для карточек и элементов
 * Автоматически подстраивается под размер экрана
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive, useResponsiveColumns } from '@/hooks/useResponsive';
import { METRICS } from '@/constants/layout';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    smallPhone?: number;
    phone?: number;
    largePhone?: number;
    tablet?: number;
    largeTablet?: number;
    desktop?: number;
    default: number;
  };
  gap?: number;
  style?: ViewStyle;
  testID?: string;
}

export default function ResponsiveGrid({
  children,
  columns,
  gap,
  style,
  testID,
}: ResponsiveGridProps) {
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  
  const numColumns = useResponsiveColumns(
    columns || {
      smallPhone: 1,
      phone: 1,
      largePhone: 1,
      tablet: 2,
      largeTablet: 2,
      desktop: 3,
      default: 1,
    }
  );

  // Определяем gap на основе размера экрана
  const getGap = () => {
    if (gap !== undefined) return gap;

    if (isSmallPhone) return METRICS.spacing.s;
    if (isPhone || isLargePhone) return METRICS.spacing.m;
    return METRICS.spacing.l;
  };

  const gridGap = getGap();

  return (
    <View
      style={[
        styles.container,
        {
          gap: gridGap,
        },
        style,
      ]}
      testID={testID}
    >
      {React.Children.map(children, (child, index) => (
        <View
          key={index}
          style={[
            styles.item,
            {
              width: numColumns === 1 
                ? '100%' 
                : `${(100 / numColumns) - ((gridGap * (numColumns - 1)) / numColumns)}%`,
            },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    flexShrink: 0,
  },
});
