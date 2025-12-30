import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface MapLegendProps {
  showRouteMode?: boolean;
}

export default function MapLegend({ showRouteMode = false }: MapLegendProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const legendItems = [
    {
      icon: 'map-pin',
      color: DESIGN_TOKENS.colors.warning,
      background: DESIGN_TOKENS.colors.warningLight,
      label: 'Путешествия',
      description: 'Места для посещения',
    },
    {
      icon: 'map-pin',
      color: DESIGN_TOKENS.colors.success,
      background: DESIGN_TOKENS.colors.successLight,
      label: 'Старт',
      description: 'Начало маршрута',
    },
    {
      icon: 'map-pin',
      color: DESIGN_TOKENS.colors.danger,
      background: DESIGN_TOKENS.colors.dangerLight,
      label: 'Финиш',
      description: 'Конец маршрута',
    },
    {
      icon: 'navigation',
      color: DESIGN_TOKENS.colors.info,
      background: DESIGN_TOKENS.colors.infoLight,
      label: 'Ваше местоположение',
      description: 'Текущая позиция',
    },
  ];

  if (showRouteMode) {
    legendItems.push({
      // Feather не имеет иконки "route" — используем "trending-up" как аналог направления
      icon: 'trending-up',
      color: DESIGN_TOKENS.colors.accent,
      background: DESIGN_TOKENS.colors.accentLight,
      label: 'Маршрут',
      description: 'Построенный путь',
    });
  }

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.header}>
        <Feather name="info" size={16} color={DESIGN_TOKENS.colors.textMuted} />
        <Text style={styles.title}>Легенда карты</Text>
      </View>
      <View style={styles.items}>
        {legendItems.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={[styles.iconContainer, { backgroundColor: item.background }]}>
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
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
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
    borderBottomColor: DESIGN_TOKENS.colors.border,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
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
    color: DESIGN_TOKENS.colors.text,
  },
  description: {
    fontSize: 11,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: 2,
  },
});
