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

type PopularTravelListProps = {
  onLayout?: (event: any) => void;
  scrollToAnchor?: () => void;
  title?: string | null;
  maxColumns?: number;
};

const SEPARATOR_HEIGHT = 20;

const PopularTravelList: React.FC<PopularTravelListProps> = memo(
  ({ onLayout, scrollToAnchor, title = "Популярные маршруты", maxColumns = 3 }) => {
    const [travelsPopular, setTravelsPopular] = useState<TravelsMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const { width } = useResponsive();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mountedRef = useRef(true);

    // ✅ УЛУЧШЕНИЕ: Более точные брейкпоинты для адаптивности
    const numColumns = useMemo(() => {
      if (width < 640) return 1; // Мобильные
      if (width < 1024) return Math.min(maxColumns, 2); // Планшеты портретные
      if (width < 1280) return Math.min(maxColumns, 2); // Планшеты landscape - исправлено на 2 колонки
      return Math.min(maxColumns, 3); // Десктопы от 1280px
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
      // Ограничиваем количество элементов для первоначального рендера
      return list.slice(0, Platform.OS === 'web' ? 8 : list.length);
    }, [travelsPopular]);

    const popularRows = useMemo(() => {
      if (Platform.OS !== 'web') return [];

      const rows: any[][] = [];
      for (let i = 0; i < popularList.length; i += numColumns) {
        rows.push(popularList.slice(i, i + numColumns));
      }
      return rows;
    }, [popularList, numColumns]);

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

    const renderWebRow = useCallback(
      ({ item: rowItems, index: rowIndex }: { item: any[]; index: number }) => {
        return (
          <View style={styles.webRow}>
            {rowItems.map((item, _itemIndex) => (
              <View key={keyExtractor(item)} style={styles.webItemContainer}>
                <TravelTmlRound travel={item as any} />
              </View>
            ))}

            {rowItems.length < numColumns &&
              Array(numColumns - rowItems.length)
                .fill(null)
                .map((_, i) => (
                  <View key={`spacer-${rowIndex}-${i}`} style={styles.webItemContainer} />
                ))}
          </View>
        );
      },
      [keyExtractor, numColumns]
    );

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
      <View style={styles.section} onLayout={onLayout}>
        {title !== null && (
          <Title style={styles.title} accessibilityRole="header">
            {title}
          </Title>
        )}

        <Animated.View style={{ opacity: fadeAnim }}>
          {Platform.OS === 'web' ? (
            <Animated.FlatList
              key={`rows-${numColumns}`}
              data={popularRows}
              renderItem={renderWebRow}
              keyExtractor={(_, index) => `row-${index}`}
              contentContainerStyle={styles.flatListContent}
              ItemSeparatorComponent={ItemSeparatorComponent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={Math.min(INITIAL_NUM_TO_RENDER, popularRows.length)}
              maxToRenderPerBatch={4}
              windowSize={WEB_LIST_WINDOW_SIZE}
              removeClippedSubviews={false}
              onContentSizeChange={handleContentChange}
              updateCellsBatchingPeriod={50}
              disableVirtualization={false}
              accessibilityRole="list"
            />
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
              showsVerticalScrollIndicator={false}
              initialNumToRender={INITIAL_NUM_TO_RENDER}
              maxToRenderPerBatch={4} // Уменьшено для производительности
              windowSize={5}
              removeClippedSubviews={false}
              onContentSizeChange={handleContentChange}
              updateCellsBatchingPeriod={50} // Батчинг обновлений
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
  webRow: {
    flexDirection: 'row',
    width: '100%',
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  webItemContainer: {
    flex: 1,
    minWidth: 0,
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },
});