/**
 * useMapPlaceSources — ленивые материалы физического места (#1571, контракт
 * `docs/features/map.md` → «Один физический объект с несколькими источниками»).
 *
 * Контракт использования:
 * - запрос уходит ТОЛЬКО после первого открытия карточки места с
 *   `sourceCount > 1` (`enabled`), никогда — при рендере маркеров;
 * - ключ — `queryKeys.mapPlaceSources(placeKey)`, `staleTime: Infinity`:
 *   один запрос на place на cache lifetime, повторное открытие карточки и
 *   перелистывание источников идут из кэша и не трогают map dataset;
 * - у legacy-места без `placeId` запроса нет — карточка работает по локальным
 *   данным записи (single-source, без pager).
 */
import { useQuery } from '@tanstack/react-query';
import { fetchAllMapPlaceSources } from '@/api/map';
import type { MapPlaceSource } from '@/api/mapPlaces';
import { queryKeys } from '@/api/queryKeys';

export type UseMapPlaceSourcesArgs = {
  /** Стабильный ключ места (`String(place_id)` либо legacy record identity). */
  placeKey: string | null | undefined;
  /** Канонический id места; null/undefined — legacy-запись, запрос запрещён. */
  placeId: string | number | null | undefined;
  /** Заявленное число материалов; ≤1 — endpoint не нужен. */
  sourceCount: number;
  /** Открыта ли карточка места (гейт лени). */
  enabled: boolean;
};

export const useMapPlaceSources = ({
  placeKey,
  placeId,
  sourceCount,
  enabled,
}: UseMapPlaceSourcesArgs) => {
  const canFetch = Boolean(enabled && placeKey && placeId != null && sourceCount > 1);

  return useQuery<MapPlaceSource[]>({
    queryKey: queryKeys.mapPlaceSources(String(placeKey ?? '')),
    queryFn: ({ signal }) => fetchAllMapPlaceSources(placeId as string | number, { signal }),
    enabled: canFetch,
    staleTime: Infinity,
    retry: 1,
  });
};
