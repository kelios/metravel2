import React, { memo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { webViewStyle } from '@/utils/webProps';

interface ShimmerOverlayProps {
  style?: any;
  testID?: string;
}

/**
 * Modern shimmer/skeleton loading overlay.
 *
 * - **Web**: sweep by `transform` (compositor-only), keyframes declared in
 *   `StyleSheet.create` below — the only place react-native-web compiles them.
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
      >
        <View style={shimmerStyles.overflow}>
          <View style={shimmerStyles.webSweep} />
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
  // #2215: анимация обязана жить в StyleSheet.create (как `webPulse` в
  // SkeletonLoader, #2170). Инлайн-объектом RN-Web не компилирует
  // `animationKeyframes`: в DOM уходило несуществующее свойство
  // `animation-keyframes`, и перелив не работал ни на одной странице. Кадры
  // описаны объектом — правило лежит во встроенной таблице стилей документа и
  // работает до гидратации, без зависимости от app/global.css.
  webSweep: Platform.select<ViewStyle>({
    web: webViewStyle({
      ...StyleSheet.absoluteFillObject,
      backgroundImage:
        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 80%, transparent 100%)',
      // Кадры RN-Web не раскрывают массив `transform` (выходит `[object Object]`),
      // поэтому значение — готовая CSS-строка.
      animationKeyframes: {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(100%)' },
      },
      animationDuration: '1.8s',
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      willChange: 'transform',
    }),
    default: {},
  }),
});

export const ShimmerOverlay = memo(ShimmerOverlayInner);
export default ShimmerOverlay;
