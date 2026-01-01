// SkeletonLoader.tsx - компонент для skeleton loading состояний
import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const colors = useThemedColors();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceLight,
          opacity,
        },
        style,
      ]}
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

export const TravelListSkeleton: React.FC<MapSkeletonProps> = ({ count = 3 }) => {
  return (
    <View style={styles.listSkeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.travelItemSkeleton}>
          <SkeletonLoader width={80} height={80} borderRadius={12} />
          <View style={styles.travelItemContent}>
            <SkeletonLoader width="70%" height={16} />
            <SkeletonLoader width="50%" height={14} style={{ marginTop: 8 }} />
            <SkeletonLoader width="90%" height={12} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
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

export default SkeletonLoader;

