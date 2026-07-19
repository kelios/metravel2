import React, {
  useState,
  useMemo,
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

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { createTabCardTemplate } from './recommendationsCardTemplate';
import TabTravelCard from './TabTravelCard';
import CardRail from '@/components/ui/CardRail';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import {
  RecommendationsAuthGate,
  RecommendationsEmptyState,
} from './RecommendationsTabs.parts';
import {
  PersonalizedRecommendations,
  WeeklyHighlights,
} from './recommendationsDeferred';
import { createRecommendationsTabsStyles } from './recommendationsTabsStyles';
import {
  getRecommendationsCardLayout,
  getRecommendationsCollectionKey,
  getRecommendationsEnsureServerDataKey,
  getRecommendationsTabsConfig,
  mapRecommendationsCardItem,
  type CollectionItem,
  type TabType,
} from './recommendationsTabsModel';
import { translate as i18nT } from '@/i18n'


interface RecommendationsTabsProps {
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

const SHELF_CARD_WIDTH = 220;

type TabStyles = ReturnType<typeof createRecommendationsTabsStyles>;

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
  isMobileWeb,
  styles,
  template,
}: {
  isMobileWeb: boolean;
  styles: TabStyles;
  template: ReturnType<typeof createTabCardTemplate>;
}) => (
  <View style={styles.placeholderContainer}>
    <SkeletonLoader width={160} height={20} borderRadius={8} style={{ marginBottom: 12 }} />
    {isMobileWeb ? (
      <View style={styles.mobileWebStack}>
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} styles={styles} template={template} />
        ))}
      </View>
    ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} styles={styles} template={template} />
        ))}
      </ScrollView>
    )}
  </View>
);

const SavedCollectionHeader = ({
  clearLabel,
  colors,
  count,
  onClear,
  onSeeAll,
  seeAllLabel,
  styles,
  title,
}: {
  clearLabel: string;
  colors: ReturnType<typeof useThemedColors>;
  count: number;
  onClear?: () => void;
  onSeeAll: () => void;
  seeAllLabel: string;
  styles: TabStyles;
  title: string;
}) => (
  <View style={styles.favoritesHeaderRow}>
    <View style={styles.headerTitleBlock}>
      <Text style={styles.favoritesHeaderTitle}>{title}</Text>
      <Text style={styles.headerSubtitle}>{count} {i18nT('travel:components.listTravel.RecommendationsTabs.sht_ff238378')}</Text>
    </View>

    <View style={styles.headerActions}>
      <Pressable
        style={styles.seeAllButton}
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={seeAllLabel}
      >
        <Text style={styles.seeAllButtonText}>{i18nT('travel:components.listTravel.RecommendationsTabs.smotret_vse_dab0b9ab')}</Text>
        <Feather name="chevron-right" size={16} color={colors.primaryDark} />
      </Pressable>

      {onClear && count > 0 && (
        <Pressable
          style={styles.favoritesClearButton}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
        >
          <Feather name="trash-2" size={16} color={colors.danger} />
          <Text style={styles.favoritesClearButtonText}>{i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_a2502648')}</Text>
        </Pressable>
      )}
    </View>
  </View>
);

/* ---------------- Mobile shelf (Task A) ---------------- */

const ShelfHeader = ({
  clearLabel,
  colors,
  count,
  onClear,
  onSeeAll,
  seeAllLabel,
  styles,
  title,
}: {
  clearLabel: string;
  colors: ReturnType<typeof useThemedColors>;
  count: number;
  onClear?: () => void;
  onSeeAll: () => void;
  seeAllLabel: string;
  styles: TabStyles;
  title: string;
}) => (
  <View style={styles.shelfHeaderRow}>
    <View style={styles.shelfTitleWrap}>
      <Text style={styles.shelfTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.shelfCount}>· {count}</Text>
    </View>

    <View style={styles.shelfActions}>
      {onClear && count > 0 && (
        <Pressable
          style={styles.shelfClearButton}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
        >
          <Feather name="trash-2" size={16} color={colors.danger} />
        </Pressable>
      )}
      <Pressable
        style={styles.shelfSeeAll}
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel={seeAllLabel}
      >
        <Text style={styles.shelfSeeAllText}>{i18nT('travel:components.listTravel.RecommendationsTabs.vse_718194eb')}</Text>
        <Feather name="chevron-right" size={16} color={colors.primaryDark} />
      </Pressable>
    </View>
  </View>
);

const CardShelf = ({
  accessibilityLabel,
  children,
  testID,
  styles,
}: {
  accessibilityLabel?: string;
  children: React.ReactNode;
  testID?: string;
  styles: TabStyles;
}) => (
  <View
    style={styles.shelf}
    testID={testID}
    accessibilityLabel={accessibilityLabel}
  >
    {children}
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
    const { isMobile, width } = useResponsive();
    const isMobileWeb = Platform.OS === 'web' && isMobile;
    // На узких экранах все 4 таба не помещаются и пользователь видит только два — остальные
    // прячутся в горизонтальный скролл без подсказки. Используем компактные подписи.
    const isNarrowViewport = isMobile && width > 0 && width < 420;

    const router = useRouter();
    const { favorites = [], viewHistory = [], clearFavorites, clearHistory, ensureServerData } = useFavorites() as any;
    const { isAuthenticated } = useAuth();

    const isTabsVisible = forceVisible || !collapsed;

    useEffect(() => {
      if (!isTabsVisible) return;
      if (!isAuthenticated) return;
      if (typeof ensureServerData !== 'function') return;
      // Mobile shelves render favorites + history side by side (no active tab),
      // so fetch both collections up front. Desktop loads per active tab.
      if (isMobile) {
        ensureServerData('favorites');
        ensureServerData('history');
        return;
      }
      const dataKey = getRecommendationsEnsureServerDataKey(activeTab);
      if (dataKey) ensureServerData(dataKey);
    }, [activeTab, ensureServerData, isAuthenticated, isMobile, isTabsVisible]);

    const handleClearFavorites = useCallback(async () => {
      try {
        if (typeof clearFavorites !== 'function') return;

        if (typeof window !== 'undefined' && (window as any).confirm) {
          const confirmed = window.confirm(i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_hochu_poehat_65feb3a9'));
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
          const confirmed = window.confirm(i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_istoriyu_prosmotrov_95782295'));
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
      () =>
        getRecommendationsTabsConfig({
          favoritesCount: favorites.length,
          historyCount: viewHistory.length,
          isAuthenticated,
        }),
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

    const activeRailTestID = useMemo(
      () => (activeTab === 'favorites' || activeTab === 'history' ? `recommendations-${activeTab}-rail` : undefined),
      [activeTab]
    );
    const renderCardCollection = (
      items: CollectionItem[],
      keyFactory: (item: CollectionItem) => string,
      cardFactory: (item: CollectionItem) => React.ReactNode,
    ) => {
      if (isMobileWeb) {
        return (
          <View style={styles.mobileWebStack}>
            {items.map((item) => (
              <View key={keyFactory(item)} style={styles.mobileWebStackItem}>
                {cardFactory(item)}
              </View>
            ))}
          </View>
        );
      }

      if (isMobile) {
        return (
          <View style={styles.mobileGrid}>
            {items.map((item) => (
              <View key={keyFactory(item)} style={styles.mobileGridItem}>
                {cardFactory(item)}
              </View>
            ))}
          </View>
        );
      }

      // Раньше на вебе рендерился только «превью» из влезших карточек — остальные
      // не существовали в DOM и были недостижимы (ни скролла, ни стрелок).
      // CardRail отдаёт всю коллекцию и сам показывает стрелки на десктопе.
      // gap=12 — как у превью «Подборки месяца»: у карточки нет своих внешних
      // отступов (обёртка UnifiedTravelCard с фиксированной width гасит margin).
      return (
        <CardRail
          testID={activeRailTestID}
          gap={12}
          contentPaddingHorizontal={4}
          contentPaddingVertical={6}
        >
          {items.map(cardFactory)}
        </CardRail>
      );
    };

    const cardLayout = getRecommendationsCardLayout(isMobile, isMobileWeb);

    const toggleCollapse = () => {
      const newCollapsed = !collapsed;
      setCollapsed(newCollapsed);
      onVisibilityChange?.(!newCollapsed);
    };

    const renderMobileRail = (
      items: CollectionItem[],
      kind: 'favorites' | 'history',
      testID: string,
    ) => (
      <ScrollView
        testID={testID}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.shelfRail}
        contentContainerStyle={styles.shelfRailContent}
        {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
      >
        {items.map((item) => (
          <View key={getRecommendationsCollectionKey(item, kind)} style={styles.shelfCardWrap}>
            <TabTravelCard
              item={mapRecommendationsCardItem(item)}
              onPress={() => router.push(item.url as any)}
              layout="horizontal"
              width={SHELF_CARD_WIDTH}
              style={styles.shelfCard}
              {...(kind === 'history'
                ? {
                    badge: {
                      icon: 'clock' as const,
                      backgroundColor: colors.overlay,
                      iconColor: colors.textOnDark,
                    },
                  }
                : {})}
            />
          </View>
        ))}
      </ScrollView>
    );

    // Task A: mobile uses vertically stacked horizontal "shelves" instead of the
    // collapsible chip-tabs panel. Each shelf is auto-height (no fixed-height +
    // overflow:hidden clipping). Empty sections are not rendered.
    if (isMobile) {
      const showFavorites = isAuthenticated && favorites.length > 0;
      const showHistory = isAuthenticated && viewHistory.length > 0;

      return (
        <View style={[styles.container, styles.containerMobileWebExpanded]}>
          <View style={[styles.content, styles.contentMobileWebExpanded, styles.shelvesContainer]}>
            <Suspense fallback={null}>
              <WeeklyHighlights showHeader enabled={isTabsVisible} />
            </Suspense>

            <Suspense fallback={null}>
              <PersonalizedRecommendations showHeader onlyRecommendations />
            </Suspense>

            {showHistory && (
              <CardShelf
                accessibilityLabel={i18nT('travel:components.listTravel.RecommendationsTabs.nedavno_smotreli_6e75a30d')}
                testID="recommendations-history-shelf"
                styles={styles}
              >
                <ShelfHeader
                  clearLabel={i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_istoriyu_prosmotrov_aba556ba')}
                  colors={colors}
                  count={viewHistory.length}
                  onClear={typeof clearHistory === 'function' ? handleClearHistory : undefined}
                  onSeeAll={() => router.push('/history' as any)}
                  seeAllLabel={i18nT('travel:components.listTravel.RecommendationsTabs.smotret_vsyu_istoriyu_prosmotrov_c486385e')}
                  styles={styles}
                  title={i18nT('travel:components.listTravel.RecommendationsTabs.nedavno_smotreli_6e75a30d')}
                />
                {renderMobileRail(viewHistory, 'history', 'recommendations-history-rail')}
              </CardShelf>
            )}

            {showFavorites && (
              <CardShelf testID="recommendations-favorites-shelf" styles={styles}>
                <ShelfHeader
                  clearLabel={i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_hochu_poehat_ad8210f6')}
                  colors={colors}
                  count={favorites.length}
                  onClear={typeof clearFavorites === 'function' ? handleClearFavorites : undefined}
                  onSeeAll={() => router.push('/favorites' as any)}
                  seeAllLabel={i18nT('travel:components.listTravel.RecommendationsTabs.smotret_vse_hochu_poehat_ded3ec15')}
                  styles={styles}
                  title={i18nT('travel:components.listTravel.RecommendationsTabs.hochu_poehat_e6276dfa')}
                />
                {renderMobileRail(favorites, 'favorites', 'recommendations-favorites-rail')}
              </CardShelf>
            )}
          </View>
        </View>
      );
    }

    // ✅ CLS fix: never unmount / collapse height to 0.
    // We keep a stable container height so the list below does not shift.
    if (!forceVisible && collapsed) {
      return (
        <View style={[styles.container, styles.containerFixedHeight]}>
          <View style={styles.collapsedHeader}>
            <Pressable testID="recommendations-tabs-expand" onPress={toggleCollapse} style={styles.expandButton} accessibilityRole="button">
              <Feather name="chevron-down" size={20} color={colors.primaryDark} />
              <Text style={styles.expandText}>{i18nT('travel:components.listTravel.RecommendationsTabs.pokazat_rekomendatsii_21bdd03a')}</Text>
            </Pressable>
          </View>
          <View style={styles.collapsedSpacer} />
        </View>
      );
    }

    const renderTabPane = (children: React.ReactNode) => (
      <View
        style={[styles.tabPane, isMobileWeb && styles.tabPaneMobileWebExpanded]}
        testID={`recommendations-tabpanel-${activeTab}`}
      >
        <View
          style={[
            styles.tabPaneScroll,
            styles.tabPaneContent,
            isMobileWeb && styles.tabPaneScrollMobileWebExpanded,
          ]}
        >
          {children}
        </View>
      </View>
    )

    const renderContent = () => {
      switch (activeTab) {
        case 'highlights':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder isMobileWeb={isMobileWeb} styles={styles} template={tabCardTemplate} />}>
              <WeeklyHighlights showHeader={false} enabled={isTabsVisible && activeTab === 'highlights'} />
            </Suspense>
          );
        case 'recommendations':
          return renderTabPane(
            <Suspense fallback={<RecommendationsPlaceholder isMobileWeb={isMobileWeb} styles={styles} template={tabCardTemplate} />}>
              <PersonalizedRecommendations showHeader={!isAuthenticated} onlyRecommendations={true} />
            </Suspense>
          );
        case 'favorites':
          if (!isAuthenticated) {
            return renderTabPane(
              <RecommendationsAuthGate
                message={i18nT('travel:components.listTravel.RecommendationsTabs.hochu_poehat_budet_dostupno_posle_registrats_24fe6d17')}
                onLogin={() => router.push(buildLoginHref({ intent: 'favorites' }) as any)}
                styles={styles}
                colors={colors}
              />
            );
          }
          return renderTabPane(
            favorites.length === 0 ? (
              <RecommendationsEmptyState message={i18nT('travel:components.listTravel.RecommendationsTabs.v_hochu_poehat_poka_pusto_2942a4b0')} icon="heart" styles={styles} colors={colors} />
            ) : (
              <View>
                <SavedCollectionHeader
                  clearLabel={i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_hochu_poehat_ad8210f6')}
                  colors={colors}
                  count={favorites.length}
                  onClear={typeof clearFavorites === 'function' ? handleClearFavorites : undefined}
                  onSeeAll={() => router.push('/favorites' as any)}
                  seeAllLabel={i18nT('travel:components.listTravel.RecommendationsTabs.smotret_vse_hochu_poehat_ded3ec15')}
                  styles={styles}
                  title={i18nT('travel:components.listTravel.RecommendationsTabs.hochu_poehat_e6276dfa')}
                />

                {renderCardCollection(
                  favorites,
                  (item: CollectionItem) => getRecommendationsCollectionKey(item, 'favorites'),
                  (item: CollectionItem) => (
                    <TabTravelCard
                      key={getRecommendationsCollectionKey(item, 'favorites')}
                      item={mapRecommendationsCardItem(item)}
                      onPress={() => router.push(item.url as any)}
                      layout={cardLayout}
                    />
                  )
                )}
              </View>
            )
          );
        case 'history':
          if (!isAuthenticated) {
            return renderTabPane(
              <RecommendationsAuthGate
                message={i18nT('travel:components.listTravel.RecommendationsTabs.istoriya_prosmotrov_budet_dostupna_posle_reg_c6632c3d')}
                onLogin={() => router.push(buildLoginHref({ intent: 'history' }) as any)}
                styles={styles}
                colors={colors}
              />
            );
          }
          return renderTabPane(
            viewHistory.length === 0 ? (
              <RecommendationsEmptyState message={i18nT('travel:components.listTravel.RecommendationsTabs.istoriya_prosmotrov_pusta_d2c9428a')} icon="clock" styles={styles} colors={colors} />
            ) : (
              <View>
                <SavedCollectionHeader
                  clearLabel={i18nT('travel:components.listTravel.RecommendationsTabs.ochistit_istoriyu_prosmotrov_aba556ba')}
                  colors={colors}
                  count={viewHistory.length}
                  onClear={typeof clearHistory === 'function' ? handleClearHistory : undefined}
                  onSeeAll={() => router.push('/history' as any)}
                  seeAllLabel={i18nT('travel:components.listTravel.RecommendationsTabs.smotret_vsyu_istoriyu_prosmotrov_c486385e')}
                  styles={styles}
                  title={i18nT('travel:components.listTravel.RecommendationsTabs.istoriya_32242be0')}
                />

                {renderCardCollection(
                  viewHistory,
                  (item: CollectionItem) => getRecommendationsCollectionKey(item, 'history'),
                  (item: CollectionItem) => (
                    <TabTravelCard
                      key={getRecommendationsCollectionKey(item, 'history')}
                      item={mapRecommendationsCardItem(item)}
                      badge={{
                        icon: 'clock',
                        backgroundColor: colors.overlay,
                        iconColor: colors.textOnDark,
                      }}
                      onPress={() => router.push(item.url as any)}
                      layout={cardLayout}
                    />
                  )
                )}
              </View>
            )
          );
        default:
          return renderTabPane(null);
      }
    };

    return (
      <View style={[styles.container, isMobileWeb ? styles.containerMobileWebExpanded : styles.containerFixedHeight]}>
        <View style={styles.header}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabsScroll, Platform.OS === 'web' && { overflowX: 'auto', overflowY: 'hidden' }]}
            contentContainerStyle={styles.tabsContainer}
            {...(Platform.OS === 'web' ? ({ onWheel: handleHorizontalWheel } as any) : {})}
          >
            {tabs.map((tab) => {
              const isActiveTab = activeTab === tab.id;
              // На узких экранах все 4 таба не помещаются. Показываем подпись только для
              // активного таба — иконки остальных служат и индикатором, и точкой нажатия.
              const showLabel = !isNarrowViewport || isActiveTab;
              return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                onLayout={(e) => handleTabLayout(tab.id, e)}
                style={[
                  styles.tab,
                  isNarrowViewport && styles.tabCompact,
                  isActiveTab && styles.activeTab,
                ]}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActiveTab }}
              >
                <Feather
                  name={tab.icon as any}
                  size={isNarrowViewport ? 16 : 18}
                  color={isActiveTab ? colors.primary : colors.textMuted}
                />
                {showLabel && (
                <Text
                  style={[
                    styles.tabLabel,
                    isNarrowViewport && styles.tabLabelCompact,
                    isActiveTab && styles.activeTabLabel,
                  ]}
                  numberOfLines={1}
                >
                  {isNarrowViewport ? (tab.shortLabel ?? tab.label) : tab.label}
                </Text>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tab.count > 99 ? '99+' : tab.count}</Text>
                  </View>
                )}
              </Pressable>
              );
            })}

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

        <View style={[styles.content, isMobileWeb && styles.contentMobileWebExpanded]}>{renderContent()}</View>
      </View>
    );
  }
);

RecommendationsTabs.displayName = 'RecommendationsTabs';

export default RecommendationsTabs;
