// Компонент категорий-чипсов для быстрой фильтрации
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Chip from '@/components/ui/Chip';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface Category {
  id: string | number;
  name: string;
  count?: number;
  icon?: string; // ✅ УЛУЧШЕНИЕ: Добавлена поддержка иконок
}

interface CategoryChipsProps {
  categories: Category[];
  selectedCategories: string[];
  onToggleCategory: (categoryName: string) => void;
  maxVisible?: number;
  showIcons?: boolean; // ✅ УЛУЧШЕНИЕ: Флаг для показа иконок
}

// ✅ УЛУЧШЕНИЕ: Маппинг популярных категорий на иконки
const CATEGORY_ICONS: Record<string, string> = {
  'Горы': 'mountain',
  'Пляжи': 'sun',
  'Города': 'map-pin',
  'Природа': 'tree',
  'Музеи': 'building',
  'Озера': 'droplet',
  'Культура': 'music',
  'Спорт': 'activity',
  'Еда': 'coffee',
  'Архитектура': 'layers',
};

export default function CategoryChips({
  categories,
  selectedCategories,
  onToggleCategory,
  maxVisible = 10,
  showIcons = true, // ✅ УЛУЧШЕНИЕ: По умолчанию показываем иконки
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
        // ✅ УЛУЧШЕНИЕ: Используем иконку из пропса или маппинга
        const iconName = category.icon || CATEGORY_ICONS[category.name];
        const shouldShowIcon = showIcons && iconName && !isSelected;
        const icon = isSelected ? (
          <Feather name="x" size={14} color="#fff" />
        ) : shouldShowIcon ? (
          <Feather name={iconName as any} size={14} color={DESIGN_TOKENS.colors.primary} />
        ) : undefined;

        return (
          <Chip
            key={category.id}
            label={category.name}
            selected={isSelected}
            count={category.count}
            icon={icon}
            onPress={() => onToggleCategory(category.name)}
          />
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
    gap: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  moreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  moreText: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
  },
});

