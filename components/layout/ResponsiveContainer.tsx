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
  /**
   * Ставить только внутри поддерева, которое монтируется уже после гидратации.
   * Тогда контейнер берёт реальную ширину на первом же кадре и не переезжает с
   * padding 8 (ветка «нулевой» ширины) на 16/40 следующим кадром — это давало
   * заметную часть CLS главной (#1282). См. HydrationReadyOptions.
   */
  clientOnly?: boolean;
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
  clientOnly = false,
}: ResponsiveContainerProps) {
  const { isSmallPhone, isPhone, isLargePhone, isTablet, isLargeDesktop } = useResponsive({ clientOnly });

  const resolvedMaxWidth = useMemo(() => {
    if (typeof maxWidth === 'number') return maxWidth;
    const base = METRICS.containers[maxWidth];
    if (isLargeDesktop && maxWidth === 'xl') return METRICS.containers.xxl;
    return base;
  }, [maxWidth, isLargeDesktop]);

  const resolvedPadding = useMemo(() => {
    if (!padding && !paddingHorizontal && !paddingVertical) return {};

    const horizontal = padding || paddingHorizontal;
    const vertical = padding || paddingVertical;

    if (isSmallPhone) {
      return {
        paddingHorizontal: horizontal ? METRICS.spacing.s : 0,
        paddingVertical: vertical ? METRICS.spacing.xs : 0,
      };
    }

    if (isPhone || isLargePhone) {
      return {
        paddingHorizontal: horizontal ? METRICS.spacing.m : 0,
        paddingVertical: vertical ? METRICS.spacing.s : 0,
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
