// hooks/useNearTravelData.ts
// E9: Data fetching + map points logic extracted from NearTravelList.tsx

import { useEffect, useMemo, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchNearbyTravelMapPoints, fetchTravelsNear } from '@/api/map';
import { queryConfigs } from '@/utils/reactQueryConfig';
import { queryKeys } from '@/api/queryKeys';
import type { Travel } from '@/types/types';

const NEAR_TRAVELS_LIMIT = 6;
const EMPTY_TRAVELS: Travel[] = [];

export function useNearTravelData(
  travelId: number | null,
  onTravelsLoaded?: (travels: Travel[]) => void,
  enabled: boolean = true,
  mapOptions?: {
    enabled: boolean;
    origin: { lat: number; lng: number } | null;
  },
) {
  const onTravelsLoadedRef = useRef(onTravelsLoaded);
  useEffect(() => {
    onTravelsLoadedRef.current = onTravelsLoaded;
  }, [onTravelsLoaded]);

  const {
    data: travelsNear = [],
    isLoading,
    isError,
    isPlaceholderData,
    error,
    refetch: refetchTravelsNear,
  } = useQuery<Travel[]>({
    queryKey: queryKeys.travelsNear(travelId as number),
    enabled: enabled && travelId != null,
    queryFn: ({ signal }) =>
      fetchTravelsNear(travelId as number, signal, NEAR_TRAVELS_LIMIT),
    // Backend caps at NEAR_TRAVELS_LIMIT; the slice keeps the UI contract local too.
    select: (data) => data.slice(0, NEAR_TRAVELS_LIMIT),
    placeholderData: keepPreviousData,
    ...queryConfigs.paginated,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!travelsNear.length) return;
    onTravelsLoadedRef.current?.(travelsNear);
  }, [travelsNear]);

  // keepPreviousData is useful for the visible list, but map queries must never
  // cache the previous travel's nearby cards under the next travel id/origin.
  const mapSourceTravels = isPlaceholderData ? EMPTY_TRAVELS : travelsNear;

  // Prefer coordinates included by older/richer near responses.
  const directMapData = useMemo(() => {
    const points: Array<{
      id: string; coord: string; address: string;
      travelImageThumbUrl: string; categoryName: string; articleUrl?: string;
    }> = [];
    const travelIds = new Set<number>();

    for (let i = 0; i < Math.min(mapSourceTravels.length, 20); i++) {
      const item = mapSourceTravels[i];
      const itemAny = item as Record<string, unknown>;
      const directCoord =
        itemAny.coord ??
        (itemAny.lat != null && itemAny.lng != null ? `${itemAny.lat},${itemAny.lng}` : null);
      const itemPoints =
        (Array.isArray(itemAny.points) && itemAny.points) ||
        (Array.isArray(itemAny.travelAddress) && itemAny.travelAddress) ||
        (Array.isArray(itemAny.travel_address) && itemAny.travel_address) ||
        (Array.isArray(itemAny.travel_points) && itemAny.travel_points) ||
        (Array.isArray(itemAny.pointsList) && itemAny.pointsList) ||
        (directCoord ? [{ coord: directCoord, title: item.name }] : null) ||
        null;
      if (!itemPoints) continue;

      const pointsBeforeTravel = points.length;
      for (let j = 0; j < itemPoints.length; j++) {
        const point = itemPoints[j] as Record<string, unknown>;
        const coordRaw =
          point.coord ?? point.coordinates ?? point.location ??
          (point.lat != null && point.lng != null ? `${point.lat},${point.lng}` : null) ??
          (point.latitude != null && point.longitude != null ? `${point.latitude},${point.longitude}` : null);
        if (!coordRaw) continue;

        const [lat, lng] = String(coordRaw).split(',').map((n) => parseFloat(String(n).trim()));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

        points.push({
          id: `${item.id}-${j}`,
          coord: `${lat},${lng}`,
          address: String(point.address || point.title || item.name || ''),
          travelImageThumbUrl: String(
            point.travelImageThumbUrl || point.travel_image_thumb_url || point.image ||
            (item as Record<string, unknown>).travel_image_thumb_url || ''
          ),
          categoryName: String(point.categoryName || point.category_name || (item as Record<string, unknown>).countryName || ''),
          articleUrl: String(point.urlTravel || point.articleUrl || point.article_url || ''),
        });
        if (points.length >= 50) break;
      }
      if (points.length > pointsBeforeTravel) {
        travelIds.add(Number(item.id));
      }
      if (points.length >= 50) break;
    }
    return { points, travelIds };
  }, [mapSourceTravels]);

  const fallbackTravels = useMemo(
    () => directMapData.points.length >= 50
      ? []
      : mapSourceTravels.filter((travel) => {
        const id = Number(travel.id);
        return Number.isFinite(id) && id > 0 && !directMapData.travelIds.has(id);
      }),
    [directMapData, mapSourceTravels],
  );
  const fallbackTravelKey = useMemo(
    () => fallbackTravels.map((travel) => ({
      id: Number(travel.id),
      slug: typeof travel.slug === 'string' ? travel.slug.trim() : '',
    })),
    [fallbackTravels],
  );
  const fallbackMapEnabled = Boolean(
    travelId != null &&
    mapOptions?.enabled &&
    mapOptions.origin &&
    fallbackTravelKey.some((travel) => travel.slug),
  );
  const {
    data: fallbackMapPoints = [],
    isLoading: isFallbackMapLoading,
    isError: isFallbackMapError,
    refetch: refetchMapPoints,
  } = useQuery({
    queryKey: queryKeys.travelsNearMap(
      travelId as number,
      mapOptions?.origin ?? { lat: 0, lng: 0 },
      fallbackTravelKey,
    ),
    enabled: fallbackMapEnabled,
    queryFn: ({ signal }) => fetchNearbyTravelMapPoints(
      mapOptions?.origin as { lat: number; lng: number },
      fallbackTravels,
      signal,
    ),
    ...queryConfigs.paginated,
    retry: false,
    refetchOnMount: false,
  });

  const mapPoints = useMemo(
    () => [...directMapData.points, ...fallbackMapPoints].slice(0, 50),
    [directMapData.points, fallbackMapPoints],
  );

  const displayedTravels = travelsNear;

  return {
    travelsNear, displayedTravels, mapPoints,
    isLoading,
    isMapLoading: Boolean(
      mapOptions?.enabled && mapOptions.origin && isPlaceholderData,
    ) || (fallbackMapEnabled && isFallbackMapLoading),
    isMapError: fallbackMapEnabled && isFallbackMapError,
    isError,
    error,
    refetchTravelsNear,
    refetchMapPoints,
  };
}
