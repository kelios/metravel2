import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileQuickActionKey = 'messages' | 'subscriptions' | 'settings' | 'userpoints' | 'calendar';

export interface ProfileQuickActionsProps {
  onPress: (key: ProfileQuickActionKey) => void;
  unreadMessagesCount?: number;
}

const ITEMS: Array<{
  key: ProfileQuickActionKey;
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  accessibilityHint: string;
}> = [
  {
    key: 'messages',
    title: 'Чаты',
    icon: 'message-circle',
    accessibilityHint: 'Перейти к сообщениям и диалогам',
  },
  {
    key: 'subscriptions',
    title: 'Подписки',
    icon: 'users',
    accessibilityHint: 'Перейти к подпискам и авторам',
  },
  {
    key: 'userpoints',
    title: 'Мои точки',
    icon: 'map-pin',
    accessibilityHint: 'Перейти к сохранённым точкам на карте',
  },
  {
    key: 'calendar',
    title: 'Календарь',
    icon: 'calendar',
    accessibilityHint: 'Перейти к календарю путешествий',
  },
  {
    key: 'settings',
    title: 'Настройки',
    icon: 'settings',
    accessibilityHint: 'Перейти к настройкам профиля',
  },
];

export function ProfileQuickActions({ onPress, unreadMessagesCount = 0 }: ProfileQuickActionsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        scrollContent: {
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xs,
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        actionItem: {
          alignItems: 'center',
          minWidth: 64,
          paddingVertical: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.xxs,
          borderRadius: DESIGN_TOKENS.radii.md,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        actionItemPressed: {
          backgroundColor: colors.primarySoft,
        },
        iconWrap: {
          position: 'relative',
          width: 48,
          height: 48,
          borderRadius: DESIGN_TOKENS.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          marginBottom: DESIGN_TOKENS.spacing.xxs,
        },
        badge: {
          position: 'absolute',
          top: -5,
          right: -5,
          minWidth: 18,
          height: 18,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          borderWidth: 2,
          borderColor: colors.background,
        },
        badgeText: {
          fontSize: 10,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnDark,
        },
        label: {
          fontSize: 11,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
          textAlign: 'center',
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="menu"
      >
        {ITEMS.map((item) => {
          const showBadge = item.key === 'messages' && unreadMessagesCount > 0;

          return (
            <Pressable
              key={item.key}
              onPress={() => onPress(item.key)}
              accessibilityRole="menuitem"
              accessibilityLabel={
                showBadge
                  ? `${item.title}, ${unreadMessagesCount} непрочитанных`
                  : item.title
              }
              accessibilityHint={item.accessibilityHint}
              style={({ pressed }) => [
                styles.actionItem,
                globalFocusStyles.focusable,
                pressed && styles.actionItemPressed,
              ]}
            >
              <View style={styles.iconWrap}>
                <Feather name={item.icon} size={20} color={colors.primary} />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
