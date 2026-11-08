import { useCallback, useState } from 'react';
import type React from 'react';

import type { PointFilters as PointFiltersType } from '@/types/userPoints';

import { usePointsSearch } from './usePointsSearch';

type Params = {
  defaultPerPage: number;
  setActivePresetId: React.Dispatch<React.SetStateAction<string | null>>;
  presetPrevCategoryIdsRef: React.MutableRefObject<string[] | null>;
  closeRecommendations: () => void;
  setActivePointId: React.Dispatch<React.SetStateAction<number | null>>;
};

export const usePointsFiltersController = ({
  defaultPerPage,
  setActivePresetId,
  presetPrevCategoryIdsRef,
  closeRecommendations,
  setActivePointId,
}: Params) => {
  const [filters, setFilters] = useState<PointFiltersType>({ page: 1, perPage: defaultPerPage, radiusKm: 100 });
  // #3132: один источник запроса. Раньше текст писался и сюда, и в
  // `filters.search` — два стейта на каждую букву, а в запрос к API поле не уходило.
  const { searchQuery, appliedSearchQuery, setSearchQuery } = usePointsSearch();

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, [setSearchQuery]);

  const handleFilterChange = useCallback((newFilters: PointFiltersType) => {
    setFilters((prev) => ({ ...newFilters, page: 1, perPage: prev.perPage ?? defaultPerPage }));
  }, [defaultPerPage]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters((prev) => ({ page: 1, perPage: prev.perPage ?? defaultPerPage, radiusKm: 100 }));
    setActivePresetId(null);
    presetPrevCategoryIdsRef.current = null;
    closeRecommendations();
    setActivePointId(null);
  }, [closeRecommendations, defaultPerPage, presetPrevCategoryIdsRef, setActivePointId, setActivePresetId, setSearchQuery]);

  return {
    filters,
    setFilters,
    searchQuery,
    appliedSearchQuery,
    setSearchQuery,
    handleSearch,
    handleFilterChange,
    handleResetFilters,
  };
};
