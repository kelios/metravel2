import React, { memo, useMemo } from 'react';
import { FlashList, FlashListProps } from '@shopify/flash-list';

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

export const OPTIMIZED_FLASHLIST_CONFIG = {
  // Расстояние отрисовки за пределами viewport
  drawDistance: 500,
  
  // Оптимизация обновлений - фиксированная высота элемента
  overrideItemLayout: (layout: { span?: number; size?: number }) => {
    layout.size = 280; // Фиксированная высота для лучшей производительности
  },
} as const;

/**
 * Оптимизированный FlashList wrapper с мемоизацией
 */
export function OptimizedFlashList<T>(props: FlashListProps<T>) {
  const optimizedProps = useMemo(() => ({
    ...OPTIMIZED_FLASHLIST_CONFIG,
    ...props,
  }), [props]);

  return <FlashList {...optimizedProps} />;
}

export const MemoizedOptimizedFlashList = memo(OptimizedFlashList) as typeof OptimizedFlashList;

// Экспорт для обратной совместимости
export const OptimizedFlatList = OptimizedFlashList;
export const MemoizedOptimizedFlatList = MemoizedOptimizedFlashList;
