// Прогресс-бар чтения для детальной страницы
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastScrollValue = useRef(0);
  const animationFrameId = useRef<number | null>(null);

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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4, // ✅ УВЕЛИЧЕНО: с 3 до 4 для лучшей видимости
    backgroundColor: DESIGN_TOKENS.colors.overlayLight, // ✅ Более прозрачный фон
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed',
      },
    }),
  },
  progressBar: {
    height: '100%',
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИЗМЕНЕН ЦВЕТ: акцентный цвет темы
    ...Platform.select({
      web: {
        transition: 'width 0.15s ease-out', // ✅ Более плавная анимация
        boxShadow: DESIGN_TOKENS.shadows.light, // ✅ Добавлена тень для глубины
      },
    }),
  },
});
