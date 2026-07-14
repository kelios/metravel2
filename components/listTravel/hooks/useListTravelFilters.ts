/**
 * Кастомный хук для управления фильтрами
 * Вынесена логика фильтров для переиспользования и тестирования
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { FilterState, FilterOptions } from '../utils/listTravelTypes';
import { INITIAL_FILTER, BELARUS_ID } from '../utils/listTravelConstants';
import { buildTravelQueryParams, mapCategoryNamesToIds } from '@/utils/filterQuery';

export interface UseListTravelFiltersProps {
  options?: FilterOptions;
  isMeTravel: boolean;
  isExport: boolean;
  isTravelBy: boolean;
  userId: string | null;
  user_id?: string;
  initialFilter?: FilterState;
}

export interface UseListTravelFiltersReturn {
  filter: FilterState;
  queryParams: Record<string, any>;
  setFilter: (filter: FilterState) => void;
  resetFilters: () => void;
  onSelect: (field: string, value: any) => void;
  applyFilter: (filter: FilterState) => void;
  handleToggleCategory: (categoryName: string) => void;
}

const serializeFilterState = (value?: FilterState) => {
  const source = value ?? INITIAL_FILTER;
  const normalized: Record<string, unknown> = {};
  Object.keys(source)
    .sort()
    .forEach((key) => {
      const raw = (source as any)[key];
      if (Array.isArray(raw)) {
        normalized[key] = [...raw];
        return;
      }
      normalized[key] = raw;
    });
  return JSON.stringify(normalized);
};

const isMeaningfulString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const extractCategoryNames = (categories?: Array<string | number>): string[] => {
  if (!categories?.length) {
    return [];
  }
  return categories.filter((value): value is string => {
    if (!isMeaningfulString(value)) {
      return false;
    }
    const numericCandidate = Number(value.trim());
    return Number.isNaN(numericCandidate);
  });
};

const extractNumericCategoryIds = (categories?: Array<string | number>): number[] => {
  if (!categories?.length) {
    return [];
  }

  return categories
    .map((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (isMeaningfulString(value)) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return null;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
};

/**
 * ✅ АРХИТЕКТУРА: Хук для управления фильтрами
 * 
 * Логика:
 * - Управление состоянием фильтров
 * - Нормализация queryParams
 * - Обработка изменений фильтров
 * - Сброс фильтров
 * - Подсчет категорий с количеством
 */
export function useListTravelFilters({
  options,
  isMeTravel,
  isExport,
  isTravelBy,
  userId,
  user_id,
  initialFilter,
}: UseListTravelFiltersProps): UseListTravelFiltersReturn {
  const [filter, setFilter] = useState<FilterState>(initialFilter ?? INITIAL_FILTER);
  const appliedInitialRef = useRef<string>(serializeFilterState(initialFilter));

  // Re-apply URL-derived initialFilter whenever query params actually change.
  // This keeps quick filters on home deterministic and prevents stale filters.
  useEffect(() => {
    const nextSerialized = serializeFilterState(initialFilter);
    if (appliedInitialRef.current === nextSerialized) return;
    appliedInitialRef.current = nextSerialized;
    setFilter(initialFilter ?? INITIAL_FILTER);
  }, [initialFilter]);

  // Когда категория приходит как имя (deep-link по чипу категории со страницы
  // путешествия ведёт на /travelsby?categoryTravelAddress=Озеро), после загрузки опций
  // фильтров переписываем имя→числовой id прямо в состоянии: тогда корректно работает
  // и API-запрос, и активный чип фильтра (getOptionName ищет по id), и его удаление.
  const filterCategories = filter.categories;
  const filterCategoryAddress = filter.categoryTravelAddress;
  useEffect(() => {
    const patch: Partial<FilterState> = {};

    ([
      ['categories', filterCategories, options?.categories],
      ['categoryTravelAddress', filterCategoryAddress, options?.categoryTravelAddress],
    ] as const).forEach(([key, values, optionList]) => {
      const textual = extractCategoryNames(values as Array<string | number> | undefined);
      if (!textual.length || !optionList?.length) return;

      const mappedIds = mapCategoryNamesToIds(textual, optionList);
      if (!mappedIds.length) return;

      const numericIds = extractNumericCategoryIds(values as Array<string | number> | undefined);
      (patch as any)[key] = Array.from(new Set<number>([...numericIds, ...mappedIds]));
    });

    if (Object.keys(patch).length) {
      setFilter((prev) => ({ ...prev, ...patch }));
    }
  }, [filterCategories, filterCategoryAddress, options?.categories, options?.categoryTravelAddress]);

  const filterForQuery = useMemo(() => {
    const textualCategories = extractCategoryNames(filter.categories);
    if (!textualCategories.length) {
      return filter;
    }

    if (!options?.categories?.length) {
      return filter;
    }

    const mappedCategoryIds = mapCategoryNamesToIds(textualCategories, options.categories);
    if (!mappedCategoryIds.length) {
      return filter;
    }

    const currentNumericIds = extractNumericCategoryIds(filter.categories);
    const normalizedCategories = Array.from(
      new Set<number>([...currentNumericIds, ...mappedCategoryIds])
    );

    return {
      ...filter,
      categories: normalizedCategories,
    };
  }, [filter, options?.categories]);

  const queryParams = useMemo(() => {
    const params = buildTravelQueryParams(filterForQuery, {
      isMeTravel,
      isExport,
      isTravelBy,
      belarusId: BELARUS_ID,
      userId,
      routeUserId: user_id,
    });
    
    const cleaned: Record<string, any> = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        const value = params[key];
        // Пропускаем пустые значения
        if (value === undefined || value === null || value === '') {
          return;
        }
        if (Array.isArray(value) && value.length === 0) {
          return;
        }
        cleaned[key] = value;
      });
    
    return cleaned;
  }, [filterForQuery, isMeTravel, isExport, isTravelBy, userId, user_id]);

  const resetFilters = useCallback(() => {
    setFilter(INITIAL_FILTER);
  }, []);

  const onSelect = useCallback((field: string, value: any) => {
    setFilter((prev) => {
      // Если значение пустое, удаляем ключ из фильтра
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        const newFilter = { ...prev };
        delete newFilter[field as keyof FilterState];
        return newFilter;
      }
      const next = { ...prev, [field]: value };
      if (field === 'moderation' && value !== undefined && value !== null) {
        delete next.draftsOnly;
        delete next.publishedOnly;
      }
      if (field === 'draftsOnly' && value === true) {
        delete next.publishedOnly;
        delete next.moderation;
      }
      if (field === 'publishedOnly' && value === true) {
        delete next.draftsOnly;
        delete next.moderation;
      }
      return next;
    });
  }, []);

  const applyFilter = useCallback((newFilter: FilterState) => {
    const cleaned: FilterState = {};
    Object.entries(newFilter).forEach(([key, value]) => {
      if (key === 'year') {
        // Год должен быть строкой и не пустой
        if (value && typeof value === 'string' && value.trim() !== '') {
          cleaned[key as keyof FilterState] = value.trim() as any;
        }
        // Если год пустой или undefined, не добавляем его в cleaned (будет удален из состояния)
        return;
      }
      
      if (value === undefined || value === null || value === "") {
        // Не добавляем пустые значения
      } else if (Array.isArray(value) && value.length === 0) {
        // Не добавляем пустые массивы
      } else {
        cleaned[key as keyof FilterState] = value as any;
      }
    });
    setFilter(cleaned);
  }, []);

  const handleToggleCategory = useCallback((categoryName: string) => {
    const currentCategories = filter.categories || [];
    const categoryOption = options?.categories?.find((option) => option.name === categoryName);
    const categoryId = categoryOption ? Number(categoryOption.id) : null;
    const isSelected = currentCategories.some((category) => {
      if (category === categoryName) return true;
      if (categoryId === null || !Number.isFinite(categoryId)) return false;
      return Number(category) === categoryId;
    });
    const newCategories = isSelected
      ? currentCategories.filter((category): category is string | number => {
          if (category === categoryName) return false;
          if (categoryId === null || !Number.isFinite(categoryId)) return true;
          return Number(category) !== categoryId;
        })
      : [...currentCategories, categoryId !== null && Number.isFinite(categoryId) ? categoryId : categoryName];
    onSelect('categories', newCategories);
  }, [filter.categories, onSelect, options?.categories]);

  return {
    filter,
    queryParams,
    setFilter,
    resetFilters,
    onSelect,
    applyFilter,
    handleToggleCategory,
  };
}
