import React, { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

// Lazy-require reanimated only on native to avoid pulling ~200KB into the web bundle.
const Reanimated = Platform.OS !== 'web'
  ? require('react-native-reanimated')
  : null;
const Animated = Reanimated?.default;
const useSharedValue = Reanimated?.useSharedValue;
const useAnimatedStyle = Reanimated?.useAnimatedStyle;
const withRepeat = Reanimated?.withRepeat;
const withTiming = Reanimated?.withTiming;
const Easing = Reanimated?.Easing;

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

  return <NativeShimmerPulse baseStyle={baseStyle} testID={testID} />;
}

// Separate native-only component to keep reanimated hooks out of the web render path.
const NativeShimmerPulse: React.FC<{ baseStyle: any[]; testID?: string }> = ({ baseStyle, testID }) => {
  const opacity = useSharedValue!(0.35);

  useEffect(() => {
    opacity.value = withRepeat!(
      withTiming!(0.75, { duration: 1200, easing: Easing!.inOut(Easing!.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle!(() => ({
    opacity: opacity.value,
  }));

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
