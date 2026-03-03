import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { UserProfileDto } from '@/api/user';

interface ProfileCompletenessProps {
  user: { name: string; email: string; avatar?: string | null };
  profile?: UserProfileDto | null;
  travelsCount: number;
}

interface CompletenessStep {
  key: string;
  label: string;
  done: boolean;
}

export function ProfileCompleteness({ user, profile, travelsCount }: ProfileCompletenessProps) {
  const colors = useThemedColors();

  const steps = useMemo<CompletenessStep[]>(() => [
    { key: 'name', label: 'Имя', done: Boolean(user.name && user.name !== 'Пользователь') },
    { key: 'avatar', label: 'Аватар', done: Boolean(user.avatar) },
    { key: 'social', label: 'Соцсеть', done: Boolean(profile?.youtube || profile?.instagram || profile?.twitter || profile?.vk) },
    { key: 'travel', label: 'Путешествие', done: travelsCount > 0 },
  ], [user.name, user.avatar, profile, travelsCount]);

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((doneCount / total) * 100);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textMuted,
    },
    percentText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.primary,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.backgroundSecondary,
      overflow: 'hidden',
    },
    fill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: { transition: 'width 0.4s ease' } as any,
        default: {},
      }),
    },
    stepsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      marginTop: DESIGN_TOKENS.spacing.xs,
    },
    stepChip: {
      fontSize: 11,
      color: colors.textMuted,
    },
    stepChipDone: {
      color: colors.success,
      textDecorationLine: 'line-through',
    },
  }), [colors]);

  // Не показываем, если профиль полностью заполнен
  if (percent >= 100) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Заполненность профиля
          {nextStep ? ` · добавьте ${nextStep.label.toLowerCase()}` : ''}
        </Text>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` as any }]} />
      </View>
      <View style={styles.stepsRow}>
        {steps.map((s) => (
          <Text key={s.key} style={[styles.stepChip, s.done && styles.stepChipDone]}>
            {s.done ? '✓' : '○'} {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
