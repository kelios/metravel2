import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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

export function ProfileTabs({ activeTab, onChangeTab, counts }: ProfileTabsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.xs,
          backgroundColor: colors.background,
          ...Platform.select({
            web: {
              position: 'sticky',
              top: 88,
              zIndex: DESIGN_TOKENS.zIndex.sticky,
              paddingTop: DESIGN_TOKENS.spacing.xs,
            } as any,
            default: {},
          }),
        },
        segmentTrack: {
          flexDirection: 'row',
          backgroundColor: colors.backgroundSecondary,
          borderRadius: DESIGN_TOKENS.radii.md,
          padding: 3,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        tab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
          paddingVertical: 8,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
          borderRadius: DESIGN_TOKENS.radii.sm,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight - 8,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        activeTab: {
          backgroundColor: colors.surface,
          // Orange bottom accent inside active tab
          borderBottomWidth: 2,
          borderBottomColor: colors.brand,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            },
            android: { elevation: 2 },
            default: {},
          }),
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
        activeTabText: {
          color: colors.brandText,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        },
        badge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.borderLight,
          minWidth: 20,
          alignItems: 'center',
        },
        activeBadge: {
          backgroundColor: colors.brand,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
        },
        activeBadgeText: {
          color: colors.surface,
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
      <View style={styles.segmentTrack}>
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
