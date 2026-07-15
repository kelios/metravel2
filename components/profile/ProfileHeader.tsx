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
import { CoverTopoTexture } from './CoverTopoTexture';
import {
  ProfileHeaderQuickActions,
  type ProfileHeaderActionKey,
} from './ProfileHeaderQuickActions';
import { translate as i18nT } from '@/i18n'


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
            { key: 'youtube', label: i18nT('profile:components.profile.ProfileHeader.youtube_3c5324c5'), url: profile.youtube },
            { key: 'instagram', label: i18nT('profile:components.profile.ProfileHeader.instagram_dbd24d26'), url: profile.instagram },
            { key: 'twitter', label: i18nT('profile:components.profile.ProfileHeader.twitter_6c382a7e'), url: profile.twitter },
            { key: 'vk', label: i18nT('profile:components.profile.ProfileHeader.vk_4e6034d6'), url: profile.vk },
          ].filter((link) => !!link.url)
        : [],
    [profile]
  );

  const rankLabel = useMemo(
    () => (rank ? i18nT('profile:components.profile.ProfileHeader.uroven_value1_value2_7a325518', { value1: rank.level, value2: rank.title }) : null),
    [rank]
  );

  // Компактная подпись чипа: уровень + название ранга («Ур.5 · Эксперт»), чтобы
  // чип читался как самостоятельный статус, а не обрезанный «Ур.5».
  const rankChipText = useMemo(
    () => (rank ? i18nT('profile:components.profile.ProfileHeader.ur_value1_value2_735cc6bf', { value1: rank.level, value2: rank.title }) : null),
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
        coverMediaLayer: {
          height: COVER_HEIGHT,
          width: '100%',
          position: 'relative',
          zIndex: 0,
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
          zIndex: 1,
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
          zIndex: 4,
        },
        // Ряд быстрых действий как оверлей у нижней кромки баннера. Левый отступ
        // резервирует место под аватар, который наезжает на баннер снизу-слева.
        overlayActions: {
          position: 'absolute',
          left: DESIGN_TOKENS.spacing.md,
          right: DESIGN_TOKENS.spacing.md,
          bottom: DESIGN_TOKENS.spacing.xs,
          paddingLeft: AVATAR_SIZE + AVATAR_BORDER * 2 + DESIGN_TOKENS.spacing.sm,
          zIndex: 3,
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
        metaRow: {
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
          <View
            style={styles.coverMediaLayer}
            pointerEvents="none"
            testID="profile-header-cover-media"
          >
            <ImageCardMedia
              src={coverPhoto}
              alt={i18nT('profile:components.profile.ProfileHeader.oblozhka_profilya_b2ecd31d')}
              height={COVER_HEIGHT}
              width="100%"
              borderRadius={0}
              fit="cover"
              blurBackground={false}
              // Above-fold cover must stay sharp on iOS Safari; a blur backdrop
              // can remain visible there if the final frame is delayed.
              priority="high"
            />
          </View>
        ) : !defaultCoverFailed ? (
          <View
            style={styles.coverMediaLayer}
            pointerEvents="none"
            testID="profile-header-cover-media"
          >
            <ImageCardMedia
              source={DEFAULT_COVER_SOURCE}
              alt={i18nT('profile:components.profile.ProfileHeader.oblozhka_profilya_b2ecd31d')}
              height={COVER_HEIGHT}
              width="100%"
              borderRadius={0}
              fit="cover"
              blurBackground={false}
              priority="high"
              onError={() => setDefaultCoverFailed(true)}
            />
          </View>
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
        <View style={styles.overlayActions} testID="profile-header-quick-actions">
          <ProfileHeaderQuickActions
            onPress={onQuickAction}
            unreadMessagesCount={unreadMessagesCount}
            overlay
            compact={isMobile}
          />
        </View>
      </View>

      {/* Identity: avatar left, info right */}
      <View style={styles.identityRow} pointerEvents="box-none" testID="profile-header-identity-row">
        <Pressable
          onPress={onAvatarUpload}
          disabled={avatarUploading}
          accessibilityRole="button"
          accessibilityLabel={avatarUploading ? i18nT('profile:components.profile.ProfileHeader.zagruzka_avatara_55d6c4d0') : i18nT('profile:components.profile.ProfileHeader.izmenit_avatar_3b22482f')}
          accessibilityHint={i18nT('profile:components.profile.ProfileHeader.nazhmite_chtoby_zagruzit_novoe_foto_profilya_631853a6')}
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

        <View style={styles.infoColumn} pointerEvents="box-none" testID="profile-header-info-column">
          <View style={styles.nameRow} testID="profile-header-name-row">
            <Text style={styles.userName} numberOfLines={2}>
              {user.name || i18nT('profile:components.profile.ProfileHeader.defaultUserName')}
            </Text>
          </View>
          {(rankLabel || socialLinks.length > 0) ? (
            <View style={styles.metaRow} testID="profile-header-meta-row">
              {rankLabel ? (
                <Pressable
                  onPress={onRankPress}
                  disabled={!onRankPress}
                  accessibilityRole={onRankPress ? 'button' : undefined}
                  accessibilityLabel={onRankPress ? i18nT('profile:components.profile.ProfileHeader.otkryt_progress_profilya_value1_7235e580', { value1: rankLabel }) : rankLabel}
                  accessibilityHint={i18nT('profile:components.profile.ProfileHeader.uroven_rastet_za_vashu_aktivnost_na_metravel_7d32196b')}
                  style={({ pressed }) => [
                    styles.rankChip,
                    pressed && { opacity: 0.78 },
                    globalFocusStyles.focusable,
                  ]}
                >
                  <Feather name="award" size={12} color={colors.primaryDark} />
                  <Text style={styles.rankChipText} numberOfLines={1}>
                    {rankChipText}
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
                  accessibilityLabel={i18nT('profile:components.profile.ProfileHeader.otkryt_value1_8f445d13', { value1: link.label })}
                  accessibilityHint={i18nT('profile:components.profile.ProfileHeader.otkroetsya_vneshnyaya_ssylka_na_value1_1821b787', { value1: link.label })}
                >
                  <Feather
                    name={SOCIAL_ICONS[link.key] || 'link'}
                    size={14}
                    color={colors.primaryDark}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
