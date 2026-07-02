import React, { useMemo, useState } from 'react';
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
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { UserProfileDto } from '@/api/user';
import { openExternalUrl } from '@/utils/externalLinks';
import { ProfileMenu } from './ProfileMenu';
import VerifiedBadge from './VerifiedBadge';
import { CoverTopoTexture } from './CoverTopoTexture';
import {
  ProfileHeaderQuickActions,
  type ProfileHeaderActionKey,
} from './ProfileHeaderQuickActions';

interface ProfileHeaderRank {
  level: number;
  title: string;
}

interface ProfileHeaderProps {
  user: { name: string; email: string; avatar?: string | null };
  profile?: UserProfileDto | null;
  rank?: ProfileHeaderRank | null;
  unreadMessagesCount?: number;
  onEdit: () => void;
  onLogout: () => void;
  onAvatarUpload: () => void;
  onQuickAction: (key: ProfileHeaderActionKey) => void;
  onRankPress?: () => void;
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

const AVATAR_SIZE = 84;
// Баннер выше на мобильном/desktop, чтобы вместить ряд быстрых действий как
// оверлей у нижней кромки, не затеняя основной кадр фото (доминанта — фото).
const COVER_HEIGHT = 132;
const AVATAR_BORDER = 3;

// Дефолтный бандл-арт обложки (горы+озеро+хайкер). Metro отдаёт jpg и на web,
// и на native — статичный require даёт ImageSourcePropType (number).
const DEFAULT_COVER_SOURCE = require('@/assets/images/profile-cover-default.jpg');

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
  rank,
  unreadMessagesCount = 0,
  onEdit,
  onLogout,
  onAvatarUpload,
  onQuickAction,
  onRankPress,
  avatarUploading = false,
}: ProfileHeaderProps) {
  const colors = useThemedColors();
  const { isMobile } = useResponsive();
  const [defaultCoverFailed, setDefaultCoverFailed] = useState(false);

  const coverPhoto = useMemo(
    () =>
      profile?.cover_photo
        ? optimizeImageUrl(profile.cover_photo, {
            width: 1024,
            height: COVER_HEIGHT * 2,
            quality: 70,
            format: 'auto',
            fit: 'cover',
          }) ?? profile.cover_photo
        : null,
    [profile?.cover_photo]
  );

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

  const rankLabel = useMemo(
    () => (rank ? `Уровень ${rank.level}: ${rank.title}` : null),
    [rank]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.background,
          paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        cover: {
          height: COVER_HEIGHT,
          backgroundColor: colors.surface,
          position: 'relative',
          overflow: 'hidden',
        },
        // Деликатный угловой scrim под frost-чипом overflow-меню. Картинка-обложка
        // светлая сверху, поэтому иконкам нужен лёгкий тёмный градиент только в
        // верхнем правом углу — кадр при этом не затемняется.
        coverScrim: {
          position: 'absolute',
          top: 0,
          right: 0,
          width: 132,
          height: 60,
          ...Platform.select({
            web: {
              backgroundImage: `linear-gradient(to bottom left, rgba(0,0,0,0.36), transparent 70%)`,
            } as any,
            default: {
              backgroundColor: colors.overlay,
              opacity: 0.24,
            },
          }),
        },
        topActions: {
          position: 'absolute',
          top: DESIGN_TOKENS.spacing.xs,
          right: DESIGN_TOKENS.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: DESIGN_TOKENS.spacing.xxs,
        },
        // Ряд быстрых действий как оверлей у нижней кромки баннера. Левый отступ
        // резервирует место под аватар, который наезжает на баннер снизу-слева.
        overlayActions: {
          position: 'absolute',
          left: DESIGN_TOKENS.spacing.md,
          right: DESIGN_TOKENS.spacing.md,
          bottom: DESIGN_TOKENS.spacing.xs,
          paddingLeft: AVATAR_SIZE + AVATAR_BORDER * 2 + DESIGN_TOKENS.spacing.sm,
        },
        menuChip: {
          backgroundColor: colors.surfaceMuted,
          borderRadius: DESIGN_TOKENS.radii.pill,
        },
        // Horizontal identity row: avatar left, info right.
        identityRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
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
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
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
          fontSize: 28,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.primaryText,
          letterSpacing: 0,
        },
        cameraOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: AVATAR_SIZE * 0.3,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Info column (name + compact meta)
        infoColumn: {
          flex: 1,
          minWidth: 0,
          paddingTop: AVATAR_SIZE / 2 + AVATAR_BORDER,
          gap: 3,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: DESIGN_TOKENS.spacing.xxs,
        },
        userName: {
          ...DESIGN_TOKENS.typography.scale.h2,
          color: colors.text,
        },
        statusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: DESIGN_TOKENS.spacing.xxs,
        },
        rankChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 4,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.accentSoft,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        rankChipText: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.text,
        },
        socialIcon: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      {/* Photo cover banner (Telegram/VK-style):
          1) uploaded cover_photo → 2) bundled default art → 3) topo-texture fallback */}
      <View style={styles.cover}>
        {coverPhoto ? (
          <ImageCardMedia
            src={coverPhoto}
            alt="Обложка профиля"
            height={COVER_HEIGHT}
            width="100%"
            borderRadius={0}
            fit="cover"
          />
        ) : !defaultCoverFailed ? (
          <ImageCardMedia
            source={DEFAULT_COVER_SOURCE}
            alt="Обложка профиля"
            height={COVER_HEIGHT}
            width="100%"
            borderRadius={0}
            fit="cover"
            onError={() => setDefaultCoverFailed(true)}
          />
        ) : (
          <CoverTopoTexture height={COVER_HEIGHT} />
        )}
        <View style={styles.coverScrim} pointerEvents="none" />
        <View style={styles.topActions}>
          <View style={styles.menuChip}>
            <ProfileMenu onLogout={onLogout} onSettings={onEdit} />
          </View>
        </View>
        {/* Быстрые действия встроены в нижнюю кромку баннера как оверлей поверх
            фото. На мобильном — компактные icon-only чипы, чтобы шапка не
            раздувалась (правило «Шапка ≤20% экрана»). */}
        <View style={styles.overlayActions}>
          <ProfileHeaderQuickActions
            onPress={onQuickAction}
            unreadMessagesCount={unreadMessagesCount}
            overlay
            compact={isMobile}
          />
        </View>
      </View>

      {/* Identity: avatar left, info right */}
      <View style={styles.identityRow}>
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
                <Image source={{ uri: optimizeImageUrl(user.avatar, { width: 168, height: 168, quality: 72, format: 'auto', fit: 'cover' }) ?? user.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>{getInitials(user.name || '?')}</Text>
              )}
              <View style={styles.cameraOverlay}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Feather name="camera" size={13} color={colors.textInverse} />
                )}
              </View>
            </View>
          </View>
        </Pressable>

        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={2}>
              {user.name || 'Пользователь'}
            </Text>
            {rankLabel ? (
              <Pressable
                onPress={onRankPress}
                disabled={!onRankPress}
                accessibilityRole={onRankPress ? 'button' : undefined}
                accessibilityLabel={onRankPress ? `Открыть прогресс профиля: ${rankLabel}` : rankLabel}
                accessibilityHint={onRankPress ? 'Показывает ваш путь, уровни и награды' : undefined}
                style={({ pressed }) => [
                  styles.rankChip,
                  pressed && { opacity: 0.78 },
                  globalFocusStyles.focusable,
                ]}
              >
                <Feather name="award" size={12} color={colors.primaryDark} />
                <Text style={styles.rankChipText} numberOfLines={1}>
                  Ур. {rank?.level}
                </Text>
              </Pressable>
            ) : null}
            {socialLinks.map((link) => (
              <Pressable
                key={link.key}
                style={({ pressed }) => [
                  styles.socialIcon,
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
                  size={14}
                  color={colors.primaryDark}
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.statusRow}>
            <VerifiedBadge
              isVerified={profile?.is_verified}
              organizerStatus={profile?.organizer_status ?? null}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
