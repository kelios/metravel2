// components/subscriptions/SubscriberCard.tsx
// D1: Extracted from subscriptions.tsx

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, Image, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { resolveProfileFullName, type UserProfileDto } from '@/api/user';
import SubscribeButton from '@/components/ui/SubscribeButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { translate as i18nT } from '@/i18n'


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
    return resolveProfileFullName(profile) || i18nT('sharedStatic:user.fallbackName');
  }, [profile.first_name, profile.last_name]);

  const initials = useMemo(() => {
    return fullName
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || null;
  }, [fullName]);

  const userId = profile.user ?? profile.id;

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Pressable
          style={styles.info}
          onPress={() => onOpenProfile(userId)}
          accessibilityRole="button"
          accessibilityLabel={i18nT('shared:components.subscriptions.SubscriberCard.otkryt_profil_value1_159b4403', { value1: fullName })}
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <View style={styles.avatar}>
            {profile.avatar && !avatarError ? (
              <Image
                source={{ uri: optimizeImageUrl(profile.avatar, { width: 80, height: 80, quality: 70, format: 'auto', fit: 'cover' }) ?? profile.avatar }}
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Feather name="user" size={20} color={colors.primaryDark} />
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
            accessibilityLabel={i18nT('shared:components.subscriptions.SubscriberCard.napisat_value1_b8348a10', { value1: fullName })}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="mail" size={16} color={colors.primaryDark} />
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
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
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
    avatarInitials: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: colors.primaryText,
      letterSpacing: 0.5,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
  });

export default React.memo(SubscriberCard);
