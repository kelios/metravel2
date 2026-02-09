/**
 * Константы для компонента ListTravel
 * Централизация всех констант для улучшения поддерживаемости
 */

import type { FilterState } from "./listTravelTypes";
import { METRICS } from "@/constants/layout";

// ✅ АРХИТЕКТУРА: Начальное состояние фильтров
export const INITIAL_FILTER: FilterState = {};

// ✅ АРХИТЕКТУРА: ID Беларуси для специальной страницы
export const BELARUS_ID = 3;

// ✅ АРХИТЕКТУРА: Количество элементов на странице
// ✅ ОПТИМИЗАЦИЯ: Увеличено для лучшей производительности и меньшего количества запросов
export const PER_PAGE = 20;

// ✅ АРХИТЕКТУРА: Ключи для хранения состояния видимости
export const PERSONALIZATION_VISIBLE_KEY = 'personalization_visible';
export const WEEKLY_HIGHLIGHTS_VISIBLE_KEY = 'weekly_highlights_visible';
export const RECOMMENDATIONS_VISIBLE_KEY = 'recommendations_visible';

// ✅ АРХИТЕКТУРА: Breakpoints для адаптивности
// ✅ B1.1: Расширенные breakpoints для лучшей адаптивности
export const BREAKPOINTS = {
  XS: 360,  // Очень маленькие телефоны
  SM: 480,  // Маленькие телефоны
  MOBILE: METRICS.breakpoints.tablet, // Планшеты портрет
  MD: 900,  // Маленькие планшеты
  TABLET: METRICS.breakpoints.largeTablet, // Планшеты ландшафт
  TABLET_LANDSCAPE: METRICS.breakpoints.desktop,
  DESKTOP: 1440,
  DESKTOP_LARGE: 1920,
  XXL: 2560, // Очень большие мониторы
} as const;

// ✅ АРХИТЕКТУРА: Количество колонок для разных экранов
// ✅ ОПТИМИЗАЦИЯ: Оптимизировано для лучшей читаемости и производительности
export const GRID_COLUMNS = {
  MOBILE: 1,
  TABLET: 3,
  TABLET_LANDSCAPE: 3, // 3 колонки на промежутке 1280-1439px
  DESKTOP: 4,
  DESKTOP_LARGE: 4,
} as const;

export const TRAVEL_CARD_IMAGE_HEIGHT = 220;
export const TRAVEL_CARD_WEB_MOBILE_HEIGHT = 360;
export const TRAVEL_CARD_WEB_HEIGHT = 400;

export const TRAVEL_CARD_MIN_WIDTH = 300;
export const TRAVEL_CARD_MAX_WIDTH = 340;

// ✅ АРХИТЕКТУРА: Время кеширования для React Query (staleTime)
export const STALE_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 5 * 60 * 1000, // 5 минут — главная лента путешествий может дольше использовать кэш
  POPULAR: 3600000, // 1 час
} as const;

// ✅ АРХИТЕКТУРА: Время хранения в кеше (gcTime, бывший cacheTime)
export const GC_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 15 * 60 * 1000, // 15 минут — дольше храним страницы ленты в памяти
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
// ✅ ОПТИМИЗАЦИЯ: Динамические настройки для разных устройств
export const FLATLIST_CONFIG = {
  INITIAL_NUM_TO_RENDER: 6, // Уменьшено для более быстрого первого рендера
  MAX_TO_RENDER_PER_BATCH: 8, // Оптимально для плавного скролла
  WINDOW_SIZE: 10, // Увеличено для лучшей производительности при быстрой прокрутке
  UPDATE_CELLS_BATCHING_PERIOD: 32, // Уменьшено для более отзывчивого UI
  ON_END_REACHED_THRESHOLD: 0.5, // Стандартное значение
} as const;

// ✅ ОПТИМИЗАЦИЯ: Специальные настройки для мобильных устройств
export const FLATLIST_CONFIG_MOBILE = {
  INITIAL_NUM_TO_RENDER: 6,
  MAX_TO_RENDER_PER_BATCH: 8,
  WINDOW_SIZE: 5,
  UPDATE_CELLS_BATCHING_PERIOD: 100,
  ON_END_REACHED_THRESHOLD: 0.4,
} as const;
