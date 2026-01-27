import React, { useEffect, useState } from 'react';

/**
 * Оптимизации для страницы карты
 * Цель: Улучшить Lighthouse score с 62 до 80+
 */

/**
 * Hook для отложенной загрузки тяжелых компонентов карты
 * Загружает компоненты только после первого рендера и idle time
 */
export function useDeferredMapLoad(enabled: boolean = true) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShouldLoad(true);
      return;
    }

    // Откладываем загрузку карты до idle time
    const timeoutId = setTimeout(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => setShouldLoad(true), { timeout: 1000 });
      } else {
        setShouldLoad(true);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [enabled]);

  return shouldLoad;
}

/**
 * Конфигурация для оптимизации OpenStreetMap
 */
export const MAP_OPTIMIZATION_CONFIG = {
  // Уменьшаем начальный zoom для быстрой загрузки
  initialZoom: 10,
  
  // Ограничиваем количество маркеров на карте
  maxMarkers: 50,
  
  // Tile loading optimization
  tileSize: 256,
  maxZoom: 18,
  
  // Отключаем анимации для первой загрузки
  zoomAnimation: false,
  fadeAnimation: false,
  
  // Предзагрузка тайлов
  keepBuffer: 2,
} as const;

/**
 * Утилита для батчинга обновлений маркеров
 */
export function batchMarkerUpdates<T>(
  items: T[],
  batchSize: number = 20
): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
