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
  Pressable,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { createTabCardTemplate } from './recommendationsCardTemplate';
import TabTravelCard from './TabTravelCard';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { createRecommendationsTabsStyles } from './recommendationsTabsStyles';

/* ---------------- Lazy Components ---------------- */

type WeeklyHighlightsComponent = React.ComponentType<{
  showHeader?: boolean;
  enabled?: boolean;
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}>;

type PersonalizedRecommendationsComponent = React.ComponentType<{
  showHeader?: boolean;
  onlyRecommendations?: boolean;
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}>;

const PersonalizedRecommendations = lazy(async () => {
  const m: any = await import('@/components/travel/PersonalizedRecommendations');
  return { default: (m?.default ?? m?.PersonalizedRecommendations) as PersonalizedRecommendationsComponent };
});

const WeeklyHighlights = lazy(async () => {
  const m: any = await import('@/components/travel/WeeklyHighlights');
  return { default: (m?.default ?? m?.WeeklyHighlights) as WeeklyHighlightsComponent };
});

/* ---------------- Types ---------------- */

type TabType = 'recommendations' | 'highlights' | 'favorites' | 'history';

interface RecommendationsTabsProps {
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const ARROW_ICON_STYLE = { marginLeft: 6 } as const;

type TabStyles = ReturnType<typeof createRecommendationsTabsStyles>;

const AuthGate = ({
  message,
  onLogin,
  styles,
  colors,
}: {
  message: string;
  onLogin: () => void;
  styles: TabStyles;
  colors: ReturnType<typeof useThemedColors>;
}) => (
  <View style={styles.gateContainer}>
    <View style={styles.gateCard}>
      <View style={styles.gateIcon}>
        <Feather name="lock" size={24} color={colors.primary} />
      </View>
      <View style={styles.gateCopy}>
        <Text style={styles.gateText}>{message}</Text>
      </View>
      <Pressable style={styles.gateButton} onPress={onLogin} accessibilityRole="button">
        <Text style={styles.gateButtonText}>Войти</Text>
        <Feather name="arrow-right" size={18} color={colors.primary} style={ARROW_ICON_STYLE as any} />
      </Pressable>
    </View>
  </View>
);

/* ---------------- Skeletons ---------------- */

const CardSkeleton = ({
  styles,
  template,
}: {
  styles: TabStyles;
  template: ReturnType<typeof createTabCardTemplate>;
}) => {
  const imageHeight = (template.imageContainer as any)?.height ?? 136;
  const contentPaddingV = (template.content as any)?.paddingVertical ?? 12;
  const contentPaddingH = (template.content as any)?.paddingHorizontal ?? 12;

  return (
    <View style={styles.skeletonCard}>
      <SkeletonLoader width="100%" height={imageHeight} borderRadius={0} style={styles.skeletonImage} />
      <View style={[styles.skeletonContent, { paddingVertical: contentPaddingV, paddingHorizontal: contentPaddingH }]}>
        <SkeletonLoader width="80%" height={14} borderRadius={6} style={styles.skeletonLine} />
        <SkeletonLoader width="60%" height={14} borderRadius={6} style={[styles.skeletonLine, { marginTop: 8 }]} />
        <View style={styles.skeletonMetaRow}>
          <SkeletonLoader width={72} height={12} borderRadius={6} />
        </View>
      </View>
    </View>
  );
};

const RecommendationsPlaceholder = ({
  styles,
  template,
}: {
  styles: TabStyles;
  template: ReturnType<typeof createTabCardTemplate>;
}) => (
  <View style={styles.placeholderContainer}>
    <SkeletonLoader width={160} height={20} borderRadius={8} style={{ marginBottom: 12 }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {[1, 2, 3, 4].map((i) => (
        <CardSkeleton key={i} styles={styles} template={template} />
      ))}
    </ScrollView>
  </View>
);

/* ---------------- Main Component ---------------- */

const RecommendationsTabs = memo(
  ({ forceVisible = false, onVisibilityChange }: RecommendationsTabsProps) => {
    const colors = useThemedColors();
    const tabCardTemplate = useMemo(() => createTabCardTemplate(colors), [colors]);
    const styles = useMemo(() => createRecommendationsTabsStyles(colors, tabCardTemplate), [colors, tabCardTemplate]);
    const [activeTab, setActiveTab] = useState<TabType>('highlights');
    const [collapsed, setCollapsed] = useState(false);

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

    const handleHorizontalWheel = useCallback((e: any) => {
      if (Platform.OS !== 'web') return;

      const deltaY = Number(e?.deltaY ?? 0);
      const deltaX = Number(e?.deltaX ?? 0);

      // Only hijack when the user is effectively scrolling vertically.
      if (!deltaY || Math.abs(deltaY) <= Math.abs(deltaX)) return;

      const target = e?.currentTarget as any;
      // DOM node for RNW ScrollView container.
      const el = target?._nativeNode || target?._domNode || target;
      if (!el || typeof (el as any).scrollLeft !== 'number') return;

      const maxScrollLeft = (el.scrollWidth ?? 0) - (el.clientWidth ?? 0);
      if (maxScrollLeft <= 0) return;

      e.preventDefault?.();
      (el as any).scrollLeft += deltaY;
    }, []);

    // Табы с бейджами
    const tabs = useMemo(
      () => [
        { id: 'highlights' as const, label: 'Подборка месяца', icon: 'zap' },
        { id: 'recommendations' as const, label: 'Рекомендации', icon: 'star' },
        { id: 'favorites' as const, label: 'Избранное', icon: 'heart', count: isAuthenticated ? favorites.length : 0 },
        { id: 'history' as const, label: 'История', icon: 'clock', count: isAuthenticated ? viewHistory.length : 0 },
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
        useNativeDriver: false,
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
              <Feather name="chevron-down" size={20} color={colors.primary} />
              <Text style={styles.expandText}>Показать рекомендации</Text>
            </Pressable>
          </View>
          <View style={styles.collapsedSpacer} />
        </View>
      );
    }

    const renderTabPane = (children: React.ReactNode) => (
      <View style={styles.tabPane}>
        <View style={[styles.tabPaneScroll, styles.tabPaneContent]}>{children}</View>
      </View>
    )

    const renderContent = () => {
      switch (activeTab) {
        case 'highlights':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder styles={styles} template={tabCardTemplate} />}>
              <WeeklyHighlights showHeader={false} enabled={isTabsVisible && activeTab === 'highlights'} />
            </Suspense>
          );
        case 'recommendations':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder styles={styles} template={tabCardTemplate} />}>
              <PersonalizedRecommendations showHeader={!isAuthenticated} onlyRecommendations={true} />
            </Suspense>
          );
        case 'favorites':
          if (!isAuthenticated) {
            return renderTabPane(
              <AuthGate
                message="Избранное будет доступно после регистрации или авторизации"
                onLogin={() => router.push(buildLoginHref({ intent: 'favorites' }) as any)}
                styles={styles}
                colors={colors}
              />
            );
          }
          return renderTabPane(
            favorites.length === 0 ? (
              <EmptyState message="Избранное пусто" icon="heart" styles={styles} colors={colors} />
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
                      <Feather name="chevron-right" size={16} color={colors.primary} />
                    </Pressable>

                    {typeof clearFavorites === 'function' && favorites.length > 0 && (
                      <Pressable
                        style={styles.favoritesClearButton}
                        onPress={handleClearFavorites}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить избранное"
                      >
                        <Feather name="trash-2" size={16} color={colors.danger} />
                        <Text style={styles.favoritesClearButtonText}>Очистить</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {Platform.OS === 'web' ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={Platform.OS === 'web'}
                    style={[styles.horizontalList, styles.webHorizontalScroll]}
                    contentContainerStyle={styles.webHorizontalScrollContent}
                    bounces={false}
                    {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
                  >
                    {favorites.map((item: any) => (
                      <TabTravelCard
                        key={`${item.type || 'item'}-${item.id}`}
                        item={{
                          id: item.id,
                          title: item.title,
                          imageUrl: item.imageUrl,
                          city: (item as any).city ?? null,
                          country: item.country ?? (item as any).countryName ?? null,
                        }}
                        onPress={() => router.push(item.url as any)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <FlashList
                    horizontal
                    data={favorites}
                    renderItem={({ item }: any) => (
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
                    keyExtractor={(item: any) => `${item.type || 'item'}-${item.id}`}
                    {...({ estimatedItemSize: 220 } as any)}
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalList}
                    contentContainerStyle={styles.horizontalListContent}
                    drawDistance={800}
                  />
                )}
              </View>
            )
          );
        case 'history':
          if (!isAuthenticated) {
            return renderTabPane(
              <AuthGate
                message="История просмотров будет доступна после регистрации или авторизации"
                onLogin={() => router.push(buildLoginHref({ intent: 'history' }) as any)}
                styles={styles}
                colors={colors}
              />
            );
          }
          return renderTabPane(
            viewHistory.length === 0 ? (
              <EmptyState message="История просмотров пуста" icon="clock" styles={styles} colors={colors} />
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
                      <Feather name="chevron-right" size={16} color={colors.primary} />
                    </Pressable>

                    {typeof clearHistory === 'function' && viewHistory.length > 0 && (
                      <Pressable
                        style={styles.favoritesClearButton}
                        onPress={handleClearHistory}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить историю просмотров"
                      >
                        <Feather name="trash-2" size={16} color={colors.danger} />
                        <Text style={styles.favoritesClearButtonText}>Очистить</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {Platform.OS === 'web' ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={Platform.OS === 'web'}
                    style={[styles.horizontalList, styles.webHorizontalScroll]}
                    contentContainerStyle={styles.webHorizontalScrollContent}
                    bounces={false}
                    {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
                  >
                    {viewHistory.map((item: any) => (
                      <TabTravelCard
                        key={`history-${item.id}-${item.viewedAt}`}
                        item={{
                          id: item.id,
                          title: item.title,
                          imageUrl: item.imageUrl,
                          city: (item as any).city ?? null,
                          country: item.country ?? (item as any).countryName ?? null,
                        }}
                        badge={{
                          icon: 'clock',
                          backgroundColor: colors.overlay,
                          iconColor: colors.textOnDark,
                        }}
                        onPress={() => router.push(item.url as any)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <FlashList
                    horizontal
                    data={viewHistory}
                    renderItem={({ item }: any) => (
                      <TabTravelCard
                        item={{
                          id: item.id,
                          title: item.title,
                          imageUrl: item.imageUrl,
                          city: (item as any).city ?? null,
                          country: item.country ?? (item as any).countryName ?? null,
                        }}
                        badge={{
                          icon: 'clock',
                          backgroundColor: colors.overlay,
                          iconColor: colors.textOnDark,
                        }}
                        onPress={() => router.push(item.url as any)}
                      />
                    )}
                    keyExtractor={(item: any) => `history-${item.id}-${item.viewedAt}`}
                    {...({ estimatedItemSize: 220 } as any)}
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalList}
                    contentContainerStyle={styles.horizontalListContent}
                    drawDistance={800}
                  />
                )}
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
            style={[styles.tabsScroll, Platform.OS === 'web' && { overflowX: 'auto', overflowY: 'hidden' }]}
            contentContainerStyle={styles.tabsContainer}
            {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                onLayout={(e) => handleTabLayout(tab.id, e)}
                style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: activeTab === tab.id }}
              >
                <Feather
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.id ? colors.primary : colors.textMuted}
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
            <Feather name="chevron-up" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.content}>{renderContent()}</View>
      </View>
    );
  }
);

RecommendationsTabs.displayName = 'RecommendationsTabs';

/* ---------------- Empty State Helper ---------------- */

const EmptyState = ({
  message,
  icon,
  styles,
  colors,
}: {
  message: string;
  icon: any;
  styles: TabStyles;
  colors: ReturnType<typeof useThemedColors>;
}) => (
  <View style={styles.emptyState}>
    <Feather name={icon} size={48} color={colors.textTertiary} />
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

/* ---------------- Styles ---------------- */


export default RecommendationsTabs;
