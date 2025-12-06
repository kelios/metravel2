// Компонент для анимированных карточек с эффектом появления
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Platform } from 'react-native';

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  style?: any;
}

export default function AnimatedCard({ 
  children, 
  index = 0, 
  delay = 0,
  style 
}: AnimatedCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const animationDelay = delay + index * 50; // Задержка для каждого элемента
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: animationDelay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: animationDelay,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, index, delay]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Убираем willChange, так как он вызывает ошибки в React Native Web
  },
});

