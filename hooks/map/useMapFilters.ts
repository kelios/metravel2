import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { logError } from '@/src/utils/logger';
import {
  loadMapFilterValues,
  saveMapFilterValues,
  type MapFilterValues,
  type StorageLike,
} from '@/src/utils/mapFiltersStorage';
import { fetchFiltersMap } from '@/src/api/map';

export interface FiltersData {
  categories: { id: string; name: string }[];
  radius: { id: string; name: string }[];
  address: string;
}

const DEFAULT_FILTER_VALUES: MapFilterValues = {
  categories: [],
  radius: '60',
  address: '',
};

const DEFAULT_RADIUS_OPTIONS = [
  { id: '60', name: '60' },
  { id: '100', name: '100' },
  { id: '200', name: '200' },
  { id: '500', name: '500' },
  { id: '600', name: '600' },
];

function getWebStorage(): StorageLike | null {
  if (Platform.OS !== 'web') return null;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function normalizeCategory(cat: unknown, idx: number): { id: string; name: string } | null {
  if (cat == null) return null;

  const name = typeof cat === 'string' ? cat : (cat as { name?: unknown })?.name;
  const realId =
    cat && typeof cat === 'object' && (cat as { id?: unknown }).id !== undefined
      ? (cat as { id?: unknown }).id
      : idx;

  const normalizedName = String(name ?? cat ?? '').trim();
  if (!normalizedName) return null;

  return {
    id: String(realId),
    name: normalizedName,
  };
}

/**
 * Хук для управления фильтрами карты.
 * Загружает доступные фильтры с сервера и сохраняет выбранные значения в localStorage.
 */
export function useMapFilters() {
  const webStorage = useMemo(() => getWebStorage(), []);

  const [filters, setFilters] = useState<FiltersData>({
    categories: [],
    radius: DEFAULT_RADIUS_OPTIONS,
    address: '',
  });

  const [filterValues, setFilterValues] = useState<MapFilterValues>(() => {
    if (!webStorage) return DEFAULT_FILTER_VALUES;
    return loadMapFilterValues(webStorage);
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка фильтров с сервера
  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchFiltersMap();

        if (!isMounted) return;

        const categories = (data.categories || [])
          .map((cat, idx) => normalizeCategory(cat, idx))
          .filter((cat): cat is { id: string; name: string } => cat !== null);

        setFilters({
          categories,
          radius: DEFAULT_RADIUS_OPTIONS,
          address: data.categoryTravelAddress?.[0] || '',
        });
      } catch (err) {
        if (isMounted) {
          logError(err, { scope: 'map', step: 'loadFilters' });
          setError('Не удалось загрузить фильтры');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  // Сохранение значений фильтров в localStorage
  useEffect(() => {
    if (!webStorage) return;
    saveMapFilterValues(webStorage, filterValues);
  }, [filterValues, webStorage]);

  const handleFilterChange = useCallback(
    <K extends keyof MapFilterValues>(field: K, value: MapFilterValues[K]) => {
      setFilterValues((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Обёртка для FiltersPanel (принимает unknown)
  const handleFilterChangeForPanel = useCallback(
    (field: string, value: unknown) => {
      if (field === 'categories' && Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        handleFilterChange('categories', value);
        return;
      }

      if (field === 'radius' && typeof value === 'string') {
        handleFilterChange('radius', value);
        return;
      }

      if (field === 'address' && typeof value === 'string') {
        handleFilterChange('address', value);
      }
    },
    [handleFilterChange]
  );

  const resetFilters = useCallback(() => {
    setFilterValues(DEFAULT_FILTER_VALUES);
  }, []);

  return {
    filters,
    filterValues,
    isLoading,
    error,
    handleFilterChange,
    handleFilterChangeForPanel,
    resetFilters,
  };
}

