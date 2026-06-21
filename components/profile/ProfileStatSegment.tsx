import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export interface ProfileStatSegmentItem {
  key: string;
  label: string;
  value: number;
  onPress: () => void;
  accessibilityHint?: string;
}

interface ProfileStatSegmentProps {
  items: ProfileStatSegmentItem[];
}

const formatValue = (value: number) => (value > 999 ? '999+' : String(value));

export function ProfileStatSegment({ items }: ProfileStatSegmentProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'stretch',
          marginHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.sm,
          borderRadius: DESIGN_TOKENS.radii.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        cell: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          paddingVertical: 9,
          paddingHorizontal: 2,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        cellPressed: {
          backgroundColor: colors.backgroundSecondary,
        },
        divider: {
          width: 1,
          marginVertical: 8,
          backgroundColor: colors.borderLight,
        },
        value: {
          fontSize: 17,
          lineHeight: 21,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.text,
        },
        label: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <Pressable
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}`}
            accessibilityHint={item.accessibilityHint}
            style={({ pressed }) => [
              styles.cell,
              globalFocusStyles.focusable,
              pressed && styles.cellPressed,
            ]}
          >
            <Text style={styles.value} numberOfLines={1}>
              {formatValue(item.value)}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}
