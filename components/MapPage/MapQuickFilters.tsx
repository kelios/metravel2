/**
 * MapQuickFilters — горизонтальный scroll с chip-кнопками категорий поверх карты
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Category {
  id: string | number;
  name: string;
}

interface MapQuickFiltersProps {
  categories: Category[];
  selectedCategories: string[];
  onToggleCategory: (categoryName: string) => void;
  maxVisible?: number;
}

export const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  'Горы': 'triangle',
  'Пляжи': 'sun',
  'Города': 'map-pin',
  'Природа': 'feather',
  'Музеи': 'home',
  'Озера': 'droplet',
  'Культура': 'music',
  'Спорт': 'activity',
  'Еда': 'coffee',
  'Архитектура': 'layers',
};

export const MapQuickFilters: React.FC<MapQuickFiltersProps> = React.memo(({
  categories,
  selectedCategories,
  onToggleCategory,
  maxVisible = 5,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const visible = useMemo(
    () => categories.slice(0, maxVisible),
    [categories, maxVisible],
  );

  if (!visible.length) return null;

  return (
    <View style={[styles.container, { pointerEvents: 'box-none' }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {visible.map((cat) => {
          const isSelected = selectedCategories.includes(cat.name);
          const iconName = CATEGORY_ICONS[cat.name];

          return (
            <CardActionPressable
              key={cat.id}
              accessibilityLabel={`${isSelected ? 'Убрать' : 'Добавить'} фильтр: ${cat.name}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onToggleCategory(cat.name)}
              title={cat.name}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              {isSelected ? (
                <Feather name="x" size={14} color={colors.textOnPrimary} />
              ) : iconName ? (
                <Feather name={iconName} size={14} color={colors.text} />
              ) : null}
              <Text
                style={[styles.chipText, isSelected && styles.chipTextActive]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
            </CardActionPressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      zIndex: 5,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      gap: 6,
      paddingRight: 6,
      ...(Platform.OS === 'web'
        ? ({ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
            cursor: 'pointer',
          } as any)
        : colors.shadows.light),
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipPressed: {
      opacity: 0.82,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
    },
  });
