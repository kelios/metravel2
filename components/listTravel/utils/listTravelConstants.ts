/**
 * Константы для компонента ListTravel
 * Централизация всех констант для улучшения поддерживаемости
 */

import type { FilterState } from "./listTravelTypes";
import { METRICS } from "@/constants/layout";
import { DESIGN_TOKENS } from "@/constants/designSystem";

export const INITIAL_FILTER: FilterState = {};

export const BELARUS_ID = 3;

export const PER_PAGE = 20;

export const PERSONALIZATION_VISIBLE_KEY = 'personalization_visible';
export const WEEKLY_HIGHLIGHTS_VISIBLE_KEY = 'weekly_highlights_visible';
export const RECOMMENDATIONS_VISIBLE_KEY = 'recommendations_visible';

export const BREAKPOINTS = {
  XS: 360,  // Очень маленькие телефоны
  SM: 480,  // Маленькие телефоны
  MOBILE: METRICS.breakpoints.tablet, // Планшеты портрет
  MD: 900,  // Маленькие планшеты
  TABLET: METRICS.breakpoints.largeTablet, // Планшеты ландшафт
  TABLET_LANDSCAPE: METRICS.breakpoints.largeTablet,
  DESKTOP: 1440,
  DESKTOP_LARGE: 1920,
  XXL: 2560, // Очень большие мониторы
} as const;

// RESP-02: Планшет показывает 2 колонки для оптимального использования пространства
export const GRID_COLUMNS = {
  MOBILE: 1,
  TABLET: 2,             // 768–1023px: 2 колонки
  TABLET_LANDSCAPE: 3,   // 1024–1279px: 3 колонки
  DESKTOP: 4,            // 1280–1439px: 4 колонки
  DESKTOP_LARGE: 4,      // 1440px+: 4 колонки
} as const;

export const TRAVEL_CARD_IMAGE_HEIGHT = DESIGN_TOKENS.cardImageHeights.medium;
export const TRAVEL_CARD_WEB_MOBILE_HEIGHT = 360;
export const TRAVEL_CARD_WEB_HEIGHT = 400;

export const TRAVEL_CARD_MAX_WIDTH = 340;

export const STALE_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 5 * 60 * 1000, // 5 минут — главная лента путешествий может дольше использовать кэш
  POPULAR: 3600000, // 1 час
} as const;

export const GC_TIME = {
  FILTERS: 10 * 60 * 1000, // 10 минут
  TRAVELS: 15 * 60 * 1000, // 15 минут — дольше храним страницы ленты в памяти
  POPULAR: 10 * 60 * 1000, // 10 минут
} as const;

export const QUERY_CONFIG = {
  REFETCH_ON_MOUNT: false,
  REFETCH_ON_WINDOW_FOCUS: false,
  KEEP_PREVIOUS_DATA: false,
} as const;


export const SEARCH_DEBOUNCE = {
  MOBILE: 250, // Mobile: 250ms
  DESKTOP: 300, // Desktop: 300ms
} as const;


export const FLATLIST_CONFIG = {
  INITIAL_NUM_TO_RENDER: 6, // Уменьшено для более быстрого первого рендера
  MAX_TO_RENDER_PER_BATCH: 8, // Оптимально для плавного скролла
  WINDOW_SIZE: 10, // Увеличено для лучшей производительности при быстрой прокрутке
  UPDATE_CELLS_BATCHING_PERIOD: 32, // Уменьшено для более отзывчивого UI
  ON_END_REACHED_THRESHOLD: 0.5, // Стандартное значение
} as const;

export const FLATLIST_CONFIG_MOBILE = {
  INITIAL_NUM_TO_RENDER: 6,
  MAX_TO_RENDER_PER_BATCH: 8,
  WINDOW_SIZE: 5,
  UPDATE_CELLS_BATCHING_PERIOD: 100,
  ON_END_REACHED_THRESHOLD: 0.4,
} as const;

const MIN_CARD_WIDTH = 240; // Минимальная комфортная ширина карточки
const GAP = 16; // Отступ между карточками

// Функция для расчета padding контейнера
function getContainerPadding(width: number): number {
  if (width < BREAKPOINTS.XS) return 8;
  if (width < BREAKPOINTS.SM) return 12;
  if (width < BREAKPOINTS.MOBILE) return 16;
  if (width < BREAKPOINTS.TABLET) return 20;
  if (width < BREAKPOINTS.DESKTOP) return 24;
  if (width < BREAKPOINTS.DESKTOP_LARGE) return 32;
  return 40;
}

export function calculateColumns(width: number, orientation: 'portrait' | 'landscape' = 'landscape'): number {
  // Single column only for very narrow content areas
  // (full-viewport mobile check is handled by isCardsSingleColumn before this function is called)
  if (width < BREAKPOINTS.SM) {
    return 1;
  }

  // Рассчитываем доступную ширину с учетом padding
  const containerPadding = width >= BREAKPOINTS.DESKTOP ? 0 : getContainerPadding(width);
  const availableWidth = width - containerPadding * 2;

  // Рассчитываем максимальное количество колонок на основе минимальной ширины карточки
  let columns = Math.floor((availableWidth + GAP) / (MIN_CARD_WIDTH + GAP));

  // Ограничиваем максимум колонок по брейкпоинтам, чтобы сетка не расползалась на широких экранах
  // и соответствовала дизайн-решению (desktop/large desktop: до 4 колонок).
  let maxColumns = Number.POSITIVE_INFINITY;
  if (width >= BREAKPOINTS.DESKTOP_LARGE) {
    maxColumns = GRID_COLUMNS.DESKTOP_LARGE;
  } else if (width >= BREAKPOINTS.DESKTOP) {
    maxColumns = GRID_COLUMNS.DESKTOP;
  } else if (width >= BREAKPOINTS.TABLET_LANDSCAPE) {
    maxColumns = GRID_COLUMNS.TABLET_LANDSCAPE;
  } else if (width >= BREAKPOINTS.MOBILE) {
    maxColumns = GRID_COLUMNS.TABLET;
  }

  if (Number.isFinite(maxColumns)) {
    columns = Math.min(columns, maxColumns);
  }

  // Учитываем ориентацию для планшетов (effective content area width)
  if (orientation === 'portrait' && width >= BREAKPOINTS.SM && width < BREAKPOINTS.DESKTOP) {
    columns = Math.min(columns, 2);
  }

  // Минимум 1 колонка
  return Math.max(columns, 1);
}
