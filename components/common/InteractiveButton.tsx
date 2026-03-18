/**
 * Interactive Button with micro-interactions
 * Provides haptic feedback, animations, and loading states
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native'
import { triggerHaptic } from '@/utils/travelDetailsUIUX'
import { useThemedColors } from '@/hooks/useTheme'

export interface InteractiveButtonProps {
  /** Button text */
  children: React.ReactNode
  /** Press handler */
  onPress?: () => void | Promise<void>
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Button size */
  size?: 'small' | 'medium' | 'large'
  /** Loading state */
  loading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Full width */
  fullWidth?: boolean
  /** Icon before text */
  iconBefore?: React.ReactNode
  /** Icon after text */
  iconAfter?: React.ReactNode
  /** Custom styles */
  style?: ViewStyle
  /** Custom text styles */
  textStyle?: TextStyle
  /** Haptic feedback type */
  haptics?: 'light' | 'medium' | 'heavy' | 'success' | 'none'
  /** Test ID */
  testID?: string
  /** Accessibility label */
  accessibilityLabel?: string
}

export const InteractiveButton: React.FC<InteractiveButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconBefore,
  iconAfter,
  style,
  textStyle,
  haptics = 'light',
  testID,
  accessibilityLabel,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [isPressed, setIsPressed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePress = useCallback(async () => {
    if (disabled || loading || isProcessing || !onPress) return

    // Haptic feedback
    if (haptics !== 'none') {
      await triggerHaptic(haptics)
    }

    // Handle async operations
    const result = onPress()
    if (result instanceof Promise) {
      setIsProcessing(true)
      try {
        await result
      } finally {
        setIsProcessing(false)
      }
    }
  }, [disabled, loading, isProcessing, onPress, haptics])

  // Build styles
  const buttonStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    isPressed && styles.pressed,
    style,
  ]

  const textStyles = [
    styles.text,
    styles[`text_${size}`],
    styles[`textVariant_${variant}`],
    disabled && styles.textDisabled,
    textStyle,
  ]

  const isLoading = loading || isProcessing
  const isDisabled = disabled || isLoading

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={isDisabled}
      style={buttonStyles}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityState={{
        disabled: isDisabled,
        busy: isLoading,
      }}
    >
      <View style={styles.content}>
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.textOnPrimary : colors.text}
            style={styles.loader}
          />
        )}

        {!isLoading && iconBefore && <View style={styles.iconBefore}>{iconBefore}</View>}

        {typeof children === 'string' ? (
          <Text style={textStyles}>{children}</Text>
        ) : (
          children
        )}

        {!isLoading && iconAfter && <View style={styles.iconAfter}>{iconAfter}</View>}
      </View>
    </Pressable>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          userSelect: 'none',
        }
      : {}),
  } as ViewStyle,

  // Sizes
  size_small: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  size_medium: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  size_large: {
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  // Variants (colors added dynamically)
  variant_primary: {
    backgroundColor: colors.brand,
  },
  variant_secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.danger,
  },

  // States
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web'
      ? {
          cursor: 'not-allowed',
        }
      : {}),
  } as ViewStyle,
  fullWidth: {
    width: '100%',
  },

  // Content
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loader: {
    marginRight: 8,
  },
  iconBefore: {
    marginRight: 4,
  },
  iconAfter: {
    marginLeft: 4,
  },

  // Text
  text: {
    fontWeight: '600',
  },
  text_small: {
    fontSize: 14,
    lineHeight: 20,
  },
  text_medium: {
    fontSize: 16,
    lineHeight: 22,
  },
  text_large: {
    fontSize: 18,
    lineHeight: 24,
  },

  // Text variants
  textVariant_primary: {
    color: colors.textOnDark,
  },
  textVariant_secondary: {
    color: colors.text,
  },
  textVariant_ghost: {
    color: colors.text,
  },
  textVariant_danger: {
    color: colors.textOnDark,
  },
  textDisabled: {
    opacity: 0.7,
  },
})

export default InteractiveButton
