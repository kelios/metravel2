/**
 * ActiveFiltersBar — компактная полоса с dismiss-чипами активных фильтров
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import CardActionPressable from '@/components/ui/CardActionPressable';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface ActiveFilter {
  key: string;
  label: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  onRemoveFilter: (key: string) => void;
  onClearAll?: () => void;
  /**
   * `panel` — полоса внутри панели фильтров (фон surface + нижняя граница).
   * `floating` — та же полоса, но поверх карты при ЗАКРЫТОЙ панели: контейнер
   * прозрачный (чипы читаются за счёт собственного фона/границы), полоса не
   * рисует фальшивую «шапку» над картой. Это ЕДИНСТВЕННОЕ отличие — разметка,
   * порядок и поведение чипов общие для обеих поверхностей.
   */
  variant?: 'panel' | 'floating';
  /**
   * `floating`-режим: показывать «Сбросить всё» даже для одного чипа. На карте
   * это единственный явный способ сброса (круглый FAB прячется, пока полоса
   * видна), поэтому он не должен зависеть от количества фильтров.
   */
  alwaysShowClearAll?: boolean;
  testID?: string;
}

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = React.memo(({
  filters,
  onRemoveFilter,
  onClearAll,
  variant = 'panel',
  alwaysShowClearAll = false,
  testID,
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
    <View
      style={variant === 'floating' ? styles.containerFloating : styles.container}
      testID={testID}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={Platform.OS === 'web' ? (styles.scroll as any) : undefined}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleFilters.map((f) => (
          <CardActionPressable
            key={f.key}
            accessibilityLabel={i18nT('map:components.MapPage.ActiveFiltersBar.ubrat_filtr_value1_0e9ad7b7', { value1: f.label })}
            onPress={() => onRemoveFilter(f.key)}
            title={i18nT('map:components.MapPage.ActiveFiltersBar.ubrat_value1_9f2821a9', { value1: f.label })}
            style={({ pressed }) => [
              styles.chip,
              variant === 'floating' && styles.chipFloating,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={styles.chipText} numberOfLines={1}>{f.label}</Text>
            <Feather name="x" size={12} color={colors.brandText} />
          </CardActionPressable>
        ))}
        {onClearAll && (alwaysShowClearAll || visibleFilters.length > 1) && (
          <CardActionPressable
            testID="map-active-filters-clear-all"
            accessibilityLabel={i18nT('map:components.MapPage.ActiveFiltersBar.sbrosit_vse_filtry_8755de36')}
            onPress={onClearAll}
            title={i18nT('map:components.MapPage.ActiveFiltersBar.sbrosit_vse_f8a0db43')}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.chipPressed]}
          >
            <Feather name="rotate-ccw" size={11} color={colors.textMuted} />
            <Text style={styles.clearText}>{i18nT('map:components.MapPage.ActiveFiltersBar.sbrosit_979f0798')}</Text>
          </CardActionPressable>
        )}
      </ScrollView>
    </View>
  );
});

// «Фрост»-тень проекта (тот же паттерн, что у тулбар-кнопок карты в
// MapMobileTopOverlay.styles.ts) — чтобы floating-чип читался поверх пёстрых
// тайлов как непрозрачная плашка, а не полупрозрачная подсветка.
const shadowWeb = {
  boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
} as const;

const shadowNative = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
} as const;

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    // Поверх карты: без фона/границы контейнера — иначе полоса читается как
    // вторая шапка. Чипы уже несут собственный фон + границу.
    containerFloating: {
      paddingVertical: 0,
      backgroundColor: 'transparent',
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
      borderWidth: 1,
      borderColor: colors.brand,
      ...(Platform.OS === 'web' ? ({
        cursor: 'pointer',
        transition: 'opacity 0.12s ease, transform 0.12s ease',
      } as any) : null),
    },
    // Поверх карты чип обязан быть НЕПРОЗРАЧНЫМ: brandSoft (~10% оранжевого)
    // тонет в пёстрых тайлах. Даём тот же surface + «фрост»-тень, что у
    // тулбар-кнопок карты. В панели фильтров (variant='panel') этот стиль НЕ
    // применяется — там brandSoft-заливка на surface-панели читается корректно
    // и лишняя тень внутри панели не нужна.
    chipFloating: {
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
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
