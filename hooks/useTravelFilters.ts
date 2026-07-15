import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAllCountries } from '@/api/misc';
import { fetchFiltersOptimized } from '@/api/miscOptimized';
import { translate as i18nT } from '@/i18n'

export interface TravelFilters {
  categories: Array<{ id: string; name: string }>;
  transports: Array<{ id: string; name: string }>;
  companions: Array<{ id: string; name: string }>;
  complexity: Array<{ id: string; name: string }>;
  month: Array<{ id: string; name: string }>;
  over_nights_stay: Array<{ id: string; name: string }>;
  categoryTravelAddress: Array<{ id: string; name: string }>;
  countries: Array<{
    country_id: string;
    title_ru: string;
    title_en?: string;
    title?: string;
    name?: string;
    country_code?: string;
    code?: string;
    iso2?: string;
    iso?: string;
    alpha2?: string;
    alpha_2?: string;
    ISO3166_1_alpha2?: string;
  }>;
}

export function initFilters(): TravelFilters {
  return {
    countries: [],
    categories: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.category.mountains') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.category.sea') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.category.cities') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.category.nature') },
    ],
    companions: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.companion.solo') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.companion.couple') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.companion.friends') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.companion.family') },
    ],
    complexity: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.complexity.easy') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.complexity.medium') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.complexity.hard') },
    ],
    month: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.month.january') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.month.february') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.month.march') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.month.april') },
      { id: '5', name: i18nT('travel:hooks.useTravelFilters.month.may') },
      { id: '6', name: i18nT('travel:hooks.useTravelFilters.month.june') },
      { id: '7', name: i18nT('travel:hooks.useTravelFilters.month.july') },
      { id: '8', name: i18nT('travel:hooks.useTravelFilters.month.august') },
      { id: '9', name: i18nT('travel:hooks.useTravelFilters.month.september') },
      { id: '10', name: i18nT('travel:hooks.useTravelFilters.month.october') },
      { id: '11', name: i18nT('travel:hooks.useTravelFilters.month.november') },
      { id: '12', name: i18nT('travel:hooks.useTravelFilters.month.december') },
    ],
    over_nights_stay: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.overnight.tent') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.overnight.hotel') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.overnight.camping') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.overnight.none') },
    ],
    transports: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.transport.car') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.transport.train') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.transport.plane') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.transport.walking') },
    ],
    categoryTravelAddress: [
      { id: '1', name: i18nT('travel:hooks.useTravelFilters.place.parking') },
      { id: '2', name: i18nT('travel:hooks.useTravelFilters.place.hotel') },
      { id: '3', name: i18nT('travel:hooks.useTravelFilters.place.restaurant') },
      { id: '4', name: i18nT('travel:hooks.useTravelFilters.place.attraction') },
      { id: '5', name: i18nT('travel:hooks.useTravelFilters.place.viewpoint') },
      { id: '6', name: i18nT('travel:hooks.useTravelFilters.place.gasStation') },
      { id: '7', name: i18nT('travel:hooks.useTravelFilters.place.shop') },
      { id: '8', name: i18nT('travel:hooks.useTravelFilters.place.cafe') },
    ],
  };
}

function unwrapArrayCandidate(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    if (Array.isArray(rec.results)) return rec.results;
    if (Array.isArray(rec.data)) return rec.data;
    if (Array.isArray(rec.items)) return rec.items;
  }
  return [];
}

export function normalizeTravelCategories(raw: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const id =
          rec.id ??
          rec.value ??
          rec.category_id ??
          rec.pk ??
          idx;
        const name =
          rec.name ??
          rec.name_ru ??
          rec.title_ru ??
          rec.title ??
          rec.text ??
          String(id);
        return { id: String(id), name: String(name) };
      }
      return { id: String(idx), name: String(item) };
    })
    .filter(Boolean);
}

function normalizeIdNameList(raw: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const id = rec.id ?? rec.value ?? rec.pk ?? idx;
        const name = rec.name ?? rec.title ?? rec.text ?? String(id);
        return { id: String(id), name: String(name) };
      }
      return { id: String(idx), name: String(item) };
    })
    .filter(Boolean);
}

function normalizeCountries(raw: unknown): Array<{
  country_id: string;
  title_ru: string;
  title_en?: string;
  title?: string;
  name?: string;
  country_code?: string;
  code?: string;
  iso2?: string;
  iso?: string;
  alpha2?: string;
  alpha_2?: string;
  ISO3166_1_alpha2?: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== 'object') {
        return {
          country_id: String(idx),
          title_ru: String(item ?? ''),
        };
      }
      const rec = item as Record<string, unknown>;
      const id =
        rec.country_id ??
        rec.id ??
        rec.pk ??
        rec.value ??
        idx;
      const titleRu =
        rec.title_ru ??
        rec.name_ru ??
        rec.name ??
        rec.title ??
        rec.title_en ??
        rec.text ??
        '';
      const titleEn =
        rec.title_en ??
        rec.title ??
        rec.name_en ??
        rec.name ??
        '';
      const countryCode =
        rec.country_code ??
        rec.code ??
        rec.iso2 ??
        rec.iso ??
        rec.alpha2 ??
        rec.alpha_2 ??
        rec.ISO3166_1_alpha2 ??
        '';
      const normalizedCode = countryCode ? String(countryCode).trim().toUpperCase() : '';
      return {
        country_id: String(id),
        title_ru: String(titleRu),
        title_en: titleEn ? String(titleEn) : undefined,
        title: rec.title ? String(rec.title) : undefined,
        name: rec.name ? String(rec.name) : undefined,
        country_code: normalizedCode || undefined,
        code: normalizedCode || undefined,
        iso2: normalizedCode || undefined,
        iso: normalizedCode || undefined,
        alpha2: normalizedCode || undefined,
        alpha_2: normalizedCode || undefined,
        ISO3166_1_alpha2: normalizedCode || undefined,
      };
    })
    .filter(Boolean);
}

export function normalizeCategoryTravelAddress(raw: unknown): Array<{ id: string; name: string }> {
  const arr = unwrapArrayCandidate(raw);
  return arr
    .map((item, idx) => {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const id =
          rec.id ??
          rec.value ??
          rec.category_id ??
          rec.pk ??
          idx;
        const name =
          rec.name ??
          rec.name_ru ??
          rec.title_ru ??
          rec.title ??
          rec.text ??
          String(id);
        return { id: String(id), name: String(name) };
      }
      return { id: String(item), name: String(item) };
    })
    .filter(Boolean);
}

interface UseTravelFiltersOptions {
  loadOnMount?: boolean;
  currentStep?: number;
}

export function useTravelFilters(options: UseTravelFiltersOptions = {}) {
  const { loadOnMount = true, currentStep } = options;
  
  const [filters, setFilters] = useState<TravelFilters>(initFilters());
  const [isLoading, setIsLoading] = useState(loadOnMount);
  const [error, setError] = useState<Error | null>(null);
  
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);
  const inFlightCountRef = useRef(0);
  const refetchStateRef = useRef<{ step: number | null; inFlight: boolean }>({
    step: null,
    inFlight: false,
  });
  const triedPointCatsRef = useRef<number | null>(null);
  const triedCountriesRef = useRef<number | null>(null);

  const beginLoading = useCallback(() => {
    inFlightCountRef.current += 1;
    if (mountedRef.current) setIsLoading(true);
  }, []);

  const endLoading = useCallback(() => {
    inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
    if (mountedRef.current && inFlightCountRef.current === 0) setIsLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFilters = useCallback(async () => {
    if (loadedRef.current) return;

    try {
      beginLoading();
      setError(null);

      const [filtersData, countryData] = await Promise.all([
        fetchFiltersOptimized(),
        fetchAllCountries({ throwOnError: true }),
      ]);

      if (!mountedRef.current) return;

      const normalizedCategories = normalizeTravelCategories(filtersData?.categories || []);
      const normalizedTransports = normalizeIdNameList(filtersData?.transports || []);
      const normalizedCompanions = normalizeIdNameList(filtersData?.companions || []);
      const normalizedComplexity = normalizeIdNameList(filtersData?.complexity || []);
      const normalizedMonth = normalizeIdNameList(filtersData?.month || []);
      const normalizedOvernights = normalizeIdNameList(filtersData?.over_nights_stay || []);
      const normalizedCategoryTravelAddress = normalizeCategoryTravelAddress(
        filtersData?.categoryTravelAddress || []
      );
      const normalizedCountries = normalizeCountries(countryData);

      setFilters({
        categories: normalizedCategories,
        transports: normalizedTransports,
        companions: normalizedCompanions,
        complexity: normalizedComplexity,
        month: normalizedMonth,
        over_nights_stay: normalizedOvernights,
        categoryTravelAddress: normalizedCategoryTravelAddress,
        countries: normalizedCountries,
      });
      
      loadedRef.current = true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load filters');
      if (mountedRef.current) setError(error);
      console.error('Error loading filters:', error);
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading]);

  const refetchPointCategories = useCallback(async () => {
    const refetchState = refetchStateRef.current;
    if (refetchState.inFlight) return;

    refetchState.inFlight = true;
    refetchState.step = currentStep || null;

    try {
      beginLoading();
      const filtersData = await fetchFiltersOptimized();

      if (!mountedRef.current) return;

      const normalizedCategoryTravelAddress = normalizeCategoryTravelAddress(
        filtersData?.categoryTravelAddress || []
      );

      setFilters(prev => ({
        ...prev,
        categoryTravelAddress: normalizedCategoryTravelAddress,
      }));
    } catch (err) {
      console.error('Error refetching point categories:', err);
    } finally {
      endLoading();
      refetchState.inFlight = false;
    }
  }, [currentStep, beginLoading, endLoading]);

  const refetchCountries = useCallback(async () => {
    try {
      beginLoading();
      const countryData = await fetchAllCountries({ throwOnError: true });

      if (!mountedRef.current) return;

      const normalizedCountries = normalizeCountries(countryData);

      setFilters(prev => ({
        ...prev,
        countries: normalizedCountries,
      }));
    } catch (err) {
      console.error('Error refetching countries:', err);
    } finally {
      endLoading();
    }
  }, [beginLoading, endLoading]);

  useEffect(() => {
    if (loadOnMount) {
      loadFilters();
    }
  }, [loadOnMount, loadFilters]);

  useEffect(() => {
    const isPointStep = currentStep === 2 || currentStep === 3;

    if (!isPointStep) {
      triedPointCatsRef.current = null;
      return;
    }

    const hasPointCats =
      !!filters?.categoryTravelAddress && filters.categoryTravelAddress.length > 0;

    if (hasPointCats || triedPointCatsRef.current === currentStep) return;

    triedPointCatsRef.current = currentStep;
    refetchPointCategories();
  }, [currentStep, filters?.categoryTravelAddress, refetchPointCategories]);

  useEffect(() => {
    if (currentStep !== 2) {
      triedCountriesRef.current = null;
      return;
    }

    const hasCountries = !!filters?.countries && filters.countries.length > 0;

    if (hasCountries || triedCountriesRef.current === currentStep) return;

    triedCountriesRef.current = currentStep;
    refetchCountries();
  }, [currentStep, filters?.countries, refetchCountries]);

  return useMemo(() => ({
    filters,
    isLoading,
    error,
    loadFilters,
    refetchPointCategories,
    refetchCountries,
  }), [filters, isLoading, error, loadFilters, refetchPointCategories, refetchCountries]);
}
