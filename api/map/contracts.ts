import type { MapPlaceSource } from '@/api/mapPlaces';

export type ApiOptions = { signal?: AbortSignal; throwOnError?: boolean; limit?: number };

export type NearbyTravelMapPoint = {
  id: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  urlTravel?: string;
  /** Id статьи точки (#1960): стек ♥/статуса в попапе не запрашивает её по slug. */
  travelId?: number;
};

export interface MapClusterBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapClusterPoint {
  id?: string | number;
  coord: string;
  lat: string;
  lng: string;
  address: string;
  categoryName: string;
  travelImageThumbUrl: string;
  imageUrl: string;
  urlTravel: string;
  articleUrl?: string;
  countryName?: string;
  countryCode?: string;
  /** Grouped place DTO (#1567): canonical place identity, additive поверх legacy полей. */
  placeId?: string | number;
  sourceCount?: number;
  primarySource?: MapPlaceSource | null;
}

export interface MapCluster {
  id: string;
  center: { lat: number; lng: number };
  count: number;
  bounds: MapClusterBBox;
  previewItems: MapClusterPoint[];
}

export interface MapClustersResult {
  clusters: MapCluster[];
  markers: MapClusterPoint[];
  totalCount: number;
  source: string;
  generatedAt: string;
}

export interface MapClustersFilters {
  /** Search text (server FTS), maps to ?q= */
  query?: string;
  /** Category ids, maps to ?category=<csv> */
  category?: Array<number | string>;
  /** Radius-mode anchor latitude, maps to ?lat= */
  lat?: number | string;
  /** Radius-mode anchor longitude, maps to ?lng= */
  lng?: number | string;
  /** Radius in kilometers, maps to ?radius= */
  radius?: number | string;
}

/**
 * Контракт `GET /api/filterformap/` (бэк `MapFilterView`): `categories` — словарь
 * типов мест (TravelCategoryAddress, те же ID, что `where.categoryTravelAddress`
 * гео-выдачи и `?category=` кластеров), `radius` — варианты радиуса. Ключа
 * `categoryTravelAddress` живой ответ не содержит: он оставлен опциональным только
 * для обратной совместимости. Читать словарь — через `resolveMapPointCategoryDictionary`.
 */
export type MapFiltersResponse = {
  categories: unknown[];
  radius?: unknown[];
  /** @deprecated отсутствует в живом ответе; читается только как legacy-fallback. */
  categoryTravelAddress?: unknown[];
};
