import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import type { ImportedPoint } from '@/types/userPoints';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import type { PointFilters } from '@/types/userPoints';
import {
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
  resolveCategoryIdsByNames as mapNamesToIds,
} from '@/utils/userPointsCategories';
import { haversineKm, normalizeCategoryIdsFromPoint } from './pointsListLogic';

type Params = {
  defaultPerPage: number;
  filters: PointFilters;
  searchQuery: string;
  currentLocation: { lat?: number; lng?: number } | null;
  defaultPointColors: string[];
};

type PointsPaginationState = {
  nextPage: number;
  complete: boolean;
};

export const usePointsDataModel = ({
  defaultPerPage,
  filters,
  searchQuery,
  currentLocation,
  defaultPointColors,
}: Params) => {
  const siteCategoryOptionsQuery = useFilterOptions({
    select: (data) => {
      const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
      return normalizeCategoryDictionary(raw);
    },
  });

  const categoryData = useMemo(() => siteCategoryOptionsQuery.data ?? [], [siteCategoryOptionsQuery.data]);

  const categoryIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoryData as any[]) {
      const id = String((c as any)?.id ?? '').trim();
      const name = String((c as any)?.name ?? id).trim();
      if (!id) continue;
      map.set(id, name || id);
    }
    return map;
  }, [categoryData]);

  const categoryNameToIds = useMemo(() => createCategoryNameToIdsMap(categoryData), [categoryData]);

  const resolveCategoryIdsByNames = useCallback(
    (names: string[]) => mapNamesToIds(names, categoryNameToIds),
    [categoryNameToIds]
  );

  const queryClient = useQueryClient();

  // First page renders fast (perPage=defaultPerPage). Remaining pages stream in
  // the background and are appended to the same flat-array cache so map pins and
  // list rows appear incrementally without the first paint waiting for all points.
  const pointsQuery = useQuery({
    queryKey: queryKeys.userPointsAll(),
    queryFn: async () => {
      const { items } = await userPointsApi.getPointsPage(1, defaultPerPage);
      queryClient.setQueryData<PointsPaginationState>(queryKeys.userPointsPagination(), {
        nextPage: 2,
        // A short page is the end. An oversized page means the backend ignored
        // perPage and returned the complete set in one response (#752).
        complete: items.length !== defaultPerPage,
      });
      return items;
    },
    staleTime: 10 * 60 * 1000,
  });

  const points = useMemo(() => {
    if (pointsQuery.error) return [];
    return Array.isArray(pointsQuery.data) ? pointsQuery.data : [];
  }, [pointsQuery.data, pointsQuery.error]);

  const backgroundLoadRef = useRef<{ running: boolean; token: number }>({ running: false, token: 0 });

  useEffect(() => {
    // Pagination metadata distinguishes accumulated full pages from an
    // oversized first response. Cache length alone cannot do that. Appended
    // pages stay outside the dependencies so they do not cancel/restart the
    // in-flight run — that used to stop loading after page 2.
    if (pointsQuery.isLoading || pointsQuery.error) return;
    const cached = queryClient.getQueryData<ImportedPoint[]>(queryKeys.userPointsAll());
    const count = Array.isArray(cached) ? cached.length : 0;
    let pagination = queryClient.getQueryData<PointsPaginationState>(queryKeys.userPointsPagination());
    if (!pagination) {
      if (count !== defaultPerPage) return;
      pagination = { nextPage: 2, complete: false };
      queryClient.setQueryData(queryKeys.userPointsPagination(), pagination);
    }
    if (pagination.complete) return;
    if (backgroundLoadRef.current.running) return;

    const token = backgroundLoadRef.current.token + 1;
    backgroundLoadRef.current = { running: true, token };
    let cancelled = false;

    (async () => {
      try {
        // Resume from explicit pagination metadata. Cache length alone cannot
        // distinguish two streamed full pages from one oversized response.
        let page = pagination.nextPage;
        // Guard against runaway loops on an unexpectedly non-terminating backend.
        const maxPages = 200;
        while (!cancelled && page <= maxPages) {
          const { items, hasMore } = await userPointsApi.getPointsPage(page, defaultPerPage);
          if (cancelled || backgroundLoadRef.current.token !== token) return;
          let added = 0;
          if (items.length > 0) {
            queryClient.setQueryData(queryKeys.userPointsAll(), (prev: unknown) => {
              const arr: ImportedPoint[] = Array.isArray(prev) ? (prev as ImportedPoint[]) : [];
              const seen = new Set(arr.map((p) => Number(p?.id)));
              const next = items.filter((p) => !seen.has(Number(p?.id)));
              added = next.length;
              return next.length ? [...arr, ...next] : arr;
            });
          }
          // A page that adds nothing new means the backend is not actually
          // paginating (returns the full set every time, see #752) or we are
          // past the end — stop instead of re-downloading the same payload.
          if (!hasMore || added === 0) {
            queryClient.setQueryData<PointsPaginationState>(queryKeys.userPointsPagination(), {
              nextPage: page,
              complete: true,
            });
            break;
          }
          page += 1;
          queryClient.setQueryData<PointsPaginationState>(queryKeys.userPointsPagination(), {
            nextPage: page,
            complete: false,
          });
        }
      } finally {
        if (backgroundLoadRef.current.token === token) {
          backgroundLoadRef.current.running = false;
        }
      }
    })();

    return () => {
      cancelled = true;
      // Release the slot synchronously: on a fast remount (StrictMode) the new
      // effect must be able to start without waiting for the aborted loop's
      // finally block.
      if (backgroundLoadRef.current.token === token) {
        backgroundLoadRef.current.running = false;
      }
    };
  }, [defaultPerPage, pointsQuery.error, pointsQuery.isLoading, queryClient]);

  const pointsWithDerivedCategories = useMemo(() => {
    return (points as any[]).map((p) => {
      const categoryIds = normalizeCategoryIdsFromPoint(p);
      const categoryNames = categoryIds
        .map((id) => categoryIdToName.get(id) ?? id)
        .map((v) => String(v).trim())
        .filter(Boolean);
      return { ...p, categoryIds, categoryNames };
    });
  }, [categoryIdToName, points]);

  const baseFilteredPoints = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    const selectedColors = filters.colors ?? [];
    const selectedStatuses = filters.statuses ?? [];
    const radiusKm = filters.radiusKm;

    const radiusFilterEnabled = radiusKm !== null && radiusKm !== undefined && currentLocation;
    const userLat = Number(currentLocation?.lat);
    const userLng = Number(currentLocation?.lng);
    const radius = Number(radiusKm);
    const canDoRadius =
      Boolean(radiusFilterEnabled) &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng) &&
      Number.isFinite(radius) &&
      radius > 0;

    const latDelta = canDoRadius ? radius / 111 : 0;
    const lngDelta = canDoRadius ? radius / (111 * Math.max(0.2, Math.cos((userLat * Math.PI) / 180))) : 0;
    const minLat = canDoRadius ? userLat - latDelta : 0;
    const maxLat = canDoRadius ? userLat + latDelta : 0;
    const minLng = canDoRadius ? userLng - lngDelta : 0;
    const maxLng = canDoRadius ? userLng + lngDelta : 0;

    return pointsWithDerivedCategories.filter((p: any) => {
      if (selectedColors.length > 0 && !selectedColors.includes(p.color)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;

      if (canDoRadius) {
        const pointLat = Number(p.latitude);
        const pointLng = Number(p.longitude);
        if (Number.isFinite(pointLat) && Number.isFinite(pointLng)) {
          if (pointLat < minLat || pointLat > maxLat || pointLng < minLng || pointLng > maxLng) return false;
          const distance = haversineKm(userLat, userLng, pointLat, pointLng);
          if (distance > radius) return false;
        }
      }

      if (!q) return true;
      const haystack = `${p.name ?? ''} ${p.address ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [currentLocation, filters.colors, filters.radiusKm, filters.statuses, pointsWithDerivedCategories, searchQuery]);

  const availableCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of baseFilteredPoints as any[]) {
      const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
      for (const id of ids) {
        const norm = String(id).trim();
        if (!norm) continue;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => ({ id, name: categoryIdToName.get(id) ?? id }));
  }, [baseFilteredPoints, categoryIdToName]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, number>();
    for (const p of points as any[]) {
      const c = String(p?.color ?? '').trim();
      if (c) {
        colorMap.set(c, (colorMap.get(c) || 0) + 1);
      }
    }

    const observed = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const c of observed) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }
    for (const c of defaultPointColors) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      merged.push(c);
    }

    return merged;
  }, [defaultPointColors, points]);

  const manualColorOptions = useMemo(() => {
    const base = [...defaultPointColors, ...(availableColors ?? [])];
    const unique = Array.from(new Set(base.map((c) => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : defaultPointColors.slice();
  }, [availableColors, defaultPointColors]);

  const filteredPoints = useMemo(() => {
    const selectedCategoryIds = filters.categoryIds ?? [];
    if (!selectedCategoryIds.length) return baseFilteredPoints;

    return baseFilteredPoints.filter((p: any) => {
      const ids = Array.isArray(p?.categoryIds) ? p.categoryIds : [];
      return selectedCategoryIds.some((id) => ids.includes(id));
    });
  }, [baseFilteredPoints, filters.categoryIds]);

  return {
    points,
    isLoading: pointsQuery.isLoading,
    // Загрузка не удалась (ошибка сети/API или offlineFirst-пауза без кэша):
    // список пуст НЕ потому, что у пользователя нет точек — UI обязан показать
    // ошибку с «Повторить», а не «У вас пока нет точек».
    loadFailed:
      Boolean(pointsQuery.error) ||
      (pointsQuery.fetchStatus === 'paused' && !Array.isArray(pointsQuery.data)),
    refetch: pointsQuery.refetch,
    categoryIdToName,
    categoryData,
    resolveCategoryIdsByNames,
    availableCategoryOptions,
    availableColors,
    manualColorOptions,
    filteredPoints,
  };
};
