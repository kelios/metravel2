// TravelsGrid.tsx
// ✅ НОВЫЙ КОМПОНЕНТ: Адаптивная сетка для карточек путешествий

import React, { useMemo, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import CompactTravelCard from './CompactTravelCard';

interface TravelsGridProps {
  travels: Travel[];
  onTravelPress: (travel: Travel) => void;
  onFavoritePress?: (travel: Travel) => void;
  favorites?: Set<number>;
  loading?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const palette = DESIGN_TOKENS.colors;
const spacing = DESIGN_TOKENS.spacing;

function TravelsGrid({
  travels,
  onTravelPress,
  onFavoritePress,
  favorites,
  loading = false,
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  refreshing = false,
  onRefresh,
}: TravelsGridProps) {
  const { width } = useWindowDimensions();

  // ✅ РЕДИЗАЙН: Вычисляем количество колонок и размер карточек
  const { columns, cardSize, gap } = useMemo(() => {
    if (width < 480) {
      // Small Mobile: 1 колонка для очень маленьких экранов
      return {
        columns: 1,
        cardSize: 'small' as const,
        gap: spacing.sm,
      };
    } else if (width < 768) {
      // Mobile: 2 колонки
      return {
        columns: 2,
        cardSize: 'small' as const,
        gap: spacing.sm,
      };
    } else if (width < 1024) {
      // Tablet: 3 колонки
      return {
        columns: 3,
        cardSize: 'medium' as const,
        gap: spacing.md,
      };
    } else if (width < 1440) {
      // Desktop: 4 колонки
      return {
        columns: 4,
        cardSize: 'medium' as const,
        gap: spacing.md,
      };
    } else {
      // Wide Desktop: 5 колонок
      return {
        columns: 5,
        cardSize: 'large' as const,
        gap: spacing.lg,
      };
    }
  }, [width]);

  // ✅ РЕДИЗАЙН: Вычисляем ширину карточки с учетом адаптивности
  const cardWidth = useMemo(() => {
    if (columns === 1) {
      // Для одной колонки - почти полная ширина с учетом padding контейнера
      const containerPadding = spacing.md * 2;
      return width - containerPadding;
    }
    const totalGaps = gap * (columns - 1);
    // ✅ ИСПРАВЛЕНИЕ: Учитываем padding контейнера и gap между колонками
    const containerPadding = spacing.md * 2;
    const availableWidth = width - containerPadding;
    const calculatedWidth = (availableWidth - totalGaps) / columns;
    // ✅ ИСПРАВЛЕНИЕ: Округляем до целого числа для избежания проблем с рендерингом
    return Math.floor(calculatedWidth);
  }, [width, columns, gap]);

  // ✅ ОПТИМИЗАЦИЯ: Мемоизированный рендер карточки
  const renderItem = useCallback(({ item, index }: { item: Travel; index: number }) => {
    const isFavorite = favorites?.has(item.id) || false;

    return (
      <View style={[styles.cardWrapper, { width: cardWidth, marginBottom: gap }]}>
        <CompactTravelCard
          travel={item}
          size={cardSize}
          onPress={() => onTravelPress(item)}
          onFavoritePress={onFavoritePress ? () => onFavoritePress(item) : undefined}
          isFavorite={isFavorite}
          showQuickInfo={true}
        />
      </View>
    );
  }, [cardWidth, gap, cardSize, onTravelPress, onFavoritePress, favorites]);

  // ✅ ОПТИМИЗАЦИЯ: Мемоизированный key extractor
  const keyExtractor = useCallback((item: Travel) => `travel-${item.id}`, []);

  // ✅ ОПТИМИЗАЦИЯ: Мемоизированный getItemLayout для виртуализации
  const getItemLayout = useCallback((_: any, index: number) => {
    // ✅ ИСПРАВЛЕНИЕ: Более точный расчет высоты карточки
    const imageHeight = cardSize === 'small' ? 120 : cardSize === 'medium' ? 160 : 200;
    const contentHeight = 80; // Примерная высота контента (заголовок + мета)
    const itemHeight = imageHeight + contentHeight + gap;
    return {
      length: itemHeight,
      offset: itemHeight * Math.floor(index / columns),
      index,
    };
  }, [cardWidth, gap, columns, cardSize]);

  return (
    <View style={styles.container}>
      <FlatList
        data={travels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={columns}
        key={`grid-${columns}`}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.xl },
        ]}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        refreshing={refreshing}
        onRefresh={onRefresh}
        getItemLayout={getItemLayout}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={columns * 2}
        {...Platform.select({
          web: {
            // @ts-ignore
            style: { width: '100%' },
          },
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingTop: spacing.sm,
  },
  cardWrapper: {
    // @ts-ignore - web specific style
    ...(Platform.OS === 'web' ? { display: 'inline-block' } : {}),
  },
});

// ✅ ОПТИМИЗАЦИЯ: Мемоизация компонента
export default memo(TravelsGrid);

