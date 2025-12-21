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
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { fetchUserProfile, type UserProfileDto } from '@/src/api/user';
import { ApiError } from '@/src/api/client';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { openExternalUrl } from '@/src/utils/externalLinks';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, logout, userId, setUserAvatar, triggerProfileRefresh } = useAuth();
  const favoritesContext = useFavorites();
  const { favorites = [], viewHistory = [] } = favoritesContext ?? { favorites: [], viewHistory: [] };
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
          setUserAvatar(normalizedAvatar);

          const { setStorageBatch, removeStorageBatch } = await import('@/src/utils/storageBatch');
          if (normalizedAvatar) {
            await setStorageBatch([['userAvatar', normalizedAvatar]]);
          } else {
            await removeStorageBatch(['userAvatar']);
          }

          triggerProfileRefresh();
        } catch (e) {
          if (__DEV__) {
            const message = e instanceof ApiError ? e.message : String(e);
            console.warn('Error loading user profile:', message);
          }
        }
      }

      // Подсчитываем статистику (без запроса на путешествия)
      setStats((prev) => ({
        ...prev,
        travelsCount: 0,
      }));
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setUserAvatar, triggerProfileRefresh, userId]);

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
          <View style={styles.dashboardSections}>
            {Array.from({ length: 4 }).map((_, index) => (
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

            <Pressable
              style={[styles.editProfileButton, globalFocusStyles.focusable]}
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Редактировать профиль"
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Feather name="edit-2" size={16} color={DESIGN_TOKENS.colors.primary} />
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

          {!!profile && (
            <View style={styles.socialsRow}>
              {!!profile.youtube && (
                <Pressable
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => {
                    openExternalUrl(String(profile.youtube || ''));
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Открыть YouTube"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>YouTube</Text>
                </Pressable>
              )}
              {!!profile.instagram && (
                <Pressable
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => {
                    openExternalUrl(String(profile.instagram || ''));
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Открыть Instagram"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>Instagram</Text>
                </Pressable>
              )}
              {!!profile.twitter && (
                <Pressable
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => {
                    openExternalUrl(String(profile.twitter || ''));
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Открыть Twitter"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>Twitter</Text>
                </Pressable>
              )}
              {!!profile.vk && (
                <Pressable
                  style={[styles.socialChip, globalFocusStyles.focusable]}
                  onPress={() => {
                    openExternalUrl(String(profile.vk || ''));
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="Открыть VK"
                  {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                  <Text style={styles.socialChipText}>VK</Text>
                </Pressable>
              )}
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
              <View
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
              <View
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
        <View
          style={styles.menuSection}
          onLayout={(e) => {
            sectionOffsetsRef.current.sections = e.nativeEvent.layout.y;
          }}
        >
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
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  editProfileButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.primary,
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
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  quickNavChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  socialChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  socialChipText: {
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
