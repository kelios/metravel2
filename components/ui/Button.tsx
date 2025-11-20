import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

const ButtonComponent = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === 'secondary' || variant === 'ghost' ? palette.primary : palette.surface}
            style={styles.icon}
          />
        )}
        {!loading && icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            variant === 'secondary' || variant === 'ghost' ? styles.labelSecondary : styles.labelPrimary,
            variant === 'danger' && styles.labelDanger,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        willChange: 'transform, box-shadow, background-color',
      },
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
    fontSize: 15,
    fontWeight: '600',
  },
  labelPrimary: {
    color: palette.surface,
  },
  labelSecondary: {
    color: palette.text,
  },
  labelDanger: {
    color: palette.surface,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
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

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: palette.primary,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: '#1f1f1f',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    ...Platform.select({
      web: {
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primaryDark,
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(31, 31, 31, 0.15), 0 2px 4px rgba(31, 31, 31, 0.1)',
        },
        ':active': {
          transform: 'translateY(0)',
          boxShadow: '0 2px 6px rgba(31, 31, 31, 0.12)',
        },
      },
    }),
  },
  secondary: {
    backgroundColor: palette.surface,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: '#1f1f1f',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    ...Platform.select({
      web: {
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primaryLight,
          transform: 'translateY(-1px)',
          boxShadow: '0 3px 10px rgba(31, 31, 31, 0.12), 0 1px 4px rgba(31, 31, 31, 0.08)',
        },
        ':active': {
          transform: 'translateY(0)',
        },
      },
    }),
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    ...Platform.select({
      web: {
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
          transform: 'translateY(-1px)',
        },
        ':active': {
          transform: 'translateY(0)',
        },
      },
    }),
  },
  danger: {
    backgroundColor: palette.danger,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    shadowColor: '#1f1f1f',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    ...Platform.select({
      web: {
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.dangerDark,
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(31, 31, 31, 0.15), 0 2px 4px rgba(31, 31, 31, 0.1)',
        },
        ':active': {
          transform: 'translateY(0)',
          boxShadow: '0 2px 6px rgba(31, 31, 31, 0.12)',
        },
      },
    }),
  },
};

export default memo(ButtonComponent);

