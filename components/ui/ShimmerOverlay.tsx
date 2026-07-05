import React, { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ShimmerOverlayProps {
  style?: any;
  testID?: string;
}

/**
 * Modern shimmer/skeleton loading overlay.
 *
 * - **Web**: CSS `@keyframes slider-shimmer` sweep (GPU-accelerated, defined in global.css).
 * - **Native**: static neutral overlay. Keep this off Reanimated so startup
 *   skeletons do not trigger Fabric synchronous-props warnings before the
 *   surface is fully mounted.
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
      <View
        testID={testID}
        style={baseStyle}
        {...(testID ? ({ 'data-testid': testID } as any) : {})}
      >
        <View style={shimmerStyles.overflow}>
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              // @ts-ignore -- backgroundImage is a web-only CSS property not in RN style types
              backgroundImage:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 80%, transparent 100%)',
              // @ts-ignore -- web-only animation fields in RN style types
              animationKeyframes: 'slider-shimmer',
              // @ts-ignore -- web-only animation fields in RN style types
              animationDuration: '1.8s',
              // @ts-ignore -- web-only animation fields in RN style types
              animationTimingFunction: 'ease-in-out',
              // @ts-ignore -- web-only animation fields in RN style types
              animationIterationCount: 'infinite',
              // @ts-ignore -- willChange is a web-only CSS property not in RN style types
              willChange: 'transform',
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[...baseStyle, shimmerStyles.nativeStatic]}
      testID={testID}
    />
  );
}

const shimmerStyles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  overflow: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  nativeStatic: {
    opacity: 0.55,
  },
});

export const ShimmerOverlay = memo(ShimmerOverlayInner);
export default ShimmerOverlay;
