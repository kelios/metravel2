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
  Pressable,
} from 'react-native';
import { Icon } from 'react-native-elements';
import AddressListItem from '@/components/MapPage/AddressListItem';
import PaginationComponent from '@/components/PaginationComponent';
import { TravelCoords } from '@/src/types/types';

export interface Travel {
  id: number | string;
  categoryName?: string;
}

interface Props {
  travelsData: TravelCoords[] | null;
  currentPage: number;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  onPageChange: (p: number) => void;
  onItemsPerPageChange: (n: number) => void;
  buildRouteTo: (t: TravelCoords) => void;

  // Новое — скрытие
  onHideTravel?: (id: string | number) => void;
  hiddenIds?: (string | number)[];
  onResetHidden?: () => void;

  // НОВОЕ — закрыть панель (мобилка)
  onClosePanel?: () => void;
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
                                            onHideTravel,
                                            hiddenIds = [],
                                            onResetHidden,
                                            onClosePanel,
                                          }) => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  // высота строки синхронизирована с AddressListItem (фото больше)
  const ROW_HEIGHT = useMemo(() => (isMobile ? 320 : 420), [isMobile]);

  const styles = useMemo(() => getStyles(isMobile, ROW_HEIGHT), [isMobile, ROW_HEIGHT]);

  const isLoading = travelsData === null;
  const totalItems = travelsData?.length ?? 0;

  const paginatedData: TravelCoords[] = useMemo(() => {
    if (!travelsData) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return travelsData.slice(start, start + itemsPerPage);
  }, [travelsData, currentPage, itemsPerPage]);

  const listRef = useRef<FlatList>(null);

  // Скроллим список вверх при смене страницы
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [currentPage]);

  // Скелетон c shimmer
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoading) {
      shimmerValue.setValue(0);
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
        <Animated.View style={[styles.skeletonShimmer, { transform: [{ translateX }] }]} />
      </View>
    );
  }, [shimmerValue, styles.skeletonItem, styles.skeletonShimmer]);

  const handleHide = useCallback(
    (item: TravelCoords) => {
      const id =
        (item as any)?.id ??
        (item as any)?.travelId ??
        (item as any)?.slug ??
        (item as any)?.uid;
      if (id != null && onHideTravel) onHideTravel(id);
    },
    [onHideTravel]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TravelCoords; index: number }) => (
      <AddressListItem
        key={(item as any)?.id ?? (item as any)?.travelId ?? `i-${index}`}
        travel={item}
        isMobile={isMobile}
        onPress={() => buildRouteTo(item)}
        onHidePress={onHideTravel ? () => handleHide(item) : undefined}
      />
    ),
    [buildRouteTo, isMobile, onHideTravel, handleHide]
  );

  const keyExtractor = useCallback((item: TravelCoords, index: number) => {
    const id =
      (item as any)?.id ??
      (item as any)?.travelId ??
      (item as any)?.slug ??
      (item as any)?.uid;
    return id != null ? String(id) : `travel-${index}`;
  }, []);

  const getItemLayout = useCallback(
    (_: TravelCoords[] | null | undefined, index: number) => {
      const length = ROW_HEIGHT + SEPARATOR_HEIGHT;
      return { length, offset: length * index, index };
    },
    [ROW_HEIGHT]
  );

  const Separator = useMemo(() => () => <View style={styles.separator} />, [styles.separator]);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {travelsData?.length === 0
            ? 'Ничего не найдено. Попробуйте изменить фильтры.'
            : 'Нет данных для отображения.'}
        </Text>
      </View>
    );
  }, [isLoading, travelsData?.length, styles.emptyContainer, styles.emptyText]);

  const hiddenCount = hiddenIds.length;

  return (
    <View style={styles.container} accessibilityLabel="Список мест по фильтрам">
      <View style={styles.headerRow}>
        <Text style={styles.resultsCount}>
          {isLoading ? 'Загрузка...' : `Найдено ${totalItems} объектов`}
        </Text>

        <View style={styles.headerActions}>
          {hiddenCount > 0 && (
            <Pressable
              onPress={onResetHidden}
              style={({ pressed }) => [styles.resetHiddenBtn, pressed && { opacity: 0.8 }]}
              hitSlop={8}
            >
              <Text style={styles.resetHiddenText}>Скрытые: {hiddenCount} • Сбросить</Text>
            </Pressable>
          )}

          {isMobile && onClosePanel && (
            <Pressable
              onPress={onClosePanel}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              hitSlop={8}
              accessibilityLabel="Свернуть список"
            >
              <Icon name="expand-more" type="material" size={24} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={isLoading ? Array.from({ length: itemsPerPage }) : paginatedData}
        renderItem={isLoading ? renderSkeleton : renderItem}
        keyExtractor={isLoading ? (_item, index) => `skeleton-${index}` : keyExtractor}
        ItemSeparatorComponent={isLoading ? null : Separator}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={[
          styles.flatListContent,
          {
            paddingBottom: isMobile ? 140 : 16,
            flexGrow: !isLoading && paginatedData.length === 0 ? 1 : 0,
          },
        ]}
        getItemLayout={!isLoading ? getItemLayout : undefined}
        removeClippedSubviews={Platform.OS === 'android' && !isLoading}
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 10,
      backgroundColor: '#f2f2f2',
    },
    resultsCount: {
      fontSize: isMobile ? 14 : 16,
      fontWeight: '600',
      color: '#333',
      textAlign: 'left',
    },
    resetHiddenBtn: {
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: '#f2f2f2',
    },
    resetHiddenText: {
      fontSize: isMobile ? 12 : 13,
      color: '#666',
      fontWeight: '600',
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
