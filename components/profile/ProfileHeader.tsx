import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { UserProfileDto } from '@/api/user';
import { openExternalUrl } from '@/utils/externalLinks';
import { ProfileMenu } from './ProfileMenu';

interface ProfileHeaderProps {
  user: { name: string; email: string; avatar?: string | null };
  profile?: UserProfileDto | null;
  onEdit: () => void;
  onLogout: () => void;
  onAvatarUpload: () => void;
  avatarUploading?: boolean;
}

const SOCIAL_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  twitter: 'Twitter',
  vk: 'ВКонтакте',
};

const SOCIAL_ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  youtube: 'youtube',
  instagram: 'instagram',
  twitter: 'twitter',
  vk: 'link',
};

const AVATAR_SIZE = 100;
const COVER_HEIGHT = 88;

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function ProfileHeader({
  user,
  profile,
  onEdit,
  onLogout,
  onAvatarUpload,
  avatarUploading = false,
}: ProfileHeaderProps) {
  const colors = useThemedColors();

  const socialLinks = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: 'YouTube', url: profile.youtube },
            { key: 'instagram', label: 'Instagram', url: profile.instagram },
            { key: 'twitter', label: 'Twitter', url: profile.twitter },
            { key: 'vk', label: 'VK', url: profile.vk },
          ].filter((link) => !!link.url)
        : [],
    [profile]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.background,
          paddingBottom: DESIGN_TOKENS.spacing.md,
        },
        // Cover band at top
        cover: {
          height: COVER_HEIGHT,
          backgroundColor: colors.primaryLight,
          position: 'relative',
        },
        menuWrap: {
          position: 'absolute',
          top: DESIGN_TOKENS.spacing.xs,
          right: DESIGN_TOKENS.spacing.xs,
        },
        // Avatar section — overlapping cover
        avatarSection: {
          alignItems: 'center',
          marginTop: -(AVATAR_SIZE / 2),
        },
        avatarContainer: {
          position: 'relative',
        },
        avatar: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          backgroundColor: colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.background,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
          // Subtle shadow for avatar pop
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 4 },
            default: {},
          }),
        },
        avatarImage: {
          width: AVATAR_SIZE - 6,
          height: AVATAR_SIZE - 6,
          borderRadius: (AVATAR_SIZE - 6) / 2,
        },
        avatarPlaceholder: {
          fontSize: 36,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.primary,
        },
        editBadge: {
          position: 'absolute',
          bottom: 2,
          right: 2,
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.sm,
          padding: 5,
          borderWidth: 1,
          borderColor: colors.border,
        },
        // Centered user info
        userInfo: {
          alignItems: 'center',
          paddingTop: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xxs,
        },
        userName: {
          ...DESIGN_TOKENS.typography.scale.h2,
          color: colors.text,
          textAlign: 'center',
        },
        userEmail: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          color: colors.textMuted,
          textAlign: 'center',
        },
        // Edit button row centered
        actionsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: DESIGN_TOKENS.spacing.sm,
          gap: DESIGN_TOKENS.spacing.xs,
        },
        editButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingVertical: DESIGN_TOKENS.spacing.xs,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        editButtonText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.text,
        },
        // Social links centered
        socialsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: DESIGN_TOKENS.spacing.xs,
          marginTop: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
        socialChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
          paddingVertical: 6,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.borderLight,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        socialChipText: {
          color: colors.textSecondary,
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
        },
        divider: {
          height: 1,
          backgroundColor: colors.borderLight,
          marginTop: DESIGN_TOKENS.spacing.md,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      {/* Cover band */}
      <View style={styles.cover}>
        <View style={styles.menuWrap}>
          <ProfileMenu onLogout={onLogout} onSettings={onEdit} />
        </View>
      </View>

      {/* Avatar overlapping cover */}
      <View style={styles.avatarSection}>
        <Pressable
          onPress={onAvatarUpload}
          disabled={avatarUploading}
          style={styles.avatarContainer}
          accessibilityRole="button"
          accessibilityLabel={avatarUploading ? 'Загрузка аватара' : 'Изменить аватар'}
          accessibilityHint="Нажмите, чтобы загрузить новое фото профиля"
        >
          <View style={styles.avatar}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholder}>{getInitials(user.name || '?')}</Text>
            )}
          </View>
          <View style={styles.editBadge}>
            {avatarUploading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Feather name="camera" size={12} color={colors.text} />
            )}
          </View>
        </Pressable>
      </View>

      {/* Name + Email */}
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name || 'Пользователь'}
        </Text>
        {!!user.email && (
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
        )}
      </View>

      {/* Edit action */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,
            globalFocusStyles.focusable,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Редактировать профиль"
          accessibilityHint="Перейти к настройкам профиля"
        >
          <Feather name="edit-2" size={14} color={colors.text} />
          <Text style={styles.editButtonText}>Редактировать</Text>
        </Pressable>
      </View>

      {/* Social Links */}
      {socialLinks.length > 0 && (
        <View style={styles.socialsRow}>
          {socialLinks.map((link) => (
            <Pressable
              key={link.key}
              style={({ pressed }) => [
                styles.socialChip,
                globalFocusStyles.focusable,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => openExternalUrl(String(link.url))}
              accessibilityRole="link"
              accessibilityLabel={`Открыть ${SOCIAL_LABELS[link.key] ?? link.label}`}
              accessibilityHint={`Откроется внешняя ссылка на ${SOCIAL_LABELS[link.key] ?? link.label}`}
            >
              <Feather
                name={SOCIAL_ICONS[link.key] || 'link'}
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.socialChipText}>
                {SOCIAL_LABELS[link.key] ?? link.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.divider} />
    </View>
  );
}
