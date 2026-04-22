/**
 * ActiveFiltersBar — компактная полоса с dismiss-чипами активных фильтров
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface ActiveFilter {
  key: string;
  label: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  onRemoveFilter: (key: string) => void;
  onClearAll?: () => void;
}

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = React.memo(({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Radius is already represented in dedicated map UI, so omit it here
  // to avoid duplicate active-filter chips.
  const visibleFilters = useMemo(
    () => filters.filter((filterItem) => filterItem.key !== 'radius'),
    [filters],
  );

  if (!visibleFilters.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={Platform.OS === 'web' ? (styles.scroll as any) : undefined}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleFilters.map((f) => (
          <CardActionPressable
            key={f.key}
            accessibilityLabel={`Убрать фильтр: ${f.label}`}
            onPress={() => onRemoveFilter(f.key)}
            title={`Убрать: ${f.label}`}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText} numberOfLines={1}>{f.label}</Text>
            <Feather name="x" size={12} color={colors.brandText} />
          </CardActionPressable>
        ))}
        {onClearAll && visibleFilters.length > 1 && (
          <CardActionPressable
            accessibilityLabel="Сбросить все фильтры"
            onPress={onClearAll}
            title="Сбросить все"
            style={({ pressed }) => [styles.clearBtn, pressed && styles.chipPressed]}
          >
            <Feather name="rotate-ccw" size={11} color={colors.textMuted} />
            <Text style={styles.clearText}>Сбросить</Text>
          </CardActionPressable>
        )}
      </ScrollView>
    </View>
  );
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    scrollContent: {
      paddingHorizontal: 10,
      gap: 6,
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? ({ minWidth: 'max-content', touchAction: 'pan-x pan-y' } as any)
        : null),
    },
    scroll: {
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'auto',
            overflowY: 'hidden',
            overscrollBehaviorX: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
          } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.brandSoft ?? colors.brandLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.brand,
      ...(Platform.OS === 'web' ? ({
        cursor: 'pointer',
        transition: 'opacity 0.12s ease, transform 0.12s ease',
      } as any) : null),
    },
    chipPressed: {
      opacity: 0.65,
      ...(Platform.OS === 'web' ? ({ transform: 'translateY(1px)' } as any) : null),
    },
    chipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.brandText,
      maxWidth: 120,
      letterSpacing: 0.1,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    clearText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
