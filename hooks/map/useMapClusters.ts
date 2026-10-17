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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMapClusters } from '@/api/map';
import type { MapClusterBBox, MapClustersFilters, MapClustersResult } from '@/api/map';
import { queryKeys } from '@/api/queryKeys';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { snapBBoxToTileGrid } from './mapViewportCoverage';
import { useProgrammaticMapMoveSettled } from './useProgrammaticMapMoveSettled';

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

// #2450 — bbox запроса привязан к тайловой сетке текущего зума: любой вьюпорт
// внутри тех же тайлов даёт тот же queryKey, поэтому возврат в район (zoom in →
// zoom out, «назад» на экран) попадает в кэш, а не промахивается на тысячную
// градуса, как при округлении до 0,001°.
const snapBBox = (bbox: MapClusterBBox, zoom: number): MapClusterBBox =>
  snapBBoxToTileGrid(bbox, zoom);

const serializeBBox = (bbox: MapClusterBBox): string =>
  `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

// После смены радиуса карта всегда делает авто-фит, который меняет bbox/zoom.
// Запрос со старым bbox и новым радиусом — лишний: ждём новый вьюпорт, но не
// дольше этого окна (если фит ничего не сдвинул — запрос уйдёт по таймауту).
const RADIUS_REFIT_WAIT_MS = 900;

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
  /**
   * Ждать авто-фит после смены радиуса/якоря (до RADIUS_REFIT_WAIT_MS). Только для
   * рендерера, который ДЕЛАЕТ такой фит (web `MapLogicComponent`); native-карта
   * после смены радиуса вьюпорт не двигает, ожидание там — чистая задержка.
   */
  awaitRadiusRefit?: boolean;
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
  const {
    bbox,
    zoom,
    filters,
    isFocused = true,
    enabled = true,
    debounceMs = 350,
    awaitRadiusRefit = true,
  } = params;
  const filterCategory = filters?.category;
  const filterLat = Number(filters?.lat);
  const filterLng = Number(filters?.lng);
  const filterRadius = Number(filters?.radius);
  const hasRadiusFilter =
    Number.isFinite(filterLat) &&
    Math.abs(filterLat) <= 90 &&
    Number.isFinite(filterLng) &&
    Math.abs(filterLng) <= 180 &&
    Number.isFinite(filterRadius) &&
    filterRadius > 0;

  const roundedZoom = Number.isFinite(zoom) ? Math.round(zoom) : NaN;

  // Стабильная сериализация debounce-входа: избегаем дёрганья дебаунсера по
  // идентичности объекта bbox при неизменных числах.
  const bboxSignature = useMemo(
    () =>
      isValidBBox(bbox) && Number.isFinite(roundedZoom)
        ? serializeBBox(snapBBox(bbox, roundedZoom))
        : '',
    [bbox, roundedZoom],
  );

  const queryText = typeof filters?.query === 'string' ? filters.query.trim() : '';
  const categorySignature = useMemo(
    () => (Array.isArray(filterCategory) ? filterCategory.join(',') : ''),
    [filterCategory],
  );
  const radiusSignature = hasRadiusFilter
    ? `${Math.round(filterLat * 1000) / 1000},${Math.round(filterLng * 1000) / 1000},${filterRadius}`
    : '';

  const debounceInput = useMemo(
    () => `${bboxSignature}|${roundedZoom}|${queryText}|${categorySignature}|${radiusSignature}`,
    [bboxSignature, roundedZoom, queryText, categorySignature, radiusSignature],
  );
  const debouncedInput = useDebouncedValue(debounceInput, debounceMs);
  const isInputDebouncing = debouncedInput !== debounceInput;

  // Удержание запроса, пока карту двигаем мы (авто-фит/flyTo) — один запрос по
  // итоговому вьюпорту вместо промежуточного + итогового.
  const moveSettled = useProgrammaticMapMoveSettled();

  // Смена радиуса без смены bbox: ждём, пока авто-фит опубликует новый вьюпорт
  // (или истечёт RADIUS_REFIT_WAIT_MS). Окно программного движения открывается
  // только когда фит уже начался, а между сменой радиуса и фитом проходит кадр
  // и больше — это ожидание закрывает промежуток (`awaitRadiusRefit`).
  const [awaitingRefit, setAwaitingRefit] = useState(false);
  const lastRadiusSignatureRef = useRef(radiusSignature);
  const lastBBoxSignatureRef = useRef(bboxSignature);
  useEffect(() => {
    const radiusChanged = lastRadiusSignatureRef.current !== radiusSignature;
    const bboxChanged = lastBBoxSignatureRef.current !== bboxSignature;
    lastRadiusSignatureRef.current = radiusSignature;
    lastBBoxSignatureRef.current = bboxSignature;
    if (bboxChanged) {
      setAwaitingRefit(false);
      return;
    }
    if (!radiusChanged || bboxSignature === '' || !awaitRadiusRefit) return;
    setAwaitingRefit(true);
    const timer = setTimeout(() => setAwaitingRefit(false), RADIUS_REFIT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [radiusSignature, bboxSignature, awaitRadiusRefit]);

  const isDebouncing = isInputDebouncing || !moveSettled || awaitingRefit;

  const isEnabled = enabled && isFocused && bboxSignature !== '' && Number.isFinite(roundedZoom);

  const queryKeyParams = useMemo(
    () => ({
      bbox: bboxSignature,
      zoom: roundedZoom,
      q: queryText,
      category: categorySignature,
      radius: radiusSignature,
    }),
    [bboxSignature, roundedZoom, queryText, categorySignature, radiusSignature],
  );

  const query = useQuery<MapClustersResult>({
    queryKey: queryKeys.mapClusters(queryKeyParams),
    enabled: isEnabled && !isDebouncing,
    queryFn: async ({ signal }) => {
      if (!isValidBBox(bbox)) return EMPTY_RESULT;
      return fetchMapClusters(
        snapBBox(bbox, roundedZoom),
        roundedZoom,
        {
          query: queryText || undefined,
          category: filterCategory,
          ...(hasRadiusFilter ? { lat: filterLat, lng: filterLng, radius: filterRadius } : {}),
        },
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
