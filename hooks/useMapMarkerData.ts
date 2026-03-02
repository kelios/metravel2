// hooks/useMapMarkerData.ts
// C3.3: Shared hook for marker data processing (category labels, image normalization, search filtering)
import { useMemo, useCallback } from 'react';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryItem {
  id: number | string;
  name: string;
}

interface MarkerLike {
  address?: string;
  image?: string;
  categories?: (string | number)[];
  [key: string]: unknown;
}

export interface UseMapMarkerDataOptions<T extends MarkerLike> {
  /** Array of marker items */
  markers: T[];
  /** Category dictionary for label resolution */
  categoryDictionary: CategoryItem[];
  /** Search query for filtering */
  searchQuery?: string;
}

export interface UseMapMarkerDataResult<T extends MarkerLike> {
  /** Filtered markers with their original indices */
  filteredMarkers: { marker: T; index: number }[];
  /** Resolve category IDs to labels for a marker */
  getCategoryLabel: (marker: T) => string;
  /** Normalize an image URL */
  normalizeImageUrl: (url?: string | null) => string;
  /** Total count */
  totalCount: number;
  /** Filtered count */
  filteredCount: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMapMarkerData<T extends MarkerLike>(
  options: UseMapMarkerDataOptions<T>,
): UseMapMarkerDataResult<T> {
  const { markers, categoryDictionary, searchQuery = '' } = options;

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categoryDictionary) {
      map.set(String(cat.id), cat.name);
    }
    return map;
  }, [categoryDictionary]);

  const getCategoryLabel = useCallback(
    (marker: T): string => {
      const cats = marker.categories;
      if (!Array.isArray(cats) || cats.length === 0) return 'Категории не выбраны';
      const names = cats
        .map((catId) => categoryMap.get(String(catId)))
        .filter(Boolean)
        .slice(0, 2);
      return names.length > 0 ? names.join(', ') : 'Категории выбраны';
    },
    [categoryMap],
  );

  const normalizeImage = useCallback(
    (url?: string | null): string => normalizeMediaUrl(url) ?? '',
    [],
  );

  const filteredMarkers = useMemo(() => {
    const indexed = markers.map((marker, index) => ({ marker, index }));
    if (!searchQuery.trim()) return indexed;
    const q = searchQuery.toLowerCase();
    return indexed.filter(({ marker }) =>
      (marker.address || '').toLowerCase().includes(q),
    );
  }, [markers, searchQuery]);

  return {
    filteredMarkers,
    getCategoryLabel,
    normalizeImageUrl: normalizeImage,
    totalCount: markers.length,
    filteredCount: filteredMarkers.length,
  };
}

