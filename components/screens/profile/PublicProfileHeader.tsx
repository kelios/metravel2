import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { ProfileStatPills, type ProfileStatPill } from '@/components/profile/ProfileStatPills';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import SubscribeButton from '@/components/ui/SubscribeButton';
import StarRating from '@/components/ui/StarRating';
import VerifiedBadge from '@/components/profile/VerifiedBadge';
import UserSafetyMenu from '@/components/profile/UserSafetyMenu';
import ProtectedContacts from '@/components/profile/ProtectedContacts';
import SafetyNotice from '@/components/ui/SafetyNotice';
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { UserProfileDto } from '@/api/user';
import type { PeerBadgeReceived } from '@/api/achievements';

const AVATAR_SIZE = 112;
const COVER_HEIGHT = 132;
const AVATAR_BORDER = 4;

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
  statPills,
  activeTab,
  onChangeTab,
  tabCounts,
  onWriteMessage,
}: PublicProfileHeaderProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const displayName = fullName || 'Пользователь';
  const rating = profile.participant_rating;

  return (
    <View style={styles.wrapper}>
      <View style={styles.cover}>
        <View style={styles.coverGlow} pointerEvents="none" />
        <View style={styles.coverGradient} pointerEvents="none" />
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

      <View style={styles.avatarSection}>
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
      </View>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={styles.userName} numberOfLines={2}>
            {displayName}
          </Text>
          <VerifiedBadge isVerified={profile.is_verified} organizerStatus={profile.organizer_status} />
        </View>
        {rating && rating.count > 0 ? (
          <View style={styles.ratingRow}>
            <StarRating
              rating={rating.average}
              ratingCount={rating.count}
              size="small"
              showValue
              showCount
              testID="participant-rating-aggregate"
            />
            <Text style={styles.ratingLabel}>как попутчик</Text>
          </View>
        ) : (
          <Text style={styles.userSub}>Автор путешествий</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <SubscribeButton targetUserId={userId} size="sm" />
        {!isOwnProfile ? (
          <Pressable
            style={[styles.secondaryButton, globalFocusStyles.focusable]}
            onPress={onWriteMessage}
            accessibilityRole="button"
            accessibilityLabel={`Написать ${fullName || 'пользователю'}`}
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="mail" size={16} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Написать</Text>
          </Pressable>
        ) : null}
        {!isOwnProfile ? (
          <PeerBadgeGiveButton target="user" recipientId={userId} received={peerReceived} />
        ) : null}
      </View>

      <ProtectedContacts
        socials={socials}
        isOwnProfile={isOwnProfile}
        contactsHidden={profile.contacts_hidden}
        contactAccess={profile.contact_access}
        targetUserId={userId}
      />

      {!isOwnProfile && socials.length > 0 ? (
        <SafetyNotice storageKey="profile-contact-exchange" style={styles.safetyNotice} />
      ) : null}

      <ProfileStatPills pills={statPills} />

      <ProfileTabs
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        counts={tabCounts}
        tabKeys={['overview', 'travels']}
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
      backgroundColor: colors.primaryLight,
      position: 'relative',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.primary} 55%, ${colors.accent} 100%)`,
        } as any,
        default: {},
      }),
    },
    coverGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(to bottom, transparent, ${colors.background})`,
        } as any,
        default: {
          backgroundColor: colors.background,
          opacity: 0.18,
        },
      }),
    },
    coverGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.accentSoft,
      opacity: 0.45,
    },
    menuWrap: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.xs,
      right: DESIGN_TOKENS.spacing.xs,
    },
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
    },
    avatarImage: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      resizeMode: 'cover',
    },
    avatarPlaceholder: {
      fontSize: 36,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.primary,
    },
    identity: {
      alignItems: 'center',
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      gap: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    userName: {
      ...DESIGN_TOKENS.typography.scale.h1,
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    userSub: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
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
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    safetyNotice: {
      marginHorizontal: DESIGN_TOKENS.spacing.md,
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
  });
