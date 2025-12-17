import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, StatusBar, useWindowDimensions, Pressable, Text, Image } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import RenderRightMenu from './RenderRightMenu';
import Breadcrumbs from './Breadcrumbs';
import Logo from './Logo';
import { useAuth } from '@/context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { globalFocusStyles } from '@/styles/globalFocus'; 
import { useUserProfileCached } from '@/src/hooks/useUserProfileCached';

// Навигационные элементы для быстрого доступа
const NAV_ITEMS = [
    { path: '/', label: 'Путешествия', icon: 'home' },
    { path: '/travelsby', label: 'Беларусь', icon: 'globe' },
    { path: '/map', label: 'Карта', icon: 'map' },
    { path: '/roulette', label: 'Случайный маршрут', icon: 'shuffle' },
    { path: '/quests', label: 'Квесты', icon: 'flag' },
];

const palette = DESIGN_TOKENS.colors;

export default function CustomHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width <= METRICS.breakpoints.tablet;
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
    const { isAuthenticated, username, logout, userId, profileRefreshToken } = useAuth();
    const [avatarLoadError, setAvatarLoadError] = useState(false);

    const { profile } = useUserProfileCached(userId, {
        enabled: isAuthenticated && !!userId,
        cacheKeySuffix: profileRefreshToken,
    });

    const avatarUri = useMemo(() => {
        if (avatarLoadError) return null;
        const raw = String(profile?.avatar ?? '').trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        if (lower === 'null' || lower === 'undefined') return null;

        let normalized = raw;
        if (raw.startsWith('/')) {
            const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
            if (base) {
                normalized = `${base}${raw}`;
            }
        }

        const separator = normalized.includes('?') ? '&' : '?';
        return `${normalized}${separator}v=${profileRefreshToken}`;
    }, [avatarLoadError, profile?.avatar, profileRefreshToken]);

    // Определяем активную страницу
    const activePath = useMemo(() => {
        if (pathname === '/' || pathname === '/index') return '/';
        if (pathname.startsWith('/travels/')) return '/';
        if (pathname.startsWith('/quests/')) return '/quests';
        return pathname;
    }, [pathname]);

    const handleNavPress = (path: string) => {
        router.push(path as any);
        setMobileMenuVisible(false);
    };

    const handleUserAction = useCallback((path: string, extraAction?: () => void) => {
        requestAnimationFrame(() => {
            extraAction?.();
            router.push(path as any);
            setMobileMenuVisible(false);
        });
    }, [router]);

    const handleLogout = useCallback(async () => {
        await logout();
        setMobileMenuVisible(false);
        router.push('/');
    }, [logout, router]);

    return (
      <View 
        style={styles.container}
        testID="main-header"
        onLayout={() => {}}
      >
          <View style={styles.wrapper}>
              <View style={[styles.inner, isMobile && styles.innerMobile]}>
                  {/* Логотип - слева */}
                  <Logo />
                  
                  {/* Навигация - в центре, показываем только на десктопе и планшетах */}
                  {!isMobile && (
                      <View style={styles.navContainer}>
                          {NAV_ITEMS.map((item) => {
                              const isActive = activePath === item.path;
                              return (
                                  <Pressable
                                      key={item.path}
                                      onPress={() => handleNavPress(item.path)}
                                      style={[
                                          styles.navItem, 
                                          isActive && styles.navItemActive,
                                          globalFocusStyles.focusable, 
                                      ]}
                                      accessibilityRole="button"
                                      accessibilityLabel={item.label}
                                      accessibilityState={{ selected: isActive }}
                                  >
                                      <View style={styles.iconSlot18}>
                                          <Feather
                                              name={item.icon as any}
                                              size={18}
                                              color={isActive ? palette.primary : palette.textMuted}
                                          />
                                      </View>
                                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                                          {item.label}
                                      </Text>
                                  </Pressable>
                              );
                          })}
                      </View>
                  )}
                  
                  {/* Элементы пользователя - справа */}
                  <View style={styles.rightSection}>
                      {/* Мобильное меню - кнопка (только на мобильных) */}
                      {isMobile ? (
                          <>
                              {isAuthenticated && username ? (
                                  <Pressable
                                      onPress={() => handleUserAction('/profile')}
                                      style={[styles.mobileUserPill, globalFocusStyles.focusable]}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Открыть профиль ${username}`}
                                  >
                                      <View style={styles.mobileUserAvatarContainer}>
                                          {avatarUri ? (
                                              <Image
                                                  source={{ uri: avatarUri }}
                                                  style={styles.mobileUserAvatar}
                                                  onError={() => setAvatarLoadError(true)}
                                              />
                                          ) : (
                                              <Icon name="account-circle" size={24} color="#333" />
                                          )}
                                      </View>
                                      <Text style={styles.mobileUserName} numberOfLines={1}>
                                          {username}
                                      </Text>
                                  </Pressable>
                              ) : null}

                              <Pressable
                                  onPress={() => setMobileMenuVisible(true)}
                                  style={[
                                      styles.mobileMenuButton,
                                      globalFocusStyles.focusable, 
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel="Открыть меню"
                              >
                                  <View style={styles.iconSlot24}>
                                      <Feather name="menu" size={24} color="#1b1f23" />
                                  </View>
                              </Pressable>
                          </>
                      ) : (
                          <RenderRightMenu />
                      )}
                  </View>
              </View>
          
          {/* Хлебные крошки - показываем на всех страницах кроме главной */}
          {pathname !== '/' && pathname !== '/index' && (
            <Breadcrumbs />
          )}
      </View>
      </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: palette.surface,
        // Sticky header для лучшей навигации
        // (на web положение управляется родительским layout)
        ...Platform.select({
            web: {
                // @ts-ignore: web-only position value
                position: 'sticky' as any,
                top: 0,
            },
            default: {
                position: 'relative',
            },
        }),
        zIndex: 1000,
    },
    wrapper: {
        width: '100%',
        backgroundColor: palette.surface,
        // Убрана граница, используется только тень для разделения
        ...Platform.select({
            ios: {
                shadowColor: '#1f1f1f',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
            },
            android: {
                elevation: 3,
                shadowColor: '#1f1f1f',
            },
            web: {
                shadowColor: '#1f1f1f',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 2,
                // @ts-ignore: web-only style
                boxShadow: '0 2px 10px rgba(31, 31, 31, 0.1), 0 1px 3px rgba(31, 31, 31, 0.06)' as any,
            }
        })
    },
    inner: {
        width: '100%',
        maxWidth: '100%',
        paddingHorizontal: 12, 
        paddingVertical: 8,    
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        // Адаптивная высота для разных платформ
        ...Platform.select({
            ios: {
                minHeight: 44,
                paddingTop: (StatusBar.currentHeight || 0) + 8,
            },
            android: {
                minHeight: 48,
                paddingTop: (StatusBar.currentHeight || 0) + 6,
            },
            web: {
                minHeight: 56,
                paddingHorizontal: 16,
                paddingVertical: 10,
            }
        }),
        // Оптимизация для веба
        ...(Platform.OS === 'web' && {
            marginLeft: 'auto',
            marginRight: 'auto',
        }),
    },
    innerMobile: {
        paddingHorizontal: 10,
    },
    navContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'center',
        marginHorizontal: 16,
    },
    iconSlot18: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconSlot20: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconSlot24: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    mobileUserPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        maxWidth: 180,
        gap: 6,
        minHeight: 44,
    },
    mobileUserAvatarContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    mobileUserAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    mobileUserName: {
        fontSize: 16,
        color: '#333',
        flexShrink: 1,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: DESIGN_TOKENS.radii.sm,
        gap: 8,
        backgroundColor: 'transparent',
        // CLS FIX: Fixed width to prevent shifts during font/icon loading
        width: 120,
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        // Улучшенные hover-состояния с лучшей визуальной иерархией
        ...Platform.select({
            web: {
                // @ts-ignore: web-only styles
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' as any,
                // @ts-ignore: web-only styles
                cursor: 'pointer' as any,
                // @ts-ignore: web-only styles
                transform: 'translateY(-1px)' as any,
            },
        }),
    },
    navItemActive: {
        backgroundColor: palette.primaryLight,
        // Убрана граница, используется только фон и тень
        ...Platform.select({
            web: {
                // @ts-ignore: web-only style
                boxShadow: `0 2px 4px rgba(93, 140, 124, 0.15)` as any,
            },
        }),
    },
    navLabel: {
        fontSize: 14,
        color: palette.textMuted,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        letterSpacing: -0.1,
    },
    navLabelActive: {
        color: palette.primary,
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any, 
        letterSpacing: -0.2,
    },
    mobileMenuButton: {
        padding: 8,
        // Увеличен размер touch-цели для мобильных (минимум 44x44px)
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: palette.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.text,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalNavContainer: {
        paddingVertical: 8,
    },
    modalNavItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        // Увеличен размер touch-цели для мобильных
        minHeight: 48,
    },
    modalNavItemActive: {
        backgroundColor: palette.primaryLight,
        borderLeftWidth: 3,
        borderLeftColor: palette.primary,
        paddingLeft: 17, 
    },
    modalNavLabel: {
        fontSize: 16,
        color: palette.textMuted,
        fontWeight: '500',
        flex: 1,
    },
    modalNavLabelActive: {
        color: palette.primary,
        fontWeight: '600',
    },
    modalDivider: {
        height: 1,
        backgroundColor: palette.border,
        marginVertical: 8,
        marginHorizontal: 20,
    },
    breadcrumbsContainer: {
        // CLS FIX: Fixed height to reserve space for breadcrumbs and prevent layout shifts
        minHeight: 32, 
    },
});