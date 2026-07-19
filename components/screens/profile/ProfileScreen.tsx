// Страница профиля пользователя
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { type ProfileTabKey } from '@/components/profile/ProfileTabs';
import {
  type ProfileTravelEngagementMetricKey,
} from '@/components/profile/ProfileTravelEngagementSection'
import EmptyState from '@/components/ui/EmptyState';
import { useMyTravels } from '@/hooks/useMyTravels';
import type { Travel } from '@/types/types';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useProfileGrid } from '@/components/screens/profile/useProfileGrid';
import { ProfileHeaderSection } from '@/components/screens/profile/ProfileHeaderSection';
import { ProfileOverviewTab } from '@/components/screens/profile/ProfileOverviewTab';
import { ProfileStatsTab } from '@/components/screens/profile/ProfileStatsTab';
import { ProfileCountriesTab } from '@/components/screens/profile/ProfileCountriesTab';
import { ProfileWorldMapTab } from '@/components/screens/profile/ProfileWorldMapTab';
import { ProfileTravelListView } from '@/components/screens/profile/ProfileTravelListView';
import SubscriptionsTabContent from '@/components/subscriptions/SubscriptionsTabContent';
import { type ProfileHeaderActionKey } from '@/components/profile/ProfileHeaderQuickActions';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyAchievements } from '@/hooks/useAchievementsApi';
import { useUnreadCount } from '@/hooks/useMessages';
import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import BadgeUnlockToast from '@/components/achievements/BadgeUnlockToast';
import PlaceFirstBadgeToast from '@/components/achievements/PlaceFirstBadgeToast';
import { useResponsive } from '@/hooks/useResponsive';
import { buildLoginHref } from '@/utils/authNavigation';
import { confirmAction } from '@/utils/confirmAction';
import { rIC } from '@/utils/rIC';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { useUserProfile } from '@/hooks/useUserProfile';
import { mapProfileRank, normalizeProfileName } from '@/api/user';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getStorageBatch } from '@/utils/storageBatch';
import { hapticImpact } from '@/utils/haptics';
import { useTravelStatusStore } from '@/stores/travelStatusStore'
import { showToastMessage } from '@/utils/toast'
import { createProfileScreenStyles } from '@/components/screens/profile/profileScreen.styles';
import { useProfileTravelSections } from '@/components/screens/profile/useProfileTravelSections';
import {
  PROFILE_TRAVELS_PER_PAGE,
  type UserStats,
} from '@/components/screens/profile/profileScreen.helpers';
import { translate as i18nT } from '@/i18n'


const isProfileTravelTab = (tab: ProfileTabKey) => tab === 'travels' || tab === 'publishedTravels' || tab === 'draftTravels';

export default function ProfileScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { isAuthenticated, authReady, logout, userId, isSuperuser } = useAuth();
  const favoritesContext = useFavorites();
  const {
    favorites = [],
    viewHistory = [],
    clearFavorites,
    clearHistory,
  } = favoritesContext ?? { favorites: [], viewHistory: [], clearFavorites: undefined, clearHistory: undefined };
  const colors = useThemedColors();
  const insets = useSafeAreaInsets();
  const { isPhone, isLargePhone, isTablet, isDesktop, isPortrait, width } = useResponsive();

  const maxContentWidth = 1280;

  const {
    isDesktopWeb,
    isMobileDevice,
    isCardsSingleColumn,
    gapSize,
    contentPadding,
    gridColumns,
    contentPaddingBottom,
  } = useProfileGrid({
    width,
    isPhone,
    isLargePhone,
    isTablet,
    isDesktop,
    isPortrait,
    insets,
    maxContentWidth,
  });

  const { profile, setProfile, isLoading: profileLoading, fullName } = useUserProfile();
  const { pickAndUpload, isUploading: avatarUploading } = useAvatarUpload({
    onSuccess: (updated) => setProfile(updated),
  });

  const [userInfo, setUserInfo] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [stats, setStats] = useState<UserStats>({
    travelsCount: 0,
    favoritesCount: 0,
    viewsCount: 0,
  });
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('travels');
  const [worldMapGestureActive, setWorldMapGestureActive] = useState(false);
  const { data: myAchievements } = useMyAchievements({ enabled: activeTab === 'overview' });
  const badgesCount = myAchievements?.rank?.badgesCount ?? 0;
  // Ранг для шапки (#847): achievements грузится только на вкладке «Уровень», поэтому
  // на первый пейнт (вкладка «Маршруты») берём ранг из profile.rank_summary, чтобы
  // не показывать пустой статус; когда achievements подтянется — сверяемся с ним.
  const rank = useMemo(() => {
    const source = myAchievements?.rank ?? mapProfileRank(profile);
    return source ? { level: source.level, title: source.title } : null;
  }, [myAchievements?.rank, profile]);
  const { count: unreadMessagesCount } = useUnreadCount(isAuthenticated);
  const {
    subscriptions,
    subscribers,
    authors,
    subscriptionsLoading,
    subscribersLoading,
    getFullName,
    handleUnsubscribe,
  } = useSubscriptionsData({ includeAuthorTravels: activeTab === 'subscriptions' });
  const subscriptionsCount = subscriptions.length;
  const subscribersCount = subscribers.length;
  const [activeTravelMetric, setActiveTravelMetric] = useState<ProfileTravelEngagementMetricKey | null>(null);
  const lastEndReachedAtRef = useRef(0);
  const travelsRequestedRef = useRef(false);

  const handleTotalChange = useCallback((total: number) => {
    setStats((prev) => ({ ...prev, travelsCount: total }));
  }, []);

  const {
    myTravels,
    engagementSummary,
    isLoading: travelsLoading,
    isLoadingMore: travelsLoadingMore,
    removingTravelId,
    hasMore: travelsHasMore,
    load: loadTravels,
    loadMore: loadMoreTravelsHook,
    remove: removeMyTravel,
  } = useMyTravels({
    userId,
    perPage: PROFILE_TRAVELS_PER_PAGE,
    includeDrafts: true,
    onTotalChange: handleTotalChange,
  });
  const personalTravelStatusEntries = useTravelStatusStore((state) => state.entries)
  const loadPersonalTravelStatuses = useTravelStatusStore((state) => state.loadLocal)

  const ensureTravelsLoaded = useCallback(() => {
    if (travelsRequestedRef.current) return;
    // Wait for auth to resolve before committing the one-shot: a call with an
    // unresolved userId no-ops loadTravels into the empty state and would burn
    // the guard, leaving the list permanently empty when 'travels' is the
    // default tab (effect fires on mount, before userId is hydrated).
    if (!userId) return;
    travelsRequestedRef.current = true;
    void loadTravels();
  }, [loadTravels, userId]);

  const loadMoreTravels = useCallback(async () => {
    if (!isProfileTravelTab(activeTab)) return;
    await loadMoreTravelsHook();
  }, [activeTab, loadMoreTravelsHook]);

  const handleListEndReached = useCallback(() => {
    if (!isProfileTravelTab(activeTab)) return;
    if (travelsLoading || travelsLoadingMore || !travelsHasMore) return;
    if (myTravels.length === 0) return;

    const now = Date.now();
    if (now - lastEndReachedAtRef.current < 800) return;

    lastEndReachedAtRef.current = now;
    void loadMoreTravels();
  }, [activeTab, loadMoreTravels, myTravels.length, travelsHasMore, travelsLoading, travelsLoadingMore]);

  const handleWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isProfileTravelTab(activeTab)) return;

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const threshold = layoutMeasurement.height * 0.5;

    if (distanceFromEnd < threshold) {
      handleListEndReached();
    }
  }, [activeTab, handleListEndReached]);

  // Web: scroll-событие не возникает, если контент не заполняет вьюпорт. На широком
  // экране с малым числом путешествий (но hasMore) пользователь застрял бы на странице 1.
  // Авто-догружаем по onContentSizeChange, пока контент короче вьюпорта и есть hasMore.
  const webViewportHeightRef = useRef(0);
  const handleWebLayout = useCallback((event: LayoutChangeEvent) => {
    webViewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);
  const handleWebContentSizeChange = useCallback((_contentWidth: number, contentHeight: number) => {
    if (!isProfileTravelTab(activeTab)) return;
    const viewport = webViewportHeightRef.current;
    if (viewport > 0 && contentHeight <= viewport + 4) {
      // handleListEndReached сам гардит hasMore/loading/throttle.
      handleListEndReached();
    }
  }, [activeTab, handleListEndReached]);

  const loadUserInfo = useCallback(async () => {
    try {
      const storageData = await getStorageBatch(['userName', 'userEmail']);
      setUserInfo({ name: storageData.userName || '', email: storageData.userEmail || '' });
    } catch {
      // storage read is non-critical
    }
  }, []);

  // AND-14: Pull-to-Refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    hapticImpact('light');
    setRefreshing(true);
    travelsRequestedRef.current = true;
    try {
      await Promise.all([loadTravels(), loadUserInfo()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTravels, loadUserInfo]);

  const handleDeleteMyTravel = removeMyTravel;

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      favoritesCount: favorites.length,
      viewsCount: viewHistory.length,
    }));
  }, [favorites.length, viewHistory.length]);

  useEffect(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // Список путешествий не нужен для первого рендера (шапка + вкладка «Уровень»
  // строятся из профиля/кэша). Дёргаем его отложенно — после первого кадра —
  // чтобы счётчик «Маршруты» в шапке заполнился без блокировки экрана.
  useEffect(() => {
    const cancel = rIC(ensureTravelsLoaded, 400);
    return cancel;
  }, [ensureTravelsLoaded]);

  // Если пользователь открыл вкладку, которой реально нужен список/метрики,
  // загружаем немедленно (не ждём idle).
  useEffect(() => {
    if (isProfileTravelTab(activeTab) || activeTab === 'stats' || activeTab === 'countries' || activeTab === 'worldmap' || activeTravelMetric) {
      ensureTravelsLoaded();
    }
  }, [activeTab, activeTravelMetric, ensureTravelsLoaded]);

  useEffect(() => {
    if (!isAuthenticated) return
    void loadPersonalTravelStatuses(userId ?? null)
  }, [isAuthenticated, loadPersonalTravelStatuses, userId])

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, router]);

  const {
    authoredTravelEngagementScope,
    authoredTravelEngagementSummary,
    currentData,
    draftTravels,
    emptyStateProps,
    formatTripsCount,
    personalTravelStatusSummary,
    profileTravels,
    publishedTravels,
  } = useProfileTravelSections({
    activeTab,
    setActiveTab,
    activeTravelMetric,
    setActiveTravelMetric,
    favorites,
    viewHistory,
    myTravels,
    engagementSummary,
    travelsCount: stats.travelsCount,
    travelsLoading,
    travelsLoadingMore,
    travelsHasMore,
    loadMoreTravels: loadMoreTravelsHook,
    personalTravelStatusEntries,
  });

  const handleTravelMetricPress = useCallback((metric: ProfileTravelEngagementMetricKey) => {
    setActiveTab('travels');
    setActiveTravelMetric((current) => (current === metric ? null : metric));
  }, []);

  const handleProfileTabChange = useCallback((tab: ProfileTabKey) => {
    setActiveTravelMetric(null);
    setWorldMapGestureActive(false);
    setActiveTab(tab);
  }, []);

  const handleWorldMapGestureActiveChange = useCallback((active: boolean) => {
    setWorldMapGestureActive(active);
  }, []);

  const safeStoredUserName = useMemo(() => normalizeProfileName(userInfo.name), [userInfo.name]);
  const displayName = useMemo(
    () => (fullName || safeStoredUserName || i18nT('profile:app.tabs.profile.defaultUserName')).trim(),
    [fullName, safeStoredUserName],
  );
  const hasDisplayName = Boolean(fullName?.trim() || safeStoredUserName);

  const handleHeaderAction = useCallback((key: ProfileHeaderActionKey) => {
    if (key === 'messages') router.push('/messages');
    else if (key === 'trips') router.push('/trips/my' as any);
    else if (key === 'userpoints') router.push({ pathname: '/userpoints', params: { from: 'profile' } } as any);
    else if (key === 'calendar') router.push('/calendar' as any);
    else if (key === 'newTravel') router.push('/travel/new' as any);
  }, [router]);

  const handleEdit = useCallback(() => router.push('/settings'), [router]);

  const handleClearActiveTab = useCallback(async () => {
    try {
      if (activeTab === 'favorites') {
        const ok = await confirmAction({
          title: i18nT('profile:app.tabs.profile.ochistit_hochu_poehat_de703e72'),
          message: i18nT('profile:app.tabs.profile.udalit_vse_marshruty_iz_hochu_poehat_a5c1de2c'),
          confirmText: i18nT('profile:app.tabs.profile.ochistit_ef7ce3e3'),
          cancelText: i18nT('profile:app.tabs.profile.otmena_0e762c35'),
        });
        if (!ok) return;
        await clearFavorites?.();
        void showToastMessage({ type: 'success', text1: i18nT('profile:app.tabs.profile.hochu_poehat_ochischen_dbb99267') })
        return;
      }

      if (activeTab === 'history') {
        const ok = await confirmAction({
          title: i18nT('profile:app.tabs.profile.ochistit_istoriyu_ce6a05b3'),
          message: i18nT('profile:app.tabs.profile.udalit_vsyu_istoriyu_prosmotrov_50f5efeb'),
          confirmText: i18nT('profile:app.tabs.profile.ochistit_ef7ce3e3'),
          cancelText: i18nT('profile:app.tabs.profile.otmena_0e762c35'),
        });
        if (!ok) return;
        await clearHistory?.();
        void showToastMessage({ type: 'success', text1: i18nT('profile:app.tabs.profile.istoriya_ochischena_7ccc2d99') })
      }
    } catch (error) {
      void showToastMessage({
        type: 'error',
        text1: i18nT('profile:app.tabs.profile.ne_udalos_ochistit_spisok_3c989153'),
        text2: error instanceof Error ? error.message : i18nT('profile:app.tabs.profile.poprobuyte_pozzhe_ada0c782'),
      })
      console.error('Error clearing profile tab data:', error);
    }
  }, [activeTab, clearFavorites, clearHistory]);

  const styles = useMemo(
    () => createProfileScreenStyles({ colors, contentPadding, gapSize, isDesktopWeb, maxContentWidth }),
    [colors, contentPadding, gapSize, isDesktopWeb, maxContentWidth],
  );
  const profileLoginActionStyle = useMemo(
    () => ({
      backgroundColor: colors.brand,
      ...(Platform.OS === 'web'
        ? {
            backgroundImage: 'none',
            boxShadow: `0 4px 16px ${colors.brandAlpha40}`,
          }
        : null),
    }) as ViewStyle,
    [colors.brand, colors.brandAlpha40],
  );

  const tabCounts = useMemo(() => ({
    overview: badgesCount,
    travels: stats.travelsCount,
    publishedTravels: publishedTravels.length,
    draftTravels: draftTravels.length,
    subscribers: subscribersCount,
    subscriptions: subscriptionsCount,
    favorites: stats.favoritesCount,
    history: stats.viewsCount,
  }), [
    badgesCount,
    draftTravels.length,
    publishedTravels.length,
    stats.travelsCount,
    subscribersCount,
    subscriptionsCount,
    stats.favoritesCount,
    stats.viewsCount,
  ]);

  const userProp = useMemo(() => ({
    name: displayName,
    email: userInfo.email,
    avatar: profile?.avatar,
    hasDisplayName,
  }), [displayName, userInfo.email, profile?.avatar, hasDisplayName]);

  const showClearButton = (activeTab === 'favorites' || activeTab === 'history') && currentData.length > 0;

  const handleOpenCalendar = useCallback((status?: 'visited' | 'wishlist' | 'planned') => {
    // Строковая форма href надёжно навигирует к скрытому tab-роуту; object-form с
    // params не срабатывал из вкладки профиля (#589 — плитки «Были/Хочу/Планирую»).
    router.push((status ? `/calendar?status=${status}` : '/calendar') as any)
  }, [router]);

  const handleCreateFirstRoute = useCallback(() => {
    router.push('/travel/new' as any)
  }, [router])

  const handleStartFirstQuest = useCallback(() => {
    router.push('/quests' as any)
  }, [router])

  const handleMessageUser = useCallback((messageUserId: number) => {
    router.push(`/messages?userId=${encodeURIComponent(messageUserId)}` as any)
  }, [router])

  const handleOpenSubscribedTravel = useCallback((url: string) => {
    router.push(url as any)
  }, [router])

  const handleOpenSubscribedProfile = useCallback((profileUserId: number) => {
    router.push(`/user/${profileUserId}` as any)
  }, [router])

  const handleFindTravels = useCallback(() => {
    router.push('/search' as any)
  }, [router])

  const Header = useMemo(
    () => (
      <ProfileHeaderSection
        styles={styles}
        profileLoading={profileLoading}
        userProp={userProp}
        profile={profile}
        rank={rank}
        unreadMessagesCount={unreadMessagesCount}
        handleEdit={handleEdit}
        handleLogout={handleLogout}
        pickAndUpload={pickAndUpload}
        avatarUploading={avatarUploading}
        handleHeaderAction={handleHeaderAction}
        onRankPress={() => handleProfileTabChange('overview')}
        activeTab={activeTab}
        handleProfileTabChange={handleProfileTabChange}
        tabCounts={tabCounts}
        showClearButton={showClearButton}
        handleClearActiveTab={handleClearActiveTab}
      />
    ),
    [
      styles,
      profileLoading,
      userProp,
      profile,
      rank,
      unreadMessagesCount,
      handleEdit,
      handleLogout,
      pickAndUpload,
      avatarUploading,
      handleHeaderAction,
      tabCounts,
      activeTab,
      showClearButton,
      handleClearActiveTab,
      handleProfileTabChange,
    ]
  );

  const overviewContent = useMemo(
    () => (
      <ProfileOverviewTab
        userProp={userProp}
        profile={profile}
        travelsCount={stats.travelsCount}
        userId={userId}
        onCreateRoute={handleCreateFirstRoute}
        onStartQuest={handleStartFirstQuest}
      />
    ),
    [
      userProp,
      profile,
      stats.travelsCount,
      userId,
      handleCreateFirstRoute,
      handleStartFirstQuest,
    ]
  );

  const statsContent = useMemo(
    () => (
      <ProfileStatsTab
        travelsCount={stats.travelsCount}
        loadedTravelsCount={profileTravels.length}
        travelsLoading={travelsLoading}
        authoredTravelEngagementSummary={authoredTravelEngagementSummary}
        authoredTravelEngagementScope={authoredTravelEngagementScope}
        activeTravelMetric={activeTravelMetric}
        handleTravelMetricPress={handleTravelMetricPress}
        personalTravelStatusSummary={personalTravelStatusSummary}
        formatTripsCount={formatTripsCount}
        onOpenCalendar={handleOpenCalendar}
        onBackToOverview={() => handleProfileTabChange('overview')}
      />
    ),
    [
      stats.travelsCount,
      profileTravels.length,
      travelsLoading,
      authoredTravelEngagementSummary,
      authoredTravelEngagementScope,
      activeTravelMetric,
      handleTravelMetricPress,
      personalTravelStatusSummary,
      formatTripsCount,
      handleOpenCalendar,
      handleProfileTabChange,
    ]
  );

  const countriesContent = useMemo(
    () => (
      <ProfileCountriesTab
        userId={userId}
        travels={profileTravels}
        personalTravelStatusEntries={personalTravelStatusEntries}
        travelsSyncing={travelsLoading || travelsLoadingMore || travelsHasMore}
        loadedTravelsCount={profileTravels.length}
        totalTravelsCount={stats.travelsCount}
        onBackToOverview={() => handleProfileTabChange('overview')}
      />
    ),
    [
      profileTravels,
      personalTravelStatusEntries,
      userId,
      travelsLoading,
      travelsLoadingMore,
      travelsHasMore,
      stats.travelsCount,
      handleProfileTabChange,
    ]
  );

  const worldmapContent = useMemo(
    () => (
      <ProfileWorldMapTab
        userId={userId}
        travels={profileTravels}
        personalTravelStatusEntries={personalTravelStatusEntries}
        onBackToOverview={() => handleProfileTabChange('overview')}
        onMapGestureActiveChange={handleWorldMapGestureActiveChange}
      />
    ),
    [
      userId,
      profileTravels,
      personalTravelStatusEntries,
      handleProfileTabChange,
      handleWorldMapGestureActiveChange,
    ]
  );

  const subscriptionsContent = useMemo(() => {
    if (activeTab !== 'subscriptions' && activeTab !== 'subscribers') return null;

    return (
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
    );
  }, [
    activeTab,
    authors,
    getFullName,
    handleFindTravels,
    handleMessageUser,
    handleOpenSubscribedProfile,
    handleOpenSubscribedTravel,
    handleUnsubscribe,
    subscribers,
    subscribersLoading,
    subscriptions,
    subscriptionsLoading,
  ]);

  const isOverview = activeTab === 'overview';
  const isStats = activeTab === 'stats';
  const isCountries = activeTab === 'countries';
  const isWorldmap = activeTab === 'worldmap';
  const isSubscriptionsSection = activeTab === 'subscriptions' || activeTab === 'subscribers';
  const isSectionTab = isOverview || isStats || isCountries || isWorldmap || isSubscriptionsSection;

  const ListHeader = useMemo(
    () => (
      <>
        {Header}
        {isOverview ? overviewContent : null}
        {isStats ? statsContent : null}
        {isCountries ? countriesContent : null}
        {isWorldmap ? worldmapContent : null}
        {subscriptionsContent}
      </>
    ),
    [
      Header,
      countriesContent,
      worldmapContent,
      isCountries,
      isWorldmap,
      isOverview,
      isStats,
      overviewContent,
      statsContent,
      subscriptionsContent,
    ],
  );

  const renderItem = useCallback(({ item, index }: { item: Travel; index: number }) => (
    <RenderTravelItem
      item={item}
      index={index}
      isMobile={isMobileDevice}
      isFirst={index === 0}
      currentUserId={userId}
      isSuperuser={isSuperuser}
      onDeletePress={isProfileTravelTab(activeTab) ? handleDeleteMyTravel : undefined}
      viewportWidth={width}
      isDeleting={removingTravelId === item.id}
    />
  ), [isMobileDevice, userId, isSuperuser, activeTab, handleDeleteMyTravel, removingTravelId, width]);

  const ListSkeleton = useMemo(() => (
    <View style={styles.skeletonListWrap}>
      <SkeletonLoader width="100%" height={200} borderRadius={12} />
      <SkeletonLoader width="100%" height={200} borderRadius={12} />
    </View>
  ), [styles.skeletonListWrap]);

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <EmptyState
          icon="user"
          title={i18nT('profile:app.tabs.profile.voydite_v_akkaunt_eba2a87d')}
          description={i18nT('profile:app.tabs.profile.voydite_chtoby_otkryt_profil_i_upravlyat_svo_d7506777')}
          action={{
            label: i18nT('profile:app.tabs.profile.voyti_bf809d29'),
            onPress: () => router.push(buildLoginHref({ redirect: '/profile', intent: 'profile' }) as any),
            style: profileLoginActionStyle,
          }}
        />
      </SafeAreaView>
    );
  }

  const isTravelsTabLoading = isProfileTravelTab(activeTab) && travelsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isFocused && (
        <InstantSEO
          headKey="profile"
          title={i18nT('profile:app.tabs.profile.profil_metravel_dd9708d4')}
          description={i18nT('profile:app.tabs.profile.profil_polzovatelya_6c2e4229')}
          canonical={buildCanonicalUrl('/profile')}
          robots="noindex, nofollow"
        />
      )}
      <ProfileTravelListView
        styles={styles}
        colors={colors}
        contentPaddingBottom={contentPaddingBottom}
        listHeader={ListHeader}
        listSkeleton={ListSkeleton}
        emptyStateProps={emptyStateProps}
        currentData={currentData}
        isSectionTab={isSectionTab}
        isTravelsTabLoading={isTravelsTabLoading}
        activeTab={activeTab}
        travelsLoadingMore={travelsLoadingMore}
        isCardsSingleColumn={isCardsSingleColumn}
        gridColumns={gridColumns}
        gapSize={gapSize}
        isMobileDevice={isMobileDevice}
        userId={userId}
        isSuperuser={isSuperuser}
        handleDeleteMyTravel={handleDeleteMyTravel}
        width={width}
        removingTravelId={removingTravelId}
        handleWebScroll={handleWebScroll}
        handleWebLayout={handleWebLayout}
        handleWebContentSizeChange={handleWebContentSizeChange}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        worldMapGestureActive={worldMapGestureActive}
        handleListEndReached={handleListEndReached}
      />
      <BadgeUnlockToast enabled={activeTab === 'overview'} />
      <PlaceFirstBadgeToast enabled={activeTab === 'overview'} />
    </SafeAreaView>
  );
}
