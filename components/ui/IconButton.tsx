import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  testID?: string;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

function IconButton({
  icon,
  label,
  active = false,
  onPress,
  disabled = false,
  size = 'md',
  testID,
}: IconButtonProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const dimension = size === 'sm' ? 36 : 42;
  const handlePress = disabled ? undefined : onPress

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        {
          width: dimension,
          height: dimension,
          minWidth: dimension, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
          minHeight: dimension, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
          borderRadius: radii.lg,
          backgroundColor: active ? colors.primary : colors.surface,
          // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.icon}>{icon}</View>
    </Pressable>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  base: {
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs / 2,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        boxShadow: colors.boxShadows.light,
        // @ts-ignore
        ':hover': {
          backgroundColor: colors.primarySoft,
          transform: 'scale(1.05)',
        },
      },
    }),
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});

export default memo(IconButton);
