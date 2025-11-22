import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, StatusBar, useWindowDimensions, Pressable, Text, Modal, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import RenderRightMenu from './RenderRightMenu';
import Breadcrumbs from './Breadcrumbs';
import Logo from './Logo';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useFilters } from '@/providers/FiltersProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

// Навигационные элементы для быстрого доступа
const NAV_ITEMS = [
    { path: '/', label: 'Путешествия', icon: 'home' },
    { path: '/travelsby', label: 'Беларусь', icon: 'globe' },
    { path: '/map', label: 'Карта', icon: 'map' },
    { path: '/roulette', label: 'Случайный маршрут', icon: 'shuffle' },
    { path: '/quests', label: 'Квесты', icon: 'flag' },
];

const palette = DESIGN_TOKENS.colors;

export default React.memo(function CustomHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
    const { isAuthenticated, username, logout, userId } = useAuth();
    const { favorites } = useFavorites();
    const { updateFilters } = useFilters();

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
    }, []);

    const handleLogout = useCallback(async () => {
        await logout();
        setMobileMenuVisible(false);
        router.push('/');
    }, [logout]);

    return (
      <View 
        style={styles.container}
        {...Platform.select({
          web: {
            // @ts-ignore
            id: 'main-navigation',
            role: 'navigation',
            'aria-label': 'Основная навигация',
          },
        })}
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
                                          globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                      ]}
                                      accessibilityRole="button"
                                      accessibilityLabel={item.label}
                                      accessibilityState={{ selected: isActive }}
                                  >
                                      <Feather 
                                          name={item.icon as any} 
                                          size={18} 
                                          color={isActive ? palette.primary : palette.textMuted} 
                                      />
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
                          <Pressable
                              onPress={() => setMobileMenuVisible(true)}
                              style={[
                                  styles.mobileMenuButton,
                                  globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Открыть меню"
                          >
                              <Feather name="menu" size={24} color="#1b1f23" />
                          </Pressable>
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
          
          {/* Мобильное меню - модальное окно */}
          {isMobile && (
              <Modal
                  visible={mobileMenuVisible}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setMobileMenuVisible(false)}
              >
                  <Pressable 
                      style={styles.modalOverlay}
                      onPress={() => setMobileMenuVisible(false)}
                  >
                      <Pressable 
                          style={styles.modalContent}
                          onPress={(e) => e.stopPropagation()}
                      >
                          <View style={styles.modalHeader}>
                              <Text style={styles.modalTitle}>Меню</Text>
                              <Pressable
                                  onPress={() => setMobileMenuVisible(false)}
                                  style={styles.modalCloseButton}
                                  accessibilityRole="button"
                                  accessibilityLabel="Закрыть меню"
                              >
                                  <Feather name="x" size={24} color="#1b1f23" />
                              </Pressable>
                          </View>
                          
                          <ScrollView style={styles.modalNavContainer}>
                              {/* Навигация */}
                              {NAV_ITEMS.map((item) => {
                                  const isActive = activePath === item.path;
                                  return (
                                      <Pressable
                                          key={item.path}
                                          onPress={() => handleNavPress(item.path)}
                                          style={[
                                              styles.modalNavItem, 
                                              isActive && styles.modalNavItemActive,
                                              globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                          ]}
                                          accessibilityRole="button"
                                          accessibilityLabel={item.label}
                                          accessibilityState={{ selected: isActive }}
                                      >
                                          <Feather 
                                              name={item.icon as any} 
                                              size={20} 
                                              color={isActive ? palette.primary : palette.textMuted} 
                                          />
                                          <Text style={[styles.modalNavLabel, isActive && styles.modalNavLabelActive]}>
                                              {item.label}
                                          </Text>
                                          {isActive && (
                                              <Feather name="check" size={18} color={palette.primary} />
                                          )}
                                      </Pressable>
                                  );
                              })}

                              {/* Разделитель перед функциями пользователя */}
                              {isAuthenticated && (
                                  <>
                                      <View style={styles.modalDivider} />
                                      
                                      {/* Функции пользователя */}
                                      <Pressable
                                          onPress={() => handleUserAction('/profile')}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Личный кабинет"
                                      >
                                          <Icon name="account-circle" size={20} color="#6b8e7f" />
                                          <Text style={styles.modalNavLabel}>
                                              Личный кабинет{favorites.length > 0 ? ` (${favorites.length})` : ''}
                                          </Text>
                                      </Pressable>

                                      <Pressable
                                          onPress={() => handleUserAction('/metravel', () => updateFilters({ user_id: userId }))}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Мои путешествия"
                                      >
                                          <Icon name="earth" size={20} color="#6aaaaa" />
                                          <Text style={styles.modalNavLabel}>Мои путешествия</Text>
                                      </Pressable>

                                      <Pressable
                                          onPress={() => handleUserAction('/travel/new')}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Добавить путешествие"
                                      >
                                          <Icon name="map-plus" size={20} color="#6aaaaa" />
                                          <Text style={styles.modalNavLabel}>Добавить путешествие</Text>
                                      </Pressable>

                                      <Pressable
                                          onPress={() => handleUserAction('/export')}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Экспорт в PDF"
                                      >
                                          <Icon name="file-pdf-box" size={20} color="#b83a3a" />
                                          <Text style={styles.modalNavLabel}>Экспорт в PDF</Text>
                                      </Pressable>

                                      <View style={styles.modalDivider} />

                                      <Pressable
                                          onPress={handleLogout}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Выход"
                                      >
                                          <Icon name="logout" size={20} color="#6aaaaa" />
                                          <Text style={styles.modalNavLabel}>Выход</Text>
                                      </Pressable>
                                  </>
                              )}

                              {/* Если не авторизован */}
                              {!isAuthenticated && (
                                  <>
                                      <View style={styles.modalDivider} />
                                      
                                      <Pressable
                                          onPress={() => handleUserAction('/login')}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Войти"
                                      >
                                          <Icon name="login" size={20} color="#667085" />
                                          <Text style={styles.modalNavLabel}>Войти</Text>
                                      </Pressable>

                                      <Pressable
                                          onPress={() => handleUserAction('/registration')}
                                          style={styles.modalNavItem}
                                          accessibilityRole="button"
                                          accessibilityLabel="Зарегистрироваться"
                                      >
                                          <Icon name="account-plus" size={20} color="#667085" />
                                          <Text style={styles.modalNavLabel}>Зарегистрироваться</Text>
                                      </Pressable>
                                  </>
                              )}
                          </ScrollView>
                      </Pressable>
                  </Pressable>
              </Modal>
          )}
      </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: palette.surface,
        // ✅ УЛУЧШЕНИЕ: Sticky header для лучшей навигации
        ...Platform.select({
            web: {
                position: 'sticky',
                top: 0,
                zIndex: 1000,
            },
        }),
    },
    wrapper: {
        width: '100%',
        backgroundColor: palette.surface,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень для разделения
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
                boxShadow: '0 2px 10px rgba(31, 31, 31, 0.1), 0 1px 3px rgba(31, 31, 31, 0.06)',
            }
        })
    },
    inner: {
        width: '100%',
        maxWidth: '100%',
        paddingHorizontal: 12, // Уменьшили отступы на мобильных
        paddingVertical: 8,    // Уменьшили вертикальные отступы
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
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: DESIGN_TOKENS.radii.sm,
        gap: 8,
        backgroundColor: 'transparent',
        // ✅ УЛУЧШЕНИЕ: Увеличен размер touch-цели для мобильных
        minHeight: 44,
        minWidth: 44,
        // ✅ УЛУЧШЕНИЕ: Улучшенные hover-состояния с лучшей визуальной иерархией
        ...Platform.select({
            web: {
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                willChange: 'background-color, transform',
                // @ts-ignore
                ':hover': {
                    backgroundColor: palette.primarySoft,
                    transform: 'translateY(-1px)',
                },
                ':active': {
                    transform: 'translateY(0)',
                },
            },
        }),
    },
    navItemActive: {
        backgroundColor: palette.primaryLight,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон и тень
        ...Platform.select({
            web: {
                boxShadow: `0 2px 4px rgba(93, 140, 124, 0.15)`,
            },
        }),
    },
    navLabel: {
        fontSize: 14,
        color: palette.textMuted,
        fontWeight: DESIGN_TOKENS.typography.weights.medium,
        letterSpacing: -0.1,
    },
    navLabelActive: {
        color: palette.primary,
        fontWeight: DESIGN_TOKENS.typography.weights.bold, // ✅ УЛУЧШЕНИЕ: Более жирный шрифт для активного состояния
        letterSpacing: -0.2,
    },
    mobileMenuButton: {
        padding: 8,
        // ✅ УЛУЧШЕНИЕ: Увеличен размер touch-цели для мобильных (минимум 44x44px)
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
        // ✅ УЛУЧШЕНИЕ: Увеличен размер touch-цели для мобильных
        minHeight: 48,
    },
    modalNavItemActive: {
        backgroundColor: palette.primaryLight,
        borderLeftWidth: 3,
        borderLeftColor: palette.primary,
        paddingLeft: 17, // Компенсация для border
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

// Дополнительно: оптимизация для разных размеров экранов
export const getHeaderStyles = (screenWidth: number) => StyleSheet.create({
    adaptiveInner: {
        paddingHorizontal: screenWidth < 375 ? 10 : 12, // Еще меньше отступы на маленьких экранах
        minHeight: screenWidth < 375 ? 42 : Platform.OS === 'web' ? 56 : 44,
    }
});