import { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/Button';
import { useUserProfileCached } from '@/hooks/useUserProfileCached';
import { useThemedColors } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { mapProfileRank } from '@/api/user';
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
import { useHydrationReady } from '@/hooks/useHydrationReady';
import type { Travel } from '@/types/types';
import SubscriptionsTabContent from '@/components/subscriptions/SubscriptionsTabContent';
import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { translate as i18nT } from '@/i18n'


const AUTHOR_TRAVELS_LIMIT = 12;

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ id?: string }>();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isMobile } = useResponsive();
  const hydrationReady = useHydrationReady();

  const userId = useMemo(() => {
    if (!hydrationReady) return null;
    const raw = params?.id;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : null;
  }, [hydrationReady, params?.id]);

  const { profile, isLoading, error, fullName } = useUserProfileCached(userId, {
    enabled: !!userId,
  });
  const displayName = fullName || i18nT('profile:app.tabs.profile.defaultUserName');

  const [avatarError, setAvatarError] = useState(false);
  // Expo Router переиспользует инстанс при смене param — сбрасываем флаг ошибки
  // аватара, иначе 404 предыдущего профиля скрывал бы валидный аватар нового.
  useEffect(() => {
    setAvatarError(false);
  }, [userId, profile?.avatar]);

  const [activeTab, setActiveTab] = useState<ProfileTabKey>('travels');
  const [travelsLimit, setTravelsLimit] = useState(AUTHOR_TRAVELS_LIMIT);

  useEffect(() => {
    setActiveTab('travels');
    setTravelsLimit(AUTHOR_TRAVELS_LIMIT);
  }, [userId]);

  const socials = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: i18nT('auth:app.tabs.user.id.youtube_607e07f5'), value: profile.youtube },
            { key: 'instagram', label: i18nT('auth:app.tabs.user.id.instagram_2e202e54'), value: profile.instagram },
            { key: 'twitter', label: i18nT('auth:app.tabs.user.id.twitter_4a585f6e'), value: profile.twitter },
            { key: 'vk', label: i18nT('auth:app.tabs.user.id.vk_43635279'), value: profile.vk },
          ]
            .filter((s) => Boolean(String(s.value ?? '').trim()))
            .map((s) => ({ key: s.key, label: s.label, value: String(s.value) }))
        : [],
    [profile]
  );

  const { userId: currentUserId } = useAuth();
  // userId уже нормализован (Number→String); нормализуем currentUserId симметрично,
  // иначе разное форматирование (ведущие нули и т.п.) ломает own-profile UI.
  const isOwnProfile =
    currentUserId != null && userId != null && String(Number(currentUserId)) === userId;

  const {
    subscriptions,
    subscribers,
    authors,
    subscriptionsLoading,
    subscribersLoading,
    getFullName,
    handleUnsubscribe,
  } = useSubscriptionsData({
    enabled: isOwnProfile,
    includeAuthorTravels: isOwnProfile && activeTab === 'subscriptions',
  });

  const subscribersCount = subscribers.length;
  const subscriptionsCount = subscriptions.length;

  const userAchievementsQuery = useUserAchievements(userId);
  const peerReceived = userAchievementsQuery.data?.peerReceived ?? [];
  const badgesCount = userAchievementsQuery.data?.rank?.badgesCount ?? 0;
  // Ранг для шапки (#847): profile.rank_summary даёт первый пейнт без ожидания
  // achievements-запроса, затем сверяемся с achievements (тот же ранг с бэка).
  const profileRank = useMemo(() => mapProfileRank(profile), [profile]);
  const headerRank = userAchievementsQuery.data?.rank ?? profileRank;

  const authorTravelsQuery = useQuery<{ data: Travel[]; total: number }>({
    queryKey: [...queryKeys.userTravels(userId), travelsLimit],
    // F-14: публичная страница автора показывает только опубликованные маршруты
    // (как счётчик в профиле), без черновиков.
    queryFn: () => fetchTravels(0, travelsLimit, '', { user_id: userId, publish: 1, moderation: 1 }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
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

  const handleLoadMoreTravels = useCallback(() => {
    setTravelsLimit((current) => Math.min(current + AUTHOR_TRAVELS_LIMIT, authorTravelsTotal));
  }, [authorTravelsTotal]);

  const handleWriteMessage = useCallback(() => {
    if (!userId) return;
    router.push(routes.messages(userId));
  }, [router, userId]);

  const handleMessageUser = useCallback((messageUserId: number) => {
    router.push(`/messages?userId=${encodeURIComponent(messageUserId)}` as any);
  }, [router]);

  const handleOpenSubscribedTravel = useCallback((url: string) => {
    router.push(url as any);
  }, [router]);

  const handleOpenSubscribedProfile = useCallback((profileUserId: number) => {
    router.push(`/user/${profileUserId}` as any);
  }, [router]);

  const handleFindTravels = useCallback(() => {
    router.push('/search' as any);
  }, [router]);

  const handleChangeTab = useCallback((tab: ProfileTabKey) => setActiveTab(tab), []);

  // Таб «Уровень» без счётчика: badgesCount на нём читался как «Уровень 13»
  // и противоречил рангу в шапке («Ур.5»). Число достижений остаётся в пилюле.
  const tabCounts = useMemo<Partial<Record<ProfileTabKey, number>>>(
    () => ({
      travels: authorTravelsTotal,
      subscribers: subscribersCount,
      subscriptions: subscriptionsCount,
    }),
    [authorTravelsTotal, subscribersCount, subscriptionsCount]
  );

  const statPills = useMemo<ProfileStatPill[]>(() => {
    const pills: ProfileStatPill[] = [
      {
        key: 'travels',
        label: i18nT('auth:app.tabs.user.id.marshruty_30d765de'),
        value: authorTravelsTotal,
        icon: 'map',
        onPress: () => handleChangeTab('travels'),
        accessibilityHint: i18nT('auth:app.tabs.user.id.pokazat_opublikovannye_marshruty_avtora_863ec77c'),
      },
    ];

    if (isOwnProfile) {
      pills.push({
        key: 'subscribers',
        label: i18nT('auth:app.tabs.user.id.podpischiki_3e8b3c47'),
        value: subscribersCount,
        icon: 'users',
        onPress: () => handleChangeTab('subscribers'),
        accessibilityHint: i18nT('auth:app.tabs.user.id.pokazat_podpischikov_pod_shapkoy_profilya_399b3201'),
      });
    }

    pills.push({
      key: 'achievements',
      label: i18nT('auth:app.tabs.user.id.dostizheniya_6c995dc0'),
      value: badgesCount,
      icon: 'award',
      onPress: () => handleChangeTab('overview'),
      accessibilityHint: i18nT('auth:app.tabs.user.id.otkryt_obzor_s_dostizheniyami_73cc4a8a'),
    });

    return pills;
  }, [authorTravelsTotal, isOwnProfile, subscribersCount, badgesCount, handleChangeTab]);

  if (!hydrationReady || isLoading) {
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
          <Text style={styles.errorTitle}>{i18nT('auth:app.tabs.user.id.profil_nedostupen_59cc6751')}</Text>
          <Text style={styles.errorText}>
            {!userId
              ? i18nT('auth:app.tabs.user.id.nekorrektnyy_id_polzovatelya_ebab8a55')
              : (error as any)?.message || String(error || i18nT('profile:app.tabs.user.id.loadError'))}
          </Text>
          <Button
            label={i18nT('auth:app.tabs.user.id.nazad_84ede616')}
            onPress={() => router.back()}
            variant="secondary"
            size="sm"
            icon={<Feather name="arrow-left" size={16} color={colors.primaryDark} />}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isOverview = activeTab === 'overview';
  const isSubscriptionsSection = activeTab === 'subscriptions' || activeTab === 'subscribers';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isFocused && (
        <InstantSEO
          headKey={`user-${userId}`}
          title={`${displayName} | Metravel`}
          description={i18nT('auth:app.tabs.user.id.profil_avtora_value1_na_metravel_471497a1', { value1: fullName || '' })}
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
          >{`${displayName} | Metravel`}</h1>
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
        ) : isSubscriptionsSection && isOwnProfile ? (
          <SubscriptionsTabContent
            activeTab={activeTab}
            showTabBar={false}
            subscriptions={subscriptions}
            subscribers={subscribers}
            authors={authors}
            subscriptionsLoading={subscriptionsLoading}
            subscribersLoading={subscribersLoading}
            getFullName={getFullName}
            handleUnsubscribe={handleUnsubscribe}
            onMessage={handleMessageUser}
            onOpenTravel={handleOpenSubscribedTravel}
            onOpenProfile={handleOpenSubscribedProfile}
            onFindTravels={handleFindTravels}
          />
        ) : (
          <PublicProfileTravelsTab
            travels={authorTravels}
            total={authorTravelsTotal}
            isLoading={authorTravelsQuery.isLoading}
            isError={authorTravelsQuery.isError}
            isMobile={isMobile}
            onOpenTravel={handleOpenTravel}
            onLoadMore={handleLoadMoreTravels}
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
    },
  });
