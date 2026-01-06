// Страница профиля пользователя
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { fetchUserProfile, type UserProfileDto } from '@/src/api/user';
import { fetchMyTravels } from '@/src/api/travelsApi';
import { ApiError } from '@/src/api/client';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { openExternalUrl } from '@/src/utils/externalLinks';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useThemedColors } from '@/hooks/useTheme';

interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, logout, userId, setUserAvatar, triggerProfileRefresh: _triggerProfileRefresh } = useAuth();
  const favoritesContext = useFavorites();
  const { favorites = [], viewHistory = [] } = favoritesContext ?? { favorites: [], viewHistory: [] };
  const colors = useThemedColors();
  const [userInfo, setUserInfo] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [stats, setStats] = useState<UserStats>({
    travelsCount: 0,
    favoritesCount: 0,
    viewsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Record<string, number>>({});

  const socialLinks = useMemo(
    () =>
      profile
        ? [
            { key: 'youtube', label: 'YouTube', url: profile.youtube },
            { key: 'instagram', label: 'Instagram', url: profile.instagram },
            { key: 'twitter', label: 'Twitter', url: profile.twitter },
            { key: 'vk', label: 'VK', url: profile.vk },
          ].filter((link) => !!link.url)
        : [],
    [profile]
  );

  const favoritesPreview = Array.isArray(favorites) ? favorites.slice(0, 8) : [];
  const historyPreview = Array.isArray(viewHistory) ? viewHistory.slice(0, 8) : [];

  const quickNavItems = useMemo(
    () =>
      [
        { key: 'profile', label: 'Профиль' },
        ...(favoritesPreview.length > 0 ? [{ key: 'favorites', label: 'Избранное' }] : []),
        ...(historyPreview.length > 0 ? [{ key: 'history', label: 'История' }] : []),
        { key: 'sections', label: 'Разделы' },
      ] as const,
    [favoritesPreview.length, historyPreview.length]
  );

  const handleScrollToSection = useCallback((key: string) => {
    const y = sectionOffsetsRef.current[key];
    if (typeof y !== 'number') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, []);

  const loadUserData = useCallback(async () => {
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

          const rawAvatar = String((profileData as any)?.avatar ?? '').trim();
          const lowerAvatar = rawAvatar.toLowerCase();
          const normalizedAvatar = rawAvatar && lowerAvatar !== 'null' && lowerAvatar !== 'undefined' ? rawAvatar : null;

          if (normalizedAvatar) {
            setUserAvatar(normalizedAvatar);

            const { setStorageBatch } = await import('@/src/utils/storageBatch');
            await setStorageBatch([['userAvatar', normalizedAvatar]]);
          }

          // Загружаем путешествия пользователя для подсчёта
          try {
            const userTravels = await fetchMyTravels({ user_id: uid });
            const payload: any = userTravels;
            const travelsCount = (() => {
              if (!payload) return 0;
              if (Array.isArray(payload)) return payload.length;
              if (Array.isArray(payload?.data)) return payload.data.length;
              if (Array.isArray(payload?.results)) return payload.results.length;
              if (Array.isArray(payload?.items)) return payload.items.length;
              if (typeof payload?.total === 'number') return payload.total;
              if (typeof payload?.count === 'number') return payload.count;
              return 0;
            })();
            setStats((prev) => ({
              ...prev,
              travelsCount,
            }));
          } catch (e) {
            if (__DEV__) {
              const message = e instanceof ApiError ? e.message : String(e);
              console.warn('Error loading user travels:', message);
            }
            setStats((prev) => ({
              ...prev,
              travelsCount: 0,
            }));
          }
        } catch (e) {
          if (__DEV__) {
            const message = e instanceof ApiError ? e.message : String(e);
            console.warn('Error loading user profile:', message);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setUserAvatar, userId]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      favoritesCount: favorites.length,
      viewsCount: viewHistory.length,
    }));
  }, [favorites.length, viewHistory.length]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, router]);

  // Создаём стили до всех условных return
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: { flex: 1 },
    content: { padding: 16, paddingBottom: 32 },
    dashboardSections: { marginBottom: 16, gap: 12 },
    dashboardSectionCard: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: { boxShadow: colors.boxShadows.light } as any,
        default: {},
      }),
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    header: {
      paddingTop: 8,
      paddingBottom: 16,
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarPlaceholder: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    headerTextBlock: {
      flex: 1,
    },
    userName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 13,
      color: colors.textMuted,
    },
    logoutButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    logoutButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.danger,
    },
    quickNav: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    quickNavButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    quickNavButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    quickNavButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    quickNavButtonTextActive: {
      color: colors.textOnPrimary,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      padding: 14,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    socialLinks: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
    },
    socialButton: {
      padding: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    gridItem: {
      width: '48%',
      minWidth: 160,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
      fontStyle: 'italic',
    },
    linkButton: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    linkButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    linkButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    editProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
    },
    editProfileButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    quickNavRow: {
      paddingHorizontal: 6,
      paddingBottom: 4,
      gap: 8,
      alignItems: 'center',
    },
    quickNavChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickNavChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
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
      backgroundColor: colors.primarySoft,
    },
    socialChipText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
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
    sectionSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
    },
    sectionAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    sectionActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    cardsRow: {
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    menuSection: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 16,
    },
    menuSectionTitle: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    menuContainer: {
      backgroundColor: colors.surface,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      minHeight: 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          ':hover': { backgroundColor: colors.primarySoft } as any,
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
      color: colors.text,
    },
    menuCount: {
      fontSize: 14,
      color: colors.textMuted,
      marginLeft: 8,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.danger,
    },
  }), [colors]);

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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <SkeletonLoader width={72} height={72} borderRadius={36} />
              <View style={styles.headerTextBlock}>
                <SkeletonLoader width={150} height={24} borderRadius={4} style={{ marginBottom: 8 }} />
                <SkeletonLoader width={200} height={16} borderRadius={4} />
              </View>
            </View>
          </View>
          <View style={styles.dashboardSections}>{Array.from({ length: 4 }).map((_, index) => (
              <View key={index} style={{ marginBottom: 12 }}>
                <SkeletonLoader width="100%" height={120} borderRadius={12} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'heart',
      label: 'Избранное',
      count: stats.favoritesCount,
      onPress: () => router.push('/favorites'),
      color: colors.danger,
      bg: colors.dangerSoft,
    },
    {
      icon: 'map',
      label: 'Мои путешествия',
      count: stats.travelsCount,
      onPress: () => router.push('/metravel'),
      color: colors.primary,
      bg: colors.primarySoft,
    },
    {
      icon: 'eye',
      label: 'История просмотров',
      count: stats.viewsCount,
      onPress: () => router.push('/history'),
      color: colors.primary,
      bg: colors.primarySoft,
    },
    {
      icon: 'settings',
      label: 'Настройки',
      onPress: () => router.push('/settings'),
      color: colors.textMuted,
      bg: colors.surfaceMuted,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.scrollView} contentContainerStyle={styles.content}>
        <View
          style={styles.header}
          onLayout={(e) => {
            sectionOffsetsRef.current.profile = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.headerRow}>
              <View style={styles.avatar}>
                {profile?.avatar ? (
                  <Image
                    source={{ uri: profile.avatar }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Feather name="user" size={28} color={colors.primary} />
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

            <Pressable
              style={[styles.editProfileButton, globalFocusStyles.focusable]}
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Редактировать профиль"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="edit-2" size={16} color={colors.primary} />
              <Text style={styles.editProfileButtonText}>Редактировать</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavRow}
            {...Platform.select({
              web: {
                style: { overflowX: 'auto', overflowY: 'hidden', width: '100%' } as any,
              },
              default: {},
            })}
          >
            {quickNavItems.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.quickNavChip, globalFocusStyles.focusable]}
                onPress={() => handleScrollToSection(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Перейти к секции: ${item.label}`}
                {...Platform.select({ web: { cursor: 'pointer' } })}
              >
                <Text style={styles.quickNavChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {socialLinks.length > 0 && (
            <View style={styles.socialsRow}>
              {socialLinks.map((link) => (
                <Pressable
                  key={link.key}
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => openExternalUrl(String(link.url))}
                  accessibilityRole="link"
                  accessibilityLabel={`Открыть ${link.label}`}
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>{link.label}</Text>
                </Pressable>
              ))}
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
            {[
              favoritesPreview.length > 0 ? (
                <View
                  key="favorites"
                  style={styles.dashboardSectionCard}
                  onLayout={(e) => {
                    sectionOffsetsRef.current.favorites = e.nativeEvent.layout.y;
                  }}
                >
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
                      <Feather name="chevron-right" size={16} color={colors.primary} />
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
              ) : null,
              historyPreview.length > 0 ? (
                <View
                  key="history"
                  style={styles.dashboardSectionCard}
                  onLayout={(e) => {
                    sectionOffsetsRef.current.history = e.nativeEvent.layout.y;
                  }}
                >
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
                      <Feather name="chevron-right" size={16} color={colors.primary} />
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
                        badge={{ icon: 'history', backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.75)', iconColor: colors.textOnDark }}
                        onPress={() => router.push(item.url as any)}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null,
            ].filter(Boolean)}
          </View>
        )}

        {/* Menu Items */}
        <View
          style={styles.menuSection}
          onLayout={(e) => {
            sectionOffsetsRef.current.sections = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.menuSectionTitle}>Разделы</Text>
          <View style={styles.menuContainer}>{menuItems.map((item, index) => (
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
                <Feather name="chevron-right" size={20} color={colors.textMuted} />
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
          <Feather name="log-out" size={20} color={colors.danger} /> {/* ✅ ИСПРАВЛЕНИЕ: Используем единый danger цвет */}
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
