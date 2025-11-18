/**
 * Кастомный хук для управления фильтрами
 * Вынесена логика фильтров для переиспользования и тестирования
 */

import { useState, useCallback, useMemo } from 'react';
import type { FilterState, FilterOptions } from '../utils/listTravelTypes';
import { INITIAL_FILTER, BELARUS_ID } from '../utils/listTravelConstants';
import { buildTravelQueryParams } from '@/src/utils/filterQuery';

export interface UseListTravelFiltersProps {
  options?: FilterOptions;
  isMeTravel: boolean;
  isExport: boolean;
  isTravelBy: boolean;
  userId: string | null;
  user_id?: string;
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
}: UseListTravelFiltersProps): UseListTravelFiltersReturn {
  const [filter, setFilter] = useState<FilterState>(INITIAL_FILTER);

  // ✅ АРХИТЕКТУРА: Нормализация queryParams с useMemo
  const queryParams = useMemo(() => {
    return buildTravelQueryParams(filter, {
      isMeTravel,
      isExport,
      isTravelBy,
      belarusId: BELARUS_ID,
      userId,
      routeUserId: user_id,
    });
  }, [filter, isMeTravel, isExport, isTravelBy, userId, user_id]);

  // ✅ АРХИТЕКТУРА: Сброс фильтров
  const resetFilters = useCallback(() => {
    setFilter(INITIAL_FILTER);
  }, []);

  // ✅ АРХИТЕКТУРА: Обработчик выбора фильтра
  const onSelect = useCallback((field: string, value: any) => {
    setFilter((prev) => {
      // Если значение пустое, удаляем ключ из фильтра
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        const newFilter = { ...prev };
        delete newFilter[field as keyof FilterState];
        return newFilter;
      }
      return { ...prev, [field]: value };
    });
  }, []);

  // ✅ АРХИТЕКТУРА: Применение фильтров
  const applyFilter = useCallback((newFilter: FilterState) => {
    const cleaned: FilterState = {};
    Object.entries(newFilter).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        cleaned[key as keyof FilterState] = undefined;
      } else if (Array.isArray(value) && value.length === 0) {
        cleaned[key as keyof FilterState] = undefined;
      } else {
        cleaned[key as keyof FilterState] = value as any;
      }
    });
    setFilter(cleaned);
  }, []);

  // ✅ АРХИТЕКТУРА: Обработчик переключения категории
  const handleToggleCategory = useCallback((categoryName: string) => {
    const currentCategories = filter.categories || [];
    const newCategories = currentCategories.includes(categoryName)
      ? currentCategories.filter((c: string) => c !== categoryName)
      : [...currentCategories, categoryName];
    onSelect('categories', newCategories);
  }, [filter.categories, onSelect]);

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

