import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export interface ProfileStatPill {
  key: string;
  label: string;
  /** Если число задано — показывается крупно; иначе пилюля работает как навигация (иконка). */
  value?: number;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityHint?: string;
}

interface ProfileStatPillsProps {
  pills: ProfileStatPill[];
}

const formatValue = (value: number) => (value > 999 ? '999+' : String(value));

export function ProfileStatPills({ pills }: ProfileStatPillsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        pill: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingVertical: 10,
          paddingHorizontal: 3,
          borderRadius: DESIGN_TOKENS.radii.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        value: {
          fontSize: 18,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.text,
          lineHeight: 22,
        },
        label: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.row}>
      {pills.map((pill) => (
        <Pressable
          key={pill.key}
          onPress={pill.onPress}
          accessibilityRole="button"
          accessibilityLabel={pill.value != null ? `${pill.label}: ${pill.value}` : pill.label}
          accessibilityHint={pill.accessibilityHint}
          style={({ pressed }) => [
            styles.pill,
            globalFocusStyles.focusable,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {pill.value != null ? (
            <Text style={styles.value}>{formatValue(pill.value)}</Text>
          ) : (
            <Feather name={pill.icon} size={18} color={colors.primaryDark} />
          )}
          <Text style={styles.label} numberOfLines={1}>
            {pill.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
