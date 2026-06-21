import { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useUserProfileCached } from '@/hooks/useUserProfileCached';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { fetchMySubscriptions, fetchMySubscribers, type UserProfileDto } from '@/api/user';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import SubscribeButton from '@/components/ui/SubscribeButton';
import { webTouchScrollStyle } from '@/utils';
import { routes } from '@/utils/routes';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { fetchTravels } from '@/api/travelListQueries';
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import ProtectedContacts from '@/components/profile/ProtectedContacts';
import UserAchievementsSection from '@/components/achievements/UserAchievementsSection';
import UserRareAwardsSection from '@/components/achievements/UserRareAwardsSection';
import AdminGrantRareAward from '@/components/achievements/AdminGrantRareAward';
import GamificationProfileBlock from '@/components/achievements/GamificationProfileBlock';
import SafetyNotice from '@/components/ui/SafetyNotice';
import UserSafetyMenu from '@/components/profile/UserSafetyMenu';
import VerifiedBadge from '@/components/profile/VerifiedBadge';
import StarRating from '@/components/ui/StarRating';
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton';
import { useUserAchievements } from '@/hooks/useAchievementsApi';
import { useResponsive } from '@/hooks/useResponsive';
import type { Travel } from '@/types/types';

const AUTHOR_TRAVELS_LIMIT = 12;
const AUTHOR_CARD_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj';

// Русская плюрализация: [одна, две-четыре, пять+]. Корректно для 0 (→ many),
// 11-14 (→ many) и 22-24 (→ few), в отличие от наивного `n < 5`.
const pluralizeRu = (n: number, forms: [string, string, string]): string => {
  const abs = Math.abs(n) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail === 1) return forms[0];
  if (tail >= 2 && tail <= 4) return forms[1];
  return forms[2];
};

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ id?: string }>();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : null;
  }, [params?.id]);

  const { profile, isLoading, error, fullName } = useUserProfileCached(userId, {
    enabled: !!userId,
  });
  const [avatarError, setAvatarError] = useState(false);
  // Expo Router переиспользует инстанс при смене param — сбрасываем флаг ошибки
  // аватара, иначе 404 предыдущего профиля скрывал бы валидный аватар нового.
  useEffect(() => {
    setAvatarError(false);
  }, [userId, profile?.avatar]);

  const socials = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: 'YouTube', icon: 'youtube', value: profile.youtube },
            { key: 'instagram', label: 'Instagram', icon: 'instagram', value: profile.instagram },
            { key: 'twitter', label: 'Twitter', icon: 'twitter', value: profile.twitter },
            { key: 'vk', label: 'VK', icon: 'vk', value: profile.vk },
          ].filter((s) => Boolean(String(s.value ?? '').trim()))
        : [],
    [profile]
  );

  const { isAuthenticated, userId: currentUserId } = useAuth();
  // userId уже нормализован (Number→String); нормализуем currentUserId симметрично,
  // иначе разное форматирование (ведущие нули и т.п.) ломает own-profile UI.
  const isOwnProfile =
    currentUserId != null &&
    userId != null &&
    String(Number(currentUserId)) === userId;

  const subscriptionsQuery = useQuery<UserProfileDto[]>({
    queryKey: queryKeys.mySubscriptions(),
    queryFn: fetchMySubscriptions,
    enabled: isAuthenticated && isOwnProfile,
    staleTime: 5 * 60 * 1000,
    retry: (fc, err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)) && fc < 2,
  });

  const subscribersQuery = useQuery<UserProfileDto[]>({
    queryKey: queryKeys.mySubscribers(),
    queryFn: fetchMySubscribers,
    enabled: isAuthenticated && isOwnProfile,
    staleTime: 5 * 60 * 1000,
    retry: (fc, err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)) && fc < 2,
  });

  const subscriptionsCount = subscriptionsQuery.data?.length ?? null;
  const subscribersCount = subscribersQuery.data?.length ?? null;

  const { isMobile } = useResponsive();

  const userAchievementsQuery = useUserAchievements(userId);
  const peerReceived = userAchievementsQuery.data?.peerReceived ?? [];

  const authorTravelsQuery = useQuery<{ data: Travel[]; total: number }>({
    queryKey: queryKeys.userTravels(userId),
    // F-14: публичная страница автора показывает только опубликованные маршруты
    // (как счётчик в профиле), без черновиков.
    queryFn: () => fetchTravels(0, AUTHOR_TRAVELS_LIMIT, '', { user_id: userId, publish: 1, moderation: 1 }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: (fc, err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)) && fc < 2,
  });

  const authorTravels = authorTravelsQuery.data?.data ?? [];
  const authorTravelsTotal = authorTravelsQuery.data?.total ?? 0;

  const handleOpenTravel = useCallback(
    (travel: Travel) => {
      const url = resolveTravelUrl(travel as any);
      if (url) router.push(url as any);
    },
    [router]
  );

  const handleViewTravels = useCallback(() => {
    if (!userId) return;
    router.push(`/search?user_id=${encodeURIComponent(userId)}` as any);
  }, [router, userId]);

  const handleWriteMessage = useCallback(() => {
    if (!userId) return;
    router.push(routes.messages(userId));
  }, [router, userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId || error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Профиль недоступен</Text>
          <Text style={styles.errorText}>{!userId ? 'Некорректный id пользователя' : (error as any)?.message || String(error || 'Не удалось загрузить данные профиля')}</Text>
          <Pressable
            style={[styles.backButton, globalFocusStyles.focusable]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isFocused && (
        <InstantSEO
          headKey={`user-${userId}`}
          title={`${fullName || 'Пользователь'} | Metravel`}
          description={`Профиль автора ${fullName || ''} на Metravel`}
          canonical={buildCanonicalUrl(`/user/${userId}`)}
          ogType="website"
        />
      )}
      <ScrollView style={[styles.scrollView, webTouchScrollStyle]} contentContainerStyle={styles.content}>
        {Platform.OS === 'web' && (
            <h1 style={{
                position: 'absolute' as const,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden' as const,
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                borderWidth: 0,
            } as any}>{`${fullName || 'Пользователь'} | Metravel`}</h1>
        )}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              {profile.avatar && !avatarError ? (
                <Image
                  source={{ uri: optimizeImageUrl(profile.avatar, { width: 112, height: 112, quality: 70, format: 'auto', fit: 'cover' }) ?? profile.avatar }}
                  style={styles.avatarImage}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Feather name="user" size={28} color={colors.primary} />
              )}
            </View>
            <View style={styles.headerTextBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>{fullName || 'Пользователь'}</Text>
                <VerifiedBadge
                  isVerified={profile.is_verified}
                  organizerStatus={profile.organizer_status}
                />
              </View>
              {isOwnProfile && (subscribersCount !== null || subscriptionsCount !== null) ? (
                <Pressable
                  style={styles.countsRow}
                  onPress={() => router.push('/subscriptions' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть подписки"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  {subscribersCount !== null && (
                    <Text style={styles.countText}>
                      <Text style={styles.countNumber}>{subscribersCount}</Text>
                      {' '}{pluralizeRu(subscribersCount, ['подписчик', 'подписчика', 'подписчиков'])}
                    </Text>
                  )}
                  {subscribersCount !== null && subscriptionsCount !== null && (
                    <Text style={styles.countSeparator}> · </Text>
                  )}
                  {subscriptionsCount !== null && (
                    <Text style={styles.countText}>
                      <Text style={styles.countNumber}>{subscriptionsCount}</Text>
                      {' '}{pluralizeRu(subscriptionsCount, ['подписка', 'подписки', 'подписок'])}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.userSub}>Автор путешествий</Text>
              )}
              {profile.participant_rating && profile.participant_rating.count > 0 ? (
                <View style={styles.ratingRow}>
                  <StarRating
                    rating={profile.participant_rating.average}
                    ratingCount={profile.participant_rating.count}
                    size="small"
                    showValue
                    showCount
                    testID="participant-rating-aggregate"
                  />
                  <Text style={styles.ratingLabel}>как попутчик</Text>
                </View>
              ) : null}
            </View>
            {!isOwnProfile && userId ? (
              <UserSafetyMenu
                targetUserId={userId}
                targetName={fullName || undefined}
                reportedByMe={profile.reported_by_me}
                isBlockedByMe={profile.is_blocked_by_me}
              />
            ) : null}
          </View>

          <ProtectedContacts
            socials={socials.map((s) => ({ key: s.key, label: s.label, value: String(s.value) }))}
            isOwnProfile={isOwnProfile}
            contactsHidden={profile?.contacts_hidden}
            contactAccess={profile?.contact_access}
            targetUserId={userId}
          />

          {!isOwnProfile && socials.length > 0 && (
            <SafetyNotice storageKey="profile-contact-exchange" style={styles.safetyNotice} />
          )}

          <View style={styles.actionsRow}>
            <SubscribeButton targetUserId={userId} size="sm" />
            {!isOwnProfile && (
              <Pressable
                style={[styles.secondaryButton, globalFocusStyles.focusable]}
                onPress={handleWriteMessage}
                accessibilityRole="button"
                accessibilityLabel={`Написать ${fullName || 'пользователю'}`}
                {...Platform.select({ web: { cursor: 'pointer' } })}
              >
                <Feather name="mail" size={16} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Написать</Text>
              </Pressable>
            )}
            {!isOwnProfile && (
              <PeerBadgeGiveButton target="user" recipientId={userId} received={peerReceived} />
            )}
            <Pressable
              style={[styles.secondaryButton, globalFocusStyles.focusable]}
              onPress={handleViewTravels}
              accessibilityRole="button"
              accessibilityLabel="Смотреть все путешествия автора"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="map" size={16} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Все путешествия</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, globalFocusStyles.focusable]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Назад"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="arrow-left" size={16} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Назад</Text>
            </Pressable>
          </View>
        </View>

        {userId ? (
          <UserAchievementsSection userId={userId} style={styles.achievementsSection} />
        ) : null}

        {userId ? (
          <UserRareAwardsSection userId={userId} style={styles.achievementsSection} />
        ) : null}

        {userId ? (
          <AdminGrantRareAward
            recipientId={userId}
            recipientName={fullName || undefined}
            style={styles.achievementsSection}
          />
        ) : null}

        {userId ? (
          <GamificationProfileBlock userId={userId} style={styles.achievementsSection} />
        ) : null}

        <View style={styles.travelsSection}>
          <View style={styles.travelsHeader}>
            <Text style={styles.travelsTitle}>Путешествия автора</Text>
            {authorTravelsTotal > 0 && (
              <Text style={styles.travelsCount}>{authorTravelsTotal}</Text>
            )}
          </View>

          {authorTravelsQuery.isLoading ? (
            <View style={styles.travelsState}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : authorTravelsQuery.isError ? (
            <Text style={styles.travelsStateText}>
              Не удалось загрузить путешествия автора
            </Text>
          ) : authorTravels.length === 0 ? (
            <Text style={styles.travelsStateText}>
              У автора пока нет опубликованных путешествий
            </Text>
          ) : (
            <>
              <View style={styles.travelsGrid}>
                {authorTravels.map((travel, index) => {
                  const meta = [travel.cityName, travel.countryName]
                    .map((v) => String(v ?? '').trim())
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <View
                      key={String(travel.id ?? travel.slug ?? index)}
                      style={styles.travelsCardWrap}
                    >
                      <UnifiedTravelCard
                        title={travel.name?.trim() || 'Без названия'}
                        imageUrl={travel.travel_image_thumb_url || null}
                        metaText={meta || null}
                        onPress={() => handleOpenTravel(travel)}
                        mediaFit="contain"
                        heroTitleOverlay
                        contentPosition="belowMedia"
                        imageHeight={180}
                        webHoverScale={!isMobile}
                        mediaProps={{
                          placeholderBlurhash: AUTHOR_CARD_BLURHASH,
                          blurBackground: true,
                          allowCriticalWebBlur: Platform.OS === 'web',
                          recyclingKey: String(travel.slug || travel.id || index),
                          loading: Platform.OS === 'web' ? (index < 3 ? 'eager' : 'lazy') : 'lazy',
                          priority: Platform.OS === 'web' && index < 3 ? 'high' : 'low',
                        }}
                      />
                    </View>
                  );
                })}
              </View>

              {authorTravelsTotal > authorTravels.length && (
                <Pressable
                  style={[styles.viewAllButton, globalFocusStyles.focusable]}
                  onPress={handleViewTravels}
                  accessibilityRole="button"
                  accessibilityLabel="Смотреть все путешествия автора"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.viewAllButtonText}>
                    Смотреть все ({authorTravelsTotal})
                  </Text>
                  <Feather name="arrow-right" size={16} color={colors.primary} />
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mutedBackground,
  },
  scrollView: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.card } as any)
      : Platform.OS === 'android'
        ? { elevation: 2 }
        : colors.shadows.light),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerTextBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  userSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  countText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  countNumber: {
    fontWeight: '700',
    color: colors.text,
  },
  countSeparator: {
    fontSize: 13,
    color: colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  safetyNotice: {
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  achievementsSection: {
    marginTop: 16,
  },
  travelsSection: {
    marginTop: 20,
  },
  travelsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  travelsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  travelsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  travelsState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelsStateText: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: 24,
    textAlign: 'center',
  },
  travelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  travelsCardWrap: {
    flexGrow: 1,
    flexBasis: Platform.OS === 'web' ? 300 : '100%',
    maxWidth: Platform.OS === 'web' ? 460 : undefined,
    minWidth: 0,
  },
  viewAllButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  errorWrap: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
