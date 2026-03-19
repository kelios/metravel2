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
        style={[styles.scroll, Platform.OS === 'web' && styles.scrollWeb]}
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
      top: 16,
      left: 16,
      right: 16,
      zIndex: 5,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollWeb: {
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'auto',
            overflowY: 'hidden',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x pan-y',
            WebkitOverflowScrolling: 'touch',
          } as any)
        : null),
    },
    scrollContent: {
      gap: 10,
      paddingRight: 10,
      ...(Platform.OS === 'web'
        ? ({ minWidth: 'max-content', touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderWidth: 0,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          } as any)
        : colors.shadows.light),
    },
    chipActive: {
      backgroundColor: colors.brand,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 6px 24px rgba(255, 146, 43, 0.4), 0 2px 8px rgba(255, 146, 43, 0.2)',
            transform: 'scale(1.05)',
          } as any)
        : null),
    },
    chipPressed: {
      opacity: 0.85,
      ...(Platform.OS === 'web'
        ? ({
            transform: 'scale(0.98)',
          } as any)
        : null),
    },
    chipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
    },
  });
