/**
 * Типы для компонента ListTravel
 * Централизация всех типов для улучшения типизации
 */

import type { Travel } from "@/types/types";

// ✅ АРХИТЕКТУРА: Состояние фильтров
export interface FilterState {
  year?: string;
  moderation?: number; // 0 - на модерации, 1 - прошедшие модерацию, undefined - по умолчанию (1)
  countries?: number[];
  categories?: Array<string | number>;
  categoryTravelAddress?: number[];
  transports?: number[];
  companions?: number[];
  complexity?: number[];
  month?: number[];
  over_nights_stay?: number[];
}

// ✅ АРХИТЕКТУРА: Опции фильтров из API
export interface FilterOptions {
  countries?: Array<{ country_id: number; title_ru: string }>;
  categories?: Array<{ id: string; name: string }>;
  categoryTravelAddress?: Array<{ id: string; name: string }>;
  transports?: Array<{ id: string; name: string }>;
  companions?: Array<{ id: string; name: string }>;
  complexity?: Array<{ id: string; name: string }>;
  month?: Array<{ id: string; name: string }>;
  over_nights_stay?: Array<{ id: string; name: string }>;
}

// ✅ АРХИТЕКТУРА: Категория с количеством
export interface CategoryWithCount {
  id: string | number;
  name: string;
  count: number;
}

// ✅ АРХИТЕКТУРА: Badge для социального доказательства
export interface SocialProofBadge {
  label: string;
  color: string;
  bgColor: string;
}

// ✅ АРХИТЕКТУРА: Состояние видимости секций
export interface VisibilityState {
  isPersonalizationVisible: boolean;
  isWeeklyHighlightsVisible: boolean;
  isInitialized: boolean;
}

// ✅ АРХИТЕКТУРА: Состояние списка путешествий
export interface ListTravelState {
  filter: FilterState;
  search: string;
  currentPage: number;
  accumulatedData: Travel[];
  selected: Travel[];
  deleteId: number | null;
  showFilters: boolean;
  isRefreshing: boolean;
}

// ✅ АРХИТЕКТУРА: Параметры запроса
export interface TravelQueryParams {
  page: number;
  perPage: number;
  search: string;
  params: Record<string, any>;
}

// ✅ АРХИТЕКТУРА: Ответ API для путешествий
export interface TravelsApiResponse {
  data?: Travel[] | { data: Travel[] | Travel; total: number };
  total?: number;
}

// ✅ АРХИТЕКТУРА: Конфигурация React Query
export interface TravelQueryConfig {
  queryKey: Array<string | TravelQueryParams>;
  enabled: boolean;
  staleTime: number;
  gcTime: number;
  refetchOnMount: boolean;
  refetchOnWindowFocus: boolean;
  keepPreviousData: boolean;
}

// ✅ АРХИТЕКТУРА: Props для ListTravel компонента
export interface ListTravelProps {
  onTogglePersonalization?: () => void;
  onToggleWeeklyHighlights?: () => void;
  isPersonalizationVisible?: boolean;
  isWeeklyHighlightsVisible?: boolean;
}

// ✅ АРХИТЕКТУРА: Route параметры
export interface ListTravelRouteParams {
  user_id?: string;
}

// ✅ АРХИТЕКТУРА: Auth флаги
export interface AuthFlags {
  userId: string | null;
  isSuperuser: boolean;
}
