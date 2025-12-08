import React, { useMemo } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';

/**
 * Wrapper для карточки путешествия с адаптивными отступами
 * Использует ширину экрана вместо Platform.select для правильной адаптивности в браузере
 */
export function TravelCardWrapper({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  
  // ✅ Вычисляем marginBottom на основе ШИРИНЫ, а не Platform
  const marginBottom = useMemo(() => {
    if (width < 768) return 20; // Mobile
    return 24; // Desktop
  }, [width]);
  
  return (
    <View style={[styles.wrapper, { marginBottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
});
