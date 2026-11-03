// Страница профиля пользователя
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import GuestAccountPrompt from '@/components/auth/GuestAccountPrompt';
import {
  View,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { type ProfileTabKey } from '@/components/profile/ProfileTabs';
import {
  type ProfileTravelEngagementMetricKey,
} from '@/components/profile/ProfileTravelEngagementSection'
import { ProfileEngagementDetailList } from '@/components/profile/ProfileEngagementDetailList';
import { resolveAuthorEngagementMetric } from '@/api/authorEngagement';
import { useAuthorEngagementDetails } from '@/hooks/useAuthorEngagementDetails';
import { useMyTravels } from '@/hooks/useMyTravels';
import type { Travel } from '@/types/types';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { resolveListFeedbackSlots } from '@/components/travel/TravelModerationFeedback';
import { useProfileGrid } from '@/components/screens/profile/useProfileGrid';
import { ProfileHeaderSection } from '@/components/screens/profile/ProfileHeaderSection';
import { ProfileOverviewTab } from '@/components/screens/profile/ProfileOverviewTab';
import { ProfileStatsTab } from '@/components/screens/profile/ProfileStatsTab';
import { useCountryProgressStats } from '@/hooks/useCountryProgressStats';
import { ProfileCountriesTab } from '@/components/screens/profile/ProfileCountriesTab';
import { ProfileWorldMapTab } from '@/components/screens/profile/ProfileWorldMapTab';
import { ProfileTravelListView } from '@/components/screens/profile/ProfileTravelListView';
import SubscriptionsTabContent from '@/components/subscriptions/SubscriptionsTabContent';
import { type ProfileHeaderActionKey } from '@/components/profile/ProfileHeaderQuickActions';
import { asBottomDimension } from '@/components/layout/bottomChromeInset';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyAchievements } from '@/hooks/useAchievementsApi';
import { useUnreadCount } from '@/hooks/useMessages';
import { useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import BadgeUnlockToast from '@/components/achievements/BadgeUnlockToast';
import PlaceFirstBadgeToast from '@/components/achievements/PlaceFirstBadgeToast';
import { useResponsive } from '@/hooks/useResponsive';
import { confirmAction } from '@/utils/confirmAction';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { useUserProfile } from '@/hooks/useUserProfile';
import { mapProfileRank, normalizeProfileName } from '@/api/user';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getStorageBatch } from '@/utils/storageBatch';
import { hapticImpact } from '@/utils/haptics';
import { useTravelStatus, loadTravelStatus } from '@/stores/travelStatusStore'
import { showToastMessage } from '@/utils/toast'
import { createProfileScreenStyles } from '@/components/screens/profile/profileScreen.styles';
import { useProfileTravelSections } from '@/components/screens/profile/useProfileTravelSections';
import { useProfileTravelTabList } from '@/components/screens/profile/useProfileTravelTabList';
import { ownerProfileTabCounters, resolveProfileTabCounts, useProfileTravelCountState } from '@/components/screens/profile/profileTabCounts';
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
    maxContentWidth,
  });

  const { profile, profileDataUpdatedAt, setProfile, isLoading: profileLoading, loadProfile, fullName } = useUserProfile();
  const { pickAndUpload, isUploading: avatarUploading } = useAvatarUpload({
    onSuccess: (updated) => setProfile(updated, ['avatar']),
  });

  const [userInfo, setUserInfo] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const owner = isAuthenticated ? userId ?? null : null;
  const initialTabCounts = ownerProfileTabCounters(profile, owner);
  const needsLegacyCounts = Boolean(owner && !profileLoading && !initialTabCounts);
  const { liveTravelsCount, onTotalChange: handleTotalChange } = useProfileTravelCountState(owner);
  const [collectionStats, setCollectionStats] = useState<Omit<UserStats, 'travelsCount'>>({
    favoritesCount: 0,
    viewsCount: 0,
  });
  const stats = useMemo<UserStats>(() => ({
    ...collectionStats,
    travelsCount: initialTabCounts?.travels ?? liveTravelsCount ?? null,
  }), [collectionStats, initialTabCounts?.travels, liveTravelsCount]);
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
  // Таб-навигатор держит экран профиля смонтированным после первого визита
  // (`lazy: true` + `freezeOnBlur: false` в app/(tabs)/_layout.tsx), поэтому
  // опрос без гейта по фокусу продолжал дёргать /api/message-threads/ каждые
  // 30 с на любой другой странице. Поллим только пока профиль на экране.
  const { count: unreadMessagesCount } = useUnreadCount(isAuthenticated, isFocused);
  const {
    subscriptions,
    subscribers,
    authors,
    subscriptionsLoading,
    subscribersLoading,
    subscriptionsCount,
    subscribersCount,
    subscriptionsDataUpdatedAt,
    subscribersDataUpdatedAt,
    getFullName,
    handleUnsubscribe,
  } = useSubscriptionsData({
    includeAuthorTravels: activeTab === 'subscriptions',
    readSubscriptions: activeTab === 'subscriptions' || needsLegacyCounts,
    readSubscribers: activeTab === 'subscribers' || needsLegacyCounts,
  });
  const [activeTravelMetric, setActiveTravelMetric] = useState<ProfileTravelEngagementMetricKey | null>(null);
  const lastEndReachedAtRef = useRef(0);
  const travelsRequestedRef = useRef<string | null>(null);
  const requestedOwnerRef = useRef(owner);
  if (requestedOwnerRef.current !== owner) {
    requestedOwnerRef.current = owner;
    travelsRequestedRef.current = null;
  }

  const allTravels = useMyTravels({
    userId,
    perPage: PROFILE_TRAVELS_PER_PAGE,
    includeDrafts: true,
    probeDraftsCount: !initialTabCounts,
    onTotalChange: handleTotalChange,
  });
  const {
    myTravels,
    engagementSummary,
    publicationCounts,
    publicationCountsUnavailable,
    isLoading: travelsLoading,
    isLoadingMore: travelsLoadingMore,
    hasMore: travelsHasMore,
    error: allTravelsError,
    load: loadTravels,
    loadMore: loadMoreTravelsHook,
  } = allTravels;
  // Контент обеих вкладок использует только подтверждённый счётчик.
  const confirmedTravelsCount = initialTabCounts?.travels ?? (travelsLoading ? null : stats.travelsCount);
  const personalTravelStatusEntries = useTravelStatus();
  const showsCountryProgress = activeTab === 'countries' || activeTab === 'worldmap';
  const countryProgress = useCountryProgressStats({
    userId: owner,
    enabled: showsCountryProgress,
    travels: myTravels,
    personalTravelStatusEntries,
  });
  const { refetch: refetchCountryProgress, shouldLoadFallbackCatalog } = countryProgress;
  const needsAllTravels = activeTab === 'travels' || activeTab === 'stats' ||
    shouldLoadFallbackCatalog || activeTravelMetric !== null;
  const refreshVisitedTravels = useCallback(() => {
    if (needsLegacyCounts || travelsRequestedRef.current === owner) void loadTravels();
  }, [needsLegacyCounts, loadTravels, owner]);
  // Вкладки «Опубл.» и «Черновики» читают свой срез с сервера (#1833), остальные —
  // общий список автора. Дальше экран работает с уже выбранным источником.
  const travelList = useProfileTravelTabList({
    activeTab,
    userId,
    perPage: PROFILE_TRAVELS_PER_PAGE,
    allTravels,
    onAfterRemove: refreshVisitedTravels,
  });

  const ensureTravelsLoaded = useCallback(() => {
    if (travelsRequestedRef.current === owner) return;
    // Wait for auth to resolve before committing the one-shot: a call with an
    // unresolved userId no-ops loadTravels into the empty state and would burn
    // the guard, leaving the list permanently empty when 'travels' is the
    // default tab (effect fires on mount, before userId is hydrated).
    if (!owner) return;
    travelsRequestedRef.current = owner;
    void loadTravels();
  }, [loadTravels, owner]);

  // Ретрай после сбоя идёт мимо one-shot guard: сам guard уже сожжён неудачной
  // попыткой, и без этого кнопка «Повторить» была бы декоративной.
  const reloadActiveTravelList = travelList.reload;
  const isFilteredTravelList = travelList.isFiltered;
  const handleRetryTravels = useCallback(() => {
    void reloadActiveTravelList();
    // Счётчики профиля считает общий список, а не срез вкладки: без этого
    // «Повторить» возвращало бы маршруты, оставляя цифры недоступными до
    // pull-to-refresh (#1865).
    if (needsLegacyCounts && isFilteredTravelList && allTravelsError) void loadTravels();
  }, [allTravelsError, isFilteredTravelList, loadTravels, needsLegacyCounts, reloadActiveTravelList]);

  const loadMoreActiveTravelList = travelList.loadMore;
  const loadMoreTravels = useCallback(async () => {
    if (!isProfileTravelTab(activeTab)) return;
    await loadMoreActiveTravelList();
  }, [activeTab, loadMoreActiveTravelList]);

  const listTravelsCount = travelList.travels.length;
  const listLoading = travelList.isLoading;
  const listLoadingMore = travelList.isLoadingMore;
  const listHasMore = travelList.hasMore;
  const handleListEndReached = useCallback(() => {
    if (!isProfileTravelTab(activeTab)) return;
    if (listLoading || listLoadingMore || !listHasMore) return;
    if (listTravelsCount === 0) return;

    const now = Date.now();
    if (now - lastEndReachedAtRef.current < 800) return;

    lastEndReachedAtRef.current = now;
    void loadMoreTravels();
  }, [activeTab, listHasMore, listLoading, listLoadingMore, listTravelsCount, loadMoreTravels]);

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
    try {
      if (needsAllTravels || needsLegacyCounts) travelsRequestedRef.current = owner;
      await Promise.all([
        loadProfile(),
        loadUserInfo(),
        ...(showsCountryProgress && owner ? [refetchCountryProgress()] : []),
        ...(isProfileTravelTab(activeTab) ? [reloadActiveTravelList()] : []),
        ...((needsAllTravels || needsLegacyCounts) && activeTab !== 'travels' ? [loadTravels()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, loadProfile, loadTravels, loadUserInfo, needsAllTravels, needsLegacyCounts, owner, refetchCountryProgress, reloadActiveTravelList, showsCountryProgress]);

  const handleDeleteMyTravel = travelList.remove;

  useEffect(() => {
    setCollectionStats({
      favoritesCount: favorites.length,
      viewsCount: viewHistory.length,
    });
  }, [favorites.length, viewHistory.length]);

  useEffect(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  useEffect(() => {
    if (!profileLoading && (needsAllTravels || needsLegacyCounts)) {
      ensureTravelsLoaded();
    }
  }, [ensureTravelsLoaded, needsAllTravels, needsLegacyCounts, profileLoading]);

  const showsTravelStats = activeTab === 'stats';
  useEffect(() => {
    if (!owner || (!showsTravelStats && !shouldLoadFallbackCatalog)) return;
    void loadTravelStatus(owner);
  }, [owner, shouldLoadFallbackCatalog, showsTravelStats]);

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
    draftTravelsCount,
    emptyStateProps,
    formatTripsCount,
    personalTravelStatusSummary,
    profileTravels,
    publishedTravelsCount,
  } = useProfileTravelSections({
    activeTab,
    setActiveTab,
    activeTravelMetric,
    setActiveTravelMetric,
    favorites,
    viewHistory,
    myTravels,
    statusTabTravels: travelList.isFiltered ? travelList.travels : undefined,
    engagementSummary,
    publicationCounts: initialTabCounts ?? publicationCounts,
    publicationCountsUnavailable,
    travelsCount: stats.travelsCount,
    travelsLoading,
    travelsLoadingMore,
    travelsHasMore,
    travelsError: travelList.error,
    travelCountsError: initialTabCounts ? null : allTravelsError,
    onRetryTravels: handleRetryTravels,
    loadMoreTravels: loadMoreTravelsHook,
    requiresCompleteTravelList: shouldLoadFallbackCatalog,
    personalTravelStatusEntries,
  });

  const handleTravelMetricPress = useCallback((metric: ProfileTravelEngagementMetricKey) => {
    setActiveTab('travels');
    setActiveTravelMetric((current) => (current === metric ? null : metric));
  }, []);

  // #1192: рядом с фильтрацией маршрутов по метрике показываем author-only
  // детализацию «кто и какой маршрут» из /travels/author-engagement/.
  const engagementMetric = useMemo(
    () => resolveAuthorEngagementMetric(activeTravelMetric),
    [activeTravelMetric],
  );
  const engagementDetails = useAuthorEngagementDetails(engagementMetric);
  // Обёртки обязательны: Pressable передаёт в onPress событие, а React Query
  // трактовал бы его как options-объект fetchNextPage/refetch.
  const { fetchNextPage: fetchMoreEngagement, refetch: refetchEngagement } = engagementDetails;
  const handleEngagementLoadMore = useCallback(() => {
    void fetchMoreEngagement();
  }, [fetchMoreEngagement]);
  const handleEngagementRetry = useCallback(() => {
    void refetchEngagement();
  }, [refetchEngagement]);

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
          cancelText: i18nT('common:action.cancel'),
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
          cancelText: i18nT('common:action.cancel'),
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

  const tabCounts = useMemo(() => ({
    overview: badgesCount,
    ...resolveProfileTabCounts({
      initial: initialTabCounts,
      travels: initialTabCounts?.travels ?? liveTravelsCount,
      published: publishedTravelsCount,
      drafts: draftTravelsCount,
      subscribers: subscribersCount,
      subscriptions: subscriptionsCount,
      profileDataUpdatedAt,
      subscribersDataUpdatedAt,
      subscriptionsDataUpdatedAt,
    }),
    favorites: stats.favoritesCount,
    history: stats.viewsCount,
  }), [
    badgesCount,
    draftTravelsCount,
    publishedTravelsCount,
    initialTabCounts,
    liveTravelsCount,
    subscribersCount,
    subscriptionsCount,
    profileDataUpdatedAt,
    subscribersDataUpdatedAt,
    subscriptionsDataUpdatedAt,
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
        travelsCount={confirmedTravelsCount}
        userId={userId}
        onCreateRoute={handleCreateFirstRoute}
        onStartQuest={handleStartFirstQuest}
      />
    ),
    [
      userProp,
      profile,
      confirmedTravelsCount,
      userId,
      handleCreateFirstRoute,
      handleStartFirstQuest,
    ]
  );

  const statsContent = useMemo(
    () => (
      <ProfileStatsTab
        travelsCount={confirmedTravelsCount}
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
      confirmedTravelsCount,
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

  const engagementDetailContent = useMemo(() => {
    if (!engagementMetric) return null;

    return (
      <ProfileEngagementDetailList
        metric={engagementMetric}
        items={engagementDetails.items}
        total={engagementDetails.total}
        isLoading={engagementDetails.isLoading}
        isError={engagementDetails.isError}
        hasNextPage={engagementDetails.hasNextPage}
        isFetchingNextPage={engagementDetails.isFetchingNextPage}
        onLoadMore={handleEngagementLoadMore}
        onRetry={handleEngagementRetry}
        onOpenProfile={handleOpenSubscribedProfile}
        onOpenTravel={handleOpenSubscribedTravel}
      />
    );
  }, [
    engagementMetric,
    engagementDetails,
    handleEngagementLoadMore,
    handleEngagementRetry,
    handleOpenSubscribedProfile,
    handleOpenSubscribedTravel,
  ]);

  const countriesContent = useMemo(
    () => (
      <ProfileCountriesTab
        progress={countryProgress}
        travelsSyncing={travelsLoading || travelsLoadingMore || travelsHasMore}
        loadedTravelsCount={profileTravels.length}
        totalTravelsCount={stats.travelsCount}
        onBackToOverview={() => handleProfileTabChange('overview')}
      />
    ),
    [
      countryProgress,
      profileTravels.length,
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
        key={owner}
        progress={countryProgress}
        travels={profileTravels}
        onBackToOverview={() => handleProfileTabChange('overview')}
        onMapGestureActiveChange={handleWorldMapGestureActiveChange}
      />
    ),
    [
      countryProgress,
      owner,
      profileTravels,
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
        {!isSectionTab ? engagementDetailContent : null}
        {subscriptionsContent}
      </>
    ),
    [
      Header,
      countriesContent,
      engagementDetailContent,
      worldmapContent,
      isCountries,
      isSectionTab,
      isWorldmap,
      isOverview,
      isStats,
      overviewContent,
      statsContent,
      subscriptionsContent,
    ],
  );

  const authorFeedbackSlots = useMemo(
    () => (isProfileTravelTab(activeTab) ? resolveListFeedbackSlots(currentData) : undefined),
    [activeTab, currentData],
  );
  const renderItem = useCallback(({ item, index }: { item: Travel; index: number }) => (
    <RenderTravelItem
      item={item}
      index={index}
      isMobile={isMobileDevice}
      isFirst={index === 0}
      currentUserId={userId}
      isSuperuser={isSuperuser}
      {...(isProfileTravelTab(activeTab) ? { onDeletePress: handleDeleteMyTravel, showAuthorModerationFeedback: true } : {})}
      authorFeedbackSlots={authorFeedbackSlots}
      viewportWidth={width}
      isDeleting={travelList.removingTravelId === item.id}
    />
  ), [isMobileDevice, userId, isSuperuser, activeTab, handleDeleteMyTravel, travelList.removingTravelId, width, authorFeedbackSlots]);

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
        {/* #2898: выгоды аккаунта и две кнопки вместо «Войдите» + «Войти». */}
        <GuestAccountPrompt
          redirect="/profile"
          intent="profile"
          title={i18nT('authStatic:authScreen.guest.profile.title')}
        />
      </SafeAreaView>
    );
  }

  const isTravelsTabLoading = isProfileTravelTab(activeTab) && listLoading;

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
        contentPaddingBottom={asBottomDimension(contentPaddingBottom)}
        listHeader={ListHeader}
        emptyStateProps={emptyStateProps}
        currentData={currentData}
        isSectionTab={isSectionTab}
        isTravelsTabLoading={isTravelsTabLoading}
        activeTab={activeTab}
        travelsLoadingMore={listLoadingMore}
        isCardsSingleColumn={isCardsSingleColumn}
        gridColumns={gridColumns}
        gapSize={gapSize}
        isMobileDevice={isMobileDevice}
        userId={userId}
        isSuperuser={isSuperuser}
        handleDeleteMyTravel={handleDeleteMyTravel}
        width={width}
        removingTravelId={travelList.removingTravelId}
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
