import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, StatusBar, Pressable, Text, Image, Modal, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AccountMenu from './AccountMenu';
import HeaderContextBar from './HeaderContextBar';
import Logo from './Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useFilters } from '@/providers/FiltersProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useResponsive } from '@/hooks/useResponsive'; 
import { DOCUMENT_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';

type CustomHeaderProps = {
    onHeightChange?: (height: number) => void;
};

export default function CustomHeader({ onHeightChange }: CustomHeaderProps) {
    const colors = useThemedColors();
    const pathname = usePathname();
    const router = useRouter();
    const { isPhone, isLargePhone, isTablet } = useResponsive();
    const isMobile = isPhone || isLargePhone || isTablet;
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
    const mobileMenuOpenedAtRef = useRef(0);
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

        if (normalized.includes('X-Amz-') || normalized.includes('x-amz-')) {
            return normalized;
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
            setMobileMenuVisible(false);
            router.push('/login' as any);
            return;
        }
        setMobileMenuVisible(false);
        router.push('/travel/new' as any);
    }, [isAuthenticated, router]);

    const openMobileMenu = useCallback(() => {
        mobileMenuOpenedAtRef.current = Date.now();
        setMobileMenuVisible(true);
    }, []);

    const webStickyStyle = Platform.OS === 'web'
        ? { position: 'sticky' as const, top: 0, zIndex: 2000, width: '100%' }
        : null;

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
            paddingTop: Platform.OS === 'ios' ? (StatusBar.currentHeight || 0) : 0,
            paddingBottom: Platform.OS === 'web' ? 12 : 0,
            borderBottomWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: colors.border,
            ...(Platform.OS === 'web'
                ? ({
                      position: 'sticky',
                      top: 0,
                      zIndex: 2000,
                      width: '100%',
                  } as any)
                : { zIndex: 10 }),
        },
        wrapper: {
            width: '100%',
            backgroundColor: Platform.OS === 'web' ? colors.background : colors.surface,
            ...Platform.select({
                ios: {
                    ...DESIGN_TOKENS.shadowsNative.light,
                },
                android: {
                    elevation: 3,
                    shadowColor: DESIGN_TOKENS.shadowsNative.light.shadowColor,
                },
                web: {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                    boxShadow: DESIGN_TOKENS.shadows.card as any,
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
            backgroundColor: colors.surfaceMuted,
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
            backgroundColor: colors.surfaceMuted,
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
            color: colors.text,
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
            ...Platform.select({
                web: {
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' as any,
                    cursor: 'pointer' as any,
                },
            }),
        },
        navItemHover: {
            backgroundColor: colors.primarySoft,
            ...Platform.select({
                web: {
                    transform: 'translateY(-1px)' as any,
                },
            }),
        },
        navItemActive: {
            backgroundColor: colors.primaryLight,
            ...Platform.select({
                web: {
                    boxShadow: DESIGN_TOKENS.shadows.light as any,
                },
            }),
        },
        navLabel: {
            fontSize: 14,
            color: colors.textMuted,
            fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
            letterSpacing: -0.1,
        },
        navLabelActive: {
            color: colors.primary,
            fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
            letterSpacing: -0.2,
        },
        mobileMenuButton: {
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        createButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            gap: 8,
            minHeight: 44,
            minWidth: 44,
            ...Platform.select({
                web: {
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease' as any,
                    cursor: 'pointer' as any,
                    boxShadow: DESIGN_TOKENS.shadows.medium as any,
                },
            }),
        },
        createButtonHover: {
            opacity: 0.96,
            ...Platform.select({
                web: {
                    transform: 'translateY(-1px)' as any,
                    boxShadow: DESIGN_TOKENS.shadows.heavy as any,
                    filter: 'brightness(0.98)' as any,
                },
            }),
        },
        createLabel: {
            color: colors.textOnPrimary,
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
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: colors.surface,
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
            borderBottomColor: colors.border,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
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
            color: colors.textMuted,
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
            minHeight: 48,
        },
        modalNavItemHover: {
            backgroundColor: 'rgba(93, 140, 124, 0.10)',
        },
        modalNavItemActive: {
            backgroundColor: colors.primaryLight,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            paddingLeft: 17,
        },
        modalNavLabel: {
            fontSize: 16,
            color: colors.textMuted,
            fontWeight: '500',
            flex: 1,
        },
        modalNavLabelActive: {
            color: colors.primary,
            fontWeight: '600',
        },
        modalDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 8,
        },
    }), [colors]);

    return (
      <View 
        style={[styles.container, webStickyStyle]}
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
                                              color={isActive ? colors.primary : colors.textMuted}
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
                              accessibilityLabel="Поделиться маршрутом и историей"
                              testID="header-create"
                          >
                              <View style={styles.iconSlot18}>
                                  <Feather name="share-2" size={18} color={colors.surface} />
                              </View>
                              <Text style={styles.createLabel}>Поделиться путешествием</Text>
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
                                              <Icon name="account-circle" size={24} color={colors.text} />
                                          )}
                                      </View>
                                      <Text style={styles.mobileUserName} numberOfLines={1}>
                                          {username}
                                      </Text>
                                  </Pressable>
                              ) : (
                                  <View style={[styles.mobileUserPillPlaceholder, { pointerEvents: 'none' } as any]}>
                                      <View style={styles.mobileUserAvatarContainer}>
                                          <Icon name="account-circle" size={24} color={colors.text} />
                                      </View>
                                      <Text style={styles.mobileUserName} numberOfLines={1}>
                                          {' '}
                                      </Text>
                                  </View>
                              )}

                              <Pressable
                                  onPress={openMobileMenu}
                                  style={[
                                      styles.mobileMenuButton,
                                      globalFocusStyles.focusable, 
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityLabel="Открыть меню"
                                  testID="mobile-menu-open"
                              >
                                  <View style={styles.iconSlot24}>
                                      <Feather name="menu" size={24} color={colors.text} />
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
              <View style={styles.modalOverlay}>
                <Pressable
                  style={styles.modalOverlay}
                  testID="mobile-menu-overlay"
                  onPress={() => {
                    const isTestEnv =
                      typeof process !== 'undefined' &&
                      (process as any).env &&
                      (process as any).env.NODE_ENV === 'test';
                    const sinceOpen = Date.now() - mobileMenuOpenedAtRef.current;
                    if (!isTestEnv && sinceOpen < 250) return;
                    setMobileMenuVisible(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть меню"
                />

                <View
                  style={styles.modalContent}
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
                      <Feather name="x" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={styles.modalNavContainer}
                    keyboardShouldPersistTaps="handled"
                  >
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
                                        color={isActive ? colors.primary : colors.textMuted}
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
                                    <Feather name="log-in" size={20} color={colors.textMuted} />
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
                                    <Feather name="user-plus" size={20} color={colors.textMuted} />
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
                                    <Feather name="user" size={20} color={colors.textMuted} />
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
                                    <Feather name="map" size={20} color={colors.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Мои путешествия</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreate}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Поделиться маршрутом и историей"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="share-2" size={20} color={colors.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Поделиться путешествием</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleUserAction('/export')}
                                style={styles.modalNavItem}
                                accessibilityRole="button"
                                accessibilityLabel="Экспорт в PDF"
                            >
                                <View style={styles.iconSlot20}>
                                    <Feather name="file-text" size={20} color={colors.textMuted} />
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
                                    <Feather name="log-out" size={20} color={colors.textMuted} />
                                </View>
                                <Text style={styles.modalNavLabel}>Выход</Text>
                            </Pressable>
                        </>
                    )}

                    <View style={styles.modalDivider} />
                    <Text style={styles.modalSectionTitle}>Тема</Text>
                    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                      <ThemeToggle compact layout="vertical" showLabels />
                    </View>

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
                                <Feather name={item.icon as any} size={20} color={colors.textMuted} />
                            </View>
                            <Text style={styles.modalNavLabel}>{item.label}</Text>
                        </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
          </View>
      </View>
    );
}

