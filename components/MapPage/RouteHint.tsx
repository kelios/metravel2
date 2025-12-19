import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

interface RouteHintProps {
  onDismiss: () => void;
  routePointsCount: number;
}

export default function RouteHint({ onDismiss, routePointsCount }: RouteHintProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  if (routePointsCount >= 2) return null; // Скрываем, если маршрут уже построен

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.content}>
        <Feather name="info" size={18} color="#2b6cb0" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Как построить маршрут</Text>
          <Text style={styles.description}>
            Кликните на карте, чтобы выбрать начальную точку, затем выберите конечную точку
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDismiss}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Закрыть подсказку"
      >
        <Feather name="x" size={16} color="#667085" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#2b6cb0',
    marginBottom: 12,
  },
  containerMobile: {
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1b1f23',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#667085',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

