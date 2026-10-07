// SkeletonLoader.tsx - компонент для skeleton loading состояний
import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { webViewStyle } from '@/utils/webProps';

interface SkeletonLoaderProps {
  testID?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  testID,
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const colors = useThemedColors();

  const baseStyle = [
    styles.skeleton,
    {
      width,
      height,
      borderRadius,
      backgroundColor: colors.surfaceLight,
    },
    style,
  ];

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          ...baseStyle,
          // @ts-ignore — web-only: мягкий градиент плашки
          {
            backgroundImage:
              `linear-gradient(90deg, ${colors.surfaceLight} 0%, ${colors.surface} 50%, ${colors.surfaceLight} 100%)`,
            backgroundSize: '200% 100%',
          },
          styles.webPulse,
        ]}
      />
    );
  }

  return (
    <View
      testID={testID}
      style={[...baseStyle, styles.nativeSkeleton]}
    />
  );
};

interface MapSkeletonProps {
  count?: number;
}

export const MapSkeleton: React.FC<MapSkeletonProps> = () => {
  return (
    <View style={styles.mapSkeletonContainer}>
      <SkeletonLoader width="100%" height={300} borderRadius={16} />
    </View>
  );
};


export const FiltersSkeleton: React.FC = () => {
  return (
    <View style={styles.filtersSkeletonContainer}>
      <SkeletonLoader width="100%" height={44} borderRadius={12} />
      <SkeletonLoader width="100%" height={44} borderRadius={12} style={{ marginTop: 12 }} />
      <View style={styles.chipContainer}>
        <SkeletonLoader width={80} height={32} borderRadius={16} />
        <SkeletonLoader width={100} height={32} borderRadius={16} />
        <SkeletonLoader width={90} height={32} borderRadius={16} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  nativeSkeleton: {
    opacity: 0.45,
  },
  // #2170: анимация обязана жить в StyleSheet.create. RN-Web компилирует
  // `animationKeyframes` только отсюда; в инлайн-стиле ключ уходил в DOM
  // несуществующим свойством `animation-keyframes`, и плашка стояла статичной
  // на web с первого дня. Кадры описаны объектом, поэтому правило лежит во
  // встроенной таблице стилей документа и работает до гидратации. Пульс по
  // `opacity` считает композитор — без перерисовки на каждый кадр.
  webPulse: Platform.select<ViewStyle>({
    web: webViewStyle({
      animationKeyframes: { '0%': { opacity: 1 }, '50%': { opacity: 0.55 }, '100%': { opacity: 1 } },
      animationDuration: '1.5s',
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
    }),
    default: {},
  }),
  mapSkeletonContainer: {
    padding: 16,
  },
  listSkeletonContainer: {
    padding: 16,
  },
  travelItemSkeleton: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  travelItemContent: {
    flex: 1,
  },
  filtersSkeletonContainer: {
    padding: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
});

export default React.memo(SkeletonLoader);
