// components/MapPage/TravelListPanel.tsx
import React, { useMemo, useCallback, useRef, memo, useEffect } from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import AddressListItem from '@/components/MapPage/AddressListItem';
import PaginationComponent from '@/components/PaginationComponent';
import { TravelCoords } from '@/src/types/types';

export interface Travel {
  id: number | string;
  categoryName?: string;
}

interface Props {
  travelsData: TravelCoords[] | null; // Исправлен тип
  currentPage: number;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  onPageChange: (p: number) => void;
  onItemsPerPageChange: (n: number) => void;
  buildRouteTo: (t: TravelCoords) => void; // Исправлен тип
}

const SEPARATOR_HEIGHT = 12;

const TravelListPanel: React.FC<Props> = ({
                                            travelsData,
                                            currentPage,
                                            itemsPerPage,
                                            itemsPerPageOptions,
                                            onPageChange,
                                            onItemsPerPageChange,
                                            buildRouteTo,
                                          }) => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  // высота строки синхронизирована с AddressListItem (фото больше)
  const ROW_HEIGHT = useMemo(() => (isMobile ? 320 : 420), [isMobile]); // Увеличена высота для десктопа

  const styles = useMemo(() => getStyles(isMobile, ROW_HEIGHT), [isMobile, ROW_HEIGHT]);

  const isLoading = travelsData === null;
  const totalItems = travelsData?.length ?? 0;

  const paginatedData: TravelCoords[] = useMemo(() => {
    if (!travelsData) return [];
    const start = (currentPage - 1) * itemsPerPage; // Исправлено: страницы обычно с 1
    return travelsData.slice(start, start + itemsPerPage);
  }, [travelsData, currentPage, itemsPerPage]);

  const listRef = useRef<FlatList>(null);

  // Скроллим список вверх при смене страницы
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [currentPage]);

  // Скелетон c shimmer — запускаем только когда идёт загрузка
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoading) {
      shimmerValue.setValue(0); // Сбрасываем анимацию при завершении загрузки
      return;
    }

    const anim = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerValue, isLoading]);

  const renderSkeleton = useCallback(() => {
    const translateX = shimmerValue.interpolate({
      inputRange: [0, 1],
      outputRange: [-150, 150],
    });

    return (
      <View style={styles.skeletonItem} accessibilityRole="progressbar">
        <Animated.View
          style={[
            styles.skeletonShimmer,
            { transform: [{ translateX }] }
          ]}
        />
      </View>
    );
  }, [shimmerValue, styles.skeletonItem, styles.skeletonShimmer]);

  const renderItem = useCallback(
    ({ item, index }: { item: TravelCoords; index: number }) => (
      <AddressListItem
        key={item.id || index} // Добавлен ключ для стабильности
        travel={item}
        isMobile={isMobile}
        onPress={() => buildRouteTo(item)}
      />
    ),
    [buildRouteTo, isMobile]
  );

  const keyExtractor = useCallback(
    (item: TravelCoords, index: number) => {
      if (item?.id != null) return String(item.id);
      if (item?.travelId != null) return String(item.travelId);
      return `travel-${index}`;
    },
    []
  );

  // фиксированный layout с учётом разделителя → плавный скролл без «прыжков»
  const getItemLayout = useCallback(
    (_: TravelCoords[] | null | undefined, index: number) => {
      const length = ROW_HEIGHT + SEPARATOR_HEIGHT;
      return {
        length,
        offset: length * index,
        index
      };
    },
    [ROW_HEIGHT]
  );

  const Separator = useMemo(
    () => () => <View style={styles.separator} />,
    [styles.separator]
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {travelsData?.length === 0
            ? "Ничего не найдено. Попробуйте изменить фильтры."
            : "Нет данных для отображения."
          }
        </Text>
      </View>
    );
  }, [isLoading, travelsData?.length, styles.emptyContainer, styles.emptyText]);

  return (
    <View style={styles.container} accessibilityLabel="Список мест по фильтрам">
      <Text style={styles.resultsCount}>
        {isLoading ? "Загрузка..." : `Найдено ${totalItems} объектов`}
      </Text>

      <FlatList
        ref={listRef}
        data={isLoading ? Array.from({ length: itemsPerPage }) : paginatedData}
        renderItem={isLoading ? renderSkeleton : renderItem}
        keyExtractor={isLoading ? (_item, index) => `skeleton-${index}` : keyExtractor}
        ItemSeparatorComponent={isLoading ? null : Separator} // Убираем разделители для скелетона
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={[
          styles.flatListContent,
          {
            paddingBottom: isMobile ? 140 : 16,
            flexGrow: paginatedData.length === 0 ? 1 : 0, // Растягиваем при пустом списке
          }
        ]}
        getItemLayout={getItemLayout}
        removeClippedSubviews={Platform.OS === 'android' && !isLoading} // Отключаем для скелетона
        initialNumToRender={isMobile ? 3 : 6}
        maxToRenderPerBatch={isMobile ? 4 : 8}
        windowSize={isMobile ? 5 : 9}
        accessibilityRole="list"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {!isLoading && totalItems > 0 && (
        <PaginationComponent
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={itemsPerPageOptions}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
          totalItems={totalItems}
        />
      )}
    </View>
  );
};

const getStyles = (isMobile: boolean, ROW_HEIGHT: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: isMobile ? 8 : 12,
    },
    resultsCount: {
      fontSize: isMobile ? 14 : 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 12,
      paddingHorizontal: 4,
      textAlign: 'center',
    },
    flatListContent: {
      flexGrow: 1,
    },
    separator: {
      height: SEPARATOR_HEIGHT,
      backgroundColor: 'transparent',
    },
    skeletonItem: {
      height: ROW_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#f0f0f0',
      marginVertical: 4,
    },
    skeletonShimmer: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      width: '60%',
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: isMobile ? 14 : 16,
      color: '#666',
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default memo(TravelListPanel);