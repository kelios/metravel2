// Страница профиля пользователя
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Platform,
  ScrollView,
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
import { isTravelListItem, normalizeToTravel } from '@/components/profile/travelNormalize';
import { useMyTravels } from '@/hooks/useMyTravels';
import type { Travel } from '@/types/types';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useProfileGrid } from '@/components/screens/profile/useProfileGrid';
import { ProfileHeaderSection } from '@/components/screens/profile/ProfileHeaderSection';
import { ProfileOverviewTab } from '@/components/screens/profile/ProfileOverviewTab';
import { ProfileStatsTab } from '@/components/screens/profile/ProfileStatsTab';
import { ProfileTravelGrid } from '@/components/screens/profile/ProfileTravelGrid';
import { type ProfileStatSegmentItem } from '@/components/profile/ProfileStatSegment';
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
import { webTouchScrollStyle } from '@/utils';
import { rIC } from '@/utils/rIC';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getStorageBatch } from '@/utils/storageBatch';
import { hapticImpact } from '@/utils/haptics';
import { computeTravelEngagementSummary } from '@/utils/travelEngagementStats'
import { useTravelStatusStore } from '@/stores/travelStatusStore'
import { showToastMessage } from '@/utils/toast'
import { createProfileScreenStyles } from '@/components/screens/profile/profileScreen.styles';
import {
  keyExtractor,
  PROFILE_TRAVELS_PER_PAGE,
  withVisibleEngagementStats,
  type UserStats,
} from '@/components/screens/profile/profileScreen.helpers';

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
  const { data: myAchievements } = useMyAchievements({ enabled: activeTab === 'overview' });
  const badgesCount = myAchievements?.rank?.badgesCount ?? 0;
  const rank = useMemo(
    () => (myAchievements?.rank ? { level: myAchievements.rank.level, title: myAchievements.rank.title } : null),
    [myAchievements?.rank],
  );
  const { count: unreadMessagesCount } = useUnreadCount(isAuthenticated);
  const { subscriptions, subscribers } = useSubscriptionsData();
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
  } = useMyTravels({ userId, perPage: PROFILE_TRAVELS_PER_PAGE, onTotalChange: handleTotalChange });
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
    if (activeTab !== 'travels') return;
    await loadMoreTravelsHook();
  }, [activeTab, loadMoreTravelsHook]);

  const handleListEndReached = useCallback(() => {
    if (activeTab !== 'travels') return;
    if (travelsLoading || travelsLoadingMore || !travelsHasMore) return;
    if (myTravels.length === 0) return;

    const now = Date.now();
    if (now - lastEndReachedAtRef.current < 800) return;

    lastEndReachedAtRef.current = now;
    void loadMoreTravels();
  }, [activeTab, loadMoreTravels, myTravels.length, travelsHasMore, travelsLoading, travelsLoadingMore]);

  const handleWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeTab !== 'travels') return;

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
    if (activeTab !== 'travels') return;
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

  // Список путешествий не нужен для первого рендера (шапка + вкладка «Обзор»
  // строятся из профиля/кэша). Дёргаем его отложенно — после первого кадра —
  // чтобы счётчик «Маршруты» в шапке заполнился без блокировки экрана.
  useEffect(() => {
    const cancel = rIC(ensureTravelsLoaded, 400);
    return cancel;
  }, [ensureTravelsLoaded]);

  // Если пользователь открыл вкладку, которой реально нужен список/метрики,
  // загружаем немедленно (не ждём idle).
  useEffect(() => {
    if (activeTab === 'travels' || activeTab === 'stats' || activeTravelMetric) {
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

  const normalizedFavorites = useMemo<Travel[]>(() =>
    (favorites || [])
      .filter((f) => isTravelListItem(f))
      .map((f) => normalizeToTravel({
        id: f.id,
        name: f.title,
        title: f.title,
        url: f.url,
        imageUrl: f.imageUrl,
        countryName: f.country,
        cityName: f.city,
      })),
    [favorites]
  );

  const normalizedHistory = useMemo<Travel[]>(() =>
    (viewHistory || [])
      .filter((h) => isTravelListItem(h))
      .map((h) => normalizeToTravel({
        id: h.id,
        name: h.title,
        title: h.title,
        url: h.url,
        imageUrl: h.imageUrl,
        countryName: h.country,
        cityName: h.city,
      })),
    [viewHistory]
  );

  const profileTravels = useMemo<Travel[]>(() =>
    myTravels.map(withVisibleEngagementStats),
    [myTravels]
  )

  const authoredMetricTravels = useMemo<Travel[]>(() => {
    if (!activeTravelMetric) return [];
    return profileTravels.filter((travel) => (travel.engagementStats?.[activeTravelMetric] ?? 0) > 0);
  }, [activeTravelMetric, profileTravels]);

  const authoredTravelEngagementScope = useMemo<'all' | 'loaded'>(() => {
    if (engagementSummary) return 'all'
    if (profileTravels.length === 0) return 'all'
    return profileTravels.length >= stats.travelsCount || !travelsHasMore ? 'all' : 'loaded'
  }, [engagementSummary, profileTravels.length, stats.travelsCount, travelsHasMore])

  const authoredTravelEngagementSummary = useMemo(() => {
    if (engagementSummary) return engagementSummary

    if (!travelsLoading && stats.travelsCount === 0) {
      return {
        favoritesCount: 0,
        wishlistCount: 0,
        visitedCount: 0,
        plannedCount: 0,
      }
    }

    if (profileTravels.length > 0) {
      return computeTravelEngagementSummary(profileTravels)
    }

    return null
  }, [engagementSummary, profileTravels, stats.travelsCount, travelsLoading])

  const personalTravelStatusSummary = useMemo(
    () =>
      personalTravelStatusEntries.reduce(
        (acc, entry) => {
          if (entry.status === 'visited') acc.visited += 1
          if (entry.status === 'wishlist') acc.wishlist += 1
          if (entry.status === 'planned') acc.planned += 1
          return acc
        },
        { visited: 0, wishlist: 0, planned: 0 }
      ),
    [personalTravelStatusEntries]
  )

  const formatTripsCount = useCallback((count: number) => {
    if (count === 0) return 'Пока пусто'
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return `${count} поездка`
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} поездки`
    return `${count} поездок`
  }, [])

  const currentData = useMemo<Travel[]>(() => {
    if (activeTravelMetric) return authoredMetricTravels;
    if (activeTab === 'travels') return profileTravels;
    if (activeTab === 'favorites') return normalizedFavorites.map(withVisibleEngagementStats);
    if (activeTab === 'history') return normalizedHistory.map(withVisibleEngagementStats);
    return [];
  }, [
    activeTab,
    activeTravelMetric,
    authoredMetricTravels,
    normalizedFavorites,
    normalizedHistory,
    profileTravels,
  ]);

  const handleTravelMetricPress = useCallback((metric: ProfileTravelEngagementMetricKey) => {
    setActiveTab('travels');
    setActiveTravelMetric((current) => (current === metric ? null : metric));
  }, []);

  const handleProfileTabChange = useCallback((tab: ProfileTabKey) => {
    setActiveTravelMetric(null);
    setActiveTab(tab);
  }, []);

  const emptyStateProps = useMemo(() => {
    if (activeTravelMetric) {
      const copy = {
        title: 'Нет маршрутов с этой метрикой',
        description: 'Когда пользователи начнут сохранять, посещать или планировать эти маршруты, карточки появятся здесь.',
      };

      return {
        icon: activeTravelMetric === 'visitedCount'
          ? 'check-circle'
          : activeTravelMetric === 'plannedCount'
            ? 'calendar'
            : 'heart',
        title: copy.title,
        description: copy.description,
        variant: 'empty' as const,
        action: { label: 'Показать все маршруты', onPress: () => setActiveTravelMetric(null) },
      };
    }

    switch (activeTab) {
      case 'travels':
        return {
          icon: 'map',
          title: 'Ваши маршруты появятся здесь',
          description: 'Добавьте первое путешествие — поделитесь маршрутом, фотографиями и впечатлениями с сообществом.',
          variant: 'inspire' as const,
          action: { label: 'Создать маршрут', onPress: () => router.push('/travel/new' as any) },
          secondaryAction: { label: 'Начать квест', onPress: () => router.push('/quests' as any) },
        };
      case 'favorites':
        return {
          icon: 'heart',
          title: 'Нет сохранённых маршрутов',
          description: 'Нажмите ♥ на любом маршруте, чтобы сохранить его сюда.',
          variant: 'empty' as const,
          action: { label: 'Найти маршруты', onPress: () => router.push('/travelsby' as any) },
        };
      case 'history':
        return {
          icon: 'clock',
          title: 'История просмотров пуста',
          description: 'Открытые маршруты будут сохраняться здесь автоматически.',
          variant: 'empty' as const,
          action: { label: 'Смотреть маршруты', onPress: () => router.push('/travelsby' as any) },
        };
      default: return { icon: 'layers', title: 'Пусто', description: '' };
    }
  }, [activeTab, activeTravelMetric, router]);

  const displayName = useMemo(
    () => (fullName || userInfo.name || 'Пользователь').trim(),
    [fullName, userInfo.name],
  );

  const handleHeaderAction = useCallback((key: ProfileHeaderActionKey) => {
    if (key === 'messages') router.push('/messages');
    else if (key === 'userpoints') router.push({ pathname: '/userpoints', params: { from: 'profile' } } as any);
    else if (key === 'calendar') router.push('/calendar' as any);
    else if (key === 'newTravel') router.push('/travel/new' as any);
  }, [router]);

  const handleEdit = useCallback(() => router.push('/settings'), [router]);

  const handleClearActiveTab = useCallback(async () => {
    try {
      if (activeTab === 'favorites') {
        const ok = await confirmAction({
          title: 'Очистить избранное',
          message: 'Удалить все путешествия из избранного?',
          confirmText: 'Очистить',
          cancelText: 'Отмена',
        });
        if (!ok) return;
        await clearFavorites?.();
        void showToastMessage({ type: 'success', text1: 'Избранное очищено' })
        return;
      }

      if (activeTab === 'history') {
        const ok = await confirmAction({
          title: 'Очистить историю',
          message: 'Удалить всю историю просмотров?',
          confirmText: 'Очистить',
          cancelText: 'Отмена',
        });
        if (!ok) return;
        await clearHistory?.();
        void showToastMessage({ type: 'success', text1: 'История очищена' })
      }
    } catch (error) {
      void showToastMessage({
        type: 'error',
        text1: 'Не удалось очистить список',
        text2: error instanceof Error ? error.message : 'Попробуйте позже.',
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
    travels: stats.travelsCount,
    favorites: stats.favoritesCount,
    history: stats.viewsCount,
  }), [stats.travelsCount, stats.favoritesCount, stats.viewsCount]);

  const userProp = useMemo(() => ({
    name: displayName,
    email: userInfo.email,
    avatar: profile?.avatar,
  }), [displayName, userInfo.email, profile?.avatar]);

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

  const statItems = useMemo<ProfileStatSegmentItem[]>(() => [
    {
      key: 'travels',
      label: 'Маршруты',
      value: stats.travelsCount,
      onPress: () => handleProfileTabChange('travels'),
      accessibilityHint: 'Показать ваши опубликованные маршруты',
    },
    {
      key: 'subscribers',
      label: 'Подписчики',
      value: subscribersCount,
      onPress: () => router.push('/subscriptions'),
      accessibilityHint: 'Перейти к подписчикам',
    },
    {
      key: 'subscriptions',
      label: 'Подписки',
      value: subscriptionsCount,
      onPress: () => router.push('/subscriptions'),
      accessibilityHint: 'Перейти к подпискам',
    },
    {
      key: 'achievements',
      label: 'Значки',
      value: badgesCount,
      onPress: () => handleProfileTabChange('overview'),
      accessibilityHint: 'Открыть обзор с достижениями',
    },
  ], [stats.travelsCount, subscribersCount, subscriptionsCount, badgesCount, handleProfileTabChange, router]);

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
        statItems={statItems}
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
      statItems,
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
        onCreateRoute={handleCreateFirstRoute}
        onStartQuest={handleStartFirstQuest}
      />
    ),
    [
      userProp,
      profile,
      stats.travelsCount,
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

  const isOverview = activeTab === 'overview';
  const isStats = activeTab === 'stats';
  const isSectionTab = isOverview || isStats;

  const ListHeader = useMemo(
    () => (
      <>
        {Header}
        {isOverview ? overviewContent : null}
        {isStats ? statsContent : null}
      </>
    ),
    [Header, isOverview, isStats, overviewContent, statsContent],
  );

  const renderItem = useCallback(({ item, index }: { item: Travel; index: number }) => (
    <RenderTravelItem
      item={item}
      index={index}
      isMobile={isMobileDevice}
      isFirst={index === 0}
      currentUserId={userId}
      isSuperuser={isSuperuser}
      onDeletePress={activeTab === 'travels' ? handleDeleteMyTravel : undefined}
      viewportWidth={width}
      isDeleting={removingTravelId === item.id}
    />
  ), [isMobileDevice, userId, isSuperuser, activeTab, handleDeleteMyTravel, removingTravelId, width]);

  const scrollViewStyle = useMemo(() => ({ flex: 1 } as const), []);

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
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <EmptyState
          icon="user"
          title="Войдите в аккаунт"
          description="Войдите, чтобы открыть профиль и управлять своими данными."
          action={{
            label: 'Войти',
            onPress: () => router.push(buildLoginHref({ redirect: '/profile', intent: 'profile' }) as any),
            style: profileLoginActionStyle,
          }}
        />
      </SafeAreaView>
    );
  }

  const isTravelsTabLoading = activeTab === 'travels' && travelsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {isFocused && (
        <InstantSEO
          headKey="profile"
          title="Профиль | Metravel"
          description="Профиль пользователя"
          canonical={buildCanonicalUrl('/profile')}
          robots="noindex, nofollow"
        />
      )}
      {Platform.OS === 'web' ? (
        <ScrollView
          style={[scrollViewStyle, webTouchScrollStyle]}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
          onScroll={handleWebScroll}
          scrollEventThrottle={32}
          onLayout={handleWebLayout}
          onContentSizeChange={handleWebContentSizeChange}
        >
          {ListHeader}
          {isSectionTab ? null : isTravelsTabLoading ? ListSkeleton : (
            currentData.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState {...emptyStateProps} />
              </View>
            ) : (
              <ProfileTravelGrid
                currentData={currentData}
                styles={styles}
                isCardsSingleColumn={isCardsSingleColumn}
                gridColumns={gridColumns}
                gapSize={gapSize}
                isMobileDevice={isMobileDevice}
                userId={userId}
                isSuperuser={isSuperuser}
                activeTab={activeTab}
                handleDeleteMyTravel={handleDeleteMyTravel}
                width={width}
                removingTravelId={removingTravelId}
              />
            )
          )}
          {activeTab === 'travels' && travelsLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <FlashList
          key={`profile-list-${gridColumns}`}
          data={isTravelsTabLoading ? [] : currentData}
          // @ts-expect-error estimatedItemSize required by FlashList but types mismatch
          estimatedItemSize={280}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
          keyExtractor={keyExtractor}
          numColumns={Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1)}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            isSectionTab ? null : isTravelsTabLoading ? ListSkeleton : (
              <View style={styles.emptyWrap}>
                <EmptyState {...emptyStateProps} />
              </View>
            )
          }
          ListFooterComponent={
            activeTab === 'travels' && travelsLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          onEndReached={activeTab === 'travels' ? handleListEndReached : undefined}
          onEndReachedThreshold={0.5}
        />
      )}
      <BadgeUnlockToast enabled={activeTab === 'overview'} />
      <PlaceFirstBadgeToast enabled={activeTab === 'overview'} />
    </SafeAreaView>
  );
}
