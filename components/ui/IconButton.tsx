import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, Platform, Text, type StyleProp, type ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
  showLabel?: boolean;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const getBoxShadows = (colors: ThemedColors) => {
  const themed = colors as unknown as { boxShadows?: typeof DESIGN_TOKENS.shadows };
  return themed.boxShadows ?? DESIGN_TOKENS.shadows;
};

function IconButton({
  icon,
  label,
  active = false,
  onPress,
  disabled = false,
  size = 'md',
  testID,
  style,
  showLabel = false,
}: IconButtonProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [hovered, setHovered] = useState(false);
  const dimension = size === 'sm' ? 36 : 42;
  const handlePress = disabled ? undefined : onPress

  if (showLabel) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={handlePress}
        testID={testID}
        style={({ pressed, hovered }) => [
          styles.labeledBase,
          globalFocusStyles.focusable,
          {
            minHeight: dimension,
            borderRadius: radii.lg,
            backgroundColor: active ? colors.primary : colors.surface,
          },
          style,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          !disabled && hovered && Platform.OS === 'web' && styles.hovered,
        ]}
      >
        <View style={styles.icon}>{icon}</View>
        <Text
          style={[
            styles.labelText,
            { color: active ? colors.textOnPrimary : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
      onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
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
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        !disabled && hovered && Platform.OS === 'web' && styles.hovered,
      ]}
    >
      <View style={styles.icon}>{icon}</View>
      {Platform.OS === 'web' && hovered && !disabled ? (
        <View style={[styles.tooltip, { backgroundColor: colors.text }]}>
          <Text style={[styles.tooltipText, { color: colors.surface }]}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const getStyles = (colors: ThemedColors) => {
  const boxShadows = getBoxShadows(colors);

  return StyleSheet.create({
    labeledBase: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
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
          boxShadow: boxShadows.light,
        },
      }),
    },
    labelText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600' as any,
    },
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
          boxShadow: boxShadows.light,
          // @ts-ignore
          ':hover': {
            backgroundColor: colors.primarySoft,
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    hovered: {
      ...Platform.select({
        web: {
          zIndex: 2,
        },
      }),
    },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -36,
    left: '50%',
    transform: [{ translateX: -0.5 } as any],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    maxWidth: 240,
    zIndex: 9999,
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
      },
    }),
  },
  tooltipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: DESIGN_TOKENS.typography.sizes.xs + 2,
    fontWeight: '500' as any,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  });
};

export default memo(IconButton);
