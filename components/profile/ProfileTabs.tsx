import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { globalFocusStyles } from '@/styles/globalFocus';
import { translate as i18nT } from '@/i18n'


export type ProfileTabKey =
  | 'overview'
  | 'stats'
  | 'countries'
  | 'worldmap'
  | 'travels'
  | 'publishedTravels'
  | 'draftTravels'
  | 'favorites'
  | 'history'
  | 'subscribers'
  | 'subscriptions';

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
  countries: 'flag',
  worldmap: 'globe',
  travels: 'map',
  publishedTravels: 'check-circle',
  draftTravels: 'edit-3',
  favorites: 'heart',
  history: 'clock',
  subscribers: 'users',
  subscriptions: 'user-check',
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
        desktopTabRow: {
          flexWrap: 'wrap',
          rowGap: DESIGN_TOKENS.spacing.xs,
        },
        mobileTabRow: {
          gap: DESIGN_TOKENS.spacing.xxs,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
        },
        compactMobileTabRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
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
        mobileTab: {
          minHeight: 44,
          gap: 4,
          paddingVertical: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.xs,
        },
        compactMobileTab: {
          flex: 1,
          minWidth: 0,
          paddingHorizontal: 6,
        },
        desktopTabFlex: {
          flexBasis: 160,
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 160,
        },
        activeTab: {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primary,
        },
        tabText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as '600',
          color: colors.textMuted,
          minWidth: 0,
          flexShrink: 1,
          textAlign: 'center',
          ...Platform.select({
            web: { whiteSpace: 'nowrap' } as object,
            default: {},
          }),
        },
        mobileTabText: {
          fontSize: 13,
          lineHeight: 16,
        },
        tabIcon: {
          flexShrink: 0,
        },
        activeTabText: {
          color: colors.primaryText,
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
          flexShrink: 0,
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
    { key: 'travels', label: i18nT('profile:components.profile.ProfileTabs.marshruty_6faa8208'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.moi_marshruty_13d9bcc9'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_vse_vashi_puteshestviya_d18d90e6') },
    { key: 'publishedTravels', label: i18nT('profile:components.profile.ProfileTabs.opubl_8960af68'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.opublikovannye_marshruty_04ba1d94'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_opublikovannye_puteshestviya_8b7eda79') },
    { key: 'draftTravels', label: i18nT('profile:components.profile.ProfileTabs.chernoviki_5cd596df'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.chernoviki_marshrutov_7818add1'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_sohranennye_chernoviki_puteshestviy_b5b0208a') },
    { key: 'subscribers', label: i18nT('profile:components.profile.ProfileTabs.podpischiki_c3060a7c'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.podpischiki_c3060a7c'), hint: i18nT('profile:components.profile.ProfileTabs.otkryt_spisok_podpischikov_ecd34c45') },
    { key: 'subscriptions', label: i18nT('profile:components.profile.ProfileTabs.podpiski_35c76252'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.podpiski_35c76252'), hint: i18nT('profile:components.profile.ProfileTabs.otkryt_spisok_podpisok_30153619') },
    {
      key: 'overview',
      label: i18nT('profile:components.profile.ProfileTabs.uroven_c4e1223e'),
      a11yLabel: i18nT('profile:components.profile.ProfileTabs.uroven_znachki_i_dostizheniya_cab1dee4'),
      hint: i18nT('profile:components.profile.ProfileTabs.pokazat_vash_uroven_znachki_i_dostizheniya_99816bce'),
    },
    { key: 'stats', label: i18nT('profile:components.profile.ProfileTabs.statistika_4d6e2616'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.statistika_profilya_760237b0'), hint: i18nT('profile:components.profile.ProfileTabs.vovlechennost_marshrutov_i_lichnye_statusy_34ed19ae') },
    { key: 'countries', label: i18nT('profile:components.profile.ProfileTabs.strany_20c33f2d'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.strany_profilya_5649ce1c'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_strany_gde_vy_uzhe_byli_i_ostavshies_b420fd51') },
    { key: 'worldmap', label: i18nT('profile:components.profile.ProfileTabs.karta_f1f34fd3'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.karta_mira_60a7fda8'), hint: i18nT('profile:components.profile.ProfileTabs.karta_poseschennyh_stran_serym_ne_posescheno_443680c5') },
    { key: 'favorites', label: i18nT('profile:components.profile.ProfileTabs.hochu_poehat_6d285e47'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.hochu_poehat_6d285e47'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_marshruty_kuda_vy_hotite_poehat_874bb3dd') },
    { key: 'history', label: i18nT('profile:components.profile.ProfileTabs.istoriya_6b1e228d'), a11yLabel: i18nT('profile:components.profile.ProfileTabs.nedavno_smotrel_8ae72b41'), hint: i18nT('profile:components.profile.ProfileTabs.pokazat_istoriyu_prosmotrov_c5066c06') },
  ];

  const tabs = tabKeys
    ? tabKeys
        .map((key) => allTabs.find((tab) => tab.key === key))
        .filter((tab): tab is (typeof allTabs)[number] => tab != null)
    : allTabs;
  const useCompactMobileRow = isMobile && tabs.length <= 3;

  const renderTab = (tab: (typeof allTabs)[number]) => {
    const isActive = activeTab === tab.key;
    const count = typeof counts?.[tab.key] === 'number' ? (counts[tab.key] as number) : 0;

    return (
      <Pressable
        key={tab.key}
        style={[
          styles.tab,
          isMobile && styles.mobileTab,
          useCompactMobileRow && styles.compactMobileTab,
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
          style={styles.tabIcon}
        />
        <Text
          style={[styles.tabText, isMobile && styles.mobileTabText, isActive && styles.activeTabText]}
          numberOfLines={1}
        >
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
        useCompactMobileRow ? (
          <View style={styles.compactMobileTabRow}>{tabs.map(renderTab)}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabRow, styles.mobileTabRow]}
          >
            {tabs.map(renderTab)}
          </ScrollView>
        )
      ) : (
        <View style={[styles.tabRow, styles.desktopTabRow]}>{tabs.map(renderTab)}</View>
      )}
    </View>
  );
}
