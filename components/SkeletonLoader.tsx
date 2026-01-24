// SkeletonLoader.tsx - компонент для skeleton loading состояний
import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { TRAVEL_CARD_IMAGE_HEIGHT } from '@/components/listTravel/utils/listTravelConstants';

interface SkeletonLoaderProps {
  testID?: string;
  width?: number | string;
  height?: number;
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
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const shouldUseNativeDriver = Platform.OS !== 'web';

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: shouldUseNativeDriver,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: shouldUseNativeDriver,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue, shouldUseNativeDriver]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      testID={testID}
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

export const TravelCardSkeleton: React.FC = () => {
  return (
    <View testID="travel-card-skeleton" style={styles.travelCardSkeleton}>
      <SkeletonLoader
        testID="travel-card-skeleton-image"
        width="100%"
        height={TRAVEL_CARD_IMAGE_HEIGHT}
        borderRadius={DESIGN_TOKENS.radii.lg}
      />
      <View style={styles.travelCardContent}>
        <SkeletonLoader width="70%" height={16} />
        <SkeletonLoader width="55%" height={14} style={{ marginTop: 8 }} />
        <SkeletonLoader width="85%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
};

export const TravelListSkeleton: React.FC<MapSkeletonProps> = ({ count = 3 }) => {
  if (count <= 0) {
    return null;
  }
  return (
    <View style={styles.listSkeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <TravelCardSkeleton key={index} />
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
  travelCardSkeleton: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  travelCardContent: {
    marginTop: 12,
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
