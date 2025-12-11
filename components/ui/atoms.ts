// Atomic Design - Atoms
// These are the most basic building blocks of the UI

import React, { forwardRef } from 'react';
import { View, Text as RNText, Pressable, StyleSheet, Platform } from 'react-native';
import { designTokens } from '../../constants/designTokens';

// ===== ATOMS =====

// Box - Basic layout primitive
interface BoxProps {
  children?: React.ReactNode;
  style?: any;
  padding?: keyof typeof designTokens.spacing;
  margin?: keyof typeof designTokens.spacing;
  backgroundColor?: string;
  borderRadius?: keyof typeof designTokens.radius;
  flex?: number;
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  gap?: keyof typeof designTokens.spacing;
  as?: keyof JSX.IntrinsicElements;
}

export const Box = forwardRef<View, BoxProps>(({
  children,
  style,
  padding,
  margin,
  backgroundColor,
  borderRadius,
  flex,
  flexDirection,
  justifyContent,
  alignItems,
  gap,
  ...props
}, ref) => {
  const componentStyle = [
    padding && { padding: designTokens.spacing[padding] },
    margin && { margin: designTokens.spacing[margin] },
    backgroundColor && { backgroundColor },
    borderRadius && { borderRadius: designTokens.radius[borderRadius] },
    flex && { flex },
    flexDirection && { flexDirection },
    justifyContent && { justifyContent },
    alignItems && { alignItems },
    gap && { gap: designTokens.spacing[gap] },
    style,
  ].filter(Boolean);

  return (
    <View ref={ref} style={componentStyle} {...props}>
      {children}
    </View>
  );
});

// Text - Typography primitive
interface TextProps {
  children: React.ReactNode;
  variant?: 'heading1' | 'heading2' | 'heading3' | 'body' | 'caption' | 'label';
  color?: string;
  weight?: keyof typeof designTokens.typography.fontWeight;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: any;
}

export const Text = forwardRef<RNText, TextProps>(({
  children,
  variant = 'body',
  color,
  weight,
  align,
  numberOfLines,
  style,
  ...props
}, ref) => {
  const variantStyles = {
    heading1: {
      fontSize: designTokens.typography.fontSize['4xl'],
      fontWeight: designTokens.typography.fontWeight.bold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    heading2: {
      fontSize: designTokens.typography.fontSize['3xl'],
      fontWeight: designTokens.typography.fontWeight.bold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    heading3: {
      fontSize: designTokens.typography.fontSize['2xl'],
      fontWeight: designTokens.typography.fontWeight.semibold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    body: {
      fontSize: designTokens.typography.fontSize.base,
      fontWeight: designTokens.typography.fontWeight.normal,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    caption: {
      fontSize: designTokens.typography.fontSize.sm,
      fontWeight: designTokens.typography.fontWeight.normal,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    label: {
      fontSize: designTokens.typography.fontSize.sm,
      fontWeight: designTokens.typography.fontWeight.medium,
      lineHeight: designTokens.typography.lineHeight.normal,
      letterSpacing: designTokens.typography.letterSpacing.wide,
    },
  };

  const componentStyle = [
    variantStyles[variant],
    color && { color },
    weight && { fontWeight: designTokens.typography.fontWeight[weight] },
    align && { textAlign: align },
    style,
  ].filter(Boolean);

  return (
    <RNText
      ref={ref}
      style={componentStyle}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </RNText>
  );
});

// Button - Interactive primitive
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  style?: any;
  accessibilityLabel?: string;
}

export const Button = forwardRef<Pressable, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  onPress,
  style,
  accessibilityLabel,
  ...props
}, ref) => {
  const variantStyles = {
    primary: {
      backgroundColor: designTokens.colors.primary[500],
      borderColor: designTokens.colors.primary[500],
      borderWidth: 1,
    },
    secondary: {
      backgroundColor: designTokens.colors.neutral[100],
      borderColor: designTokens.colors.neutral[200],
      borderWidth: 1,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: designTokens.colors.neutral[300],
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  };

  const sizeStyles = {
    sm: {
      paddingHorizontal: designTokens.spacing[3],
      paddingVertical: designTokens.spacing[1],
      minHeight: 32,
    },
    md: {
      paddingHorizontal: designTokens.spacing[4],
      paddingVertical: designTokens.spacing[2],
      minHeight: 40,
    },
    lg: {
      paddingHorizontal: designTokens.spacing[6],
      paddingVertical: designTokens.spacing[3],
      minHeight: 48,
    },
  };

  const componentStyle = [
    {
      borderRadius: designTokens.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    },
    variantStyles[variant],
    sizeStyles[size],
    style,
  ].filter(Boolean);

  return (
    <Pressable
      ref={ref}
      style={componentStyle}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      {loading ? (
        <Text variant="caption" color={designTokens.colors.neutral[400]}>
          Загрузка...
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
});

// Spacer - Layout primitive
interface SpacerProps {
  size?: keyof typeof designTokens.spacing;
  flex?: number;
}

export const Spacer = ({ size = 4, flex }: SpacerProps) => (
  <View style={{ flex }} />
);

// Divider - Visual separator
interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  style?: any;
}

export const Divider = ({
  orientation = 'horizontal',
  thickness = 1,
  color = designTokens.colors.neutral[200],
  style,
}: DividerProps) => (
  <View
    style={[
      {
        backgroundColor: color,
        [orientation === 'horizontal' ? 'height' : 'width']: thickness,
        [orientation === 'horizontal' ? 'width' : 'height']: '100%',
      },
      style,
    ]}
  />
);

// Icon - Visual primitive
interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon = ({ name, size = 16, color, style }: IconProps) => {
  // This would use your icon library (Feather, etc.)
  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* Icon implementation would go here */}
      <Text style={{ color, fontSize: size }}>[{name}]</Text>
    </View>
  );
};
