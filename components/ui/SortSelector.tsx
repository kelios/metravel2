import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


export type SortOption = 'date' | 'popularity' | 'distance' | 'name';

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  showDistance?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'date', get label() { return i18nT('sharedStatic:components.ui.SortSelector.po_date_7b38f670') }, icon: 'calendar' },
  { value: 'popularity', get label() { return i18nT('sharedStatic:components.ui.SortSelector.po_populyarnosti_0cf7c20d') }, icon: 'trending-up' },
  { value: 'name', get label() { return i18nT('sharedStatic:components.ui.SortSelector.po_nazvaniyu_d1dee248') }, icon: 'type' },
];

function SortSelector({ value, onChange, showDistance = false }: SortSelectorProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const options = showDistance
    ? [...SORT_OPTIONS, { value: 'distance' as SortOption, label: i18nT('shared:components.ui.SortSelector.po_rasstoyaniyu_8c8c6925'), icon: 'map-pin' }]
    : SORT_OPTIONS;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Text style={styles.label}>{i18nT('shared:components.ui.SortSelector.sortirovka_a1c8e586')}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.option, isActive && styles.optionActive]}
              accessibilityRole="button"
              accessibilityLabel={i18nT('shared:components.ui.SortSelector.sortirovat_value1_98a74dcf', { value1: option.label })}
              accessibilityState={{ selected: isActive }}
            >
              <Feather
                name={option.icon as any}
                size={14}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  containerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  optionTextActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
});

export default React.memo(SortSelector);
