/**
 * ResponsiveContainer - универсальный контейнер для адаптивной верстки
 * Обеспечивает единообразное поведение на всех устройствах
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { METRICS } from '@/constants/layout';

type MaxWidth = keyof typeof METRICS.containers | number;

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
  padding?: boolean;
  paddingHorizontal?: boolean;
  paddingVertical?: boolean;
  center?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export default function ResponsiveContainer({
  children,
  maxWidth = 'xl',
  padding = true,
  paddingHorizontal = true,
  paddingVertical = false,
  center = true,
  style,
  testID,
}: ResponsiveContainerProps) {
  const { isSmallPhone, isPhone, isLargePhone, isTablet, isDesktop } = useResponsive();

  // Определяем padding на основе размера экрана
  const getPadding = () => {
    if (!padding && !paddingHorizontal && !paddingVertical) return {};

    const horizontal = padding || paddingHorizontal;
    const vertical = padding || paddingVertical;

    if (isSmallPhone) {
      return {
        paddingHorizontal: horizontal ? METRICS.spacing.m : 0,
        paddingVertical: vertical ? METRICS.spacing.s : 0,
      };
    }

    if (isPhone || isLargePhone) {
      return {
        paddingHorizontal: horizontal ? METRICS.spacing.l : 0,
        paddingVertical: vertical ? METRICS.spacing.m : 0,
      };
    }

    if (isTablet) {
      return {
        paddingHorizontal: horizontal ? METRICS.spacing.xl : 0,
        paddingVertical: vertical ? METRICS.spacing.l : 0,
      };
    }

    // Desktop
    return {
      paddingHorizontal: horizontal ? METRICS.spacing.xxl : 0,
      paddingVertical: vertical ? METRICS.spacing.xl : 0,
    };
  };

  // Определяем максимальную ширину
  const getMaxWidth = () => {
    if (typeof maxWidth === 'number') return maxWidth;
    return METRICS.containers[maxWidth];
  };

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: getMaxWidth(),
          ...getPadding(),
        },
        center && styles.center,
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
  center: {
    ...Platform.select({
      web: {
        marginLeft: 'auto',
        marginRight: 'auto',
      },
      default: {
        alignSelf: 'center',
      },
    }),
  },
});
