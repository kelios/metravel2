import { useCallback, useState } from 'react';
import type React from 'react';

import type { PointFilters as PointFiltersType } from '@/types/userPoints';

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
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setFilters((prev) => ({ ...prev, search: text, page: 1 }));
  }, []);

  const handleFilterChange = useCallback((newFilters: PointFiltersType) => {
    setFilters((prev) => ({ ...newFilters, page: 1, perPage: prev.perPage ?? defaultPerPage }));
  }, [defaultPerPage]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilters((prev) => ({ page: 1, perPage: prev.perPage ?? 50, radiusKm: 100 }));
    setActivePresetId(null);
    presetPrevCategoryIdsRef.current = null;
    closeRecommendations();
    setActivePointId(null);
  }, [closeRecommendations, presetPrevCategoryIdsRef, setActivePointId, setActivePresetId]);

  return {
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    handleSearch,
    handleFilterChange,
    handleResetFilters,
  };
};
