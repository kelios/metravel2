import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';

interface ChipProps {
  label: string;
  selected?: boolean;
  count?: number;
  icon?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const radii = DESIGN_TOKENS.radii;
const spacing = DESIGN_TOKENS.spacing;

function Chip({ label, selected = false, count, icon, onPress, testID, disabled = false, style }: ChipProps) {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Динамическая поддержка тем

  const styles = useMemo(() => StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.md, // ✅ УЛУЧШЕНИЕ: Увеличен padding
      paddingVertical: DESIGN_TOKENS.spacing.sm, // ✅ УЛУЧШЕНИЕ: Увеличен padding для высоты 40px
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      gap: spacing.xs,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight, // ✅ УЛУЧШЕНИЕ: Минимальная высота для touch-целей
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: DESIGN_TOKENS.shadows.light,
          ':hover': {
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    selected: {
      backgroundColor: colors.primarySoft,
      shadowColor: colors.primary,
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
    },
    labelSelected: {
      color: colors.primaryText,
    },
    count: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '500',
    },
    countSelected: {
      color: colors.primaryText,
    },
    icon: {
      marginRight: spacing.xs / 2,
    },
  }), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        globalFocusStyles.focusable, // ✅ УЛУЧШЕНИЕ: Добавлен focus-индикатор
        selected && styles.selected,
        pressed && !selected && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text style={[styles.count, selected && styles.countSelected]}>({count})</Text>
      ) : null}
    </Pressable>
  );
}

export default memo(Chip);
