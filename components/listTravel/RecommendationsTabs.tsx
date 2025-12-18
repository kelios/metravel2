import React, {
  useState,
  useMemo,
  lazy,
  Suspense,
  useCallback,
  useRef,
  useEffect,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Animated,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { TAB_CARD_TEMPLATE } from './recommendationsCardTemplate';
import TabTravelCard from './TabTravelCard';

/* ---------------- Lazy Components ---------------- */

const PersonalizedRecommendations = lazy(() =>
  import('@/components/PersonalizedRecommendations') as any
);

const WeeklyHighlights = lazy(() =>
  import('@/components/WeeklyHighlights') as any
);

const ErrorFallback = ({ message }: { message: string }) => (
  <View style={styles.errorContainer}>
    <MaterialIcons name="error-outline" size={48} color={DESIGN_TOKENS.colors.error} />
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

/* ---------------- Types ---------------- */

type TabType = 'recommendations' | 'highlights' | 'favorites' | 'history';

interface RecommendationsTabsProps {
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const TAB_CONTENT_HEIGHT = 320;
const TAB_HEADER_HEIGHT = 56;
const TAB_TOTAL_HEIGHT = TAB_HEADER_HEIGHT + TAB_CONTENT_HEIGHT;

const AuthGate = ({ message, onLogin }: { message: string; onLogin: () => void }) => (
  <View style={styles.gateContainer}>
    <View style={styles.gateCard}>
      <View style={styles.gateIcon}>
        <MaterialIcons name="lock" size={24} color={DESIGN_TOKENS.colors.primary} />
      </View>
      <View style={styles.gateCopy}>
        <Text style={styles.gateText}>{message}</Text>
      </View>
      <Pressable style={styles.gateButton} onPress={onLogin} accessibilityRole="button">
        <Text style={styles.gateButtonText}>Войти</Text>
        <MaterialIcons name="arrow-forward" size={18} color={DESIGN_TOKENS.colors.primary} style={{ marginLeft: 6 }} />
      </Pressable>
    </View>
  </View>
);

/* ---------------- Skeletons ---------------- */

const CardSkeleton = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonContent}>
      <View style={[styles.skeletonLine, { width: '80%' }]} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
    </View>
  </View>
);

const RecommendationsPlaceholder = () => (
  <View style={styles.placeholderContainer}>
    <View style={[styles.skeletonLine, { width: 160, height: 20, marginBottom: 12 }]} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {[1, 2, 3, 4].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </ScrollView>
  </View>
);

/* ---------------- Main Component ---------------- */

const RecommendationsTabs = memo(
  ({ forceVisible = false, onVisibilityChange }: RecommendationsTabsProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('highlights');
    const [collapsed, setCollapsed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const router = useRouter();
    const { favorites = [], viewHistory = [], clearFavorites, clearHistory, ensureServerData } = useFavorites() as any;
    const { isAuthenticated } = useAuth();

    const isTabsVisible = forceVisible || !collapsed;

    useEffect(() => {
      if (!isTabsVisible) return;
      if (!isAuthenticated) return;
      if (typeof ensureServerData !== 'function') return;

      if (activeTab === 'favorites') {
        ensureServerData('favorites');
        return;
      }
      if (activeTab === 'history') {
        ensureServerData('history');
        return;
      }
      if (activeTab === 'recommendations') {
        ensureServerData('recommendations');
        return;
      }
    }, [activeTab, ensureServerData, isAuthenticated, isTabsVisible]);

    const handleClearFavorites = useCallback(async () => {
      try {
        if (typeof clearFavorites !== 'function') return;

        if (typeof window !== 'undefined' && (window as any).confirm) {
          const confirmed = window.confirm('Очистить избранное?');
          if (!confirmed) return;
        }

        await clearFavorites();
      } catch (error) {
        console.error('Error clearing favorites:', error);
      }
    }, [clearFavorites]);

    const handleClearHistory = useCallback(async () => {
      try {
        if (typeof clearHistory !== 'function') return;

        if (typeof window !== 'undefined' && (window as any).confirm) {
          const confirmed = window.confirm('Очистить историю просмотров?');
          if (!confirmed) return;
        }

        await clearHistory();
      } catch (error) {
        console.error('Error clearing history:', error);
      }
    }, [clearHistory]);

    const tabLayout = useRef<Record<string, { x: number; width: number }>>({}).current;
    const underlineAnim = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef<ScrollView>(null);

    // Табы с бейджами
    const tabs = useMemo(
      () => [
        { id: 'highlights' as const, label: 'Подборка месяца', icon: 'auto-awesome' },
        { id: 'recommendations' as const, label: 'Рекомендации', icon: 'star' },
        { id: 'favorites' as const, label: 'Избранное', icon: 'favorite', count: isAuthenticated ? favorites.length : 0 },
        { id: 'history' as const, label: 'История', icon: 'history', count: isAuthenticated ? viewHistory.length : 0 },
      ],
      [favorites.length, isAuthenticated, viewHistory.length]
    );

    // Анимация подчёркивания
    useEffect(() => {
      const current = tabs.findIndex((t) => t.id === activeTab);
      if (current === -1) return;

      const { x = 0, width = 100 } = tabLayout[tabs[current].id] || {};
      Animated.spring(underlineAnim, {
        toValue: x + width / 2,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }, [activeTab, tabLayout, tabs, underlineAnim]);

    const handleTabLayout = (id: string, event: any) => {
      const { x, width } = event.nativeEvent.layout;
      tabLayout[id] = { x, width };

      // Прокрутка к активному табу при смене
      if (id === activeTab && scrollRef.current) {
        scrollRef.current.scrollTo({ x: Math.max(0, x - 50), animated: true });
      }
    };

    const toggleCollapse = () => {
      const newCollapsed = !collapsed;
      setCollapsed(newCollapsed);
      onVisibilityChange?.(!newCollapsed);
    };

    // ✅ CLS fix: never unmount / collapse height to 0.
    // We keep a stable container height so the list below does not shift.
    if (!forceVisible && collapsed) {
      return (
        <View style={[styles.container, styles.containerFixedHeight]}>
          <View style={styles.collapsedHeader}>
            <Pressable testID="recommendations-tabs-expand" onPress={toggleCollapse} style={styles.expandButton} accessibilityRole="button">
              <Feather name="chevron-down" size={20} color={DESIGN_TOKENS.colors.primary} />
              <Text style={styles.expandText}>Показать рекомендации</Text>
            </Pressable>
          </View>
          <View style={styles.collapsedSpacer} />
        </View>
      );
    }

    const renderTabPane = (children: React.ReactNode) => (
      <View style={styles.tabPane}>
        <ScrollView
          style={styles.tabPaneScroll}
          contentContainerStyle={styles.tabPaneContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </View>
    )

    const renderContent = () => {
      switch (activeTab) {
        case 'highlights':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <WeeklyHighlights showHeader={false} enabled={isTabsVisible && activeTab === 'highlights'} />
            </Suspense>
          );
        case 'recommendations':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <PersonalizedRecommendations showHeader={!isAuthenticated} onlyRecommendations={true} />
            </Suspense>
          );
        case 'favorites':
          if (!isAuthenticated) {
            return renderTabPane(
              <AuthGate
                message="Избранное будет доступно после регистрации или авторизации"
                onLogin={() => router.push('/login' as any)}
              />
            );
          }
          return renderTabPane(
            favorites.length === 0 ? (
              <EmptyState message="Избранное пусто" icon="favorite-border" />
            ) : (
              <View>
                <View style={styles.favoritesHeaderRow}>
                  <View style={styles.headerTitleBlock}>
                    <Text style={styles.favoritesHeaderTitle}>Избранное</Text>
                    <Text style={styles.headerSubtitle}>{favorites.length} шт.</Text>
                  </View>

                  <View style={styles.headerActions}>
                    <Pressable
                      style={styles.seeAllButton}
                      onPress={() => router.push('/favorites' as any)}
                      accessibilityRole="button"
                      accessibilityLabel="Смотреть все избранное"
                    >
                      <Text style={styles.seeAllButtonText}>Смотреть все</Text>
                      <Feather name="chevron-right" size={16} color={DESIGN_TOKENS.colors.primary} />
                    </Pressable>

                    {typeof clearFavorites === 'function' && favorites.length > 0 && (
                      <Pressable
                        style={styles.favoritesClearButton}
                        onPress={handleClearFavorites}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить избранное"
                      >
                        <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.danger} />
                        <Text style={styles.favoritesClearButtonText}>Очистить</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <FlatList
                  horizontal
                  data={favorites}
                  renderItem={({ item }) => (
                    <TabTravelCard
                      item={{
                        id: item.id,
                        title: item.title,
                        imageUrl: item.imageUrl,
                        city: (item as any).city ?? null,
                        country: item.country ?? (item as any).countryName ?? null,
                      }}
                      onPress={() => router.push(item.url as any)}
                    />
                  )}
                  keyExtractor={(item) => `${item.type || 'item'}-${item.id}`}
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalList}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )
          );
        case 'history':
          if (!isAuthenticated) {
            return renderTabPane(
              <AuthGate
                message="История просмотров будет доступна после регистрации или авторизации"
                onLogin={() => router.push('/login' as any)}
              />
            );
          }
          return renderTabPane(
            viewHistory.length === 0 ? (
              <EmptyState message="История просмотров пуста" icon="history" />
            ) : (
              <View>
                <View style={styles.favoritesHeaderRow}>
                  <View style={styles.headerTitleBlock}>
                    <Text style={styles.favoritesHeaderTitle}>История</Text>
                    <Text style={styles.headerSubtitle}>{viewHistory.length} шт.</Text>
                  </View>

                  <View style={styles.headerActions}>
                    <Pressable
                      style={styles.seeAllButton}
                      onPress={() => router.push('/history' as any)}
                      accessibilityRole="button"
                      accessibilityLabel="Смотреть всю историю просмотров"
                    >
                      <Text style={styles.seeAllButtonText}>Смотреть все</Text>
                      <Feather name="chevron-right" size={16} color={DESIGN_TOKENS.colors.primary} />
                    </Pressable>

                    {typeof clearHistory === 'function' && viewHistory.length > 0 && (
                      <Pressable
                        style={styles.favoritesClearButton}
                        onPress={handleClearHistory}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить историю просмотров"
                      >
                        <Feather name="trash-2" size={16} color={DESIGN_TOKENS.colors.danger} />
                        <Text style={styles.favoritesClearButtonText}>Очистить</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <FlatList
                  horizontal
                  data={viewHistory}
                  renderItem={({ item }) => (
                    <TabTravelCard
                      item={{
                        id: item.id,
                        title: item.title,
                        imageUrl: item.imageUrl,
                        city: (item as any).city ?? null,
                        country: item.country ?? (item as any).countryName ?? null,
                      }}
                      badge={{ icon: 'history', backgroundColor: 'rgba(0,0,0,0.7)', iconColor: '#fff' }}
                      onPress={() => router.push(item.url as any)}
                    />
                  )}
                  keyExtractor={(item) => `history-${item.id}-${item.viewedAt}`}
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalList}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )
          );
        default:
          return renderTabPane(null);
      }
    };

    return (
      <View style={[styles.container, styles.containerFixedHeight]}>
        <View style={styles.header}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                onLayout={(e) => handleTabLayout(tab.id, e)}
                style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.id ? DESIGN_TOKENS.colors.primary : '#666'}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.id && styles.activeTabLabel,
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count !== undefined && tab.count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tab.count > 99 ? '99+' : tab.count}</Text>
                  </View>
                )}
              </Pressable>
            ))}

            <Animated.View
              style={[
                styles.tabUnderline,
                {
                  width: 24,
                  transform: [
                    {
                      translateX: underlineAnim.interpolate({
                        inputRange: [0, 1000],
                        outputRange: [0, 1000],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          </ScrollView>

          <Pressable testID="recommendations-tabs-collapse" onPress={toggleCollapse} hitSlop={10} style={styles.collapseButton}>
            <Feather name="chevron-up" size={20} color="#666" />
          </Pressable>
        </View>

        <View style={styles.content}>{renderContent()}</View>
      </View>
    );
  }
);

RecommendationsTabs.displayName = 'RecommendationsTabs';

/* ---------------- Empty State Helper ---------------- */

const EmptyState = ({ message, icon }: { message: string; icon: any }) => (
  <View style={styles.emptyState}>
    <MaterialIcons name={icon} size={48} color="#ccc" />
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  containerFixedHeight: {
    height: TAB_TOTAL_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: TAB_HEADER_HEIGHT,
  },
  tabsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    minHeight: 40,
  },
  activeTab: {
    backgroundColor: '#f0f8ff',
  },
  tabLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  activeTabLabel: {
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 4,
    height: 3,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderRadius: 2,
  },
  collapseButton: {
    padding: 12,
  },
  content: {
    height: TAB_CONTENT_HEIGHT,
    paddingVertical: 8,
  },
  collapsedHeader: {
    height: TAB_HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  collapsedSpacer: {
    height: TAB_CONTENT_HEIGHT,
  },
  tabPane: {
    height: TAB_CONTENT_HEIGHT,
    flex: 1,
  },
  tabPaneScroll: {
    flex: 1,
  },
  tabPaneContent: {
    flexGrow: 1,
    paddingVertical: 4,
  },

  gateContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fdf8f3',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 90, 0.25)',
  },
  gateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  gateCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  gateText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    fontWeight: '500',
  },
  gateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.primary,
    backgroundColor: '#fff',
  },
  gateButtonText: {
    color: DESIGN_TOKENS.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Collapsed
  collapsedContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandText: {
    marginLeft: 8,
    fontSize: 15,
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: '500',
  },

  // Placeholders & Empty
  placeholderContainer: {
    padding: 16,
  },
  skeletonCard: {
    width: TAB_CARD_TEMPLATE.container.width || 208,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: TAB_CARD_TEMPLATE.container.borderRadius || 12,
    overflow: 'hidden',
  },
  skeletonImage: {
    height: TAB_CARD_TEMPLATE.imageContainer.height || 136,
    backgroundColor: '#eee',
  },
  skeletonContent: {
    padding: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#eee',
    borderRadius: 6,
  },

  horizontalList: {
    marginBottom: 8,
  },
  horizontalListContent: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    ...Platform.select({
      web: {
        paddingBottom: 12,
      } as any,
      default: {},
    }),
  },

  favoritesHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  seeAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  favoritesHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  favoritesClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  favoritesClearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.danger,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});

export default RecommendationsTabs;