// ✅ МИГРАЦИЯ: Прогресс-бар чтения с поддержкой useThemedColors
import React, { useMemo } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ReadingProgressBarProps {
  scrollY: Animated.Value;
  contentHeight: number;
  viewportHeight: number;
}

function ReadingProgressBar({
  scrollY,
  contentHeight,
  viewportHeight,
}: ReadingProgressBarProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressAnim = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, Math.max(1, contentHeight - viewportHeight)],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [contentHeight, scrollY, viewportHeight],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            // Animate scaleX (compositor-only) instead of width% to avoid
            // forcing layout/reflow on every scroll frame. progressAnim is 0..1.
            transform: [{ scaleX: progressAnim }],
          },
        ]}
      />
    </View>
  );
}

// ✅ МИГРАЦИЯ: Вынесена функция создания стилей с динамическими цветами
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.overlayLight,
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed',
      },
    }),
  },
  progressBar: {
    height: '100%',
    width: '100%',
    backgroundColor: colors.primary,
    transformOrigin: 'left center',
    ...Platform.select({
      web: {
        transition: 'transform 0.15s ease-out',
        willChange: 'transform',
      },
    }),
  },
});

export default React.memo(ReadingProgressBar);
