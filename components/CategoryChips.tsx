// Компонент категорий-чипсов для быстрой фильтрации
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
// ✅ ДИЗАЙН: Импорт максимально легкой и воздушной палитры
import { AIRY_COLORS, AIRY_BOX_SHADOWS } from '@/constants/airyColors';

interface Category {
  id: string | number;
  name: string;
  count?: number;
}

interface CategoryChipsProps {
  categories: Category[];
  selectedCategories: string[];
  onToggleCategory: (categoryName: string) => void;
  maxVisible?: number;
}

export default function CategoryChips({
  categories,
  selectedCategories,
  onToggleCategory,
  maxVisible = 10,
}: CategoryChipsProps) {
  const visibleCategories = useMemo(
    () => categories.slice(0, maxVisible),
    [categories, maxVisible]
  );

  if (categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {visibleCategories.map((category) => {
        const isSelected = selectedCategories.includes(category.name);
        return (
          <Pressable
            key={category.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onToggleCategory(category.name)}
            {...Platform.select({
              web: { cursor: 'pointer' },
            })}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {category.name}
            </Text>
            {category.count !== undefined && (
              <Text style={[styles.chipCount, isSelected && styles.chipCountSelected]}>
                {' '}({category.count})
              </Text>
            )}
            {isSelected && (
              <Feather name="x" size={12} color="#fff" style={styles.chipIcon} />
            )}
          </Pressable>
        );
      })}
      {categories.length > maxVisible && (
        <View style={styles.moreChip}>
          <Text style={styles.moreText}>+{categories.length - maxVisible}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    marginBottom: 0, // ✅ ДИЗАЙН: Убран margin (управляется извне)
  },
  container: {
    paddingHorizontal: Platform.select({
      default: 8, // Mobile: 8px
      web: 0, // Desktop: 0px (уже есть padding в main)
    }),
    gap: 12, // ✅ ДИЗАЙН: Увеличен gap
    alignItems: 'center',
    paddingVertical: 4, // ✅ ДИЗАЙН: Вертикальные отступы
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, // ✅ ДИЗАЙН: Увеличены отступы
    paddingVertical: 10, // ✅ ДИЗАЙН: Увеличены отступы
    height: Platform.select({
      default: 32, // Mobile: 32px
      web: 36, // Desktop: 36px
    }),
    borderRadius: 18, // ✅ ДИЗАЙН: Pill shape (50% от высоты)
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)', // ✅ ДИЗАЙН: Единая граница
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          transform: 'scale(1.05)', // ✅ ДИЗАЙН: Масштаб при hover
          boxShadow: AIRY_BOX_SHADOWS.light,
          borderColor: AIRY_COLORS.borderAccent, // ✅ ДИЗАЙН: Воздушная легкая персиковая граница при hover
        },
      },
    }),
  },
  chipSelected: {
    backgroundColor: AIRY_COLORS.primary, // ✅ ДИЗАЙН: Воздушный легкий персиковый фон
    borderColor: AIRY_COLORS.primary,
    ...Platform.select({
      web: {
        boxShadow: AIRY_BOX_SHADOWS.medium, // ✅ ДИЗАЙН: Легкая воздушная тень
        transform: 'scale(1.05)',
      },
    }),
  },
  chipText: {
    fontSize: 14, // ✅ ДИЗАЙН: Увеличен размер
    fontWeight: '600', // ✅ ДИЗАЙН: Увеличен weight
    color: '#1a202c', // ✅ ДИЗАЙН: Единый цвет текста
    lineHeight: 20,
    letterSpacing: -0.2, // ✅ ДИЗАЙН: Отрицательный letter-spacing
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipCount: {
    fontSize: 12,
    color: '#4a5568', // ✅ ДИЗАЙН: Вторичный цвет
    fontWeight: '500',
  },
  chipCountSelected: {
    color: 'rgba(255,255,255,0.9)', // ✅ ДИЗАЙН: Более непрозрачный белый
  },
  chipIcon: {
    marginLeft: 6,
  },
  moreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  moreText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
});

