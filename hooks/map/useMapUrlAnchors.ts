import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

import type { Point as MapPoint } from '@/components/MapPage/Map/types';

// Разбор anchor-координат и первичных значений фильтров из URL-параметров карты.
// Извлечено из useMapScreenController без изменения поведения.

const parseUrlCoordinate = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getFirstParamText = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
};

export interface MapUrlAnchors {
  initialCategories: string[] | undefined;
  initialRadius: string | undefined;
  urlCoordinates: { latitude: number; longitude: number } | null;
  urlSelectedPlace: MapPoint | null;
}

export function useMapUrlAnchors(): MapUrlAnchors {
  // URL params → initial filter values
  const params = useLocalSearchParams<{
    categories?: string;
    radius?: string;
    lat?: string;
    lng?: string;
    placeId?: string;
    placeTitle?: string;
    placeAddress?: string;
    placeCategory?: string;
    placeTravelUrl?: string;
    placeImageUrl?: string;
  }>();

  const initialCategories = useMemo(
    () => (params.categories ? params.categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined),
    // mount-only: captures the initial URL param; later filter changes are owned by useMapFilters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // mount-only: initial radius from URL; subsequent radius is owned by useMapFilters
  const initialRadius = useMemo(() => params.radius ?? undefined, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const urlCoordinates = useMemo(() => {
    const lat = parseUrlCoordinate(params.lat);
    const lng = parseUrlCoordinate(params.lng);
    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { latitude: lat, longitude: lng };
  }, [params.lat, params.lng]);

  const urlSelectedPlace = useMemo<MapPoint | null>(() => {
    if (!urlCoordinates) return null;
    const title = getFirstParamText(params.placeTitle);
    const address = getFirstParamText(params.placeAddress);
    const category = getFirstParamText(params.placeCategory) || getFirstParamText(params.categories);
    const id = getFirstParamText(params.placeId) || `url-${urlCoordinates.latitude},${urlCoordinates.longitude}`;
    const coord = `${urlCoordinates.latitude},${urlCoordinates.longitude}`;

    if (!title && !address && !category) return null;

    return {
      id,
      coord,
      address: address || title || category || coord,
      categoryName: category || undefined,
      urlTravel: getFirstParamText(params.placeTravelUrl) || undefined,
      travelImageThumbUrl: getFirstParamText(params.placeImageUrl) || undefined,
    };
  }, [
    params.categories,
    params.placeAddress,
    params.placeCategory,
    params.placeId,
    params.placeImageUrl,
    params.placeTitle,
    params.placeTravelUrl,
    urlCoordinates,
  ]);

  return { initialCategories, initialRadius, urlCoordinates, urlSelectedPlace };
}
