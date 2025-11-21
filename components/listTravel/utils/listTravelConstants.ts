/**
 * Константы для компонента ListTravel
 * Централизация всех констант для улучшения поддерживаемости
 */

import type { FilterState } from "./listTravelTypes";

// ✅ АРХИТЕКТУРА: Начальное состояние фильтров
export const INITIAL_FILTER: FilterState = {};

// ✅ АРХИТЕКТУРА: ID Беларуси для специальной страницы
export const BELARUS_ID = 3;

// ✅ АРХИТЕКТУРА: Количество элементов на странице
export const PER_PAGE = 12;

// ✅ АРХИТЕКТУРА: Ключи для хранения состояния видимости
export const PERSONALIZATION_VISIBLE_KEY = 'personalization_visible';
export const WEEKLY_HIGHLIGHTS_VISIBLE_KEY = 'weekly_highlights_visible';
export const RECOMMENDATIONS_VISIBLE_KEY = 'recommendations_visible';

// ✅ АРХИТЕКТУРА: Breakpoints для адаптивности
// ✅ ИСПРАВЛЕНИЕ: Добавлены промежуточные breakpoints для лучшей адаптивности
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  TABLET_LANDSCAPE: 1280,
  DESKTOP: 1440,
} as const;

// ✅ АРХИТЕКТУРА: Количество колонок для разных экранов
// ✅ ИСПРАВЛЕНИЕ: Оптимизировано для планшетов (2-3 колонки в зависимости от размера)
export const GRID_COLUMNS = {
  MOBILE: 1,
  TABLET: 2,        // 768-1024px: 2 колонки
  TABLET_LANDSCAPE: 3, // 1024-1280px: 3 колонки
  DESKTOP: 4,       // 1280-1440px: 4 колонки
  DESKTOP_LARGE: 5, // >1440px: 5 колонок
} as const;

// ✅ АРХИТЕКТУРА: Время кеширования для React Query (staleTime)
export const STALE_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 60 * 1000, // 1 минута
  POPULAR: 3600000, // 1 час
} as const;

// ✅ АРХИТЕКТУРА: Время хранения в кеше (gcTime, бывший cacheTime)
export const GC_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 5 * 60 * 1000, // 5 минут
  POPULAR: 10 * 60 * 1000, // 10 минут
} as const;

// ✅ АРХИТЕКТУРА: Конфигурация React Query по умолчанию
export const QUERY_CONFIG = {
  REFETCH_ON_MOUNT: false,
  REFETCH_ON_WINDOW_FOCUS: false,
  KEEP_PREVIOUS_DATA: false,
} as const;

// ✅ АРХИТЕКТУРА: Пороги для badges социального доказательства
export const BADGE_THRESHOLDS = {
  POPULAR_VIEWS: 1000, // "Популярное" - более 1000 просмотров
  NEW_DAYS: 7, // "Новое" - создано за последние 7 дней
  TREND_VIEWS: 500, // "Тренд" - более 500 просмотров
  TREND_DAYS: 30, // "Тренд" - обновлено за последние 30 дней
} as const;

// ✅ АРХИТЕКТУРА: Дебаунс для поиска (мс)
export const SEARCH_DEBOUNCE = {
  MOBILE: 250, // Mobile: 250ms
  DESKTOP: 300, // Desktop: 300ms
} as const;

// ✅ АРХИТЕКТУРА: Максимальное количество видимых категорий
export const MAX_VISIBLE_CATEGORIES = 8;

// ✅ АРХИТЕКТУРА: Настройки FlatList для производительности
export const FLATLIST_CONFIG = {
  INITIAL_NUM_TO_RENDER: 6,
  MAX_TO_RENDER_PER_BATCH: 6,
  WINDOW_SIZE: 5,
  UPDATE_CELLS_BATCHING_PERIOD: 100,
  ON_END_REACHED_THRESHOLD: 0.5,
} as const;
