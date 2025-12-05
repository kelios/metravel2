import React, { memo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Platform,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export interface FloatingActionButtonProps {
  label: string;
  icon?: string;
  onPress?: (event: GestureResponderEvent) => void;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const FloatingActionButton = ({
  label,
  icon = '+',
  onPress,
  position = 'bottom-right',
  accessibilityLabel,
  testID,
  style,
}: FloatingActionButtonProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      testID={testID}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.fab,
        positionStyles[position],
        !pressed && hovered && Platform.OS === 'web' && styles.fabHovered,
        pressed && styles.fabPressed,
        style,
      ]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.pill,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    minWidth: DESIGN_TOKENS.touchTarget.minWidth,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    zIndex: DESIGN_TOKENS.zIndex.fixed,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        willChange: 'transform, box-shadow',
      },
    }),
  },
  fabHovered: {
    backgroundColor: DESIGN_TOKENS.colors.primaryDark,
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 20px rgba(31, 31, 31, 0.25)',
      },
    }),
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateY(0)',
        boxShadow: '0 4px 12px rgba(31, 31, 31, 0.2)',
      },
    }),
  },
  icon: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: 'bold',
    color: DESIGN_TOKENS.colors.surface,
    lineHeight: 24,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.surface,
    letterSpacing: 0.5,
  },
});

const positionStyles: Record<'bottom-right' | 'bottom-center' | 'bottom-left', ViewStyle> = {
  'bottom-right': {
    bottom: DESIGN_TOKENS.spacing.xl,
    right: DESIGN_TOKENS.spacing.xl,
  },
  'bottom-center': {
    bottom: DESIGN_TOKENS.spacing.xl,
    left: '50%',
    ...Platform.select({
      web: {
        // @ts-ignore
        transform: 'translateX(-50%)',
      },
    }),
  },
  'bottom-left': {
    bottom: DESIGN_TOKENS.spacing.xl,
    left: DESIGN_TOKENS.spacing.xl,
  },
};

export default memo(FloatingActionButton);
