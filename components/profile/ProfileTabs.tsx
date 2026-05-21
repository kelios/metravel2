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
          paddingTop: DESIGN_TOKENS.spacing.sm,
          paddingBottom: DESIGN_TOKENS.spacing.xs,
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
          gap: DESIGN_TOKENS.spacing.xs,
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: DESIGN_TOKENS.spacing.xs,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          borderRadius: DESIGN_TOKENS.radii.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        activeTab: {
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
        },
        countText: {
          ...DESIGN_TOKENS.typography.scale.h2,
          color: colors.text,
          textAlign: 'center',
        },
        activeCountText: {
          color: colors.primary,
        },
        labelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
          textAlign: 'center',
        },
        activeTabText: {
          color: colors.primary,
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
          const count = typeof counts?.[tab.key] === 'number' ? counts[tab.key] : 0;

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
              accessibilityLabel={`${tab.label}: ${count}`}
              accessibilityHint={tab.hint}
            >
              <Text style={[styles.countText, isActive && styles.activeCountText]}>{count}</Text>
              <View style={styles.labelRow}>
                <Feather
                  name={TAB_ICONS[tab.key]}
                  size={15}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
