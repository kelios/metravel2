import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { ProfileStatPills, type ProfileStatPill } from '@/components/profile/ProfileStatPills';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import SubscribeButton from '@/components/ui/SubscribeButton';
import StarRating from '@/components/ui/StarRating';
import UserSafetyMenu from '@/components/profile/UserSafetyMenu';
import ProtectedContacts from '@/components/profile/ProtectedContacts';
import SafetyNotice from '@/components/ui/SafetyNotice';
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton';
import Button from '@/components/ui/Button';
import type { UserProfileDto } from '@/api/user';
import type { PeerBadgeReceived, UserRank } from '@/api/achievements';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { CoverTopoTexture } from '@/components/profile/CoverTopoTexture';
import { translate as i18nT } from '@/i18n'


const AVATAR_SIZE = 84;
const COVER_HEIGHT = 132;
const AVATAR_BORDER = 3;
const DEFAULT_COVER_SOURCE = require('@/assets/images/profile-cover-default.jpg');

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface PublicProfileHeaderProps {
  userId: string;
  fullName: string;
  profile: UserProfileDto;
  avatarError: boolean;
  onAvatarError: () => void;
  isOwnProfile: boolean;
  socials: Array<{ key: string; label: string; value: string }>;
  peerReceived: PeerBadgeReceived[];
  rank?: UserRank | null;
  statPills: ProfileStatPill[];
  activeTab: ProfileTabKey;
  onChangeTab: (tab: ProfileTabKey) => void;
  tabCounts: Partial<Record<ProfileTabKey, number>>;
  onWriteMessage: () => void;
}

export function PublicProfileHeader({
  userId,
  fullName,
  profile,
  avatarError,
  onAvatarError,
  isOwnProfile,
  socials,
  peerReceived,
  rank,
  statPills,
  activeTab,
  onChangeTab,
  tabCounts,
  onWriteMessage,
}: PublicProfileHeaderProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [defaultCoverFailed, setDefaultCoverFailed] = useState(false);

  const displayName = fullName || i18nT('profile:components.screens.profile.PublicProfileHeader.defaultUserName');
  const rating = profile.participant_rating;
  // Ранг — единственный первичный статус под именем (#847). Компактно: «Ур.5 · Эксперт».
  const rankChipText = rank ? i18nT('profile:components.screens.profile.PublicProfileHeader.ur_value1_value2_8cacab38', { value1: rank.level, value2: rank.title }) : null;
  const coverPhoto = profile.cover_photo
    ? optimizeImageUrl(profile.cover_photo, {
        width: 1024,
        height: COVER_HEIGHT * 2,
        quality: 70,
        format: 'auto',
        fit: 'cover',
      }) ?? profile.cover_photo
    : null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.cover}>
        {coverPhoto ? (
          <View style={styles.coverMediaLayer} pointerEvents="none">
            <ImageCardMedia
              src={coverPhoto}
              alt={i18nT('profile:components.screens.profile.PublicProfileHeader.oblozhka_profilya_bebc7e97')}
              height={COVER_HEIGHT}
              width="100%"
              borderRadius={0}
              fit="cover"
              blurBackground={false}
              priority="high"
            />
          </View>
        ) : !defaultCoverFailed ? (
          <View style={styles.coverMediaLayer} pointerEvents="none">
            <ImageCardMedia
              source={DEFAULT_COVER_SOURCE}
              alt={i18nT('profile:components.screens.profile.PublicProfileHeader.oblozhka_profilya_bebc7e97')}
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
        {!isOwnProfile && userId ? (
          <View style={styles.menuWrap}>
            <UserSafetyMenu
              targetUserId={userId}
              targetName={fullName || undefined}
              reportedByMe={profile.reported_by_me}
              isBlockedByMe={profile.is_blocked_by_me}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.identityRow}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            {profile.avatar && !avatarError ? (
              <Image
                source={{
                  uri:
                    optimizeImageUrl(profile.avatar, {
                      width: 224,
                      height: 224,
                      quality: 72,
                      format: 'auto',
                      fit: 'cover',
                    }) ?? profile.avatar,
                }}
                style={styles.avatarImage}
                onError={onAvatarError}
              />
            ) : (
              <Text style={styles.avatarPlaceholder}>{getInitials(displayName)}</Text>
            )}
          </View>
        </View>
        <View style={styles.infoColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={2}>{displayName}</Text>
          </View>
          {rankChipText ? (
            <View style={styles.rankChip} accessibilityRole="text" accessibilityLabel={i18nT('profile:components.screens.profile.PublicProfileHeader.uroven_value1_value2_509cab7b', { value1: rank?.level, value2: rank?.title })}>
              <Feather name="award" size={12} color={colors.primaryDark} />
              <Text style={styles.rankChipText} numberOfLines={1}>{rankChipText}</Text>
            </View>
          ) : null}
          {rating && rating.count > 0 ? (
            <View style={styles.ratingRow}>
              <StarRating rating={rating.average} ratingCount={rating.count} size="small" showValue showCount testID="participant-rating-aggregate" />
              <Text style={styles.ratingLabel}>{i18nT('profile:components.screens.profile.PublicProfileHeader.kak_poputchik_cb66e518')}</Text>
            </View>
          ) : !rankChipText ? <Text style={styles.userSub}>{i18nT('profile:components.screens.profile.PublicProfileHeader.avtor_puteshestviy_bce7467f')}</Text> : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <SubscribeButton targetUserId={userId} size="sm" />
        {!isOwnProfile ? (
          <Button
            label={i18nT('profile:components.screens.profile.PublicProfileHeader.napisat_6e0d896e')}
            onPress={onWriteMessage}
            variant="secondary"
            size="sm"
            icon={<Feather name="mail" size={16} color={colors.primaryDark} />}
            accessibilityLabel={i18nT('profile:components.screens.profile.PublicProfileHeader.napisat_value1_1156a332', { value1: fullName || i18nT('profile:components.screens.profile.PublicProfileHeader.defaultUserReference') })}
          />
        ) : null}
        {!isOwnProfile ? (
          <PeerBadgeGiveButton target="user" recipientId={userId} received={peerReceived} />
        ) : null}
      </View>

      <View style={styles.contactsSection}>
        <ProtectedContacts
          socials={socials}
          isOwnProfile={isOwnProfile}
          contactsHidden={profile.contacts_hidden}
          contactAccess={profile.contact_access}
          targetUserId={userId}
        />
      </View>

      {!isOwnProfile && socials.length > 0 ? (
        <SafetyNotice storageKey="profile-contact-exchange" style={styles.safetyNotice} />
      ) : null}

      <ProfileStatPills pills={statPills} />

      <ProfileTabs
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        counts={tabCounts}
        tabKeys={isOwnProfile ? ['travels', 'subscribers', 'subscriptions', 'overview'] : ['travels', 'overview']}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: colors.background,
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
    coverScrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 132,
      height: 60,
      zIndex: 1,
      ...Platform.select({
        web: {
          backgroundImage: 'linear-gradient(to bottom left, rgba(0,0,0,0.36), transparent 70%)',
        } as any,
        default: {
          backgroundColor: colors.overlay,
          opacity: 0.24,
        },
      }),
    },
    menuWrap: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.xs,
      right: DESIGN_TOKENS.spacing.xs,
    },
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
    },
    avatarImage: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      resizeMode: 'cover',
    },
    avatarPlaceholder: {
      fontSize: 28,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.primaryText,
    },
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
    userSub: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    rankChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.accentSoft,
    },
    rankChipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.text,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ratingLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    // Контакты не full-bleed: карточка «Контакты скрыты»/чипы соцсетей раньше
    // прижимались к краям экрана (без бокового отступа, в отличие от соседей).
    // Вертикальный отступ живёт внутри ProtectedContacts — пустой гейт не
    // оставляет лишнего зазора.
    contactsSection: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    safetyNotice: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
  });
