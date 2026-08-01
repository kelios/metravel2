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
import { useBreakpoints } from '@/hooks/useResponsive';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { openExternalUrl } from '@/utils/externalLinks';
import { translate as i18nT } from '@/i18n'


const WEB_CARD_SHADOW_STYLE = { boxShadow: DESIGN_TOKENS.shadows.card };
const WEB_CURSOR_POINTER_STYLE = { cursor: 'pointer' as const };

type SocialKey = 'youtube' | 'instagram' | 'twitter' | 'vk';

const SOCIAL_ICONS: Record<SocialKey, React.ComponentProps<typeof Feather>['name']> = {
  youtube: 'youtube',
  instagram: 'instagram',
  twitter: 'twitter',
  vk: 'external-link',
};

interface SubscriberCardProps {
  profile: UserProfileDto;
  onMessage: (userId: number) => void;
  onOpenProfile: (userId: number) => void;
}

function SubscriberCard({ profile, onMessage, onOpenProfile }: SubscriberCardProps) {
  const colors = useThemedColors();
  const { isMobile, width } = useBreakpoints();
  const isCompact = isMobile || width < 640;
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact]);
  const [avatarError, setAvatarError] = useState(false);

  const fullName = useMemo(() => {
    return resolveProfileFullName(profile) || i18nT('sharedStatic:user.fallbackName');
  }, [profile]);

  const initials = useMemo(() => {
    return fullName
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || null;
  }, [fullName]);

  const userId = profile.user ?? profile.id;
  const socialLinks = useMemo(() => {
    if (profile.contacts_hidden === true && profile.contact_access !== 'granted') return [];

    return [
      { key: 'youtube' as const, label: i18nT('profile:components.profile.ProfileHeader.youtube_3c5324c5'), url: profile.youtube },
      { key: 'instagram' as const, label: i18nT('profile:components.profile.ProfileHeader.instagram_dbd24d26'), url: profile.instagram },
      { key: 'twitter' as const, label: i18nT('profile:components.profile.ProfileHeader.twitter_6c382a7e'), url: profile.twitter },
      { key: 'vk' as const, label: i18nT('profile:components.profile.ProfileHeader.vk_4e6034d6'), url: profile.vk },
    ]
      .map((social) => ({ ...social, url: String(social.url ?? '').trim() }))
      .filter((social) => social.url);
  }, [profile]);

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
                source={{ uri: optimizeImageUrl(profile.avatar, { width: 80, quality: 70, fit: 'cover' }) ?? profile.avatar }}
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Feather name="user" size={20} color={colors.primaryDark} />
            )}
          </View>
          <Text style={styles.name}>{fullName}</Text>
        </Pressable>

        <View testID="subscriber-actions" style={styles.actions}>
          {socialLinks.map((social) => (
            <Pressable
              key={social.key}
              testID={`subscriber-social-${social.key}`}
              style={[styles.actionButton, globalFocusStyles.focusable]}
              onPress={() => void openExternalUrl(social.url)}
              accessibilityRole="link"
              accessibilityLabel={i18nT('profile:components.profile.ProfileHeader.otkryt_value1_8f445d13', { value1: social.label })}
              accessibilityHint={i18nT('profile:components.profile.ProfileHeader.otkroetsya_vneshnyaya_ssylka_na_value1_1821b787', { value1: social.label })}
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name={SOCIAL_ICONS[social.key]} size={18} color={colors.primaryDark} />
            </Pressable>
          ))}
          <SubscribeButton targetUserId={userId} size="sm" iconOnly style={styles.actionButton} />
          <Pressable
            style={[styles.actionButton, globalFocusStyles.focusable]}
            onPress={() => onMessage(userId)}
            accessibilityRole="button"
            accessibilityLabel={i18nT('shared:components.subscriptions.SubscriberCard.napisat_value1_b8348a10', { value1: fullName })}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="mail" size={18} color={colors.primaryDark} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>, isCompact: boolean) =>
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
      flexDirection: isCompact ? 'column' : 'row',
      alignItems: isCompact ? 'stretch' : 'center',
    },
    info: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: isCompact ? 0 : 12,
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
      flexShrink: 1,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingLeft: isCompact ? 12 : 0,
      paddingRight: 12,
      paddingTop: isCompact ? DESIGN_TOKENS.spacing.xs : 12,
      paddingBottom: 12,
    },
    actionButton: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: DESIGN_TOKENS.touchTarget.minHeight / 2,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
    },
  });

export default React.memo(SubscriberCard);
