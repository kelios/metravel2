// src/hooks/useOptimizedList.ts
// ✅ Хук для оптимизации рендеринга списков

import { useMemo, useCallback } from 'react';
import { Platform } from 'react-native';

export interface OptimizedListConfig {
  /**
   * Количество элементов для первоначального рендера
   */
  initialNumToRender?: number;
  /**
   * Максимальное количество элементов для рендера за один батч
   */
  maxToRenderPerBatch?: number;
  /**
   * Размер окна для виртуализации (больше = больше элементов в памяти)
   */
  windowSize?: number;
  /**
   * Задержка между батчами рендеринга (мс)
   */
  updateCellsBatchingPeriod?: number;
  /**
   * Удалять элементы вне viewport из DOM (только для web)
   */
  removeClippedSubviews?: boolean;
}

/**
 * Возвращает оптимизированные настройки для FlatList/VirtualizedList
 * с учетом платформы и количества элементов
 */
export function useOptimizedList(
  itemCount: number,
  config: OptimizedListConfig = {}
): OptimizedListConfig {
  const {
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    updateCellsBatchingPeriod,
    removeClippedSubviews,
  } = config;

  return useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const isMobile = Platform.OS !== 'web';

    // Базовые значения для разных платформ
    const baseInitialNum = isWeb ? 6 : 10;
    const baseMaxBatch = isWeb ? 4 : 8;
    const baseWindowSize = isWeb ? 5 : 10;

    // Адаптируем под количество элементов
    const optimizedInitial = Math.min(
      initialNumToRender ?? baseInitialNum,
      itemCount
    );
    const optimizedMaxBatch = Math.min(
      maxToRenderPerBatch ?? baseMaxBatch,
      itemCount
    );

    return {
      initialNumToRender: optimizedInitial,
      maxToRenderPerBatch: optimizedMaxBatch,
      windowSize: windowSize ?? baseWindowSize,
      updateCellsBatchingPeriod: updateCellsBatchingPeriod ?? (isWeb ? 50 : 16),
      removeClippedSubviews: removeClippedSubviews ?? isMobile,
    };
  }, [
    itemCount,
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    updateCellsBatchingPeriod,
    removeClippedSubviews,
  ]);
}

/**
 * Создает оптимизированный keyExtractor для списков
 */
export function useOptimizedKeyExtractor(
  keyField: string = 'id',
  fallbackIndex: boolean = true
) {
  return useCallback(
    (item: any, index: number) => {
      if (item && typeof item === 'object' && item[keyField] != null) {
        return String(item[keyField]);
      }
      if (fallbackIndex) {
        return `item-${index}`;
      }
      throw new Error(`Item at index ${index} does not have ${keyField}`);
    },
    [keyField, fallbackIndex]
  );
}

/**
 * Создает оптимизированный getItemLayout для FlatList
 * (улучшает производительность при фиксированной высоте элементов)
 */
export function useOptimizedItemLayout(itemHeight: number) {
  return useCallback(
    (_data: any, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );
}

