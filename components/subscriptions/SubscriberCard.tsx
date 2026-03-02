// components/subscriptions/SubscriberCard.tsx
// D1: Extracted from subscriptions.tsx

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Image, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { UserProfileDto } from '@/api/user';
import SubscribeButton from '@/components/ui/SubscribeButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

const WEB_CARD_SHADOW_STYLE = { boxShadow: DESIGN_TOKENS.shadows.card };
const WEB_CURSOR_POINTER_STYLE = { cursor: 'pointer' as const };

interface SubscriberCardProps {
  profile: UserProfileDto;
  onMessage: (userId: number) => void;
  onOpenProfile: (userId: number) => void;
}

function SubscriberCard({ profile, onMessage, onOpenProfile }: SubscriberCardProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [avatarError, setAvatarError] = useState(false);

  const fullName = useMemo(() => {
    const first = String(profile.first_name ?? '').trim();
    const last = String(profile.last_name ?? '').trim();
    return `${first} ${last}`.trim() || 'Пользователь';
  }, [profile.first_name, profile.last_name]);

  const userId = profile.user ?? profile.id;

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Pressable
          style={styles.info}
          onPress={() => onOpenProfile(userId)}
          accessibilityRole="button"
          accessibilityLabel={`Открыть профиль ${fullName}`}
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <View style={styles.avatar}>
            {profile.avatar && !avatarError ? (
              <Image
                source={{ uri: profile.avatar }}
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Feather name="user" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
        </Pressable>

        <View style={styles.actions}>
          <SubscribeButton targetUserId={userId} size="sm" />
          <Pressable
            style={[styles.actionButton, globalFocusStyles.focusable]}
            onPress={() => onMessage(userId)}
            accessibilityRole="button"
            accessibilityLabel={`Написать ${fullName}`}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="mail" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    section: {
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? WEB_CARD_SHADOW_STYLE : Platform.OS === 'android' ? { elevation: 2 } : {}),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      gap: 10,
    },
    info: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
  });

export default React.memo(SubscriberCard);

