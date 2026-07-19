import React, { forwardRef, memo, useMemo } from 'react';
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

// soft = tonal (primarySoft bg + primaryText); danger-outline = красная рамка+текст, прозрачный фон
// tonal = нейтральный серый фон (backgroundTertiary) + primaryText, для второстепенных pill-кнопок
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft' | 'danger-outline' | 'tonal';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  /** Замыкающая иконка справа от label. Рендерится одновременно с leading `icon`. */
  trailingIcon?: React.ReactNode;
  /** Иконочная кнопка: рендерит только icon (label уходит в accessibilityLabel), квадрат 44/48. */
  iconOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
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

const ButtonComponent = forwardRef<View, ButtonProps>(({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  trailingIcon,
  iconOnly = false,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  labelStyle,
  labelNumberOfLines = 1,
  hoverStyle,
  pressedStyle,
}, ref) => {
  const colors = useThemedColors();
  const styles = staticStyles;
  const variantStyles = useMemo(() => getVariantStyles(colors), [colors]);
  const variantHoverStyles = useMemo(() => getVariantHoverStyles(colors), [colors]);
  const variantPressedStyles = useMemo(() => getVariantPressedStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  // Цвет текста/иконки-спиннера по варианту (единый источник для label и ActivityIndicator)
  const foreground = getForegroundColor(variant, colors);

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      testID={testID}
      disabled={isDisabled}
      onPress={onPress}
      android_ripple={!isDisabled ? { color: 'rgba(0,0,0,0.12)', borderless: false } : undefined}
      style={({ pressed, hovered }) => [
        styles.base,
        globalFocusStyles.focusable, // ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        sizeStyles[size],
        iconOnly && styles.iconOnly,
        style,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        !isDisabled && hovered && Platform.OS === 'web' && variantHoverStyles[variant],
        !isDisabled && pressed && variantPressedStyles[variant],
        !isDisabled && hovered && Platform.OS === 'web' && hoverStyle,
        !isDisabled && pressed && pressedStyle,
        styles.visualShell,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={foreground}
            style={iconOnly ? undefined : styles.icon}
          />
        )}
        {!loading && icon && (iconOnly || iconPosition === 'left')
          ? <View style={iconOnly ? undefined : styles.icon}>{icon}</View>
          : null}
        {!iconOnly && (
          <Text
            style={[styles.label, { color: foreground }, labelStyle]}
            numberOfLines={labelNumberOfLines}
          >
            {label}
          </Text>
        )}
        {!loading && !iconOnly && icon && iconPosition === 'right' ? <View style={styles.icon}>{icon}</View> : null}
        {!loading && !iconOnly && trailingIcon ? <View style={styles.trailingIcon}>{trailingIcon}</View> : null}
      </View>
    </Pressable>
  );
});

ButtonComponent.displayName = 'Button';

// Стили визуального «шелла» кнопки не зависят от темы — цвет текста/иконки
// применяется инлайном через getForegroundColor(), а фон/бордер — через variantStyles.
const staticStyles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: Platform.OS === 'android' ? 48 : 44, // AND-26: M3 touch target 48dp on Android
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
  visualShell: {
    // borderRadius задаётся в `base` (radii.md по умолчанию); здесь не дублируем,
    // чтобы caller мог переопределить радиус через `style` (напр. pill).
    ...Platform.select({
      web: {
        backgroundImage: 'none',
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
  trailingIcon: {
    marginLeft: spacing.xs,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  iconOnly: {
    paddingHorizontal: spacing.sm,
    minWidth: Platform.OS === 'android' ? 48 : 44,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});

// Цвет переднего плана (label + spinner) по варианту.
const getForegroundColor = (variant: ButtonVariant, colors: ThemedColors): string => {
  switch (variant) {
    case 'secondary':
    case 'ghost':
    case 'outline':
      return colors.text;
    case 'soft':
    case 'tonal':
      return colors.primaryText;
    case 'danger-outline':
      return colors.danger;
    case 'primary':
    case 'danger':
    default:
      return colors.textOnPrimary;
  }
};

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
    soft: {
      backgroundColor: colors.primarySoft,
      borderColor: 'transparent',
    },
    tonal: {
      backgroundColor: colors.backgroundTertiary,
      borderColor: 'transparent',
    },
    'danger-outline': {
      backgroundColor: 'transparent',
      borderColor: colors.danger,
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
    soft: {
      backgroundColor: colors.primaryLight,
      ...Platform.select({
        web: {},
      }),
    },
    tonal: {
      backgroundColor: colors.mutedBackground,
      ...Platform.select({
        web: {},
      }),
    },
    'danger-outline': {
      backgroundColor: colors.dangerLight,
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
          // @ts-ignore -- web transform string type conflicts with RN transform array type
          transform: 'translateY(0)',
          boxShadow: boxShadows.light,
        },
      }),
    },
    secondary: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore -- web transform string type conflicts with RN transform array type
          transform: 'translateY(0)',
        },
      }),
    },
    ghost: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore -- web transform string type conflicts with RN transform array type
          transform: 'translateY(0)',
        },
      }),
    },
    danger: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore -- web transform string type conflicts with RN transform array type
          transform: 'translateY(0)',
          boxShadow: boxShadows.light,
        },
      }),
    },
    outline: {
      transform: [{ scale: 0.99 }],
      ...Platform.select({
        web: {
          // @ts-ignore -- web transform string type conflicts with RN transform array type
          transform: 'translateY(0)',
        },
      }),
    },
    soft: {
      transform: [{ scale: 0.99 }],
    },
    tonal: {
      transform: [{ scale: 0.99 }],
    },
    'danger-outline': {
      transform: [{ scale: 0.99 }],
    },
  };
};

export default memo(ButtonComponent);
