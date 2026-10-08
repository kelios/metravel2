/**
 * Константы для компонента ListTravel
 * Централизация всех констант для улучшения поддерживаемости
 */

import type { FilterState } from "./listTravelTypes";
import { DESIGN_TOKENS } from "@/constants/designSystem";

export const INITIAL_FILTER: FilterState = {};

export const BELARUS_ID = 3;

export const PER_PAGE = 20;

export const PERSONALIZATION_VISIBLE_KEY = 'personalization_visible';
export const WEEKLY_HIGHLIGHTS_VISIBLE_KEY = 'weekly_highlights_visible';
export const RECOMMENDATIONS_VISIBLE_KEY = 'recommendations_visible';

export { BREAKPOINTS, GRID_COLUMNS, calculateColumns } from '@/components/listTravel/travelCatalogGeometry'

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
