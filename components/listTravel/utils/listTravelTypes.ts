/**
 * Типы для компонента ListTravel
 * Централизация всех типов для улучшения типизации
 */

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

