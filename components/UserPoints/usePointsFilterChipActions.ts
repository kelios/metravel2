import { useCallback, useEffect } from 'react';
import type React from 'react';

import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { PointStatus } from '@/types/userPoints';

type CategoryOption = { id: string };

type Params = {
  availableCategoryOptions: CategoryOption[];
  filters: PointFiltersType;
  setFilters: React.Dispatch<React.SetStateAction<PointFiltersType>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handlePresetChange: (presetId: string | null) => void;
};

export const usePointsFilterChipActions = ({
  availableCategoryOptions,
  filters,
  setFilters,
  setSearchQuery,
  handlePresetChange,
}: Params) => {
  useEffect(() => {
    const selected = filters.categoryIds ?? [];
    if (!selected.length) return;
    const available = new Set(availableCategoryOptions.map((c) => c.id));
    const next = selected.filter((c) => available.has(c));
    if (next.length === selected.length) return;
    setFilters((prev) => ({ ...prev, categoryIds: next, page: 1 }));
  }, [availableCategoryOptions, filters.categoryIds, setFilters]);

  const handleRemoveFilterChip = useCallback((key: string) => {
    if (key === 'preset') {
      handlePresetChange(null);
      return;
    }

    if (key === 'search') {
      setSearchQuery('');
      setFilters((prev) => ({ ...prev, search: '', page: 1 }));
      return;
    }

    if (key === 'radius') {
      setFilters((prev) => ({ ...prev, radiusKm: 100, page: 1 }));
      return;
    }

    if (key.startsWith('status-')) {
      const status = key.replace('status-', '') as PointStatus;
      const next = (filters.statuses ?? []).filter((s) => s !== status);
      setFilters((prev) => ({ ...prev, statuses: next, page: 1 }));
      return;
    }

    if (key.startsWith('category-')) {
      const category = key.replace('category-', '');
      const next = (filters.categoryIds ?? []).filter((c) => c !== category);
      setFilters((prev) => ({ ...prev, categoryIds: next, page: 1 }));
      return;
    }

    if (key.startsWith('color-')) {
      const color = key.replace('color-', '');
      const next = (filters.colors ?? []).filter((c) => c !== color);
      setFilters((prev) => ({ ...prev, colors: next, page: 1 }));
    }
  }, [filters.categoryIds, filters.colors, filters.statuses, handlePresetChange, setFilters, setSearchQuery]);

  return { handleRemoveFilterChip };
};
