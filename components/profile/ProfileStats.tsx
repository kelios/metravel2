import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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

export function ProfileStats({ stats, onPressStat }: ProfileStatsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          marginHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.md,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          // Orange top accent stripe
          borderTopWidth: 3,
          borderTopColor: colors.brand,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
            },
            android: { elevation: 2 },
            default: {},
          }),
        },
        statItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: DESIGN_TOKENS.spacing.md,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          ...Platform.select({
            web: {
              cursor: onPressStat ? 'pointer' : 'default',
            } as any,
            default: {},
          }),
        },
        statItemPressed: {
          backgroundColor: colors.brandSoft,
        },
        verticalDivider: {
          width: 1,
          backgroundColor: colors.borderLight,
          alignSelf: 'stretch',
          marginVertical: DESIGN_TOKENS.spacing.sm,
        },
        statValue: {
          ...DESIGN_TOKENS.typography.scale.h1,
          color: colors.brandText,
          textAlign: 'center',
        },
        statLabel: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textMuted,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          textAlign: 'center',
          marginTop: 2,
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
      label: 'Просмотры',
      value: stats.viewsCount,
      hint: 'Показать историю просмотров',
    },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, idx) => {
        const content = (
          <>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </>
        );

        return (
          <React.Fragment key={item.key}>
            {idx > 0 && <View style={styles.verticalDivider} />}
            {onPressStat ? (
              <Pressable
                style={({ pressed }) => [
                  styles.statItem,
                  globalFocusStyles.focusable,
                  pressed && styles.statItemPressed,
                ]}
                onPress={() => onPressStat(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${item.value}`}
                accessibilityHint={item.hint}
              >
                {content}
              </Pressable>
            ) : (
              <View style={styles.statItem}>{content}</View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
