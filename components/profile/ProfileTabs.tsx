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
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
          ...Platform.select({
            web: {
              position: 'sticky',
              top: 0,
              zIndex: DESIGN_TOKENS.zIndex.sticky,
            } as any,
            default: {},
          }),
        },
        tabRow: {
          flexDirection: 'row',
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
        tab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
          marginBottom: -1,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        activeTab: {
          borderBottomColor: colors.primary,
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
        activeTabText: {
          color: colors.primary,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        badge: {
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.backgroundSecondary,
          minWidth: 20,
          alignItems: 'center',
        },
        activeBadge: {
          backgroundColor: colors.primarySoft,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
        },
        activeBadgeText: {
          color: colors.primary,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        },
      }),
    [colors]
  );

  const tabs: Array<{ key: ProfileTabKey; label: string; hint: string }> = [
    { key: 'travels', label: 'Мои', hint: 'Показать ваши путешествия' },
    { key: 'favorites', label: 'Избранное', hint: 'Показать избранные путешествия' },
    { key: 'history', label: 'История', hint: 'Показать историю просмотров' },
  ];

  return (
    <View style={styles.wrapper} accessibilityRole="tablist">
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts?.[tab.key];
          const showBadge = typeof count === 'number' && count >= 0;

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
              accessibilityLabel={`${tab.label}${showBadge ? `: ${count}` : ''}`}
              accessibilityHint={tab.hint}
            >
              <Feather
                name={TAB_ICONS[tab.key]}
                size={15}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>
              {showBadge && (
                <View style={[styles.badge, isActive && styles.activeBadge]}>
                  <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
