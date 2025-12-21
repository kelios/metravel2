import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';

interface MapLegendProps {
  showRouteMode?: boolean;
}

export default function MapLegend({ showRouteMode = false }: MapLegendProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const legendItems = [
    {
      icon: 'map-pin',
      color: '#ff9f5a',
      label: 'Путешествия',
      description: 'Места для посещения',
    },
    {
      icon: 'map-pin',
      color: '#25a562',
      label: 'Старт',
      description: 'Начало маршрута',
    },
    {
      icon: 'map-pin',
      color: '#d94b4b',
      label: 'Финиш',
      description: 'Конец маршрута',
    },
    {
      icon: 'navigation',
      color: '#2b6cb0',
      label: 'Ваше местоположение',
      description: 'Текущая позиция',
    },
  ];

  if (showRouteMode) {
    legendItems.push({
      icon: 'route',
      color: '#ff9800',
      label: 'Маршрут',
      description: 'Построенный путь',
    });
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.header}>
        <Feather name="info" size={16} color="#667085" />
        <Text style={styles.title}>Легенда карты</Text>
      </View>
      <View style={styles.items}>
        {legendItems.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
              <Feather name={item.icon as any} size={14} color={item.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.label}>{item.label}</Text>
              {!isMobile && (
                <Text style={styles.description}>{item.description}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  containerMobile: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1b1f23',
  },
  items: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1b1f23',
  },
  description: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
});
