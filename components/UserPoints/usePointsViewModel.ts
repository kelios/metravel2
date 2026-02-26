import { useCallback, useMemo } from 'react';
import type { PointFilters } from '@/types/userPoints';
import { buildActiveFilterChips, computeHasActiveFilters } from './pointsFiltersMeta';
import { sortPointsByPresetProximity, type PointsPreset } from './pointsListLogic';

type Params = {
  filteredPoints: Record<string, unknown>[];
  showingRecommendations: boolean;
  recommendedPointIds: number[];
  activePreset: PointsPreset | null;
  resolveCategoryIdsByNames: (names: string[]) => string[];
  activePresetId: string | null;
  filters: PointFilters;
  searchQuery: string;
  categoryIdToName: Map<string, string>;
  statusLabels: Record<string, string>;
  openRecommendations: (points: Record<string, unknown>[]) => Promise<void>;
};

export const usePointsViewModel = ({
  filteredPoints,
  showingRecommendations,
  recommendedPointIds,
  activePreset,
  resolveCategoryIdsByNames,
  activePresetId,
  filters,
  searchQuery,
  categoryIdToName,
  statusLabels,
  openRecommendations,
}: Params) => {
  const visibleFilteredPoints = useMemo(() => {
    if (showingRecommendations && recommendedPointIds.length > 0) {
      const recommended = new Set(recommendedPointIds);
      return filteredPoints.filter((p) => recommended.has(Number(p.id)));
    }

    return sortPointsByPresetProximity(filteredPoints, activePreset, resolveCategoryIdsByNames);
  }, [activePreset, filteredPoints, recommendedPointIds, resolveCategoryIdsByNames, showingRecommendations]);

  const hasActiveFilters = useMemo(
    () => computeHasActiveFilters({ activePresetId, filters, searchQuery }),
    [activePresetId, filters, searchQuery]
  );

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        activePreset,
        categoryIdToName,
        filters,
        searchQuery,
        statusLabels,
      }),
    [activePreset, categoryIdToName, filters, searchQuery, statusLabels]
  );

  const handleOpenRecommendations = useCallback(
    async () => openRecommendations(filteredPoints),
    [filteredPoints, openRecommendations]
  );

  return {
    visibleFilteredPoints,
    hasActiveFilters,
    activeFilterChips,
    handleOpenRecommendations,
  };
};
