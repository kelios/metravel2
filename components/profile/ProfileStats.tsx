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

export function ProfileStats({ stats, onPressStat }: ProfileStatsProps) {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      marginHorizontal: DESIGN_TOKENS.spacing.xxs,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minHeight: 80,
      ...Platform.select({
        web: {
          cursor: onPressStat ? 'pointer' : 'default',
        } as any,
        default: {},
      }),
    },
    statItemPressed: {
      opacity: 0.9,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    statValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    statLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
  }), [colors, onPressStat]);

  const items: Array<{
    key: 'travels' | 'favorites' | 'views';
    label: string;
    value: number;
    icon: React.ComponentProps<typeof Feather>['name'];
    hint: string;
  }> = [
    {
      key: 'travels',
      label: 'Путешествия',
      value: stats.travelsCount,
      icon: 'map-pin',
      hint: 'Показать ваши путешествия',
    },
    {
      key: 'favorites',
      label: 'Избранное',
      value: stats.favoritesCount,
      icon: 'heart',
      hint: 'Показать избранные путешествия',
    },
    {
      key: 'views',
      label: 'Просмотры',
      value: stats.viewsCount,
      icon: 'eye',
      hint: 'Показать историю просмотров',
    },
  ];

  return (
    <View style={styles.container}>
      {items.map((item) => {
        if (!onPressStat) {
          return (
            <View key={item.key} style={styles.statItem}>
              <View style={styles.iconWrap}>
                <Feather name={item.icon} size={14} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          );
        }

        return (
          <Pressable
            key={item.key}
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
            <View style={styles.iconWrap}>
              <Feather name={item.icon} size={14} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
