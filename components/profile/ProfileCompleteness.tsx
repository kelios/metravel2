import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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

  const steps = useMemo<CompletenessStep[]>(
    () => [
      { key: 'name', label: 'Имя', done: Boolean(user.name && user.name !== 'Пользователь') },
      { key: 'avatar', label: 'Аватар', done: Boolean(user.avatar) },
      {
        key: 'social',
        label: 'Соцсеть',
        done: Boolean(
          profile?.youtube || profile?.instagram || profile?.twitter || profile?.vk
        ),
      },
      { key: 'travel', label: 'Путешествие', done: travelsCount > 0 },
    ],
    [user.name, user.avatar, profile, travelsCount]
  );

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((doneCount / total) * 100);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.md,
          padding: DESIGN_TOKENS.spacing.sm,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
          flex: 1,
        },
        title: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
          flex: 1,
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
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        stepLabel: {
          fontSize: 11,
          color: colors.textMuted,
        },
        stepLabelDone: {
          color: colors.success,
        },
      }),
    [colors]
  );

  if (percent >= 100) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Заполненность профиля"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="trending-up" size={12} color={colors.primary} />
          <Text style={styles.title}>
            Профиль заполнен{nextStep ? ` · добавьте ${nextStep.label.toLowerCase()}` : ''}
          </Text>
        </View>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` as any }]} />
      </View>
      <View style={styles.stepsRow}>
        {steps.map((s) => (
          <View key={s.key} style={styles.stepChip}>
            <Feather
              name={s.done ? 'check-circle' : 'circle'}
              size={11}
              color={s.done ? colors.success : colors.textMuted}
            />
            <Text style={[styles.stepLabel, s.done && styles.stepLabelDone]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
