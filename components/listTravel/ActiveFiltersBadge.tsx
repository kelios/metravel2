// Компонент для отображения количества активных фильтров
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

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
      if (key === 'showModerationPending' && value) {
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
        <Feather name="filter" size={14} color="#6b8e7f" />
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
          <Feather name="x" size={16} color="#666" />
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
    backgroundColor: '#f0f7f4',
    borderRadius: 8,
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
    color: '#6b8e7f',
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      },
    }),
  },
});

