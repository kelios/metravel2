import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Platform, ActivityIndicator } from 'react-native';
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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.background,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarImage: {
      width: 68,
      height: 68,
      borderRadius: 34,
    },
    avatarPlaceholder: {
      fontSize: 32,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.primary,
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.sm,
      padding: DESIGN_TOKENS.spacing.xxs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    nameBlock: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: 22,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xxs,
    },
    userEmail: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      flexShrink: 0,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.sm,
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
      fontSize: 13,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    socialsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    socialChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 6,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.border,
      marginTop: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Main Profile Info */}
      <View style={styles.mainRow}>
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
              <Text style={styles.avatarPlaceholder}>
                {getInitials(user.name || '?')}
              </Text>
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

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.name || 'Пользователь'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>

            <View style={styles.actions}>
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
              <ProfileMenu onLogout={onLogout} onSettings={onEdit} />
            </View>
          </View>
        </View>
      </View>

      {/* Social Links with Icons */}
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

      {/* Section Divider */}
      <View style={styles.divider} />
    </View>
  );
}
