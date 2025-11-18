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

  if (activeCount === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Feather name="filter" size={14} color={DESIGN_TOKENS.colors.primary} />
        <Text style={styles.badgeText}>
          {activeCount} {activeCount === 1 ? 'фильтр' : activeCount < 5 ? 'фильтра' : 'фильтров'}
        </Text>
      </View>
      {showClearButton && onClear && (
        <Pressable
          style={styles.clearButton}
          onPress={onClear}
          accessibilityLabel="Сбросить все фильтры"
          hitSlop={8}
        >
          <Feather name="x" size={16} color={DESIGN_TOKENS.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 12,
    ...Platform.select({
      web: {
        cursor: 'default',
      },
    }),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  clearButton: {
    padding: 4,
    borderRadius: DESIGN_TOKENS.radii.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      },
    }),
  },
});

