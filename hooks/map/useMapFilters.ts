import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { logError } from '@/utils/logger';
import {
  loadMapFilterValues,
  saveMapFilterValues,
  type MapFilterValues,
  type StorageLike,
} from '@/utils/mapFiltersStorage';
import { fetchFiltersMap, type MapFiltersResponse } from '@/api/map';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS } from '@/constants/mapConfig';
import { translate as i18nT } from '@/i18n'


export interface FiltersData {
  /**
   * Словарь категорий путешествий (`where.categories`). `/api/filterformap/` его
   * не отдаёт, поэтому на карте он пуст — не путать со словарём типов мест.
   */
  categories: { id: string; name: string }[];
  /** Единственный словарь чипов «тип места»: имя чипа → ID для сервера. */
  categoryTravelAddress: { id: string; name: string }[];
  radius: { id: string; name: string }[];
  address: string;
}

const DEFAULT_FILTER_VALUES: MapFilterValues = {
  categories: [],
  categoryTravelAddress: [],
  radius: String(DEFAULT_RADIUS_KM),
  address: '',
  searchQuery: '',
};

function getWebStorage(): StorageLike | null {
  if (Platform.OS !== 'web') return null;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function normalizeCategory(cat: unknown): { id: string; name: string } | null {
  if (cat == null) return null;

  const rec = cat && typeof cat === 'object' ? (cat as Record<string, unknown>) : null;
  const name =
    typeof cat === 'string'
      ? cat
      : rec?.name ??
        rec?.name_ru ??
        rec?.title_ru ??
        rec?.title ??
        rec?.text ??
        rec?.value;
  const realId =
    rec?.id ??
    rec?.value ??
    rec?.category_id ??
    rec?.pk;

  const normalizedName = String(name ?? cat ?? '').trim();
  if (!normalizedName) return null;

  // Без реального ID имя остаётся ключом: позиционный индекс выдавался бы за ID
  // чужой категории и уходил серверу. Нечисловой id `mapCategoryNamesToIds` пропустит.
  return {
    id: String(realId ?? normalizedName),
    name: normalizedName,
  };
}

/**
 * Единственный источник словаря чипов «тип места» карты (#2374). Живой
 * `/api/filterformap/` отдаёт его под ключом `categories`; legacy-ключ
 * `categoryTravelAddress` дочитывается только как fallback. Дубли по ID и имени
 * схлопываются, чтобы `mapCategoryNamesToIds` получал однозначное имя → ID.
 */
export function resolveMapPointCategoryDictionary(
  data: Partial<MapFiltersResponse> | null | undefined,
): { id: string; name: string }[] {
  const raw = [
    ...(Array.isArray(data?.categories) ? data.categories : []),
    ...(Array.isArray(data?.categoryTravelAddress) ? data.categoryTravelAddress : []),
  ];
  const seen = new Set<string>();
  const dictionary: { id: string; name: string }[] = [];
  raw.forEach((cat) => {
    const normalized = normalizeCategory(cat);
    if (!normalized) return;
    const nameKey = normalized.name.toLowerCase();
    if (seen.has(`id:${normalized.id}`) || seen.has(`name:${nameKey}`)) return;
    seen.add(`id:${normalized.id}`);
    seen.add(`name:${nameKey}`);
    dictionary.push(normalized);
  });
  return dictionary;
}

export interface UseMapFiltersOptions {
  initialCategories?: string[];
  initialRadius?: string;
}

/**
 * Хук для управления фильтрами карты.
 * Загружает доступные фильтры с сервера и сохраняет выбранные значения в localStorage.
 * URL-параметры (initialCategories, initialRadius) имеют приоритет над localStorage.
 */
export function useMapFilters(options?: UseMapFiltersOptions) {
  const webStorage = useMemo(() => getWebStorage(), []);

  const [filters, setFilters] = useState<FiltersData>({
    categories: [],
    categoryTravelAddress: [],
    radius: [...RADIUS_OPTIONS],
    address: '',
  });

  const [filterValues, setFilterValues] = useState<MapFilterValues>(() => {
    const stored = webStorage ? loadMapFilterValues(webStorage) : DEFAULT_FILTER_VALUES;
    // Карта всегда открывается БЕЗ активных фильтров контента: категории/адрес/
    // поиск НЕ восстанавливаем из localStorage. Иначе выбранные в прошлой сессии
    // категории (напр. «Город», «Пещера») «залипают» и выглядят как фильтр,
    // который пользователь не ставил, — вплоть до «в этой области ничего не
    // нашлось». Из хранилища переносим только настройки, не скрывающие контент:
    // радиус (всегда имеет значение и показан отдельной кнопкой), режим
    // транспорта и последний режим (radius/route). URL-параметры имеют приоритет.
    return {
      ...DEFAULT_FILTER_VALUES,
      radius: stored.radius,
      transportMode: stored.transportMode,
      lastMode: stored.lastMode,
      searchQuery: '',
      // `?categories=` в URL /map — имена типов мест (как `placeCategory`), поэтому
      // идут в тот же канал чипов, что и выбор в панели, и резолвятся одним словарём.
      ...(options?.initialCategories?.length
        ? { categoryTravelAddress: options.initialCategories }
        : {}),
      ...(options?.initialRadius ? { radius: options.initialRadius } : {}),
    };
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка фильтров с сервера
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadFilters = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchFiltersMap({ signal: controller.signal });

        if (!isMounted) return;

        setFilters({
          categories: [],
          categoryTravelAddress: resolveMapPointCategoryDictionary(data),
          radius: [...RADIUS_OPTIONS],
          address: '',
        });
      } catch (err) {
        if (isMounted) {
          logError(err, { scope: 'map', step: 'loadFilters' });
          setError(i18nT('map:hooks.map.useMapFilters.ne_udalos_zagruzit_filtry_4d480f39'));
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
      controller.abort();
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

      if (field === 'categoryTravelAddress' && Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        handleFilterChange('categoryTravelAddress', value);
        return;
      }

      if (field === 'radius' && typeof value === 'string') {
        handleFilterChange('radius', value);
        return;
      }

      if (field === 'address' && typeof value === 'string') {
        handleFilterChange('address', value);
        return;
      }

      if (field === 'searchQuery' && typeof value === 'string') {
        handleFilterChange('searchQuery', value);
        return;
      }

    },
    [handleFilterChange]
  );

  const resetFilters = useCallback(() => {
    setFilterValues(DEFAULT_FILTER_VALUES);
  }, []);

  return useMemo(() => ({
    filters,
    filterValues,
    isLoading,
    error,
    handleFilterChange,
    handleFilterChangeForPanel,
    resetFilters,
  }), [
    filters,
    filterValues,
    isLoading,
    error,
    handleFilterChange,
    handleFilterChangeForPanel,
    resetFilters,
  ]);
}
