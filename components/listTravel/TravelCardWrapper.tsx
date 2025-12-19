import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Wrapper для карточки путешествия с адаптивными отступами
 * Использует ширину экрана вместо Platform.select для правильной адаптивности в браузере
 */
export function TravelCardWrapper({ children }: { children: React.ReactNode }) {
  const { width } = useResponsive();
  
  // ✅ Вычисляем marginBottom на основе ШИРИНЫ, а не Platform
  const marginBottom = useMemo(() => {
    if (width < METRICS.breakpoints.tablet) return 20; // Mobile
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
