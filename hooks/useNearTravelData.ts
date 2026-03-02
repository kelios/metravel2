// hooks/useNearTravelData.ts
// E9: Data fetching + map points logic extracted from NearTravelList.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchTravelsNear } from '@/api/map';
import { queryConfigs } from '@/utils/reactQueryConfig';
import { queryKeys } from '@/queryKeys';
import type { Travel } from '@/types/types';

export function useNearTravelData(
  travelId: number | null,
  loadMoreCount: number,
  onTravelsLoaded?: (travels: Travel[]) => void,
) {
  const [visibleCount, setVisibleCount] = useState(6);
  const [isQueryEnabled, setIsQueryEnabled] = useState(false);

  // Small delay to prioritize main content rendering
  useEffect(() => {
    setIsQueryEnabled(false);
    setVisibleCount(6);
    const timer = setTimeout(() => setIsQueryEnabled(true), 300);
    return () => clearTimeout(timer);
  }, [travelId]);

  const {
    data: travelsNear = [],
    isLoading,
    isError,
    error,
    refetch: refetchTravelsNear,
  } = useQuery<Travel[]>({
    queryKey: queryKeys.travelsNear(travelId as number),
    enabled: isQueryEnabled && travelId != null,
    queryFn: ({ signal }) => fetchTravelsNear(travelId as number, signal) as Promise<Travel[]>,
    select: (data) => (Array.isArray(data) ? data.slice(0, 50) : []),
    placeholderData: keepPreviousData,
    ...queryConfigs.paginated,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!travelsNear.length) return;
    onTravelsLoaded?.(travelsNear);
  }, [onTravelsLoaded, travelsNear]);

  // Optimized map points conversion
  const mapPoints = useMemo(() => {
    if (!travelsNear.length) return [];
    const points: Array<{
      id: string; coord: string; address: string;
      travelImageThumbUrl: string; categoryName: string; articleUrl?: string;
    }> = [];

    for (let i = 0; i < Math.min(travelsNear.length, 20); i++) {
      const item = travelsNear[i];
      const itemAny = item as Record<string, unknown>;
      const itemPoints =
        (Array.isArray(itemAny.points) && itemAny.points) ||
        (Array.isArray(itemAny.travelAddress) && itemAny.travelAddress) ||
        (Array.isArray(itemAny.travel_address) && itemAny.travel_address) ||
        (Array.isArray(itemAny.travel_points) && itemAny.travel_points) ||
        (Array.isArray(itemAny.pointsList) && itemAny.pointsList) ||
        null;
      if (!itemPoints) continue;

      for (let j = 0; j < itemPoints.length; j++) {
        const point = itemPoints[j] as Record<string, unknown>;
        const coordRaw =
          point.coord ?? point.coordinates ?? point.location ??
          (point.lat != null && point.lng != null ? `${point.lat},${point.lng}` : null) ??
          (point.latitude != null && point.longitude != null ? `${point.latitude},${point.longitude}` : null);
        if (!coordRaw) continue;

        const [lat, lng] = String(coordRaw).split(',').map((n) => parseFloat(String(n).trim()));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

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
      if (points.length >= 50) break;
    }
    return points;
  }, [travelsNear]);

  const handleLoadMore = useCallback(() => {
    if (visibleCount < travelsNear.length) {
      setVisibleCount((prev) => Math.min(prev + loadMoreCount, travelsNear.length));
    }
  }, [visibleCount, travelsNear.length, loadMoreCount]);

  const displayedTravels = useMemo(
    () => travelsNear.slice(0, visibleCount),
    [travelsNear, visibleCount]
  );

  return {
    travelsNear, displayedTravels, mapPoints,
    isLoading, isError, error, visibleCount,
    refetchTravelsNear, handleLoadMore,
  };
}

