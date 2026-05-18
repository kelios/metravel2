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

const AVATAR_SIZE = 116;
const COVER_HEIGHT = 130;
const AVATAR_BORDER = 4;

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
        cover: {
          height: COVER_HEIGHT,
          backgroundColor: colors.primaryLight,
          position: 'relative',
          overflow: 'hidden',
        },
        coverGradient: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          ...Platform.select({
            web: {
              backgroundImage: `linear-gradient(to bottom, transparent, ${colors.background}22)`,
            } as any,
            default: {},
          }),
        },
        menuWrap: {
          position: 'absolute',
          top: DESIGN_TOKENS.spacing.xs,
          right: DESIGN_TOKENS.spacing.xs,
        },
        // Avatar overlapping cover
        avatarSection: {
          alignItems: 'center',
          marginTop: -(AVATAR_SIZE / 2 + AVATAR_BORDER),
        },
        avatarRing: {
          width: AVATAR_SIZE + AVATAR_BORDER * 2,
          height: AVATAR_SIZE + AVATAR_BORDER * 2,
          borderRadius: (AVATAR_SIZE + AVATAR_BORDER * 2) / 2,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 6 },
            default: {},
          }),
        },
        avatar: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          backgroundColor: colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        avatarImage: {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
        },
        avatarPlaceholder: {
          fontSize: 38,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.primary,
          letterSpacing: 0,
        },
        cameraOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: AVATAR_SIZE * 0.32,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // User info section
        userInfo: {
          alignItems: 'center',
          paddingTop: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
          gap: 4,
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

        // Actions row
        actionsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: DESIGN_TOKENS.spacing.md,
          gap: DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
        editButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
          paddingVertical: 10,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.primary,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
          ...Platform.select({
            ios: {
              shadowColor: colors.primary,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
            },
            android: { elevation: 3 },
            default: {},
          }),
        },
        editButtonText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
          color: colors.textOnPrimary,
        },
        // Social links
        socialsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: DESIGN_TOKENS.spacing.xs,
          marginTop: DESIGN_TOKENS.spacing.md,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
        },
        socialChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
          paddingVertical: 7,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: DESIGN_TOKENS.touchTarget.minHeight - 4,
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
          marginHorizontal: DESIGN_TOKENS.spacing.md,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      {/* Cover band with subtle gradient overlay */}
      <View style={styles.cover}>
        <View style={styles.coverGradient} />
        <View style={styles.menuWrap}>
          <ProfileMenu onLogout={onLogout} onSettings={onEdit} />
        </View>
      </View>

      {/* Avatar overlapping cover */}
      <View style={styles.avatarSection}>
        <Pressable
          onPress={onAvatarUpload}
          disabled={avatarUploading}
          accessibilityRole="button"
          accessibilityLabel={avatarUploading ? 'Загрузка аватара' : 'Изменить аватар'}
          accessibilityHint="Нажмите, чтобы загрузить новое фото профиля"
        >
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>{getInitials(user.name || '?')}</Text>
              )}
              <View style={styles.cameraOverlay}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Feather name="camera" size={14} color={colors.textInverse} />
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Name + Email */}
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={2}>
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
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Редактировать профиль"
          accessibilityHint="Перейти к настройкам профиля"
        >
          <Feather name="edit-2" size={14} color={colors.textOnPrimary} />
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
                { opacity: pressed ? 0.75 : 1 },
              ]}
              onPress={() => openExternalUrl(String(link.url))}
              accessibilityRole="link"
              accessibilityLabel={`Открыть ${SOCIAL_LABELS[link.key] ?? link.label}`}
              accessibilityHint={`Откроется внешняя ссылка на ${SOCIAL_LABELS[link.key] ?? link.label}`}
            >
              <Feather
                name={SOCIAL_ICONS[link.key] || 'link'}
                size={13}
                color={colors.primary}
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
