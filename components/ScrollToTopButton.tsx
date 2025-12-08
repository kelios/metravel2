// Кнопка "Наверх" с анимацией и прогресс-баром
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface ScrollToTopButtonProps {
  scrollViewRef?: React.RefObject<any>;
  flatListRef?: React.RefObject<any>;
  scrollY?: Animated.Value;
  threshold?: number;
  forceVisible?: boolean;
}

export default function ScrollToTopButton({
  scrollViewRef,
  flatListRef,
  scrollY,
  threshold = 300,
  forceVisible,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const lastScrollValue = useRef(0);

  useEffect(() => {
    if (typeof forceVisible === 'boolean') {
      setIsVisible(forceVisible);
      return;
    }

    if (scrollY) {
      const listener = scrollY.addListener(({ value }) => {
        // Debounce scroll events to improve performance
        if (Math.abs(value - lastScrollValue.current) < 5) {
          return;
        }
        lastScrollValue.current = value;
        
        const visible = value > threshold;
        if (visible !== isVisible) {
          setIsVisible(visible);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: visible ? 1 : 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: visible ? 1 : 0.8,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
          ]).start();
        }
      });

      return () => {
        scrollY.removeListener(listener);
      };
    }
  }, [scrollY, threshold, isVisible, fadeAnim, scaleAnim, forceVisible]);

  const scrollToTop = () => {
    if (scrollViewRef?.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    } else if (flatListRef?.current) {
      // ✅ УЛУЧШЕНИЕ: Улучшенная прокрутка для FlatList
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      } catch (e) {
        // Fallback для веб-версии
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Fallback для веб-версии без ref
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        style={[styles.button, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        onPress={scrollToTop}
        accessibilityRole="button"
        accessibilityLabel="Прокрутить наверх"
        accessibilityHint="Прокручивает страницу к началу"
        {...Platform.select({
          web: { 
            cursor: 'pointer',
            // @ts-ignore
            'aria-label': 'Прокрутить наверх',
            // @ts-ignore
            tabIndex: 0,
          },
        })}
        testID="scroll-to-top-button"
      >
        <Feather name="arrow-up" size={20} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    zIndex: 1000,
  },
  button: {
    width: 48,
    height: 48,
    minWidth: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
    minHeight: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    borderRadius: DESIGN_TOKENS.radii.pill, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.medium,
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: '#3a7a7a', // Темнее primary для hover
          transform: 'translateY(-2px) scale(1.05)',
        },
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

