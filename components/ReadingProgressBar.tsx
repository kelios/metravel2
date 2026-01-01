// ✅ МИГРАЦИЯ: Прогресс-бар чтения с поддержкой useThemedColors
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface ReadingProgressBarProps {
  scrollY: Animated.Value;
  contentHeight: number;
  viewportHeight: number;
}

export default function ReadingProgressBar({
  scrollY,
  contentHeight,
  viewportHeight,
}: ReadingProgressBarProps) {
  const colors = useThemedColors();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastScrollValue = useRef(0);
  const animationFrameId = useRef<number | null>(null);

  // ✅ МИГРАЦИЯ: Мемоизация стилей
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      // Debounce scroll events to improve performance
      if (Math.abs(value - lastScrollValue.current) < 3) {
        return;
      }
      lastScrollValue.current = value;
      
      // Cancel previous animation frame to prevent layout thrashing
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      animationFrameId.current = requestAnimationFrame(() => {
        const scrollableHeight = contentHeight - viewportHeight;
        if (scrollableHeight <= 0) {
          progressAnim.setValue(0);
          return;
        }
        
        const progress = Math.min(Math.max(value / scrollableHeight, 0), 1);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 100,
          useNativeDriver: false,
        }).start();
      });
    });

    return () => {
      scrollY.removeListener(listener);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [scrollY, contentHeight, viewportHeight, progressAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
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
    backgroundColor: colors.primary,
    ...Platform.select({
      web: {
        transition: 'width 0.15s ease-out',
        boxShadow: DESIGN_TOKENS.shadows.light,
      },
    }),
  },
});
