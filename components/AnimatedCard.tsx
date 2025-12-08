// Компонент для карточек (анимации отключены для улучшения производительности скролла)
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  style?: any;
}

export default function AnimatedCard({ 
  children, 
  style 
}: AnimatedCardProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Убираем willChange, так как он вызывает ошибки в React Native Web
  },
});

