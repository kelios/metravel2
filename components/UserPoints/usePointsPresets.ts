import { useCallback, useMemo } from 'react';

import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { POINTS_PRESETS, type PointsPreset } from './pointsListLogic';

type Params = {
  activePresetId: string | null;
  setActivePresetId: (nextPresetId: string | null) => void;
  filtersCategoryIds: string[] | undefined;
  setFilters: React.Dispatch<React.SetStateAction<PointFiltersType>>;
  presetPrevCategoryIdsRef: React.MutableRefObject<string[] | null>;
  resolveCategoryIdsByNames: (names: string[]) => string[];
};

type Result = {
  activePreset: PointsPreset | null;
  handlePresetChange: (nextPresetId: string | null) => void;
};

export const usePointsPresets = ({
  activePresetId,
  setActivePresetId,
  filtersCategoryIds,
  setFilters,
  presetPrevCategoryIdsRef,
  resolveCategoryIdsByNames,
}: Params): Result => {
  const activePreset = useMemo(() => {
    if (!activePresetId) return null;
    return POINTS_PRESETS.find((p) => p.id === activePresetId) ?? null;
  }, [activePresetId]);

  const handlePresetChange = useCallback(
    (nextPresetId: string | null) => {
      setActivePresetId(nextPresetId);

      if (!nextPresetId) {
        const prev = presetPrevCategoryIdsRef.current;
        presetPrevCategoryIdsRef.current = null;
        if (prev) {
          setFilters((f) => ({ ...f, categoryIds: prev, page: 1 }));
        }
        return;
      }

      const preset = POINTS_PRESETS.find((p) => p.id === nextPresetId);
      if (!preset) return;

      presetPrevCategoryIdsRef.current = (filtersCategoryIds ?? []).slice();
      const baseIds = resolveCategoryIdsByNames(preset.baseCategoryNames);
      setFilters((f) => ({ ...f, categoryIds: baseIds, page: 1 }));
    },
    [filtersCategoryIds, presetPrevCategoryIdsRef, resolveCategoryIdsByNames, setActivePresetId, setFilters]
  );

  return { activePreset, handlePresetChange };
};
