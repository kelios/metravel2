import React, { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ИСПРАВЛЕНИЕ: Импорт focus-стилей

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  labelNumberOfLines?: number;
  hoverStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const getBoxShadows = (colors: ThemedColors) => {
  const themed = colors as unknown as { boxShadows?: typeof DESIGN_TOKENS.shadows };
  return themed.boxShadows ?? DESIGN_TOKENS.shadows;
};

const ButtonComponent = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
  style,
  labelStyle,
  labelNumberOfLines = 1,
  hoverStyle,
  pressedStyle,
}: ButtonProps) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const variantStyles = useMemo(() => getVariantStyles(colors), [colors]);
  const variantHoverStyles = useMemo(() => getVariantHoverStyles(colors), [colors]);
  const variantPressedStyles = useMemo(() => getVariantPressedStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.base,
        globalFocusStyles.focusable, // ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        !isDisabled && hovered && Platform.OS === 'web' && variantHoverStyles[variant],
        !isDisabled && pressed && variantPressedStyles[variant],
        !isDisabled && hovered && Platform.OS === 'web' && hoverStyle,
        !isDisabled && pressed && pressedStyle,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={
              variant === 'secondary' || variant === 'ghost' || variant === 'outline'
                ? colors.primary
                : colors.textOnPrimary
            }
            style={styles.icon}
          />
        )}
        {!loading && icon && iconPosition === 'left' ? <View style={styles.icon}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            variant === 'secondary' || variant === 'ghost' || variant === 'outline' ? styles.labelSecondary : styles.labelPrimary,
            variant === 'danger' && styles.labelDanger,
            labelStyle,
          ]}
          numberOfLines={labelNumberOfLines}
        >
          {label}
        </Text>
        {!loading && icon && iconPosition === 'right' ? <View style={styles.icon}>{icon}</View> : null}
      </View>
    </Pressable>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 44, // ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        touchAction: 'pan-y',
      } as any,
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  labelPrimary: {
    color: colors.textOnPrimary,
  },
  labelSecondary: {
    color: colors.text,
  },
  labelDanger: {
    color: colors.textOnPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  md: {},
  lg: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
};

const getVariantStyles = (colors: ThemedColors): Record<ButtonVariant, ViewStyle> => {
  const boxShadows = getBoxShadows(colors);

  return {
    primary: {
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.medium,
        },
        default: {
          shadowColor: colors.text,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 3,
        },
      }),
    },
    secondary: {
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.light,
        },
        default: {
          shadowColor: colors.text,
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        },
      }),
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: colors.danger,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.medium,
        },
        default: {
          shadowColor: colors.text,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 3,
        },
      }),
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
      borderWidth: 2,
    },
  };
};

const getVariantHoverStyles = (colors: ThemedColors): Record<ButtonVariant, ViewStyle> => {
  const boxShadows = getBoxShadows(colors);

  return {
    primary: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.heavy,
        },
      }),
    },
    secondary: {
      backgroundColor: colors.primaryLight,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.hover,
        },
      }),
    },
    ghost: {
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {},
      }),
    },
    danger: {
      backgroundColor: colors.dangerDark,
      ...Platform.select({
        web: {
          boxShadow: boxShadows.heavy,
        },
      }),
    },
    outline: {
      backgroundColor: colors.primarySoft,
      ...Platform.select({
        web: {},
      }),
    },
  };
};

const getVariantPressedStyles = (colors: ThemedColors): Record<ButtonVariant, ViewStyle> => {
  const boxShadows = getBoxShadows(colors);

  return {
    primary: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore
          transform: 'translateY(0)',
          boxShadow: boxShadows.light,
        },
      }),
    },
    secondary: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore
          transform: 'translateY(0)',
        },
      }),
    },
    ghost: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore
          transform: 'translateY(0)',
        },
      }),
    },
    danger: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore
          transform: 'translateY(0)',
          boxShadow: boxShadows.light,
        },
      }),
    },
    outline: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore
          transform: 'translateY(0)',
        },
      }),
    },
  };
};

export default memo(ButtonComponent);
