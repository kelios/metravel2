// Страница профиля пользователя
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { deleteTravel, fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import type { Travel } from '@/types/types';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import { calculateColumns } from '@/components/listTravel/utils/listTravelHelpers';
import { BREAKPOINTS } from '@/components/listTravel/utils/listTravelConstants';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { buildLoginHref } from '@/utils/authNavigation';
import { confirmAction } from '@/utils/confirmAction';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { FlashList } from '@shopify/flash-list';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getStorageBatch } from '@/utils/storageBatch';

interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

type ProfileListItem = {
  type?: string;
  id?: unknown;
  title?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  country?: unknown;
  city?: unknown;
};

const isTravelListItem = (value: unknown): value is ProfileListItem =>
  !!value && typeof value === 'object' && (value as ProfileListItem).type === 'travel';

const getSlugFromUrl = (url: string | undefined | null, fallback: string) => {
  const raw = String(url ?? '').trim();
  if (!raw) return fallback;
  const noQuery = raw.split('?')[0]?.replace(/\/+$/, '') ?? raw;
  const match = noQuery.match(/\/travels\/([^/]+)$/);
  return match?.[1] ? String(match[1]) : fallback;
};

const normalizeToTravel = (item: Record<string, unknown>): Travel => {
  const idRaw = item?.id ?? item?._id ?? 0;
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw) || 0;
  const url = String(item?.url ?? item?.urlTravel ?? item?.href ?? '').trim();
  const slug = String(item?.slug ?? getSlugFromUrl(url, String(id || item?.id || ''))).trim();
  const name = String(item?.name ?? item?.title ?? '').trim() || 'Без названия';

  const travel_image_thumb_url =
    String(
      item?.travel_image_thumb_url ??
        item?.travel_image_thumb_small_url ??
        item?.travelImageThumbUrl ??
        item?.travelImageThumbSmallUrl ??
        item?.imageUrl ??
        ''
    ).trim();

  const countryName = String(item?.countryName ?? item?.country ?? '').trim();
  const cityName = String(item?.cityName ?? item?.city ?? '').trim();
  const countUnicIpView = String(item?.countUnicIpView ?? item?.views ?? '0');

  return {
    id,
    slug,
    name,
    travel_image_thumb_url,
    travel_image_thumb_small_url: travel_image_thumb_url,
    url: url || `/travels/${slug || id}`,
    youtube_link: '',
    userName: String(item?.userName ?? item?.authorName ?? ''),
    description: String(item?.description ?? ''),
    recommendation: String(item?.recommendation ?? ''),
    plus: String(item?.plus ?? ''),
    minus: String(item?.minus ?? ''),
    cityName,
    countryName,
    countUnicIpView,
    gallery: Array.isArray(item?.gallery) ? item.gallery : [],
    travelAddress: Array.isArray(item?.travelAddress) ? item.travelAddress : [],
    userIds: String(item?.userIds ?? item?.userId ?? item?.user?.id ?? ''),
    year: String(item?.year ?? ''),
    monthName: String(item?.monthName ?? ''),
    number_days: Number(item?.number_days ?? 0) || 0,
    companions: Array.isArray(item?.companions) ? item.companions : [],
    coordsMeTravel: Array.isArray(item?.coordsMeTravel) ? item.coordsMeTravel : undefined,
    countryCode: String(item?.countryCode ?? ''),
    user: item?.user,
    created_at: item?.created_at,
    updated_at: item?.updated_at,
  };
};

const keyExtractor = (item: Travel, index: number) => `${item.id}-${index}`;

export default function ProfileScreen() {
  const router = useRouter();
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

  const isDesktopWeb = Platform.OS === 'web' && isDesktop;

  const maxContentWidth = 1280;

  const effectiveWidth = Math.max(0, width || 0);
  const contentWidth = Platform.OS === 'web'
    ? Math.min(effectiveWidth, maxContentWidth)
    : effectiveWidth;

  const isMobileDevice = isPhone || isLargePhone || (isTablet && isPortrait);
  const isCardsSingleColumn = contentWidth < BREAKPOINTS.MOBILE;

  const gapSize = useMemo(() => {
    if (contentWidth < BREAKPOINTS.XS) return 6;
    if (contentWidth < BREAKPOINTS.SM) return 8;
    if (contentWidth < BREAKPOINTS.MOBILE) return 10;
    if (contentWidth < BREAKPOINTS.TABLET) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP) return 14;
    return 16;
  }, [contentWidth]);

  const contentPadding = useMemo(() => {
    if (contentWidth < BREAKPOINTS.XS) return 12;
    if (contentWidth < BREAKPOINTS.SM) return 8;
    if (contentWidth < BREAKPOINTS.MOBILE) return 10;
    if (contentWidth < BREAKPOINTS.TABLET) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP_LARGE) return 16;
    return 20;
  }, [contentWidth]);

  const gridColumns = useMemo(() => {
    if (isCardsSingleColumn) return 1;
    const orientation = isPortrait ? 'portrait' : 'landscape';
    if (isMobileDevice) return calculateColumns(contentWidth, orientation);
    return calculateColumns(contentWidth, 'landscape');
  }, [contentWidth, isCardsSingleColumn, isMobileDevice, isPortrait]);

  const contentPaddingBottom = useMemo(() => {
    if (Platform.OS === 'web') {
      const dockVisible = isPhone || isLargePhone || isTablet;
      return (dockVisible ? 56 : 0) + 32;
    }

    return Math.max(32, (insets.bottom || 0) + 16);
  }, [insets.bottom, isLargePhone, isPhone, isTablet]);

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
  const [travelsLoading, setTravelsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('travels');
  const [myTravels, setMyTravels] = useState<Travel[]>([]);

  const loadTravels = useCallback(async () => {
    const uid = userId;
    if (!uid) { setTravelsLoading(false); return; }
    setTravelsLoading(true);
    try {
      const payload = await fetchMyTravels({ user_id: uid });
      const { items, total } = unwrapMyTravelsPayload(payload);
      setMyTravels(items.map(normalizeToTravel));
      setStats((prev) => ({
        ...prev,
        travelsCount: total || items.length,
      }));
    } catch {
      setStats((prev) => ({ ...prev, travelsCount: 0 }));
    } finally {
      setTravelsLoading(false);
    }
  }, [userId]);

  const loadUserInfo = useCallback(async () => {
    try {
      const storageData = await getStorageBatch(['userName', 'userEmail']);
      setUserInfo({ name: storageData.userName || '', email: storageData.userEmail || '' });
    } catch {
      // storage read is non-critical
    }
  }, []);

  const handleDeleteMyTravel = useCallback(async (travelId: number) => {
    try {
      const ok = await confirmAction({
        title: 'Удалить путешествие',
        message: 'Удалить это путешествие?',
        confirmText: 'Удалить',
        cancelText: 'Отмена',
      });
      if (!ok) return;

      await deleteTravel(travelId);
      await loadTravels();
    } catch (error) {
      console.error('Error deleting travel:', error);
    }
  }, [loadTravels]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      favoritesCount: favorites.length,
      viewsCount: viewHistory.length,
    }));
  }, [favorites.length, viewHistory.length]);

  useEffect(() => {
    loadUserInfo();
    loadTravels();
  }, [loadUserInfo, loadTravels]);

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

  const currentData = useMemo<Travel[]>(() => {
    if (activeTab === 'travels') return myTravels;
    if (activeTab === 'favorites') return normalizedFavorites;
    if (activeTab === 'history') return normalizedHistory;
    return [];
  }, [activeTab, myTravels, normalizedFavorites, normalizedHistory]);

  const rows = useMemo(() => {
    const cols = Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1);
    const result: Travel[][] = [];
    for (let i = 0; i < currentData.length; i += cols) {
      result.push(currentData.slice(i, i + cols));
    }
    return result;
  }, [currentData, gridColumns, isCardsSingleColumn]);

  const emptyStateProps = useMemo(() => {
    switch (activeTab) {
      case 'travels':
        return {
          title: 'Нет путешествий',
          description: 'Вы еще не создали ни одного путешествия.',
          action: { label: 'Создать', onPress: () => router.push('/metravel') },
        };
      case 'favorites':
        return {
          title: 'Нет избранного',
          description: 'Добавляйте интересные маршруты в избранное.',
          action: { label: 'Найти', onPress: () => router.push('/travelsby') },
        };
      case 'history':
        return {
          title: 'История пуста',
          description: 'История просмотров появится здесь.',
          action: { label: 'Смотреть', onPress: () => router.push('/travelsby') },
        };
      default: return { title: 'Пусто', description: '' };
    }
  }, [activeTab, router]);

  const displayName = useMemo(
    () => (fullName || userInfo.name || 'Пользователь').trim(),
    [fullName, userInfo.name],
  );

  const handleQuickAction = useCallback((key: string) => {
    if (key === 'messages') router.push('/messages');
    else if (key === 'subscriptions') router.push('/subscriptions');
    else router.push('/settings');
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
      }
    } catch (error) {
      console.error('Error clearing profile tab data:', error);
    }
  }, [activeTab, clearFavorites, clearHistory]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: contentPadding,
      paddingBottom: 0,
      paddingTop: 12,
      rowGap: gapSize,
      maxWidth: Platform.OS === 'web' ? (isDesktopWeb ? maxContentWidth : undefined) : undefined,
      alignSelf: Platform.OS === 'web' ? 'center' : undefined,
      width: Platform.OS === 'web' ? '100%' : undefined,
    },
    headerComponent: {
      backgroundColor: colors.background,
    },
    fullRow: {
      width: '100%',
    },
    cardsRow: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      maxWidth: '100%',
      minWidth: 0,
      alignItems: 'flex-start',
      ...Platform.select({
        web: {
          columnGap: gapSize,
          rowGap: gapSize,
        },
        default: {},
      }),
    },
    rowSeparator: {
      height: gapSize,
    },
    emptyWrap: {
      paddingHorizontal: contentPadding,
      paddingTop: 16,
    },
    skeletonWrap: {
      padding: 16,
      gap: 16,
    },
    skeletonHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 10,
    },
    skeletonHeaderText: {
      gap: 8,
    },
    skeletonStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    skeletonListWrap: {
      marginTop: 16,
      gap: 12,
    },
    tabActions: {
      paddingHorizontal: contentPadding,
      paddingTop: 12,
      paddingBottom: 8,
    },
    tabActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  }), [colors, contentPadding, gapSize, isDesktopWeb, maxContentWidth]);

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

  const Header = useMemo(
    () => (
      <View style={[styles.headerComponent, styles.fullRow]}>
        {profileLoading ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.skeletonHeaderRow}>
              <SkeletonLoader width={80} height={80} borderRadius={40} />
              <View style={styles.skeletonHeaderText}>
                <SkeletonLoader width={150} height={24} borderRadius={4} />
                <SkeletonLoader width={200} height={16} borderRadius={4} />
              </View>
            </View>
            <View style={styles.skeletonStatsRow}>
              <SkeletonLoader width="30%" height={60} borderRadius={12} />
              <SkeletonLoader width="30%" height={60} borderRadius={12} />
              <SkeletonLoader width="30%" height={60} borderRadius={12} />
            </View>
          </View>
        ) : (
          <>
            <ProfileHeader
              user={userProp}
              profile={profile}
              onEdit={handleEdit}
              onLogout={handleLogout}
              onAvatarUpload={pickAndUpload}
              avatarUploading={avatarUploading}
            />
            <ProfileQuickActions onPress={handleQuickAction} />
          </>
        )}
        <ProfileTabs
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          counts={tabCounts}
        />
        {showClearButton ? (
          <View style={styles.tabActions}>
            <View style={styles.tabActionsRow}>
              <Button
                label="Очистить"
                onPress={handleClearActiveTab}
                variant="danger"
                size="sm"
              />
            </View>
          </View>
        ) : null}
      </View>
    ),
    [
      styles,
      profileLoading,
      userProp,
      profile,
      handleEdit,
      handleLogout,
      pickAndUpload,
      avatarUploading,
      handleQuickAction,
      tabCounts,
      activeTab,
      showClearButton,
      handleClearActiveTab,
    ]
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
    />
  ), [isMobileDevice, userId, isSuperuser, activeTab, handleDeleteMyTravel]);

  const scrollViewStyle = useMemo(() => ({ flex: 1 } as const), []);

  const singleColStyle = useMemo(() => ({
    width: '100%', maxWidth: '100%', minWidth: 0, flexBasis: '100%',
  } as ViewStyle), []);

  const placeholderBaseStyle = useMemo(() => ({
    flexGrow: 0, flexShrink: 0, minWidth: 0, opacity: 0, pointerEvents: 'none' as const,
  }), []);

  const ListSkeleton = useMemo(() => (
    <View style={styles.skeletonListWrap}>
      <SkeletonLoader width="100%" height={200} borderRadius={12} />
      <SkeletonLoader width="100%" height={200} borderRadius={12} />
    </View>
  ), [styles.skeletonListWrap]);

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="user"
          title="Войдите в аккаунт"
          description="Войдите, чтобы открыть профиль и управлять своими данными."
          action={{
            label: 'Войти',
            onPress: () => router.push(buildLoginHref({ redirect: '/profile', intent: 'profile' }) as any),
          }}
        />
      </SafeAreaView>
    );
  }

  const isTravelsTabLoading = activeTab === 'travels' && travelsLoading;

  return (
    <SafeAreaView style={styles.container}>
      <InstantSEO
        headKey="profile"
        title="Профиль | Metravel"
        description="Профиль пользователя"
        canonical={buildCanonicalUrl('/profile')}
        robots="noindex, nofollow"
      />
      {Platform.OS === 'web' ? (
        <ScrollView
          style={scrollViewStyle}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
        >
          {Header}
          {isTravelsTabLoading ? ListSkeleton : (
            currentData.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState icon="layers" {...emptyStateProps} />
              </View>
            ) : (
              rows.map((rowItems, rowIndex) => {
                const cols = Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1);
                const missingSlots = Math.max(0, cols - rowItems.length);
                const calcWidth =
                  cols > 1
                    ? `calc((100% - ${(cols - 1) * gapSize}px) / ${cols})`
                    : '100%';

                return (
                  <View key={`row-${rowIndex}`}>
                    <View style={styles.cardsRow}>
                      {rowItems.map((travel, itemIndex) => {
                        const rowItemStyle: ViewStyle | undefined = isCardsSingleColumn
                          ? singleColStyle
                          : {
                              flexGrow: 0,
                              flexShrink: 0,
                              flexBasis: calcWidth,
                              width: calcWidth,
                              maxWidth: calcWidth,
                              minWidth: 0,
                            };

                        return (
                          <View
                            key={String(travel.id)}
                            style={rowItemStyle}
                          >
                            <RenderTravelItem
                              item={travel}
                              index={rowIndex * cols + itemIndex}
                              isMobile={isMobileDevice}
                              isFirst={rowIndex === 0 && itemIndex === 0}
                              currentUserId={userId}
                              isSuperuser={isSuperuser}
                              onDeletePress={activeTab === 'travels' ? handleDeleteMyTravel : undefined}
                            />
                          </View>
                        );
                      })}

                      {!isCardsSingleColumn && missingSlots > 0
                        ? Array.from({ length: missingSlots }).map((_, placeholderIndex) => {
                            const placeholderStyle: ViewStyle = {
                              ...placeholderBaseStyle,
                              flexBasis: calcWidth,
                              width: calcWidth,
                              maxWidth: calcWidth,
                            };
                            return (
                              <View
                                key={`placeholder-${rowIndex}-${placeholderIndex}`}
                                style={placeholderStyle}
                              />
                            );
                          })
                        : null}
                    </View>
                    {rowIndex < rows.length - 1 ? <View style={styles.rowSeparator} /> : null}
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      ) : (
        <FlashList
          key={`profile-list-${gridColumns}`}
          data={isTravelsTabLoading ? [] : currentData}
          // @ts-expect-error estimatedItemSize required by FlashList but types mismatch
          estimatedItemSize={280}
          ListHeaderComponent={Header}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentPaddingBottom }]}
          keyExtractor={keyExtractor}
          numColumns={Math.max(1, (isCardsSingleColumn ? 1 : gridColumns) || 1)}
          renderItem={renderItem}
          ListEmptyComponent={
            isTravelsTabLoading ? ListSkeleton : (
              <View style={styles.emptyWrap}>
                <EmptyState icon="layers" {...emptyStateProps} />
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
