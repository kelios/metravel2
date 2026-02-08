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

  if (!filters.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((f) => (
          <CardActionPressable
            key={f.key}
            accessibilityLabel={`Убрать фильтр: ${f.label}`}
            onPress={() => onRemoveFilter(f.key)}
            title={`Убрать: ${f.label}`}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText} numberOfLines={1}>{f.label}</Text>
            <Feather name="x" size={12} color={colors.textMuted} />
          </CardActionPressable>
        ))}
        {onClearAll && filters.length > 1 && (
          <CardActionPressable
            accessibilityLabel="Сбросить все фильтры"
            onPress={onClearAll}
            title="Сбросить все"
            style={({ pressed }) => [styles.clearBtn, pressed && styles.chipPressed]}
          >
            <Text style={styles.clearText}>Сбросить все</Text>
          </CardActionPressable>
        )}
      </ScrollView>
    </View>
  );
});

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      height: 36,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    scrollContent: {
      paddingHorizontal: 12,
      gap: 8,
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? ({ touchAction: 'pan-x' } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      maxWidth: 120,
    },
    clearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 14,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    clearText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
