// Кнопка "Наверх" с анимацией и прогресс-баром
import React, { useState, useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

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

  useEffect(() => {
    if (typeof forceVisible === 'boolean') {
      setIsVisible(forceVisible);
      return;
    }

    if (scrollY) {
      const listener = scrollY.addListener(({ value }) => {
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
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
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
        style={styles.button}
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
    borderRadius: 24,
    backgroundColor: '#6b8e7f',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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

