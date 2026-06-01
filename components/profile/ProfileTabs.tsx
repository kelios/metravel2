import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileTabKey = 'travels' | 'favorites' | 'history';

interface ProfileTabsProps {
  activeTab: ProfileTabKey;
  onChangeTab: (key: ProfileTabKey) => void;
  counts?: {
    travels?: number;
    favorites?: number;
    history?: number;
  };
}

const TAB_ICONS: Record<ProfileTabKey, React.ComponentProps<typeof Feather>['name']> = {
  travels: 'map',
  favorites: 'heart',
  history: 'clock',
};

export function ProfileTabs({ activeTab, onChangeTab, counts }: ProfileTabsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          backgroundColor: colors.background,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingTop: DESIGN_TOKENS.spacing.xs,
          paddingBottom: DESIGN_TOKENS.spacing.md,
        },
        tabRow: {
          flexDirection: 'row',
          padding: 4,
          gap: 4,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        tab: {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingVertical: 8,
          paddingHorizontal: 6,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: 'transparent',
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        tabTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
        },
        activeTab: {
          backgroundColor: colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 2 },
            default: {},
          }),
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
          textAlign: 'center',
          alignSelf: 'stretch',
        },
        activeTabText: {
          color: colors.text,
        },
        countBadge: {
          minWidth: 22,
          height: 18,
          paddingHorizontal: 6,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.borderLight,
          alignItems: 'center',
          justifyContent: 'center',
        },
        activeCountBadge: {
          backgroundColor: colors.primary,
        },
        countText: {
          fontSize: 11,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textMuted,
          lineHeight: 14,
        },
        activeCountText: {
          color: colors.textOnPrimary,
        },
      }),
    [colors]
  );

  const tabs: Array<{ key: ProfileTabKey; label: string; a11yLabel: string; hint: string }> = [
    { key: 'travels', label: 'Маршруты', a11yLabel: 'Мои маршруты', hint: 'Показать ваши опубликованные путешествия' },
    { key: 'favorites', label: 'Избранное', a11yLabel: 'Сохранённое', hint: 'Показать сохранённые путешествия' },
    { key: 'history', label: 'История', a11yLabel: 'Недавно смотрел', hint: 'Показать историю просмотров' },
  ];

  return (
    <View style={styles.wrapper} accessibilityRole="tablist">
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = typeof counts?.[tab.key] === 'number' ? (counts[tab.key] as number) : 0;

          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && styles.activeTab,
                globalFocusStyles.focusable,
              ]}
              onPress={() => onChangeTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.a11yLabel}: ${count}`}
              accessibilityHint={tab.hint}
            >
              <View style={styles.tabTopRow}>
                <Feather
                  name={TAB_ICONS[tab.key]}
                  size={15}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                {count > 0 ? (
                  <View style={[styles.countBadge, isActive && styles.activeCountBadge]}>
                    <Text style={[styles.countText, isActive && styles.activeCountText]}>
                      {count > 999 ? '999+' : count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
