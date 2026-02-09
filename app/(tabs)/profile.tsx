// Страница профиля пользователя
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { normalizeAvatar } from '@/api/user';
import { fetchMyTravels } from '@/api/travelsApi';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
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

const unwrapTravelsPayload = (payload: any): { items: any[]; count: number } => {
  if (Array.isArray(payload)) return { items: payload, count: payload.length };
  if (Array.isArray(payload?.data)) return { items: payload.data, count: payload.data.length };
  if (Array.isArray(payload?.results)) return { items: payload.results, count: payload.count ?? payload.results.length };
  if (Array.isArray(payload?.items)) return { items: payload.items, count: payload.count ?? payload.items.length };
  return { items: [], count: 0 };
};

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, authReady, logout, userId } = useAuth();
  const favoritesContext = useFavorites();
  const { favorites = [], viewHistory = [] } = favoritesContext ?? { favorites: [], viewHistory: [] };
  const colors = useThemedColors();

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
  const [myTravels, setMyTravels] = useState<any[]>([]);

  const loadTravels = useCallback(async () => {
    const uid = userId;
    if (!uid) { setTravelsLoading(false); return; }
    setTravelsLoading(true);
    try {
      const payload = await fetchMyTravels({ user_id: uid });
      const { items, count } = unwrapTravelsPayload(payload);
      setMyTravels(items);
      setStats((prev) => ({
        ...prev,
        travelsCount: count || (typeof (payload as any)?.total === 'number' ? (payload as any).total : 0) || items.length,
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

  const isLoading = profileLoading || travelsLoading;

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
      paddingBottom: 32,
    },
    headerComponent: {
      backgroundColor: colors.background,
    },
    listItemWrap: {
      paddingHorizontal: 16,
    },
    emptyWrap: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    separator: {
      height: 16,
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
  }), [colors]);

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
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
             <SkeletonLoader width="100%" height={40} borderRadius={0} />
             <View style={styles.skeletonListWrap}>
                 <SkeletonLoader width="100%" height={200} borderRadius={12} />
                 <SkeletonLoader width="100%" height={200} borderRadius={12} />
             </View>
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

  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'travels': return myTravels;
      case 'favorites': return favorites;
      case 'history': return viewHistory;
      default: return [];
    }
  }, [activeTab, myTravels, favorites, viewHistory]);

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

  const handlePressStat = useCallback((key: string) => {
    if (key === 'views') setActiveTab('history');
    else setActiveTab(key as ProfileTabKey);
  }, []);

  const handleEdit = useCallback(() => router.push('/settings'), [router]);

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  const Header = useMemo(() => (
      <View style={styles.headerComponent}>
        <ProfileHeader
            user={{
                name: displayName,
                email: userInfo.email,
                avatar: profile?.avatar,
            }}
            profile={profile}
            onEdit={handleEdit}
            onLogout={handleLogout}
            onAvatarUpload={pickAndUpload}
            avatarUploading={avatarUploading}
        />

        <ProfileQuickActions onPress={handleQuickAction} />

        <ProfileStats
            stats={stats}
            onPressStat={handlePressStat}
        />

        <ProfileTabs
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            counts={{
              travels: stats.travelsCount,
              favorites: stats.favoritesCount,
              history: stats.viewsCount,
            }}
        />
      </View>
  ), [styles, displayName, userInfo.email, profile, handleEdit, handleLogout, pickAndUpload, avatarUploading, handleQuickAction, stats, handlePressStat, activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      <InstantSEO
        headKey="profile"
        title="Профиль | Metravel"
        description="Профиль пользователя"
        canonical={buildCanonicalUrl('/profile')}
        robots="noindex, nofollow"
      />

      <FlashList
          data={currentData}
          // @ts-expect-error estimatedItemSize required by FlashList but types mismatch
          estimatedItemSize={280}
          ListHeaderComponent={Header}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
          keyExtractor={(item, index) => `${activeTab}-${item.id}-${index}`}
          renderItem={({ item }) => (
               <View style={styles.listItemWrap}>
                 <TabTravelCard
                    item={{
                      id: item.id,
                      title: item.title || item.name,
                      imageUrl: item.imageUrl || item.travel_image_thumb_url || item.url,
                      city: item.city || item.cityName || null,
                      country: item.country || item.countryName || null,
                    }}
                    onPress={() => {
                        const url = item.url || `/travels/${item.slug || item.id}`;
                        router.push(url as any);
                    }}
                 />
               </View>
          )}
          ListEmptyComponent={
              <View style={styles.emptyWrap}>
                 <EmptyState
                    icon="layers"
                    {...emptyStateProps}
                 />
              </View>
          }
      />
    </SafeAreaView>
  );
}
