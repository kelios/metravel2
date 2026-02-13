import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import ModernFilters from '@/components/listTravel/ModernFilters';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';
import { useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { deduplicateTravels, normalizeApiResponse } from '@/components/listTravel/utils/listTravelHelpers';
import { fetchAllCountries, fetchAllFiltersOptimized } from '@/api/miscOptimized';
import { queryConfigs } from '@/utils/reactQueryConfig';
import type { Travel } from '@/types/types';
import type { FilterOptions } from '@/components/listTravel/utils/listTravelTypes';

type FilterGroup = Parameters<typeof ModernFilters>[0]['filterGroups'][number];

function shuffleTravels(items: Travel[]): Travel[] {
  const arr = [...(items || [])];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function useRoulette() {
  const { data: rawOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['filter-options'],
    queryFn: ({ signal } = {} as any) => fetchAllFiltersOptimized({ signal }),
    ...queryConfigs.static,
  });

  const options: FilterOptions | undefined = useMemo(() => {
    if (!rawOptions) return undefined;
    const transformed: FilterOptions = {
      countries: rawOptions.countries || [],
    } as FilterOptions;

    const stringArrayFields = [
      'categories',
      'categoryTravelAddress',
      'transports',
      'companions',
      'complexity',
      'month',
      'over_nights_stay',
    ] as const;

    stringArrayFields.forEach((field) => {
      const value = (rawOptions as any)[field];
      if (Array.isArray(value)) {
        (transformed as any)[field] = value.map((item: any) => {
          if (item && typeof item === 'object' && 'id' in item && 'name' in item) {
            return item;
          }
          return {
            id: String(item),
            name: String(item),
          };
        });
      }
    });

    return transformed;
  }, [rawOptions]);

  const [defaultCountries, setDefaultCountries] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDefaultCountries = async () => {
      try {
        const all = await fetchAllCountries();
        if (!Array.isArray(all)) return;
        let belarusId: number | null = null;
        let polandId: number | null = null;
        all.forEach((country: any) => {
          const name = String(country?.name || country?.title || '').toLowerCase();
          const idRaw = country?.id ?? country?.pk;
          const id = typeof idRaw === 'number' ? idRaw : Number(String(idRaw).trim());
          if (!Number.isFinite(id)) return;
          if (!belarusId && (name.includes('беларус') || name.includes('belarus'))) {
            belarusId = id;
          }
          if (!polandId && (name.includes('польш') || name.includes('poland'))) {
            polandId = id;
          }
        });
        const result: number[] = [];
        if (belarusId != null) result.push(belarusId);
        if (polandId != null && polandId !== belarusId) result.push(polandId);
        if (!cancelled && result.length > 0) {
          setDefaultCountries(result);
        }
      } catch {
        if (!cancelled) {
          setDefaultCountries(null);
        }
      }
    };
    loadDefaultCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    filter,
    queryParams,
    resetFilters,
    onSelect,
  } = useListTravelFilters({
    options,
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  });

  const filterGroups = useMemo<FilterGroup[]>(() => [
    {
      key: 'countries',
      title: 'Страны',
      options: (options?.countries || []).map((country: any) => ({
        id: String(country.country_id ?? country.id),
        name: country.title_ru || country.name,
      })),
      multiSelect: true,
      icon: 'globe',
    },
    {
      key: 'categories',
      title: 'Категории',
      options: (options?.categories || []).map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        count: undefined,
      })),
      multiSelect: true,
      icon: 'tag',
    },
    {
      key: 'transports',
      title: 'Транспорт',
      options: (options?.transports || []).map((t: any) => ({
        id: String(t.id),
        name: t.name,
      })),
      multiSelect: true,
      icon: 'truck',
    },
    {
      key: 'categoryTravelAddress',
      title: 'Объекты',
      options: (options?.categoryTravelAddress || []).map((obj: any) => ({
        id: String(obj.id),
        name: obj.name,
      })),
      multiSelect: true,
      icon: 'map-pin',
    },
    {
      key: 'companions',
      title: 'Спутники',
      options: (options?.companions || []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
      })),
      multiSelect: true,
      icon: 'users',
    },
    {
      key: 'complexity',
      title: 'Сложность',
      options: (options?.complexity || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'activity',
    },
    {
      key: 'month',
      title: 'Месяц',
      options: (options?.month || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'calendar',
    },
    {
      key: 'over_nights_stay',
      title: 'Ночлег',
      options: (options?.over_nights_stay || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'moon',
    },
  ], [options]);

  const rouletteQueryParams = useMemo(() => {
    const base = { ...queryParams };
    if (!base.countries || !Array.isArray(base.countries) || base.countries.length === 0) {
      if (defaultCountries && defaultCountries.length > 0) {
        base.countries = defaultCountries;
      }
    }
    return base;
  }, [queryParams, defaultCountries]);

  const activeFiltersCount = useMemo(() => {
    const technicalKeys = new Set(['publish', 'moderation']);
    return Object.keys(rouletteQueryParams).filter((key) => !technicalKeys.has(key)).length;
  }, [rouletteQueryParams]);

  const filtersSummary = useMemo(() => {
    const count = activeFiltersCount;
    const countryIds = (rouletteQueryParams.countries as number[] | undefined) || [];

    if (options && Array.isArray((options as any).countries) && countryIds.length > 0) {
      const list = (options as any).countries as any[];
      const first = list.find((c) => String(c.id) === String(countryIds[0]));
      if (first) {
        if (countryIds.length > 1) {
          return `${first.name} и ещё ${countryIds.length - 1}`;
        }
        return String(first.name);
      }
    }

    if (count > 0) return `Выбрано: ${count}`;
    return 'Без фильтров';
  }, [rouletteQueryParams, options, activeFiltersCount]);

  const {
    data: travels,
    isLoading,
    isFetching,
    isEmpty,
    refetch,
  } = useRandomTravelData({
    queryParams: rouletteQueryParams,
    search: '',
    isQueryEnabled: false,
  });

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Travel[]>([]);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const shouldUseNativeDriver = Platform.OS !== 'web';

  const handleSpin = useCallback(async () => {
    setSpinning(true);
    spinAnim.setValue(0);

    let freshTravels: Travel[] = travels || [];

    try {
      const refetchResult = await refetch();
      const pages = (refetchResult.data as any)?.pages || [];
      if (Array.isArray(pages) && pages.length > 0) {
        const normalized = pages.map((page: any) => normalizeApiResponse(page));
        const flattened = normalized.flatMap((page: any) => page.items || []);
        freshTravels = deduplicateTravels(flattened as Travel[]);
      }
    } catch {
      // В случае ошибки используем уже загруженные travels
    }

    if (!freshTravels || freshTravels.length === 0) {
      setResult([]);
      setSpinning(false);
      return;
    }

    const next = shuffleTravels(freshTravels).slice(0, 3);

    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: shouldUseNativeDriver,
    }).start(() => {
      setResult(next);
      setSpinning(false);
    });
  }, [spinAnim, travels, refetch, shouldUseNativeDriver]);

  const handleClearAll = useCallback(() => {
    resetFilters();
    setResult([]);
  }, [resetFilters]);

  const handleFilterChange = useCallback((groupKey: string, optionId: string) => {
    const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v));
    const normalizedId = String(optionId);
    const newValues = currentValues.includes(normalizedId)
      ? currentValues.filter((id) => id !== normalizedId)
      : [...currentValues, normalizedId];
    onSelect(groupKey, newValues);
  }, [filter, onSelect]);

  const showLoading = isLoading || isFetching || filtersLoading;

  return {
    filter,
    filterGroups,
    filtersSummary,
    activeFiltersCount,
    travels,
    isEmpty,
    isLoading,
    isFetching,
    filtersLoading,
    result,
    spinning,
    handleSpin,
    handleClearAll,
    handleFilterChange,
    showLoading,
    onSelect,
  };
}

export { useRoulette as useRouletteLogic };
