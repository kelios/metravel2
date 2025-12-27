// components/travel/PopularTravelList.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Title } from "react-native-paper";
import TravelTmlRound from "@/components/travel/TravelTmlRound";
import { fetchTravelsPopular } from "@/src/api/map";
import type { TravelsMap } from "@/src/types/types";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import {
  FLATLIST_CONFIG,
  FLATLIST_CONFIG_MOBILE,
} from '@/components/listTravel/utils/listTravelConstants';

type PopularTravelListProps = {
  onLayout?: (event: any) => void;
  scrollToAnchor?: () => void;
  title?: string | null;
  maxColumns?: number;
  showHeader?: boolean;
  embedded?: boolean;
};

const SEPARATOR_HEIGHT = 20;

const PopularTravelList: React.FC<PopularTravelListProps> = memo(
  ({
     onLayout,
     scrollToAnchor,
     title = "Популярные маршруты",
     maxColumns = 3,
     showHeader = true,
     embedded = false,
   }) => {
    const [travelsPopular, setTravelsPopular] = useState<TravelsMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const { width } = useResponsive();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mountedRef = useRef(true);
    const listConfig = Platform.OS === 'web' ? FLATLIST_CONFIG : FLATLIST_CONFIG_MOBILE;

    // ✅ УЛУЧШЕНИЕ: Более точные брейкпоинты для адаптивности
    const numColumns = useMemo(() => {
      if (width <= 640) return 1; // mobile (≤ 640px)
      if (width <= 1024) return Math.min(maxColumns, 2); // tablet (641–1024px)
      return Math.min(maxColumns, 3); // desktop (≥ 1025px)
    }, [width, maxColumns]);

    const fetchPopularTravels = useCallback(async () => {
      if (!mountedRef.current) return;

      try {
        setIsLoading(true);
        setHasError(false);
        const data = await fetchTravelsPopular();
        if (mountedRef.current) {
          setTravelsPopular(data);
        }
      } catch (error) {
        if (mountedRef.current) {
          setHasError(true);
          if (__DEV__) {
            console.error('Error fetching popular travels:', error);
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }, []);

    useEffect(() => {
      mountedRef.current = true;
      fetchPopularTravels();

      return () => {
        mountedRef.current = false;
      };
    }, [fetchPopularTravels]);

    const popularList = useMemo(() => {
      const list = Object.values(travelsPopular) as any[];
      const filtered = list.filter((item) => {
        const name = (item?.name || '').trim();
        const country = (item?.countryName || '').trim();
        const rawViews = item?.countUnicIpView ?? item?.views;
        const hasViewsField = rawViews !== undefined && rawViews !== null && String(rawViews).trim().length > 0;
        const views = Number(rawViews);

        return name.length > 0 && country.length > 0 && (!hasViewsField || views > 0);
      });
      // Ограничиваем количество элементов для первоначального рендера
      return filtered.slice(0, Platform.OS === 'web' ? 8 : filtered.length);
    }, [travelsPopular]);

    const webGridStyle: any = useMemo(() => {
      if (Platform.OS !== 'web') return undefined;

      // mobile-first: on small screens allow horizontal scroll while keeping CSS Grid as the layout engine
      if (width <= 640) {
        return {
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(260px, 86vw)',
          gap: styles.webGrid?.gap ?? DESIGN_TOKENS.spacing.sm,
          alignItems: 'stretch',
          width: 'max-content',
        };
      }

      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
        gap: styles.webGrid?.gap ?? DESIGN_TOKENS.spacing.sm,
        alignItems: 'stretch',
        width: '100%',
      };
    }, [numColumns, width]);

    // Оптимизированный рендер элемента с предотвращением лишних ререндеров
    const renderItem = useCallback(
      ({ item }: { item: any; index: number }) => (
        <TravelTmlRound
          travel={item as any}
        />
      ),
      []
    );

    const keyExtractor = useCallback((item: any) => `${item.id}-${item.updated_at || ''}`, []);

    const handleContentChange = useCallback(() => {
      scrollToAnchor?.();
    }, [scrollToAnchor]);

    // Оптимизированная анимация - запускаем только когда контент готов
    useEffect(() => {
      if (!isLoading && popularList.length > 0 && mountedRef.current) {
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 250, // Укороченная анимация
              useNativeDriver: true,
            }).start();
          }
        }, 50); // Небольшая задержка для обеспечения плавности

        return () => clearTimeout(timer);
      }
    }, [isLoading, popularList.length, fadeAnim]);

    // ✅ УЛУЧШЕНИЕ: Улучшенное выравнивание с одинаковой высотой карточек
    const columnWrapperStyle: any = useMemo(
      () =>
        numColumns > 1
          ? {
            justifyContent: "flex-start",
            alignItems: "stretch",
            gap: DESIGN_TOKENS.spacing.xxs,
            ...Platform.select({
              web: {
                display: 'flex' as any,
                flexDirection: 'row' as any,
              },
            }),
          }
          : undefined,
      [numColumns]
    );

    // Оптимизированный разделитель
    const ItemSeparatorComponent = useCallback(() =>
        <View style={styles.separator} />,
      []);

    if (isLoading) {
      return (
        <View style={styles.loadingContainer} onLayout={onLayout}>
          <ActivityIndicator size="large" color="#6B4F4F" />
          <Text style={styles.loadingText}>Загрузка популярных маршрутов…</Text>
        </View>
      );
    }

    if (hasError || popularList.length === 0) {
      return (
        <View style={styles.loadingContainer} onLayout={onLayout}>
          <Text style={styles.errorText}>
            {hasError ? 'Ошибка загрузки маршрутов' : 'Нет популярных маршрутов 😔'}
          </Text>
        </View>
      );
    }

    return (
      <View style={embedded ? styles.embeddedSection : styles.section} onLayout={onLayout}>
        {showHeader && title !== null && (
          <Title style={styles.title} accessibilityRole="header">
            {title}
          </Title>
        )}

        <Animated.View style={{ opacity: fadeAnim }}>
          {Platform.OS === 'web' ? (
            <View style={width <= 640 ? styles.webScrollContainer : undefined}>
              <View
                accessibilityRole="list"
                style={[styles.flatListContent, styles.webGrid, webGridStyle]}
              >
                {popularList.map((item) => (
                  <View
                    key={keyExtractor(item)}
                    accessibilityRole="none"
                    style={styles.webGridItem}
                  >
                    <TravelTmlRound travel={item as any} />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Animated.FlatList
              key={`cols-${numColumns}`}
              data={popularList as any[]}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={numColumns}
              contentContainerStyle={styles.flatListContent}
              columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
              ItemSeparatorComponent={ItemSeparatorComponent}
              scrollEnabled={!embedded}
              nestedScrollEnabled={!embedded}
              showsVerticalScrollIndicator={false}
              initialNumToRender={
                listConfig?.INITIAL_NUM_TO_RENDER ?? FLATLIST_CONFIG_MOBILE.INITIAL_NUM_TO_RENDER
              }
              maxToRenderPerBatch={listConfig.MAX_TO_RENDER_PER_BATCH}
              windowSize={listConfig.WINDOW_SIZE}
              removeClippedSubviews={false}
              onContentSizeChange={handleContentChange}
              updateCellsBatchingPeriod={listConfig.UPDATE_CELLS_BATCHING_PERIOD} // Батчинг обновлений
              disableVirtualization={false} // Всегда использовать виртуализацию
              accessibilityRole="list"
            />
          )}
        </Animated.View>
      </View>
    );
  }
);

// Добавляем явное имя для memo для лучшей отладки
PopularTravelList.displayName = 'PopularTravelList';

export default PopularTravelList;

const styles = StyleSheet.create({
  // ✅ УЛУЧШЕНИЕ: Современная секция с улучшенным дизайном
  section: {
    marginTop: 32,
    marginBottom: 48,
    paddingHorizontal: Platform.select({
      web: 24,
      default: 16,
    }),
    paddingVertical: Platform.select({
      web: 32,
      default: 24,
    }),
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    minHeight: 200,
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease',
      },
    }),
  },
  embeddedSection: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    width: '100%',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 0,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.xs,
    minHeight: 300,
  },
  loadingText: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "500",
  },
  errorText: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: "#ef4444",
    textAlign: "center",
    fontWeight: "500",
  },
  // ✅ УЛУЧШЕНИЕ: Современная типографика заголовка
  title: {
    fontSize: Platform.select({
      web: 28,
      default: 24,
    }),
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: DESIGN_TOKENS.spacing.xxs,
    textAlign: "center",
    letterSpacing: -0.5,
    ...Platform.select({
      web: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    }),
  },
  flatListContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xxs,
    ...Platform.select({
      web: {
        paddingHorizontal: 0,
      },
      default: {},
    }),
  },
  webGrid: {
    ...Platform.select({
      web: {
        display: 'grid' as any,
        gap: 'clamp(12px, 1.6vw, 16px)' as any,
      } as any,
      default: {},
    }),
  },
  webScrollContainer: {
    ...Platform.select({
      web: {
        overflowX: 'auto' as any,
        overflowY: 'hidden' as any,
        WebkitOverflowScrolling: 'touch' as any,
        paddingBottom: DESIGN_TOKENS.spacing.xxs,
        scrollSnapType: 'x mandatory' as any,
        scrollBehavior: 'smooth' as any,
      } as any,
      default: {},
    }),
  },
  webGridItem: {
    flex: 1,
    minWidth: 0,
    ...Platform.select({
      web: {
        scrollSnapAlign: 'start' as any,
      } as any,
      default: {},
    }),
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },
});