/**
 * MapQuickFilters — горизонтальный scroll с chip-кнопками категорий поверх карты
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
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
  onOpenFilters?: () => void;
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
  onOpenFilters,
}) => {
  const colors = useThemedColors();
  const { width } = useWindowDimensions();
  const isNarrow = width > 0 && width <= 390;
  const isVeryNarrow = width > 0 && width <= 360;
  const styles = useMemo(() => getStyles(colors, { isNarrow, isVeryNarrow }), [colors, isNarrow, isVeryNarrow]);
  const effectiveMaxVisible = isVeryNarrow ? Math.min(maxVisible, 2) : isNarrow ? Math.min(maxVisible, 3) : maxVisible;

  const visible = useMemo(
    () => categories.slice(0, effectiveMaxVisible),
    [categories, effectiveMaxVisible],
  );
  const hiddenCount = Math.max(categories.length - visible.length, 0);
  const selectedCount = selectedCategories.length;
  const shouldShowActionChip =
    typeof onOpenFilters === 'function' && (hiddenCount > 0 || selectedCount > 0);
  const actionBadgeLabel =
    hiddenCount > 0 ? `+${hiddenCount}` : selectedCount > 0 ? String(selectedCount) : '';
  const actionAccessibilityLabel =
    hiddenCount > 0
      ? `Открыть все фильтры, скрыто ещё ${hiddenCount}`
      : `Открыть все фильтры, выбрано ${selectedCount}`;

  if (!visible.length) return null;

  // Show fade hint when there are more items than visible (hidden chips or action chip)
  const showFadeHint = hiddenCount > 0 || shouldShowActionChip;

  return (
    <View style={[styles.container, { pointerEvents: 'box-none' }]}>
      <View style={styles.scrollWrapper}>
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

        {shouldShowActionChip && (
          <CardActionPressable
            accessibilityLabel={actionAccessibilityLabel}
            onPress={onOpenFilters}
            title="Все фильтры"
            style={({ pressed }) => [
              styles.chip,
              styles.actionChip,
              selectedCount > 0 && styles.actionChipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Feather name="sliders" size={14} color={colors.text} />
            <Text style={styles.chipText} numberOfLines={1}>
              Все фильтры
            </Text>
            {actionBadgeLabel ? (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{actionBadgeLabel}</Text>
              </View>
            ) : null}
          </CardActionPressable>
        )}
      </ScrollView>
      {showFadeHint && Platform.OS === 'web' && (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(253, 252, 251, 0)', 'rgba(253, 252, 251, 0.84)', colors.background]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fadeHint}
        />
      )}
      </View>
    </View>
  );
});

const getStyles = (
  colors: ThemedColors,
  options: { isNarrow: boolean; isVeryNarrow: boolean }
) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: options.isNarrow ? 10 : 16,
      left: options.isNarrow ? 12 : 16,
      right: options.isNarrow ? 12 : 16,
      zIndex: 5,
    },
    scrollWrapper: {
      position: 'relative',
      flexShrink: 0,
    },
    fadeHint: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 44,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
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
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      paddingRight: options.isNarrow ? 4 : 10,
      ...(Platform.OS === 'web'
        ? ({ minWidth: 'max-content', touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      paddingHorizontal: options.isVeryNarrow ? 12 : options.isNarrow ? 14 : 16,
      paddingVertical: options.isVeryNarrow ? 8 : options.isNarrow ? 9 : 10,
      borderRadius: options.isVeryNarrow ? 20 : 24,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '0 8px 24px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    chipActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 10px 28px rgba(255, 146, 43, 0.28), 0 2px 10px rgba(255, 146, 43, 0.18)',
            transform: 'translateY(-1px)',
          } as any)
        : null),
    },
    chipPressed: {
      opacity: 0.85,
      ...(Platform.OS === 'web'
        ? ({
            transform: 'translateY(0px) scale(0.985)',
          } as any)
        : null),
    },
    actionChip: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    actionChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    actionBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    actionBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
    },
    chipText: {
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    chipTextActive: {
      color: colors.textOnPrimary,
    },
  });
