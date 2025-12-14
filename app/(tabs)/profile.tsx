// Страница профиля пользователя
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { fetchTravels } from '@/src/api/travelsApi';
import { fetchUserProfile, type UserProfileDto } from '@/src/api/user';
import { ApiError } from '@/src/api/client';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, logout, userId } = useAuth();
  const favoritesContext = typeof useFavorites === 'function' ? useFavorites() : { favorites: [], viewHistory: [] };
  const { favorites, viewHistory } = favoritesContext as any;
  const [userInfo, setUserInfo] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [stats, setStats] = useState<UserStats>({
    travelsCount: 0,
    favoritesCount: 0,
    viewsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const favoritesPreview = Array.isArray(favorites) ? favorites.slice(0, 8) : [];
  const historyPreview = Array.isArray(viewHistory) ? viewHistory.slice(0, 8) : [];

  useEffect(() => {
    loadUserData();
  }, [favorites, viewHistory]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      // ✅ FIX-004: Используем батчинг для загрузки данных
      const { getStorageBatch } = await import('@/src/utils/storageBatch');
      const storageData = await getStorageBatch(['userName', 'userId', 'userEmail']);
      const userName = storageData.userName || '';
      const userIdFromStorage = storageData.userId;
      const userEmail = storageData.userEmail || '';

      setUserInfo({ name: userName, email: userEmail });

      const uid = userId || userIdFromStorage;
      if (uid) {
        try {
          const profileData = await fetchUserProfile(uid);
          setProfile(profileData);
        } catch (e) {
          if (__DEV__) {
            const message = e instanceof ApiError ? e.message : String(e);
            console.warn('Error loading user profile:', message);
          }
        }
      }

      // ✅ ИСПРАВЛЕНИЕ: Загружаем статистику путешествий из API
      let travelsCount = 0;
      if (uid) {
        try {
          // Загружаем путешествия пользователя (только опубликованные)
          const travelsData = await fetchTravels(
            0, // page
            1, // itemsPerPage - нам нужен только total
            '', // search
            {
              user_id: uid,
              publish: 1, // только опубликованные
              moderation: 1, // только прошедшие модерацию
            }
          );
          travelsCount = travelsData?.total || 0;
        } catch (error) {
          console.error('Error loading travels count:', error);
          // В случае ошибки оставляем 0
        }
      }

      // Подсчитываем статистику
      setStats({
        travelsCount,
        favoritesCount: favorites.length,
        viewsCount: viewHistory.length,
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, router]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="user"
          title="Войдите в аккаунт"
          description="Войдите, чтобы открыть профиль и управлять своими данными."
          action={{
            label: 'Войти',
            onPress: () => router.push('/login'),
          }}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} /> {/* ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет */}
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'heart',
      label: 'Избранное',
      count: stats.favoritesCount,
      onPress: () => router.push('/favorites'),
      color: '#ef5350',
    },
    {
      icon: 'map',
      label: 'Мои путешествия',
      count: stats.travelsCount,
      onPress: () => router.push('/metravel'),
      color: '#4a8c8c',
    },
    {
      icon: 'eye',
      label: 'История просмотров',
      count: stats.viewsCount,
      onPress: () => router.push('/history'),
      color: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    },
    {
      icon: 'settings',
      label: 'Настройки',
      onPress: () => router.push('/settings'),
      color: '#667085',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={28} color={DESIGN_TOKENS.colors.primary} />
              )}
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.userName}>
                {(() => {
                  const clean = (value: unknown) => {
                    const v = String(value ?? '').trim();
                    if (!v) return '';
                    if (v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return '';
                    return v;
                  };
                  const fullName = profile
                    ? `${clean(profile.first_name)} ${clean(profile.last_name)}`.trim()
                    : '';
                  return fullName || userInfo.name || 'Пользователь';
                })()}
              </Text>
              {!!userInfo.email && <Text style={styles.userEmail}>{userInfo.email}</Text>}
            </View>
          </View>

          {!!profile && (
            <View style={styles.socialsRow}>
              {!!profile.youtube && <Text style={styles.socialChip}>YouTube</Text>}
              {!!profile.instagram && <Text style={styles.socialChip}>Instagram</Text>}
              {!!profile.twitter && <Text style={styles.socialChip}>Twitter</Text>}
              {!!profile.vk && <Text style={styles.socialChip}>VK</Text>}
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.travelsCount}</Text>
              <Text style={styles.statLabel}>Путешествий</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.favoritesCount}</Text>
              <Text style={styles.statLabel}>Избранное</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.viewsCount}</Text>
              <Text style={styles.statLabel}>Просмотров</Text>
            </View>
          </View>
        </View>

        {(favoritesPreview.length > 0 || historyPreview.length > 0) && (
          <View style={styles.dashboardSections}>
            {favoritesPreview.length > 0 && (
              <View style={styles.dashboardSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>Избранное</Text>
                    <Text style={styles.sectionSubtitle}>{favorites.length} шт.</Text>
                  </View>
                  <Pressable
                    style={[styles.sectionAction, globalFocusStyles.focusable]}
                    onPress={() => router.push('/favorites')}
                    accessibilityRole="button"
                    accessibilityLabel="Открыть избранное"
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                  >
                    <Text style={styles.sectionActionText}>Смотреть все</Text>
                    <Feather name="chevron-right" size={16} color={DESIGN_TOKENS.colors.primary} />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsRow}
                  {...Platform.select({
                    web: {
                      style: { overflowX: 'auto', overflowY: 'hidden', width: '100%' } as any,
                    },
                    default: {},
                  })}
                >
                  {favoritesPreview.map((item: any) => (
                    <TabTravelCard
                      key={`${item.type || 'travel'}-${item.id}`}
                      item={{
                        id: item.id,
                        title: item.title,
                        imageUrl: item.imageUrl,
                        city: item.city ?? null,
                        country: item.country ?? null,
                      }}
                      onPress={() => router.push(item.url as any)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {historyPreview.length > 0 && (
              <View style={styles.dashboardSectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionTitle}>История</Text>
                    <Text style={styles.sectionSubtitle}>{viewHistory.length} шт.</Text>
                  </View>
                  <Pressable
                    style={[styles.sectionAction, globalFocusStyles.focusable]}
                    onPress={() => router.push('/history')}
                    accessibilityRole="button"
                    accessibilityLabel="Открыть историю просмотров"
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                  >
                    <Text style={styles.sectionActionText}>Смотреть все</Text>
                    <Feather name="chevron-right" size={16} color={DESIGN_TOKENS.colors.primary} />
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsRow}
                  {...Platform.select({
                    web: {
                      style: { overflowX: 'auto', overflowY: 'hidden', width: '100%' } as any,
                    },
                    default: {},
                  })}
                >
                  {historyPreview.map((item: any) => (
                    <TabTravelCard
                      key={`history-${item.type || 'travel'}-${item.id}-${item.viewedAt || ''}`}
                      item={{
                        id: item.id,
                        title: item.title,
                        imageUrl: item.imageUrl,
                        city: item.city ?? null,
                        country: item.country ?? null,
                      }}
                      badge={{ icon: 'history', backgroundColor: 'rgba(0,0,0,0.75)', iconColor: '#ffffff' }}
                      onPress={() => router.push(item.url as any)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Разделы</Text>
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                style={[styles.menuItem, globalFocusStyles.focusable]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                {...Platform.select({
                  web: { cursor: 'pointer' },
                })}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <Feather name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.count !== undefined && (
                    <Text style={styles.menuCount}>{item.count}</Text>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color="#ccc" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          style={[styles.logoutButton, globalFocusStyles.focusable]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Выйти из аккаунта"
          {...Platform.select({
            web: { cursor: 'pointer' },
          })}
        >
          <Feather name="log-out" size={20} color={DESIGN_TOKENS.colors.danger} /> {/* ✅ ИСПРАВЛЕНИЕ: Используем единый danger цвет */}
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  dashboardSections: {
    marginBottom: 16,
    gap: 12,
  },
  dashboardSectionCard: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  menuSection: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuSectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  cardsRow: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.lg, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  socialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  socialChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    color: DESIGN_TOKENS.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1b1f23',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b1f23',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  menuContainer: {
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.lg, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 56, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DESIGN_TOKENS.colors.border, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        },
      },
    }),
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1b1f23',
  },
  menuCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.danger, // ✅ ИСПРАВЛЕНИЕ: Используем единый danger цвет
    gap: 8,
    minHeight: 48, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          backgroundColor: DESIGN_TOKENS.colors.dangerSoft,
          borderColor: DESIGN_TOKENS.colors.danger,
        },
      },
    }),
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.danger, // ✅ ИСПРАВЛЕНИЕ: Используем единый danger цвет
  },
});
