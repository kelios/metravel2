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
      <View style={styles.headerRow}>
        <Text style={styles.caption}>Активные фильтры</Text>
        <Text style={styles.captionCount}>{filters.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={Platform.OS === 'web' ? (styles.scroll as any) : undefined}
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
      minHeight: 40,
      paddingTop: 8,
      paddingBottom: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
          } as any)
        : null),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingBottom: 6,
    },
    caption: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    captionCount: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      backgroundColor: colors.backgroundSecondary,
      textAlign: 'center',
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
      paddingHorizontal: 10,
      paddingVertical: 5,
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
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
