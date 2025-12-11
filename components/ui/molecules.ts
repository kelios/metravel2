// Atomic Design - Molecules
// These combine atoms into more complex UI patterns

import React, { forwardRef } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Box, Text, Icon, Spacer } from './atoms';
import { designTokens } from '../../constants/designTokens';

// ===== MOLECULES =====

// Badge - Status indicator
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  style?: any;
}

export const Badge = forwardRef<View, BadgeProps>(({
  children,
  variant = 'primary',
  size = 'md',
  style,
  ...props
}, ref) => {
  const variantStyles = {
    primary: {
      backgroundColor: designTokens.colors.primary[100],
      color: designTokens.colors.primary[700],
    },
    secondary: {
      backgroundColor: designTokens.colors.neutral[100],
      color: designTokens.colors.neutral[700],
    },
    success: {
      backgroundColor: designTokens.colors.semantic.success + '20',
      color: designTokens.colors.semantic.success,
    },
    warning: {
      backgroundColor: designTokens.colors.semantic.warning + '20',
      color: designTokens.colors.semantic.warning,
    },
    error: {
      backgroundColor: designTokens.colors.semantic.error + '20',
      color: designTokens.colors.semantic.error,
    },
  };

  const sizeStyles = {
    sm: {
      paddingHorizontal: designTokens.spacing[2],
      paddingVertical: designTokens.spacing[1],
      borderRadius: designTokens.radius.sm,
    },
    md: {
      paddingHorizontal: designTokens.spacing[3],
      paddingVertical: designTokens.spacing[1],
      borderRadius: designTokens.radius.base,
    },
  };

  return (
    <Box
      ref={ref}
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: designTokens.radius.base,
        },
        variantStyles[variant],
        sizeStyles[size],
        style,
      ]}
      {...props}
    >
      <Text
        variant="label"
        style={{
          color: variantStyles[variant].color,
          fontSize: size === 'sm' ? designTokens.typography.fontSize.xs : designTokens.typography.fontSize.sm,
        }}
      >
        {children}
      </Text>
    </Box>
  );
});

// Card - Content container with elevation
interface CardProps {
  children: React.ReactNode;
  padding?: keyof typeof designTokens.spacing;
  shadow?: keyof typeof designTokens.shadows;
  borderRadius?: keyof typeof designTokens.radius;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: any;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const Card = forwardRef<View, CardProps>(({
  children,
  padding = 4,
  shadow = 'base',
  borderRadius = 'lg',
  backgroundColor = designTokens.colors.neutral[50],
  borderColor,
  borderWidth,
  style,
  onPress,
  accessibilityLabel,
  ...props
}, ref) => {
  const cardStyle = [
    {
      backgroundColor,
      borderRadius: designTokens.radius[borderRadius],
      shadowColor: designTokens.colors.neutral[900],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderColor,
      borderWidth,
    },
    shadow && { ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
      android: { elevation: 3 },
      web: { boxShadow: designTokens.shadows[shadow] },
    })},
    style,
  ].filter(Boolean);

  const Component = onPress ? Pressable : View;

  return (
    <Component
      ref={ref}
      style={cardStyle}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      <Box padding={padding}>
        {children}
      </Box>
    </Component>
  );
});

// Avatar - User/profile image
interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  style?: any;
}

export const Avatar = forwardRef<View, AvatarProps>(({
  src,
  alt,
  size = 'md',
  fallback,
  style,
  ...props
}, ref) => {
  const sizeStyles = {
    xs: { width: 24, height: 24 },
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 56, height: 56 },
    xl: { width: 72, height: 72 },
  };

  return (
    <Box
      ref={ref}
      style={[
        {
          borderRadius: designTokens.radius.full,
          backgroundColor: designTokens.colors.neutral[200],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        sizeStyles[size],
        style,
      ]}
      {...props}
    >
      {src ? (
        <View style={sizeStyles[size]}>
          {/* Image component would go here */}
          <Text variant="caption">{alt?.[0]?.toUpperCase()}</Text>
        </View>
      ) : (
        <Text variant="caption" style={{ color: designTokens.colors.neutral[500] }}>
          {fallback?.[0]?.toUpperCase() || '?'}
        </Text>
      )}
    </Box>
  );
});

// Tag - Category/label indicator
interface TagProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'sm' | 'md';
  icon?: string;
  removable?: boolean;
  onRemove?: () => void;
  style?: any;
}

export const Tag = forwardRef<View, TagProps>(({
  children,
  variant = 'default',
  size = 'md',
  icon,
  removable,
  onRemove,
  style,
  ...props
}, ref) => {
  const variantStyles = {
    default: {
      backgroundColor: designTokens.colors.neutral[100],
      color: designTokens.colors.neutral[700],
    },
    primary: {
      backgroundColor: designTokens.colors.primary[100],
      color: designTokens.colors.primary[700],
    },
    secondary: {
      backgroundColor: designTokens.colors.neutral[200],
      color: designTokens.colors.neutral[800],
    },
  };

  const sizeStyles = {
    sm: {
      paddingHorizontal: designTokens.spacing[2],
      paddingVertical: designTokens.spacing[1],
      gap: designTokens.spacing[1],
    },
    md: {
      paddingHorizontal: designTokens.spacing[3],
      paddingVertical: designTokens.spacing[1],
      gap: designTokens.spacing[2],
    },
  };

  return (
    <Box
      ref={ref}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: designTokens.radius.full,
          alignSelf: 'flex-start',
        },
        variantStyles[variant],
        sizeStyles[size],
        style,
      ]}
      {...props}
    >
      {icon && <Icon name={icon} size={14} color={variantStyles[variant].color} />}
      <Text
        variant="label"
        style={{
          color: variantStyles[variant].color,
          fontSize: size === 'sm' ? designTokens.typography.fontSize.xs : designTokens.typography.fontSize.sm,
        }}
      >
        {children}
      </Text>
      {removable && (
        <Pressable onPress={onRemove} style={{ marginLeft: designTokens.spacing[1] }}>
          <Icon name="x" size={12} color={variantStyles[variant].color} />
        </Pressable>
      )}
    </Box>
  );
});

// Skeleton - Loading placeholder
interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  style?: any;
}

export const Skeleton = forwardRef<View, SkeletonProps>(({
  variant = 'text',
  width,
  height,
  style,
  ...props
}, ref) => {
  const variantStyles = {
    text: {
      height: 16,
      borderRadius: designTokens.radius.sm,
    },
    rectangular: {
      borderRadius: designTokens.radius.base,
    },
    circular: {
      borderRadius: designTokens.radius.full,
    },
  };

  return (
    <Box
      ref={ref}
      style={[
        {
          backgroundColor: designTokens.colors.neutral[200],
          width: width || '100%',
          height: height || variantStyles[variant].height,
          borderRadius: variantStyles[variant].borderRadius,
        },
        style,
      ]}
      {...props}
    />
  );
});

// Tooltip - Information overlay
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  style?: any;
}

export const Tooltip = ({
  children,
  content,
  placement = 'top',
  style,
}: TooltipProps) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <Box style={style}>
      <Pressable
        onPressIn={() => setVisible(true)}
        onPressOut={() => setVisible(false)}
      >
        {children}
      </Pressable>

      {visible && (
        <Box
          style={{
            position: 'absolute',
            [placement]: '100%',
            left: '50%',
            transform: [{ translateX: -50 }],
            backgroundColor: designTokens.colors.neutral[900],
            padding: designTokens.spacing[2],
            borderRadius: designTokens.radius.base,
            zIndex: designTokens.zIndex.tooltip,
            maxWidth: 200,
          }}
        >
          <Text variant="caption" style={{ color: 'white' }}>
            {content}
          </Text>
        </Box>
      )}
    </Box>
  );
};
