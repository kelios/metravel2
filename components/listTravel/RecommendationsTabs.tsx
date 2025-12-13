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
  Image,
  Animated,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { TAB_CARD_TEMPLATE, MOBILE_CARD_WIDTH } from './recommendationsCardTemplate';

/* ---------------- Lazy Components ---------------- */

const PersonalizedRecommendations = lazy(() =>
  import('@/components/PersonalizedRecommendations').catch(() => ({
    default: () => <ErrorFallback message="Не удалось загрузить рекомендации" />,
  }))
);

const WeeklyHighlights = lazy(() =>
  import('@/components/WeeklyHighlights').catch(() => ({
    default: () => <ErrorFallback message="Не удалось загрузить подборку месяца" />,
  }))
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

/* ---------------- Travel Card ---------------- */

const TravelCard = memo(
  ({ item, onPress, isHistory = false }: { item: any; onPress: () => void; isHistory?: boolean }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const location = [item?.city, item?.country].filter(Boolean).join(', ');

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
        friction: 8,
        tension: 300,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          isMobile && styles.cardContainerMobile,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={styles.cardImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderImage}>
                <MaterialIcons name="route" size={40} color="#aaa" />
              </View>
            )}

            {isHistory && (
              <View style={styles.historyBadge}>
                <MaterialIcons name="history" size={16} color="#fff" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || 'Без названия'}
            </Text>
            {!!location && (
              <View style={styles.cardMeta}>
                <MaterialIcons name="place" size={12} color="#6b7280" style={styles.cardMetaIcon} />
                <Text style={styles.cardMetaText}>{location}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }
);

TravelCard.displayName = 'TravelCard';

/* ---------------- Main Component ---------------- */

const RecommendationsTabs = memo(
  ({ forceVisible = false, onVisibilityChange }: RecommendationsTabsProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('highlights');
    const [collapsed, setCollapsed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const router = useRouter();
    const { favorites = [], viewHistory = [], refreshFavorites } = useFavorites();
    const { isAuthenticated } = useAuth();

    const tabLayout = useRef<Record<string, { x: number; width: number }>>({}).current;
    const underlineAnim = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef<ScrollView>(null);

    // Табы с бейджами
    const tabs = useMemo(
      () => [
        { id: 'highlights' as const, label: 'Подборка месяца', icon: 'auto-awesome' },
        { id: 'recommendations' as const, label: 'Рекомендации', icon: 'star' },
        { id: 'favorites' as const, label: 'Избранное', icon: 'favorite', count: favorites.length },
        { id: 'history' as const, label: 'История', icon: 'history', count: viewHistory.length },
      ],
      [favorites.length, viewHistory.length]
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

    const handleRefresh = useCallback(async () => {
      if (!refreshFavorites) return;
      setRefreshing(true);
      try {
        await refreshFavorites();
      } finally {
        setRefreshing(false);
      }
    }, [refreshFavorites]);

    const toggleCollapse = () => {
      const newCollapsed = !collapsed;
      setCollapsed(newCollapsed);
      onVisibilityChange?.(!newCollapsed);
    };

    // Если принудительно скрыто — ничего не рендерим
    if (!forceVisible && collapsed) {
      return (
        <View style={styles.collapsedContainer}>
          <Pressable onPress={toggleCollapse} style={styles.expandButton}>
            <Feather name="chevron-down" size={20} color={DESIGN_TOKENS.colors.primary} />
            <Text style={styles.expandText}>Показать рекомендации</Text>
          </Pressable>
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
              <WeeklyHighlights showHeader={false} />
            </Suspense>
          );
        case 'recommendations':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <PersonalizedRecommendations showHeader={false} />
            </Suspense>
          );
        case 'favorites':
          return renderTabPane(
            favorites.length === 0 ? (
              <EmptyState message="Избранное пусто" icon="favorite-border" />
            ) : (
              <FlatList
                horizontal
                data={favorites}
                renderItem={({ item }) => (
                  <TravelCard item={item} onPress={() => router.push(item.url)} />
                )}
                keyExtractor={(item) => `${item.type || 'item'}-${item.id}`}
                showsHorizontalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                style={styles.horizontalList}
                contentContainerStyle={styles.horizontalListContent}
              />
            )
          );
        case 'history':
          return renderTabPane(
            viewHistory.length === 0 ? (
              <EmptyState message="История просмотров пуста" icon="history" />
            ) : (
              <FlatList
                horizontal
                data={viewHistory}
                renderItem={({ item }) => (
                  <TravelCard item={item} onPress={() => router.push(item.url)} isHistory />
                )}
                keyExtractor={(item) => `history-${item.id}-${item.viewedAt}`}
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalList}
                contentContainerStyle={styles.horizontalListContent}
              />
            )
          );
        default:
          return renderTabPane(null);
      }
    };

    return (
      <View style={styles.container}>
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

          <Pressable onPress={toggleCollapse} hitSlop={10} style={styles.collapseButton}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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

  // Cards
  cardContainer: {
    ...TAB_CARD_TEMPLATE.container,
    marginRight: 16,
  },
  cardContainerMobile: {
    width: MOBILE_CARD_WIDTH,
  },
  cardImageContainer: {
    ...TAB_CARD_TEMPLATE.imageContainer,
  },
  cardImage: {
    ...TAB_CARD_TEMPLATE.image,
  },
  placeholderImage: {
    ...TAB_CARD_TEMPLATE.image,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    ...TAB_CARD_TEMPLATE.content,
  },
  cardTitle: {
    ...TAB_CARD_TEMPLATE.title,
  },
  cardMeta: {
    ...TAB_CARD_TEMPLATE.metaRow,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMetaIcon: {
    marginRight: 4,
  },
  cardMetaText: {
    ...TAB_CARD_TEMPLATE.metaText,
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
  horizontalList: {
    minHeight: 210,
    paddingVertical: 4,
  },
  horizontalListContent: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
});

export default RecommendationsTabs;