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
      height: 40,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          } as any)
        : null),
    },
    scrollContent: {
      paddingHorizontal: 14,
      gap: 6,
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? ({ touchAction: 'pan-x' } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primarySoft ?? colors.primaryLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      ...(Platform.OS === 'web' ? ({
        cursor: 'pointer',
        transition: 'opacity 0.12s ease',
      } as any) : null),
    },
    chipPressed: {
      opacity: 0.65,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryText,
      maxWidth: 110,
      letterSpacing: 0.1,
    },
    clearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    clearText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },
  });
