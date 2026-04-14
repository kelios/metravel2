/**
 * Типы для компонента ListTravel
 * Централизация всех типов для улучшения типизации
 */

import type { Travel } from "@/types/types";

export interface FilterState {
  year?: string;
  sort?: string;
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

export interface FilterOptions {
  countries?: Array<{ country_id?: number; id?: string | number; title_ru?: string; name?: string }>;
  categories?: Array<{ id: string; name: string }>;
  categoryTravelAddress?: Array<{ id: string; name: string }>;
  transports?: Array<{ id: string; name: string }>;
  companions?: Array<{ id: string; name: string }>;
  complexity?: Array<{ id: string; name: string }>;
  month?: Array<{ id: string; name: string }>;
  over_nights_stay?: Array<{ id: string; name: string }>;
  sortings?: Array<{
    id: string;
    name: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }>;
}

export interface CategoryWithCount {
  id: string | number;
  name: string;
  count: number;
}

export interface SocialProofBadge {
  label: string;
  color: string;
  bgColor: string;
}

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

export interface TravelQueryParams {
  page: number;
  perPage: number;
  search: string;
  params: Record<string, any>;
}

export interface TravelsApiResponse {
  data?: Travel[] | { data: Travel[] | Travel; total: number };
  total?: number;
}

export interface TravelQueryConfig {
  queryKey: Array<string | TravelQueryParams>;
  enabled: boolean;
  staleTime: number;
  gcTime: number;
  refetchOnMount: boolean;
  refetchOnWindowFocus: boolean;
  keepPreviousData: boolean;
}


export interface ListTravelRouteParams {
  user_id?: string;
}

export interface AuthFlags {
  userId: string | null;
  isSuperuser: boolean;
}
