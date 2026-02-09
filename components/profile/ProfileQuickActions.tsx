import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileQuickActionKey = 'messages' | 'subscriptions' | 'settings';

export interface ProfileQuickActionsProps {
  onPress: (key: ProfileQuickActionKey) => void;
  unreadMessagesCount?: number;
}

export function ProfileQuickActions({ onPress, unreadMessagesCount = 0 }: ProfileQuickActionsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.md,
          backgroundColor: colors.background,
        },
        title: {
          fontSize: 13,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textMuted,
          marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        row: {
          flexDirection: 'row',
          gap: DESIGN_TOKENS.spacing.sm,
        },
        card: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.md,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
          minHeight: 88,
          ...Platform.select({
            web: {
              cursor: 'pointer',
            } as any,
            default: {},
          }),
        },
        cardPressed: {
          opacity: 0.9,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: DESIGN_TOKENS.spacing.xs,
        },
        iconWrap: {
          position: 'relative',
          width: 32,
          height: 32,
          borderRadius: DESIGN_TOKENS.radii.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        badge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        },
        badgeText: {
          fontSize: 10,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnDark,
        },
        chevron: {
          marginTop: 2,
        },
        label: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.text,
          marginBottom: 2,
        },
        hint: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.textMuted,
        },
      }),
    [colors]
  );

  const items: Array<{
    key: ProfileQuickActionKey;
    title: string;
    hint: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    accessibilityHint: string;
  }> = [
    {
      key: 'messages',
      title: 'Чаты',
      hint: 'Сообщения и диалоги',
      icon: 'message-circle',
      accessibilityHint: 'Перейти к сообщениям и диалогам',
    },
    {
      key: 'subscriptions',
      title: 'Подписки',
      hint: 'Авторы и обновления',
      icon: 'users',
      accessibilityHint: 'Перейти к подпискам и авторам',
    },
    {
      key: 'settings',
      title: 'Настройки',
      hint: 'Редактировать данные',
      icon: 'settings',
      accessibilityHint: 'Перейти к настройкам профиля',
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Быстрые действия</Text>
      <View style={styles.row}>
        {items.map((item) => {
          const showBadge = item.key === 'messages' && unreadMessagesCount > 0;

          return (
            <Pressable
              key={item.key}
              onPress={() => onPress(item.key)}
              accessibilityRole="button"
              accessibilityLabel={
                showBadge
                  ? `${item.title}, ${unreadMessagesCount} непрочитанных`
                  : item.title
              }
              accessibilityHint={item.accessibilityHint}
              style={({ pressed }) => [
                styles.card,
                globalFocusStyles.focusable,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Feather name={item.icon} size={18} color={colors.text} />
                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.chevron}>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </View>
              </View>
              <Text style={styles.label}>{item.title}</Text>
              <Text style={styles.hint} numberOfLines={1}>
                {item.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

