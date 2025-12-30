import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
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
    paddingHorizontal: DESIGN_TOKENS.spacing.xxs, // ✅ УЛУЧШЕНИЕ: Увеличен padding для больших чипсов
    paddingVertical: DESIGN_TOKENS.spacing.sm, // ✅ УЛУЧШЕНИЕ: Увеличен padding для высоты 40px
    borderRadius: radii.lg,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
    backgroundColor: palette.surface,
    gap: spacing.xs,
    minHeight: 40, // ✅ УЛУЧШЕНИЕ: Увеличена минимальная высота
    shadowColor: palette.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: DESIGN_TOKENS.shadows.light,
        ':hover': {
          transform: 'scale(1.05)',
        },
      },
    }),
  },
  selected: {
    backgroundColor: palette.primarySoft,
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
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
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  labelSelected: {
    color: palette.primary,
  },
  count: {
    color: palette.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
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
