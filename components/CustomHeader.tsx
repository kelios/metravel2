import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, StatusBar, useWindowDimensions, Pressable, Text, Image, Modal, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AccountMenu from './AccountMenu';
import HeaderContextBar from './HeaderContextBar';
import Logo from './Logo';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useFilters } from '@/providers/FiltersProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { globalFocusStyles } from '@/styles/globalFocus'; 
import { DOCUMENT_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';

const palette = DESIGN_TOKENS.colors;

type CustomHeaderProps = {
    onHeightChange?: (height: number) => void;
};

export default function CustomHeader({ onHeightChange }: CustomHeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const effectiveWidth =
        Platform.OS === 'web' && width === 0
            ? typeof window !== 'undefined'
                ? window.innerWidth
                : METRICS.breakpoints.tablet + 1
            : width;
    const isMobile = effectiveWidth <= METRICS.breakpoints.tablet;
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
    const { isAuthenticated, username, logout, userAvatar, profileRefreshToken, userId } = useAuth();
    const { favorites } = useFavorites();
    const { updateFilters } = useFilters();
    const [avatarLoadError, setAvatarLoadError] = useState(false);
    const lastHeightRef = useRef(0);

    React.useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!mobileMenuVisible) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMobileMenuVisible(false);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [mobileMenuVisible]);

    const avatarUri = useMemo(() => {
        if (avatarLoadError) return null;
        const raw = String(userAvatar ?? '').trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        if (lower === 'null' || lower === 'undefined') return null;

        let normalized = raw;
        if (raw.startsWith('/')) {
            const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
            if (base) {
                normalized = `${base}${raw}`;
            } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
                normalized = `${window.location.origin}${raw}`;
            }
        }

        const separator = normalized.includes('?') ? '&' : '?';
        return `${normalized}${separator}v=${profileRefreshToken}`;
    }, [avatarLoadError, userAvatar, profileRefreshToken]);

    React.useEffect(() => {
        setAvatarLoadError(false);
    }, [profileRefreshToken, userAvatar]);

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

    const handleUserAction = useCallback(
        (path: string, extraAction?: () => void) => {
            extraAction?.();
            router.push(path as any);
            setMobileMenuVisible(false);
        },
        [router]
    );

    const handleLogout = useCallback(async () => {
        await logout();
        setMobileMenuVisible(false);
        router.push('/');
    }, [logout, router]);

    const handleCreate = useCallback(() => {
        if (!isAuthenticated) {
            router.push('/login' as any);
            return;
        }
        router.push('/travel/new' as any);
    }, [isAuthenticated, router]);

    return (
      <View 
        style={styles.container}
        testID="main-header"
        onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.height);
            if (next > 0 && next !== lastHeightRef.current) {
                lastHeightRef.current = next;
                onHeightChange?.(next);
            }
        }}
      >
          <View style={styles.wrapper}>
              <View style={[styles.inner, isMobile && styles.innerMobile]}>
                  {/* Логотип - слева */}
                  <Logo />
                  
                  {/* Навигация - в центре, показываем только на десктопе и планшетах */}
                  {!isMobile && (
                      <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.navContainer}
                          style={styles.navScroll}
                          alwaysBounceHorizontal={false}
                      >
                          {PRIMARY_HEADER_NAV_ITEMS.map((item) => {
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
                      </ScrollView>
                  )}
                  
                  {/* Элементы пользователя - справа */}
                  <View style={styles.rightSection}>
                      {!isMobile && (
                          <Pressable
                              onPress={handleCreate}
                              style={({ hovered, pressed }) => [
                                  styles.createButton,
                                  (hovered || pressed) && styles.createButtonHover,
                                  globalFocusStyles.focusable,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Добавить путешествие"
                              testID="header-create"
                          >
                              <View style={styles.createIconComposite}>
                                  <Feather name="book" size={18} color={palette.surface} />
                                  <View style={styles.createIconPlus}>
                                      <Feather name="plus" size={10} color={palette.surface} />
                                  </View>
                                  <View style={styles.createIconPin}>
                                      <Feather name="map-pin" size={10} color={palette.surface} />
                                  </View>
                              </View>
                              <Text style={styles.createLabel}>Добавить</Text>
                          </Pressable>
                      )}

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
                              ) : (
                                  <View style={styles.mobileUserPillPlaceholder} pointerEvents="none">
                                      <View style={styles.mobileUserAvatarContainer}>
                                          <Icon name="account-circle" size={24} color="#333" />
                                      </View>
                                      <Text style={styles.mobileUserName} numberOfLines={1}>
                                          {' '}
                                      </Text>
                                  </View>
                              )}

                              <Pressable
                                  onPress={() => setMobileMenuVisible(true)}
                                  style={[
                                      styles.mobileMenuButton,
                                      globalFocusStyles.focusable, 
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel="Открыть меню"
                                  testID="mobile-menu-open"
                              >
                                  <View style={styles.iconSlot24}>
                                      <Feather name="menu" size={24} color="#1b1f23" />
                                  </View>
                              </Pressable>
                          </>
                      ) : (
                          <AccountMenu />
                      )}
                  </View>
              </View>
          
          <HeaderContextBar />

          {isMobile && (
            <Modal
              visible={mobileMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setMobileMenuVisible(false)}
            >
              <Pressable
                style={styles.modalOverlay}
                onPress={() => setMobileMenuVisible(false)}
                testID="mobile-menu-overlay"
              >
                <Pressable
                  style={styles.modalContent}
                  onPress={(e) => {
                    e.stopPropagation();
                  }}
                  testID="mobile-menu-panel"
                  {...(Platform.OS === 'web'
                    ? ({ role: 'dialog', 'aria-modal': 'true' } as any)
                    : {})}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Меню</Text>
                    <Pressable
                      onPress={() => setMobileMenuVisible(false)}
                      style={styles.modalCloseButton}
                      accessibilityRole="button"
                      accessibilityLabel="Закрыть меню"
                      testID="mobile-menu-close"
                    >
                      <Feather name="x" size={22} color={palette.text} />
                    </Pressable>
                  </View>
                  <ScrollView style={styles.modalNavContainer}>
                    <Text style={styles.modalSectionTitle}>Навигация</Text>
                    {PRIMARY_HEADER_NAV_ITEMS.map((item) => {
                        const isActive = activePath === item.path;
                        return (
                            <Pressable
                                key={item.path}
                                onPress={() => handleNavPress(item.path)}
                                style={({ hovered, pressed }) => [
                                    styles.modalNavItem,
                                    (hovered || pressed) && styles.modalNavItemHover,
                                    isActive && styles.modalNavItemActive,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                                accessibilityState={{ selected: isActive }}
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather
                                        name={item.icon as any}
                                        size={20}
                                        color={isActive ? palette.primary : palette.textMuted}
                                    />
                                </View>
                                <Text style={[styles.modalNavLabel, isActive && styles.modalNavLabelActive]}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}

                    <View style={styles.modalDivider} />
                    <Text style={styles.modalSectionTitle}>Аккаунт</Text>
                    {!isAuthenticated ? (
                        <>
                            <Pressable
                                onPress={() => handleUserAction('/login')}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Войти"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="log-in" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Войти</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleUserAction('/registration')}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Зарегистрироваться"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="user-plus" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Зарегистрироваться</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Pressable
                                onPress={() => handleUserAction('/profile')}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Личный кабинет"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="user" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>
                                    {`Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    handleUserAction('/metravel', () => {
                                        const numericUserId = userId ? Number(userId) : undefined;
                                        updateFilters({ user_id: numericUserId });
                                    })
                                }
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Мои путешествия"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="map" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Мои путешествия</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreate}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Добавить путешествие"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="book" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Добавить путешествие</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleUserAction('/export')}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Экспорт в PDF"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="file-text" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Экспорт в PDF</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleLogout}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Выход"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="log-out" size={20} color={palette.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Выход</Text>
                            </Pressable>
                        </>
                    )}

                    <View style={styles.modalDivider} />
                    <Text style={styles.modalSectionTitle}>Документы</Text>
                    {DOCUMENT_NAV_ITEMS.map((item) => (
                        <Pressable
                            key={item.path}
                            onPress={() => handleUserAction(item.path)}
                            style={styles.modalNavItem}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                        >
                            <View style={styles.iconSlot20}>
                                <Feather name={item.icon as any} size={20} color={palette.textMuted} />
                            </View>
                            <Text style={styles.modalNavLabel}>{item.label}</Text>
                        </Pressable>
                    ))}
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>
          )}
      </View>
      </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Platform.OS === 'web' ? '#FBFAF8' : palette.surface,
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
        backgroundColor: Platform.OS === 'web' ? '#FBFAF8' : palette.surface,
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
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(17, 24, 39, 0.08)',
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
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    navScroll: {
        flex: 1,
        marginHorizontal: 12,
        minHeight: 44,
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
    mobileUserPillPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        maxWidth: 180,
        gap: 6,
        minHeight: 44,
        opacity: 0,
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
        borderRadius: 999,
        gap: 8,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        flexShrink: 0,
        // Улучшенные hover-состояния с лучшей визуальной иерархией
        ...Platform.select({
            web: {
                // @ts-ignore: web-only styles
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' as any,
                // @ts-ignore: web-only styles
                cursor: 'pointer' as any,
            },
        }),
    },
    navItemHover: {
        backgroundColor: 'rgba(93, 140, 124, 0.10)',
        ...Platform.select({
            web: {
                // @ts-ignore: web-only style
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
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        gap: 8,
        minHeight: 44,
        minWidth: 44,
        ...Platform.select({
            web: {
                // @ts-ignore: web-only styles
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease' as any,
                // @ts-ignore: web-only styles
                cursor: 'pointer' as any,
            },
        }),
    },
    createButtonHover: {
        ...Platform.select({
            web: {
                // @ts-ignore: web-only style
                transform: 'translateY(-1px)' as any,
                // @ts-ignore: web-only style
                boxShadow: '0 8px 16px rgba(47, 94, 80, 0.18)' as any,
            },
        }),
    },
    createLabel: {
        color: palette.surface,
        fontSize: 14,
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        letterSpacing: -0.1,
    },
    createIconComposite: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    createIconPlus: {
        position: 'absolute',
        top: -4,
        right: -4,
    },
    createIconPin: {
        position: 'absolute',
        bottom: -4,
        right: -4,
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
    modalSectionTitle: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        fontSize: 13,
        color: palette.textMuted,
        fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
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
    modalNavItemHover: {
        backgroundColor: 'rgba(93, 140, 124, 0.10)',
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
});