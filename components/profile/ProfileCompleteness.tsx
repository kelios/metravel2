import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { UserProfileDto } from '@/api/user';
import { translate as i18nT } from '@/i18n'


interface ProfileCompletenessProps {
  user: { name: string; email: string; avatar?: string | null; hasDisplayName: boolean };
  profile?: UserProfileDto | null;
  travelsCount: number;
}

interface CompletenessStep {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  done: boolean;
}

export function ProfileCompleteness({ user, profile, travelsCount }: ProfileCompletenessProps) {
  const colors = useThemedColors();

  const steps = useMemo<CompletenessStep[]>(
    () => [
      {
        key: 'name',
        label: i18nT('profile:components.profile.ProfileCompleteness.imya_2d455d22'),
        icon: 'user',
        done: user.hasDisplayName,
      },
      {
        key: 'avatar',
        label: i18nT('profile:components.profile.ProfileCompleteness.foto_2373d29c'),
        icon: 'camera',
        done: Boolean(user.avatar),
      },
      {
        key: 'social',
        label: i18nT('profile:components.profile.ProfileCompleteness.sotsset_2627f63a'),
        icon: 'link',
        done: Boolean(
          profile?.youtube || profile?.instagram || profile?.twitter || profile?.vk
        ),
      },
      {
        key: 'travel',
        label: i18nT('profile:components.profile.ProfileCompleteness.marshrut_e01f2892'),
        icon: 'map',
        done: travelsCount > 0,
      },
    ],
    [user.hasDisplayName, user.avatar, profile, travelsCount]
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
          padding: DESIGN_TOKENS.spacing.md,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 1 },
            default: {},
          }),
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          flex: 1,
        },
        iconDot: {
          width: 28,
          height: 28,
          borderRadius: DESIGN_TOKENS.radii.sm,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.text,
          flex: 1,
        },
        percentBadge: {
          backgroundColor: colors.primary,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          paddingVertical: 3,
          borderRadius: DESIGN_TOKENS.radii.pill,
          minWidth: 42,
          alignItems: 'center',
        },
        percentText: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnPrimary,
        },
        trackWrap: {
          marginBottom: DESIGN_TOKENS.spacing.sm,
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
        },
        stepChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          paddingVertical: 5,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        stepChipDone: {
          backgroundColor: colors.successSoft,
          borderColor: colors.success,
        },
        stepLabel: {
          fontSize: 11,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
        stepLabelDone: {
          color: colors.successDark,
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
      accessibilityLabel={i18nT('profile:components.profile.ProfileCompleteness.zapolnennost_profilya_84142b90')}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconDot}>
            <Feather name="trending-up" size={14} color={colors.primaryDark} />
          </View>
          <Text style={styles.title}>
            {nextStep ? i18nT('profile:components.profile.ProfileCompleteness.dobavte_value1_867fcfcd', { value1: nextStep.label.toLowerCase() }) : i18nT('profile:components.profile.ProfileCompleteness.zapolnite_profil_1437b8dd')}
          </Text>
        </View>
        <View style={styles.percentBadge}>
          <Text style={styles.percentText}>{percent}%</Text>
        </View>
      </View>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` as any }]} />
        </View>
      </View>
      <View style={styles.stepsRow}>
        {steps.map((s) => (
          <View key={s.key} style={[styles.stepChip, s.done && styles.stepChipDone]}>
            <Feather
              name={s.done ? 'check' : s.icon}
              size={11}
              color={s.done ? colors.successDark : colors.textMuted}
            />
            <Text style={[styles.stepLabel, s.done && styles.stepLabelDone]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
