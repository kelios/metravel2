import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchFilters, fetchAllCountries } from '@/api/misc';

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
      { id: '1', name: 'Горы' },
      { id: '2', name: 'Море' },
      { id: '3', name: 'Города' },
      { id: '4', name: 'Природа' },
    ],
    companions: [
      { id: '1', name: 'Один' },
      { id: '2', name: 'Пара' },
      { id: '3', name: 'Друзья' },
      { id: '4', name: 'Семья' },
    ],
    complexity: [
      { id: '1', name: 'Легко' },
      { id: '2', name: 'Средне' },
      { id: '3', name: 'Сложно' },
    ],
    month: [
      { id: '1', name: 'Январь' },
      { id: '2', name: 'Февраль' },
      { id: '3', name: 'Март' },
      { id: '4', name: 'Апрель' },
      { id: '5', name: 'Май' },
      { id: '6', name: 'Июнь' },
      { id: '7', name: 'Июль' },
      { id: '8', name: 'Август' },
      { id: '9', name: 'Сентябрь' },
      { id: '10', name: 'Октябрь' },
      { id: '11', name: 'Ноябрь' },
      { id: '12', name: 'Декабрь' },
    ],
    over_nights_stay: [
      { id: '1', name: 'Палатка' },
      { id: '2', name: 'Отель' },
      { id: '3', name: 'Кемпинг' },
      { id: '4', name: 'Без ночёвки' },
    ],
    transports: [
      { id: '1', name: 'Авто' },
      { id: '2', name: 'Поезд' },
      { id: '3', name: 'Самолёт' },
      { id: '4', name: 'Пешком' },
    ],
    categoryTravelAddress: [
      { id: '1', name: 'Парковка' },
      { id: '2', name: 'Отель' },
      { id: '3', name: 'Ресторан' },
      { id: '4', name: 'Достопримечательность' },
      { id: '5', name: 'Смотровая площадка' },
      { id: '6', name: 'Заправка' },
      { id: '7', name: 'Магазин' },
      { id: '8', name: 'Кафе' },
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
  const refetchStateRef = useRef<{ step: number | null; inFlight: boolean }>({
    step: null,
    inFlight: false,
  });

  const loadFilters = useCallback(async () => {
    if (loadedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const [filtersData, countryData] = await Promise.all([
        fetchFilters(),
        fetchAllCountries(),
      ]);

      const normalizedCategories = normalizeTravelCategories(filtersData?.categories || []);
      const normalizedTransports = normalizeIdNameList(filtersData?.transports || []);
      const normalizedCompanions = normalizeIdNameList(filtersData?.companions || []);
      const normalizedComplexity = normalizeIdNameList(filtersData?.complexity || []);
      const normalizedMonth = normalizeIdNameList(filtersData?.month || []);
      const normalizedOvernights = normalizeIdNameList(filtersData?.over_nights_stay || []);
      const normalizedCategoryTravelAddress = normalizeCategoryTravelAddress(
        filtersData?.categoryTravelAddress || []
      );
      const normalizedCountries = normalizeCountries(filtersData?.countries || countryData || []);

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
      setError(error);
      console.error('Error loading filters:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetchPointCategories = useCallback(async () => {
    const refetchState = refetchStateRef.current;
    if (refetchState.inFlight) return;

    refetchState.inFlight = true;
    refetchState.step = currentStep || null;

    try {
      setIsLoading(true);
      const filtersData = await fetchFilters();

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
      setIsLoading(false);
      refetchState.inFlight = false;
    }
  }, [currentStep]);

  const refetchCountries = useCallback(async () => {
    try {
      setIsLoading(true);
      const countryData = await fetchAllCountries();
      const normalizedCountries = normalizeCountries(countryData);

      setFilters(prev => ({
        ...prev,
        countries: normalizedCountries,
      }));
    } catch (err) {
      console.error('Error refetching countries:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadOnMount) {
      loadFilters();
    }
  }, [loadOnMount, loadFilters]);

  useEffect(() => {
    const needsPointCategories =
      (currentStep === 2 || currentStep === 3) &&
      (!filters?.categoryTravelAddress || filters.categoryTravelAddress.length === 0);

    if (needsPointCategories) {
      refetchPointCategories();
    }
  }, [currentStep, filters?.categoryTravelAddress, refetchPointCategories]);

  useEffect(() => {
    const needCountries = currentStep === 2 && (!filters?.countries || filters.countries.length === 0);

    if (needCountries) {
      refetchCountries();
    }
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
