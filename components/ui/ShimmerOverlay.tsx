import { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemedColors } from '@/hooks/useTheme';

interface ShimmerOverlayProps {
  style?: any;
  testID?: string;
}

/**
 * Modern shimmer/skeleton loading overlay.
 *
 * - **Web**: CSS `@keyframes slider-shimmer` sweep (GPU-accelerated, defined in global.css).
 * - **Native**: Reanimated opacity pulse (0.35 → 0.75, 1.2 s cycle).
 *
 * Neutral by design: no icons, text, or bright colors (per RULES.md).
 */
function ShimmerOverlayInner({ style, testID }: ShimmerOverlayProps) {
  const colors = useThemedColors();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.75, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseStyle = [
    shimmerStyles.fill,
    { backgroundColor: colors.surfaceMuted },
    style,
  ];

  if (Platform.OS === 'web') {
    return (
      <View style={baseStyle} testID={testID}>
        <View style={shimmerStyles.overflow}>
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              // @ts-ignore — web-only CSS property
              backgroundImage:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 80%, transparent 100%)',
              // @ts-ignore
              animation: 'slider-shimmer 1.8s ease-in-out infinite',
              // @ts-ignore
              willChange: 'transform',
            }}
          />
        </View>
      </View>
    );
  }

  return <Animated.View style={[...baseStyle, pulseStyle]} testID={testID} />;
}

const shimmerStyles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  overflow: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});

export const ShimmerOverlay = memo(ShimmerOverlayInner);
export default ShimmerOverlay;
