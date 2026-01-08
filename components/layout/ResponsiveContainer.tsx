/**
 * ResponsiveContainer - универсальный контейнер для адаптивной верстки
 * Обеспечивает единообразное поведение на всех устройствах
 */

import React, { useMemo } from 'react';
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
  const { isSmallPhone, isPhone, isLargePhone, isTablet } = useResponsive();

  const resolvedMaxWidth = useMemo(() => {
    if (typeof maxWidth === 'number') return maxWidth;
    return METRICS.containers[maxWidth];
  }, [maxWidth]);

  const resolvedPadding = useMemo(() => {
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

    return {
      paddingHorizontal: horizontal ? METRICS.spacing.xxl : 0,
      paddingVertical: vertical ? METRICS.spacing.xl : 0,
    };
  }, [isSmallPhone, isPhone, isLargePhone, isTablet, padding, paddingHorizontal, paddingVertical]);

  return (
    <View
      style={[
        styles.container,
        {
          maxWidth: resolvedMaxWidth,
          ...resolvedPadding,
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
