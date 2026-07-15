import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive';
import { translate as i18nT } from '@/i18n'


export type ProfileQuickActionKey = 'messages' | 'subscriptions' | 'settings' | 'userpoints' | 'calendar';

export interface ProfileQuickActionsProps {
  onPress: (key: ProfileQuickActionKey) => void;
  unreadMessagesCount?: number;
  /** 'scroll' — горизонтальный ряд (по умолчанию); 'grid' — адаптивная сетка. */
  layout?: 'scroll' | 'grid';
  /** Ключи, которые не показывать (например, 'subscriptions' вынесены в шапку). */
  excludeKeys?: ProfileQuickActionKey[];
}

type QuickActionItem = {
  key: ProfileQuickActionKey;
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  accessibilityHint: string;
};

const createQuickActionItems = (): QuickActionItem[] => [
  {
    key: 'messages',
    title: i18nT('profile:components.profile.ProfileQuickActions.items.messages.label'),
    icon: 'message-circle',
    accessibilityHint: i18nT('profile:components.profile.ProfileQuickActions.items.messages.hint'),
  },
  {
    key: 'subscriptions',
    title: i18nT('profile:components.profile.ProfileQuickActions.items.subscriptions.label'),
    icon: 'users',
    accessibilityHint: i18nT('profile:components.profile.ProfileQuickActions.items.subscriptions.hint'),
  },
  {
    key: 'userpoints',
    title: i18nT('profile:components.profile.ProfileQuickActions.items.userpoints.label'),
    icon: 'map-pin',
    accessibilityHint: i18nT('profile:components.profile.ProfileQuickActions.items.userpoints.hint'),
  },
  {
    key: 'calendar',
    title: i18nT('profile:components.profile.ProfileQuickActions.items.calendar.label'),
    icon: 'calendar',
    accessibilityHint: i18nT('profile:components.profile.ProfileQuickActions.items.calendar.hint'),
  },
  {
    key: 'settings',
    title: i18nT('profile:components.profile.ProfileQuickActions.items.settings.label'),
    icon: 'settings',
    accessibilityHint: i18nT('profile:components.profile.ProfileQuickActions.items.settings.hint'),
  },
];

export function ProfileQuickActions({
  onPress,
  unreadMessagesCount = 0,
  layout = 'scroll',
  excludeKeys,
}: ProfileQuickActionsProps) {
  const colors = useThemedColors();
  const { isDesktop } = useResponsive();
  const items = createQuickActionItems();

  const visibleItems = excludeKeys?.length
    ? items.filter((item) => !excludeKeys.includes(item.key))
    : items;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xs,
        },
        scrollContent: {
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
        },
        actionChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 6,
          paddingRight: DESIGN_TOKENS.spacing.sm,
          paddingVertical: 6,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          position: 'relative',
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
            android: { elevation: 1 },
            default: {},
          }),
        },
        actionChipPressed: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.primary,
        },
        iconPill: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        chipLabel: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.text,
        },
        badge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 17,
          height: 17,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 2,
          borderColor: colors.background,
        },
        badgeText: {
          fontSize: 9,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnDark,
        },
      }),
    [colors]
  );

  const renderChip = (item: QuickActionItem, extraStyle?: object) => {
    const showBadge = item.key === 'messages' && unreadMessagesCount > 0;

    return (
      <Pressable
        key={item.key}
        onPress={() => onPress(item.key)}
        accessibilityRole="menuitem"
        accessibilityLabel={
          showBadge ? i18nT('profile:components.profile.ProfileQuickActions.value1_value2_neprochitannyh_c3a0b009', { value1: item.title, value2: unreadMessagesCount }) : item.title
        }
        accessibilityHint={item.accessibilityHint}
        style={({ pressed }) => [
          styles.actionChip,
          extraStyle,
          globalFocusStyles.focusable,
          pressed && styles.actionChipPressed,
        ]}
      >
        <View style={styles.iconPill}>
          <Feather name={item.icon} size={15} color={colors.primaryDark} />
        </View>
        <Text style={styles.chipLabel}>{item.title}</Text>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  if (layout === 'grid') {
    const itemWidth = isDesktop ? '23.5%' : '48%';
    return (
      <View style={styles.grid} accessibilityRole="menu">
        {visibleItems.map((item) => renderChip(item, { width: itemWidth }))}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="menu"
      >
        {visibleItems.map((item) => renderChip(item))}
      </ScrollView>
    </View>
  );
}
