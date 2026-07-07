import { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useUserProfileCached } from '@/hooks/useUserProfileCached';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { fetchMySubscriptions, fetchMySubscribers, mapProfileRank, type UserProfileDto } from '@/api/user';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/queryKeys';
import { webTouchScrollStyle } from '@/utils';
import { routes } from '@/utils/routes';
import { fetchTravels } from '@/api/travelListQueries';
import { resolveTravelUrl } from '@/utils/subscriptionsHelpers';
import { type ProfileTabKey } from '@/components/profile/ProfileTabs';
import { type ProfileStatPill } from '@/components/profile/ProfileStatPills';
import { PublicProfileHeader } from '@/components/screens/profile/PublicProfileHeader';
import { PublicProfileOverviewTab } from '@/components/screens/profile/PublicProfileOverviewTab';
import { PublicProfileTravelsTab } from '@/components/screens/profile/PublicProfileTravelsTab';
import { useUserAchievements } from '@/hooks/useAchievementsApi';
import { useResponsive } from '@/hooks/useResponsive';
import type { Travel } from '@/types/types';

const AUTHOR_TRAVELS_LIMIT = 12;

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ id?: string }>();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isMobile } = useResponsive();

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

  const [activeTab, setActiveTab] = useState<ProfileTabKey>('travels');

  const socials = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: 'YouTube', value: profile.youtube },
            { key: 'instagram', label: 'Instagram', value: profile.instagram },
            { key: 'twitter', label: 'Twitter', value: profile.twitter },
            { key: 'vk', label: 'VK', value: profile.vk },
          ]
            .filter((s) => Boolean(String(s.value ?? '').trim()))
            .map((s) => ({ key: s.key, label: s.label, value: String(s.value) }))
        : [],
    [profile]
  );

  const { isAuthenticated, userId: currentUserId } = useAuth();
  // userId уже нормализован (Number→String); нормализуем currentUserId симметрично,
  // иначе разное форматирование (ведущие нули и т.п.) ломает own-profile UI.
  const isOwnProfile =
    currentUserId != null && userId != null && String(Number(currentUserId)) === userId;

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

  const subscribersCount = subscribersQuery.data?.length ?? null;
  const subscriptionsCount = subscriptionsQuery.data?.length ?? null;

  const userAchievementsQuery = useUserAchievements(userId);
  const peerReceived = userAchievementsQuery.data?.peerReceived ?? [];
  const badgesCount = userAchievementsQuery.data?.rank?.badgesCount ?? 0;
  // Ранг для шапки (#847): profile.rank_summary даёт первый пейнт без ожидания
  // achievements-запроса, затем сверяемся с achievements (тот же ранг с бэка).
  const profileRank = useMemo(() => mapProfileRank(profile), [profile]);
  const headerRank = userAchievementsQuery.data?.rank ?? profileRank;

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

  const handleChangeTab = useCallback((tab: ProfileTabKey) => setActiveTab(tab), []);

  const tabCounts = useMemo<Partial<Record<ProfileTabKey, number>>>(
    () => ({ travels: authorTravelsTotal }),
    [authorTravelsTotal]
  );

  const statPills = useMemo<ProfileStatPill[]>(() => {
    const pills: ProfileStatPill[] = [
      {
        key: 'travels',
        label: 'Маршруты',
        value: authorTravelsTotal,
        icon: 'map',
        onPress: () => handleChangeTab('travels'),
        accessibilityHint: 'Показать опубликованные маршруты автора',
      },
    ];

    if (isOwnProfile) {
      pills.push({
        key: 'subscribers',
        label: 'Подписчики',
        value: subscribersCount ?? subscriptionsCount ?? 0,
        icon: 'users',
        onPress: () => router.push('/subscriptions' as any),
        accessibilityHint: 'Перейти к подпискам и подписчикам',
      });
    }

    pills.push({
      key: 'achievements',
      label: 'Достижения',
      value: badgesCount,
      icon: 'award',
      onPress: () => handleChangeTab('overview'),
      accessibilityHint: 'Открыть обзор с достижениями',
    });

    return pills;
  }, [authorTravelsTotal, isOwnProfile, subscribersCount, subscriptionsCount, badgesCount, handleChangeTab, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId || error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Профиль недоступен</Text>
          <Text style={styles.errorText}>
            {!userId
              ? 'Некорректный id пользователя'
              : (error as any)?.message || String(error || 'Не удалось загрузить данные профиля')}
          </Text>
          <Pressable
            style={[styles.backButton, globalFocusStyles.focusable]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            {...Platform.select({ web: { cursor: 'pointer' } })}
          >
            <Feather name="arrow-left" size={16} color={colors.primaryDark} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOverview = activeTab === 'overview';

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
          <h1
            style={
              {
                position: 'absolute' as const,
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden' as const,
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                borderWidth: 0,
              } as any
            }
          >{`${fullName || 'Пользователь'} | Metravel`}</h1>
        )}

        <PublicProfileHeader
          userId={userId}
          fullName={fullName || ''}
          profile={profile}
          avatarError={avatarError}
          onAvatarError={() => setAvatarError(true)}
          isOwnProfile={isOwnProfile}
          socials={socials}
          peerReceived={peerReceived}
          rank={headerRank}
          statPills={statPills}
          activeTab={activeTab}
          onChangeTab={handleChangeTab}
          tabCounts={tabCounts}
          onWriteMessage={handleWriteMessage}
        />

        {isOverview ? (
          <PublicProfileOverviewTab userId={userId} fullName={fullName || ''} isOwnProfile={isOwnProfile} />
        ) : (
          <PublicProfileTravelsTab
            travels={authorTravels}
            total={authorTravelsTotal}
            isLoading={authorTravelsQuery.isLoading}
            isError={authorTravelsQuery.isError}
            isMobile={isMobile}
            onOpenTravel={handleOpenTravel}
            onViewAll={handleViewTravels}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      paddingBottom: 24,
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
      color: colors.primaryText,
    },
  });
