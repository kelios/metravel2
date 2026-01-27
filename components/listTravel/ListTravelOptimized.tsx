import React, { memo, useMemo } from 'react';
import { FlatList, FlatListProps } from 'react-native';

/**
 * Оптимизированные настройки для FlatList на странице поиска
 * Цель: Уменьшить DOM size и улучшить Lighthouse score
 */
export const OPTIMIZED_FLATLIST_CONFIG = {
  // Уменьшаем начальное количество рендеримых элементов
  initialNumToRender: 6, // Было: default (10+)
  
  // Увеличиваем размер окна для лучшей производительности
  windowSize: 5, // Было: 21 (default)
  
  // Оптимизация обновлений
  maxToRenderPerBatch: 3, // Было: 10 (default)
  updateCellsBatchingPeriod: 100, // Было: 50 (default)
  
  // Удаляем элементы вне видимости для уменьшения DOM
  removeClippedSubviews: true,
  
  // Оптимизация прокрутки
  getItemLayout: (data: any, index: number) => ({
    length: 280, // Примерная высота карточки
    offset: 280 * index,
    index,
  }),
} as const;

/**
 * Оптимизированный FlatList wrapper с мемоизацией
 */
export function OptimizedFlatList<T>(props: FlatListProps<T>) {
  const optimizedProps = useMemo(() => ({
    ...OPTIMIZED_FLATLIST_CONFIG,
    ...props,
  }), [props]);

  return <FlatList {...optimizedProps} />;
}

export const MemoizedOptimizedFlatList = memo(OptimizedFlatList) as typeof OptimizedFlatList;
