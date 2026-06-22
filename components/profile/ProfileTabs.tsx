import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileTabKey = 'overview' | 'stats' | 'travels' | 'favorites' | 'history';

interface ProfileTabsProps {
  activeTab: ProfileTabKey;
  onChangeTab: (key: ProfileTabKey) => void;
  counts?: Partial<Record<ProfileTabKey, number>>;
  /** Какие табы показывать и в каком порядке. По умолчанию — все четыре. */
  tabKeys?: ProfileTabKey[];
}

const TAB_ICONS: Record<ProfileTabKey, React.ComponentProps<typeof Feather>['name']> = {
  overview: 'grid',
  stats: 'bar-chart-2',
  travels: 'map',
  favorites: 'heart',
  history: 'clock',
};

export function ProfileTabs({ activeTab, onChangeTab, counts, tabKeys }: ProfileTabsProps) {
  const colors = useThemedColors();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          backgroundColor: colors.background,
          paddingTop: DESIGN_TOKENS.spacing.xs,
          paddingBottom: DESIGN_TOKENS.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        tabRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: DESIGN_TOKENS.radii.pill,
          borderWidth: 1,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          ...Platform.select({
            web: { cursor: 'pointer' } as object,
            default: {},
          }),
        },
        desktopTabFlex: {
          flex: 1,
        },
        activeTab: {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primary,
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as '600',
          color: colors.textMuted,
        },
        activeTabText: {
          color: colors.primary,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as '700',
        },
        countBadge: {
          minWidth: 18,
          paddingHorizontal: 5,
          paddingVertical: 1,
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
          fontWeight: DESIGN_TOKENS.typography.weights.bold as '700',
          color: colors.textMuted,
          lineHeight: 14,
        },
        activeCountText: {
          color: colors.textOnPrimary,
        },
      }),
    [colors]
  );

  const allTabs: Array<{ key: ProfileTabKey; label: string; a11yLabel: string; hint: string }> = [
    { key: 'travels', label: 'Маршруты', a11yLabel: 'Мои маршруты', hint: 'Показать ваши опубликованные путешествия' },
    { key: 'overview', label: 'Обзор', a11yLabel: 'Обзор профиля', hint: 'Сводка: достижения и быстрые действия' },
    { key: 'stats', label: 'Статистика', a11yLabel: 'Статистика профиля', hint: 'Вовлечённость маршрутов и личные статусы' },
    { key: 'favorites', label: 'Избранное', a11yLabel: 'Сохранённое', hint: 'Показать сохранённые путешествия' },
    { key: 'history', label: 'История', a11yLabel: 'Недавно смотрел', hint: 'Показать историю просмотров' },
  ];

  const tabs = tabKeys
    ? tabKeys
        .map((key) => allTabs.find((tab) => tab.key === key))
        .filter((tab): tab is (typeof allTabs)[number] => tab != null)
    : allTabs;

  const renderTab = (tab: (typeof allTabs)[number]) => {
    const isActive = activeTab === tab.key;
    const count = typeof counts?.[tab.key] === 'number' ? (counts[tab.key] as number) : 0;

    return (
      <Pressable
        key={tab.key}
        style={[
          styles.tab,
          !isMobile && styles.desktopTabFlex,
          isActive && styles.activeTab,
          globalFocusStyles.focusable,
        ]}
        onPress={() => onChangeTab(tab.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={count > 0 ? `${tab.a11yLabel}: ${count}` : tab.a11yLabel}
        accessibilityHint={tab.hint}
      >
        <Feather
          name={TAB_ICONS[tab.key]}
          size={15}
          color={isActive ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
          {tab.label}
        </Text>
        {count > 0 ? (
          <View style={[styles.countBadge, isActive && styles.activeCountBadge]}>
            <Text style={[styles.countText, isActive && styles.activeCountText]}>
              {count > 999 ? '999+' : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrapper} accessibilityRole="tablist">
      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map(renderTab)}
        </ScrollView>
      ) : (
        <View style={styles.tabRow}>{tabs.map(renderTab)}</View>
      )}
    </View>
  );
}
