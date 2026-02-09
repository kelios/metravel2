import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface MapLegendProps {
  showRouteMode?: boolean;
}

function MapLegend({ showRouteMode = false }: MapLegendProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const legendItems = useMemo(() => {
    const items = [
      {
        icon: 'map-pin',
        color: colors.warning,
        background: colors.warningLight,
        label: 'Путешествия',
        description: 'Места для посещения',
      },
      {
        icon: 'map-pin',
        color: colors.success,
        background: colors.successLight,
        label: 'Старт',
        description: 'Начало маршрута',
      },
      {
        icon: 'map-pin',
        color: colors.danger,
        background: colors.dangerLight,
        label: 'Финиш',
        description: 'Конец маршрута',
      },
      {
        icon: 'navigation',
        color: colors.info,
        background: colors.infoLight,
        label: 'Ваше местоположение',
        description: 'Текущая позиция',
      },
    ];

    if (showRouteMode) {
      items.push({
        // Feather не имеет иконки "route" — используем "trending-up" как аналог направления
        icon: 'trending-up',
        color: colors.accent,
        background: colors.accentLight,
        label: 'Маршрут',
        description: 'Построенный путь',
      });
    }

    return items;
  }, [colors, showRouteMode]);

  const [collapsed, setCollapsed] = useState(true);

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Pressable
        style={({ pressed }) => [styles.header, collapsed && styles.headerCollapsed, pressed && { opacity: 0.7 }]}
        onPress={() => setCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Показать легенду' : 'Скрыть легенду'}
      >
        <Feather name="info" size={16} color={colors.textMuted} />
        <Text style={styles.title}>Легенда карты</Text>
        <Feather name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={colors.textMuted} />
      </Pressable>
      {!collapsed && (
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
      )}
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderBottomColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  headerCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.text,
  },
  description: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default React.memo(MapLegend);
