import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

export type SortOption = 'date' | 'popularity' | 'distance' | 'name';

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  showDistance?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'date', label: 'По дате', icon: 'calendar' },
  { value: 'popularity', label: 'По популярности', icon: 'trending-up' },
  { value: 'name', label: 'По названию', icon: 'type' },
];

export default function SortSelector({ value, onChange, showDistance = false }: SortSelectorProps) {
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const options = showDistance
    ? [...SORT_OPTIONS, { value: 'distance' as SortOption, label: 'По расстоянию', icon: 'map-pin' }]
    : SORT_OPTIONS;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <Text style={styles.label}>Сортировка:</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.option, isActive && styles.optionActive]}
              accessibilityRole="button"
              accessibilityLabel={`Сортировать ${option.label}`}
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
    color: colors.primary,
    fontWeight: '600',
  },
});
