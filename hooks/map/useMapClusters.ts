/**
 * useMapClusters — серверная кластеризация карты (BE #719).
 *
 * Тянет GET /api/map/clusters/ по текущему bbox/zoom вьюпорта и фильтрам карты.
 * Данные общие для web (Leaflet) и native (WebView+Leaflet) — платформенные файлы
 * рендерят один и тот же результат разными движками.
 *
 * Контракт использования (Task Contract #720):
 * - Сервер сам решает clusters↔markers по плотности; на высоком зуме отдаёт markers.
 * - queryKey завязан на bbox/zoom/фильтры → смена вьюпорта = новый запрос.
 * - bbox/zoom дебаунсятся, чтобы pan/zoom не бил эндпоинт на каждый кадр.
 * - При ошибке/недоступности эндпоинта возвращается пустой результат + флаг isError;
 *   вызывающий обязан оставить локальный клиентский fallback (useClustering /
 *   markercluster по уже загруженным точкам). Ошибка НЕ показывается пользователю.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMapClusters } from '@/api/map';
import type { MapClusterBBox, MapClustersFilters, MapClustersResult } from '@/api/map';
import { queryKeys } from '@/api/queryKeys';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const EMPTY_RESULT: MapClustersResult = {
  clusters: [],
  markers: [],
  totalCount: 0,
  source: '',
  generatedAt: '',
};

// Санитизация bbox: широты в [-90,90], долготы в [-180,180], south<north.
// Невалидный bbox отключает запрос (эндпоинт вернул бы 400 «Expected -90 <= south < north <= 90»).
const isValidBBox = (bbox: MapClusterBBox | null | undefined): bbox is MapClusterBBox => {
  if (!bbox) return false;
  const { south, west, north, east } = bbox;
  return (
    Number.isFinite(south) &&
    Number.isFinite(west) &&
    Number.isFinite(north) &&
    Number.isFinite(east) &&
    south >= -90 &&
    north <= 90 &&
    south < north &&
    west >= -180 &&
    east <= 180 &&
    west <= east
  );
};

// Округляем bbox до сетки, чтобы микродвижения карты не плодили новые queryKey
// (кэш-промахи) на каждый пиксель. ~3 знака ≈ 100 м.
const roundBBox = (bbox: MapClusterBBox): MapClusterBBox => ({
  south: Math.round(bbox.south * 1000) / 1000,
  west: Math.round(bbox.west * 1000) / 1000,
  north: Math.round(bbox.north * 1000) / 1000,
  east: Math.round(bbox.east * 1000) / 1000,
});

const serializeRoundedBBox = (bbox: MapClusterBBox): string =>
  `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

export interface UseMapClustersParams {
  /** Текущий bbox вьюпорта карты (south/west/north/east). null → запрос выключен. */
  bbox: MapClusterBBox | null;
  /** Текущий zoom карты. */
  zoom: number;
  /** Фильтры карты (поиск/категории), совместимые с canonical map search. */
  filters?: MapClustersFilters;
  /** Экран сфокусирован — иначе не тянем. */
  isFocused?: boolean;
  /** Внешний выключатель (например, режим route не использует server clusters). */
  enabled?: boolean;
  /** Дебаунс bbox/zoom, мс (по умолчанию 350). */
  debounceMs?: number;
}

export interface UseMapClustersResult {
  data: MapClustersResult;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  /** true пока bbox/zoom дебаунсятся до следующего запроса. */
  isDebouncing: boolean;
}

export function useMapClusters(params: UseMapClustersParams): UseMapClustersResult {
  const { bbox, zoom, filters, isFocused = true, enabled = true, debounceMs = 350 } = params;
  const filterCategory = filters?.category;

  const roundedZoom = Number.isFinite(zoom) ? Math.round(zoom) : NaN;

  // Стабильная сериализация debounce-входа: избегаем дёрганья дебаунсера по
  // идентичности объекта bbox при неизменных числах.
  const bboxSignature = useMemo(
    () => (isValidBBox(bbox) ? serializeRoundedBBox(roundBBox(bbox)) : ''),
    [bbox],
  );

  const queryText = typeof filters?.query === 'string' ? filters.query.trim() : '';
  const categorySignature = useMemo(
    () => (Array.isArray(filterCategory) ? filterCategory.join(',') : ''),
    [filterCategory],
  );

  const debounceInput = useMemo(
    () => `${bboxSignature}|${roundedZoom}|${queryText}|${categorySignature}`,
    [bboxSignature, roundedZoom, queryText, categorySignature],
  );
  const debouncedInput = useDebouncedValue(debounceInput, debounceMs);
  const isDebouncing = debouncedInput !== debounceInput;

  const isEnabled = enabled && isFocused && bboxSignature !== '' && Number.isFinite(roundedZoom);

  const queryKeyParams = useMemo(
    () => ({ bbox: bboxSignature, zoom: roundedZoom, q: queryText, category: categorySignature }),
    [bboxSignature, roundedZoom, queryText, categorySignature],
  );

  const query = useQuery<MapClustersResult>({
    queryKey: queryKeys.mapClusters(queryKeyParams),
    enabled: isEnabled && !isDebouncing,
    queryFn: async ({ signal }) => {
      if (!isValidBBox(bbox)) return EMPTY_RESULT;
      return fetchMapClusters(
        roundBBox(bbox),
        roundedZoom,
        { query: queryText || undefined, category: filterCategory },
        { signal },
      );
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return useMemo(
    () => ({
      data: query.data ?? EMPTY_RESULT,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isError: query.isError,
      isDebouncing,
    }),
    [query.data, query.isLoading, query.isFetching, query.isError, isDebouncing],
  );
}
