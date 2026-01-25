import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

export interface SelectionOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectionGroupProps<T extends string | number> {
  options: SelectionOption<T>[] | T[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  itemStyle?: ViewStyle;
}

export function SelectionGroup<T extends string | number>({
  options,
  value,
  onChange,
  style,
  itemStyle,
}: SelectionGroupProps<T>) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const normalizedOptions: SelectionOption<T>[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && 'value' in opt) {
        return opt;
      }
      return { value: opt, label: String(opt) };
    });
  }, [options]);

  return (
    <View style={[styles.container, style]}>
      {normalizedOptions.map((option) => {
        const isActive = value === option.value;
        return (
          <Pressable
            key={String(option.value)}
            style={[
              styles.item,
              isActive && styles.itemActive,
              itemStyle,
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
          >
            <Text
              style={[
                styles.text,
                isActive && styles.textActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  textActive: {
    color: colors.textOnPrimary,
  },
});
