// Компонент для отображения количества активных фильтров
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ActiveFiltersBadgeProps {
  filterValue: Record<string, any>;
  onClear?: () => void;
  showClearButton?: boolean;
}

export default function ActiveFiltersBadge({
  filterValue,
  onClear,
  showClearButton = true,
}: ActiveFiltersBadgeProps) {
  const activeCount = useMemo(() => {
    let count = 0;
    
    // Подсчитываем активные фильтры
    Object.entries(filterValue).forEach(([key, value]) => {
      if (key === 'moderation' && value === 0) {
        count++;
      } else if (Array.isArray(value) && value.length > 0) {
        count += value.length;
      } else if (value && typeof value === 'string' && value.trim() !== '') {
        count++;
      }
    });
    
    return count;
  }, [filterValue]);

  // ✅ UX УЛУЧШЕНИЕ: Получаем список активных фильтров для отображения
  const activeFiltersList = useMemo(() => {
    const list: string[] = [];
    Object.entries(filterValue).forEach(([key, value]) => {
      if (key === 'moderation' && value === 0) {
        list.push('Модерация');
      } else if (Array.isArray(value) && value.length > 0) {
        list.push(...value.slice(0, 3).map(v => String(v)));
        if (value.length > 3) {
          list.push(`+${value.length - 3} еще`);
        }
      } else if (value && typeof value === 'string' && value.trim() !== '') {
        list.push(value);
      }
    });
    return list;
  }, [filterValue]);

  if (activeCount === 0) return null;

  // ✅ ИСПРАВЛЕНИЕ: Выносим Platform-специфичные стили в компонент
  const containerStyle = [
    styles.container,
    Platform.OS === 'web' && { cursor: 'default' },
  ];

  const clearButtonStyle = [
    styles.clearButton,
    Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.badge}>
        <Feather name="filter" size={16} color={DESIGN_TOKENS.colors.primary} />
        <Text style={styles.badgeText}>
          {activeCount} {activeCount === 1 ? 'фильтр' : activeCount < 5 ? 'фильтра' : 'фильтров'}
        </Text>
      </View>
      {activeFiltersList.length > 0 && activeFiltersList.length <= 3 && (
        <View style={styles.filtersList}>
          {activeFiltersList.map((filter, index) => (
            <Text key={index} style={styles.filterItem} numberOfLines={1}>
              {filter}
            </Text>
          ))}
        </View>
      )}
      {showClearButton && onClear && (
        <Pressable
          style={clearButtonStyle}
          onPress={onClear}
          accessibilityLabel="Сбросить все фильтры"
          hitSlop={8}
          minWidth={44}
          minHeight={44}
          justifyContent="center"
          alignItems="center"
        >
          <Feather name="x" size={18} color={DESIGN_TOKENS.colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 14,
    // ✅ UX УЛУЧШЕНИЕ: Более заметный badge
    borderWidth: 1.5,
    borderColor: DESIGN_TOKENS.colors.primary,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(74, 140, 140, 0.2)',
      },
      default: {
        shadowColor: DESIGN_TOKENS.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  filtersList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  filterItem: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    maxWidth: 120,
  },
  clearButton: {
    padding: 6,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        },
      },
    }),
  },
});

