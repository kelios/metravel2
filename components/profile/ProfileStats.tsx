import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

interface ProfileStatsProps {
  stats: {
    travelsCount: number;
    favoritesCount: number;
    viewsCount: number;
  };
  onPressStat?: (key: 'travels' | 'favorites' | 'views') => void;
}

const STAT_ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  travels: 'map',
  favorites: 'heart',
  views: 'eye',
};

export function ProfileStats({ stats, onPressStat }: ProfileStatsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          marginHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xs,
        },
        statCard: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          gap: 4,
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
          ...Platform.select({
            web: {
              cursor: onPressStat ? 'pointer' : 'default',
            } as any,
            default: {},
          }),
        },
        statCardPressed: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: DESIGN_TOKENS.radii.sm,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 2,
        },
        statValue: {
          ...DESIGN_TOKENS.typography.scale.h2,
          color: colors.text,
          textAlign: 'center',
        },
        statLabel: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textMuted,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          textAlign: 'center',
        },
      }),
    [colors, onPressStat]
  );

  const items: Array<{
    key: 'travels' | 'favorites' | 'views';
    label: string;
    value: number;
    hint: string;
  }> = [
    {
      key: 'travels',
      label: 'Маршруты',
      value: stats.travelsCount,
      hint: 'Показать ваши путешествия',
    },
    {
      key: 'favorites',
      label: 'Избранное',
      value: stats.favoritesCount,
      hint: 'Показать избранные путешествия',
    },
    {
      key: 'views',
      label: 'История',
      value: stats.viewsCount,
      hint: 'Показать историю просмотров',
    },
  ];

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const content = (
          <>
            <View style={styles.iconWrap}>
              <Feather name={STAT_ICONS[item.key]} size={16} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </>
        );

        return onPressStat ? (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.statCard,
              globalFocusStyles.focusable,
              pressed && styles.statCardPressed,
            ]}
            onPress={() => onPressStat(item.key)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}`}
            accessibilityHint={item.hint}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.key} style={styles.statCard}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
