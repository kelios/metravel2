import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ChipProps {
  label: string;
  selected?: boolean;
  count?: number;
  icon?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

const palette = DESIGN_TOKENS.colors;
const radii = DESIGN_TOKENS.radii;
const spacing = DESIGN_TOKENS.spacing;

function Chip({ label, selected = false, count, icon, onPress, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && !selected && styles.pressed,
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

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: spacing.xs,
    minHeight: 36,
  },
  selected: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  labelSelected: {
    color: palette.primary,
  },
  count: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  countSelected: {
    color: palette.primary,
  },
  icon: {
    marginRight: spacing.xs / 2,
  },
});

export default memo(Chip);

