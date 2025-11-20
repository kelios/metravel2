// AnimatedCard.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Обертка для анимации карточек

import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';

interface AnimatedCardProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
}

export default function AnimatedCard({ children, index, delay = 0 }: AnimatedCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // ✅ UX УЛУЧШЕНИЕ: Плавное появление карточек с задержкой
    const animationDelay = delay + (index * 50); // Задержка для каждой карточки

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: animationDelay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: animationDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, index, delay]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

