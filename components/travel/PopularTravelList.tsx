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
  useWindowDimensions,
  View,
} from "react-native";
import { Title } from "react-native-paper";
import TravelTmlRound from "@/components/travel/TravelTmlRound";
import { fetchTravelsPopular } from "@/src/api/travels";
import type { Travel, TravelsMap } from "@/src/types/types";

type PopularTravelListProps = {
  onLayout?: (event: any) => void;
  scrollToAnchor?: () => void;
  title?: string | null;
  maxColumns?: number;
};

const ITEM_HEIGHT = 250;
const SEPARATOR_HEIGHT = 20;

// Оптимизированные значения для производительности
const WEB_LIST_WINDOW_SIZE = 3; // Уменьшено для web
const INITIAL_NUM_TO_RENDER = 4; // Уменьшено для быстрой первоначальной загрузки

const PopularTravelList: React.FC<PopularTravelListProps> = memo(
  ({ onLayout, scrollToAnchor, title = "Популярные маршруты", maxColumns = 3 }) => {
    const [travelsPopular, setTravelsPopular] = useState<TravelsMap>({});
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const { width } = useWindowDimensions();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mountedRef = useRef(true);

    const numColumns = useMemo(() => {
      if (width <= 600) return 1;
      if (width <= 1024) return Math.min(maxColumns, 2);
      return Math.min(maxColumns, 3);
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
          console.error('Error fetching popular travels:', error);
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
      const list = Object.values(travelsPopular);
      // Ограничиваем количество элементов для первоначального рендера
      return list.slice(0, Platform.OS === 'web' ? 8 : list.length);
    }, [travelsPopular]);

    // Оптимизированный рендер элемента с предотвращением лишних ререндеров
    const renderItem = useCallback(
      ({ item, index }: { item: Travel; index: number }) => (
        <TravelTmlRound
          travel={item}
          priority={index < 4 ? 'high' : 'low'} // Приоритетная загрузка первых изображений
        />
      ),
      []
    );

    const keyExtractor = useCallback((item: Travel) => `${item.id}-${item.updated_at || ''}`, []);

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

    const getItemLayout = useCallback(
      (_: unknown, index: number) => ({
        length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
        offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
        index,
      }),
      []
    );

    // Упрощенное выравнивание - убрана сложная логика
    const columnWrapperStyle = useMemo(
      () =>
        numColumns > 1
          ? {
            justifyContent: "space-between",
            gap: 16,
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
          <Animated.FlatList
            key={`cols-${numColumns}`}
            data={popularList}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={numColumns}
            contentContainerStyle={styles.flatListContent}
            columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
            ItemSeparatorComponent={ItemSeparatorComponent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={INITIAL_NUM_TO_RENDER}
            maxToRenderPerBatch={4} // Уменьшено для производительности
            windowSize={Platform.OS === "web" ? WEB_LIST_WINDOW_SIZE : 5}
            removeClippedSubviews={Platform.OS !== "web"}
            getItemLayout={getItemLayout}
            onContentSizeChange={handleContentChange}
            updateCellsBatchingPeriod={50} // Батчинг обновлений
            disableVirtualization={false} // Всегда использовать виртуализацию
            accessibilityRole="list"
          />
        </Animated.View>
      </View>
    );
  }
);

// Добавляем явное имя для memo для лучшей отладки
PopularTravelList.displayName = 'PopularTravelList';

export default PopularTravelList;

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    marginBottom: 40,
    paddingHorizontal: 16,
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 200, // Минимальная высота для предотвращения layout shift
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    minHeight: 200,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: "#d32f2f",
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3B2C24",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  flatListContent: {
    paddingBottom: 20,
  },
  separator: {
    height: SEPARATOR_HEIGHT,
  },
});