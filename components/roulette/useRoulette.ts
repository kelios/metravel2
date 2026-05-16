import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import ModernFilters from '@/components/listTravel/ModernFilters';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';
import { useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { deduplicateTravels, normalizeApiResponse } from '@/components/listTravel/utils/listTravelHelpers';
import { buildFacetCounts, buildTravelFilterGroups } from '@/components/listTravel/utils/filterGroups';
import { fetchAllCountries, fetchAllFiltersOptimized } from '@/api/miscOptimized';
import { fetchTravelFacets } from '@/api/travelListQueries';
import { queryConfigs } from '@/utils/reactQueryConfig';
import type { Travel } from '@/types/types';
import type { FilterOptions } from '@/components/listTravel/utils/listTravelTypes';

type FilterGroup = Parameters<typeof ModernFilters>[0]['filterGroups'][number];

const RESULT_SIZE = 3;
const SPIN_DURATION_MS = 900;

const STRING_ARRAY_FIELDS = [
  'categories',
  'categoryTravelAddress',
  'transports',
  'companions',
  'complexity',
  'month',
  'over_nights_stay',
] as const;

const TECHNICAL_FILTER_KEYS = new Set(['publish', 'moderation']);

function shuffle(items: Travel[]): Travel[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toCountryId(raw: unknown): number | null {
  const id = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(id) ? id : null;
}

// Беларусь + Польша как страны по умолчанию, если пользователь не выбрал страну.
function pickDefaultCountryIds(countries: unknown): number[] {
  if (!Array.isArray(countries)) return [];

  let belarusId: number | null = null;
  let polandId: number | null = null;

  for (const entry of countries) {
    const country = entry as Record<string, unknown>;
    const name = String(country?.name || country?.title || '').toLowerCase();
    const id = toCountryId(country?.id ?? country?.pk);
    if (id == null) continue;
    if (belarusId == null && (name.includes('беларус') || name.includes('belarus'))) {
      belarusId = id;
    }
    if (polandId == null && (name.includes('польш') || name.includes('poland'))) {
      polandId = id;
    }
  }

  const ids: number[] = [];
  if (belarusId != null) ids.push(belarusId);
  if (polandId != null && polandId !== belarusId) ids.push(polandId);
  return ids;
}

export function useRoulette() {
  const { data: rawOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['filter-options'],
    queryFn: ({ signal } = {} as any) => fetchAllFiltersOptimized({ signal }),
    ...queryConfigs.static,
  });

  const { data: allCountries } = useQuery({
    queryKey: ['all-countries'],
    queryFn: ({ signal } = {} as any) => fetchAllCountries({ signal }),
    ...queryConfigs.static,
  });

  const options: FilterOptions | undefined = useMemo(() => {
    if (!rawOptions) return undefined;
    const transformed = { countries: rawOptions.countries || [] } as FilterOptions;

    STRING_ARRAY_FIELDS.forEach((field) => {
      const value = (rawOptions as Record<string, unknown>)[field];
      if (!Array.isArray(value)) return;
      (transformed as Record<string, unknown>)[field] = value.map((item: unknown) => {
        if (item && typeof item === 'object' && 'id' in item && 'name' in item) return item;
        return { id: String(item), name: String(item) };
      });
    });

    return transformed;
  }, [rawOptions]);

  const defaultCountries = useMemo(
    () => pickDefaultCountryIds(allCountries),
    [allCountries],
  );

  const { filter, queryParams, resetFilters, onSelect } = useListTravelFilters({
    options,
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  });

  const rouletteQueryParams = useMemo(() => {
    const params = { ...queryParams };
    const hasCountry = Array.isArray(params.countries) && params.countries.length > 0;
    if (!hasCountry && defaultCountries.length > 0) {
      params.countries = defaultCountries;
    }
    return params;
  }, [queryParams, defaultCountries]);

  const { data: facetsData } = useQuery({
    queryKey: ['roulette-travel-facets', rouletteQueryParams],
    queryFn: ({ signal } = {} as any) =>
      fetchTravelFacets('', rouletteQueryParams, { signal, suppressErrors: true }),
    enabled: Boolean(options),
    staleTime: 30 * 1000,
  });

  const facetCounts = useMemo(
    () => buildFacetCounts(facetsData?.facets),
    [facetsData?.facets],
  );

  const filterGroups = useMemo<FilterGroup[]>(
    () =>
      buildTravelFilterGroups({
        options,
        facetCounts,
        selectedFilters: filter,
        includeSort: false,
        hideCountries: false,
      }),
    [options, facetCounts, filter],
  );

  const activeFiltersCount = useMemo(
    () => Object.keys(rouletteQueryParams).filter((key) => !TECHNICAL_FILTER_KEYS.has(key)).length,
    [rouletteQueryParams],
  );

  const filtersSummary = useMemo(() => {
    const countryIds = (rouletteQueryParams.countries as number[] | undefined) || [];
    const countryList = (options?.countries as { id: unknown; name: unknown }[] | undefined) || [];

    if (countryIds.length > 0 && countryList.length > 0) {
      const first = countryList.find((c) => String(c.id) === String(countryIds[0]));
      if (first) {
        return countryIds.length > 1
          ? `${first.name} и ещё ${countryIds.length - 1}`
          : String(first.name);
      }
    }

    return activeFiltersCount > 0 ? `Выбрано: ${activeFiltersCount}` : 'Без фильтров';
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
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    },
    [],
  );

  const handleSpin = useCallback(async () => {
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    setSpinning(true);

    let pool: Travel[] = travels || [];
    try {
      const { data } = await refetch();
      const pages = (data as { pages?: unknown[] } | undefined)?.pages || [];
      if (pages.length > 0) {
        const items = pages.flatMap((page) => normalizeApiResponse(page).items || []);
        pool = deduplicateTravels(items as Travel[]);
      }
    } catch {
      // оставляем уже загруженные travels
    }

    if (pool.length === 0) {
      setResult([]);
      setSpinning(false);
      return;
    }

    const next = shuffle(pool).slice(0, RESULT_SIZE);
    spinTimerRef.current = setTimeout(() => {
      setResult(next);
      setSpinning(false);
    }, SPIN_DURATION_MS);
  }, [travels, refetch]);

  const handleClearAll = useCallback(() => {
    resetFilters();
    setResult([]);
  }, [resetFilters]);

  const handleFilterChange = useCallback(
    (groupKey: string, optionId: string) => {
      const current: string[] = ((filter as Record<string, unknown>)[groupKey] as unknown[] | undefined || [])
        .map((v) => String(v));
      const id = String(optionId);
      const nextValues = current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id];
      onSelect(groupKey, nextValues);
    },
    [filter, onSelect],
  );

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
