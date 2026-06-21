import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileHeaderActionKey = 'messages' | 'userpoints' | 'calendar' | 'newTravel';

export interface ProfileHeaderQuickActionsProps {
  onPress: (key: ProfileHeaderActionKey) => void;
  unreadMessagesCount?: number;
}

const ITEMS: Array<{
  key: ProfileHeaderActionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  accessibilityHint: string;
}> = [
  {
    key: 'messages',
    label: 'Чаты',
    icon: 'message-circle',
    accessibilityHint: 'Перейти к сообщениям и диалогам',
  },
  {
    key: 'userpoints',
    label: 'Мои точки',
    icon: 'map-pin',
    accessibilityHint: 'Перейти к сохранённым точкам на карте',
  },
  {
    key: 'calendar',
    label: 'Календарь',
    icon: 'calendar',
    accessibilityHint: 'Перейти к календарю путешествий',
  },
  {
    key: 'newTravel',
    label: 'Маршрут',
    icon: 'plus-circle',
    accessibilityHint: 'Создать новый маршрут',
  },
];

export function ProfileHeaderQuickActions({
  onPress,
  unreadMessagesCount = 0,
}: ProfileHeaderQuickActionsProps) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        action: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingVertical: 8,
          paddingHorizontal: 2,
          borderRadius: DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          position: 'relative',
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        actionPressed: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.primary,
        },
        iconWrap: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.text,
        },
        badge: {
          position: 'absolute',
          top: 4,
          right: 8,
          minWidth: 17,
          height: 17,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 2,
          borderColor: colors.surface,
        },
        badgeText: {
          fontSize: 9,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnDark,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.row} accessibilityRole="menu">
      {ITEMS.map((item) => {
        const showBadge = item.key === 'messages' && unreadMessagesCount > 0;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item.key)}
            accessibilityRole="menuitem"
            accessibilityLabel={
              showBadge ? `${item.label}, ${unreadMessagesCount} непрочитанных` : item.label
            }
            accessibilityHint={item.accessibilityHint}
            style={({ pressed }) => [
              styles.action,
              globalFocusStyles.focusable,
              pressed && styles.actionPressed,
            ]}
          >
            <View style={styles.iconWrap}>
              <Feather name={item.icon} size={15} color={colors.primary} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
