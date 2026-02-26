import { useCallback } from 'react';
import { POINTS_PRESETS } from './pointsListLogic';
import { PointsListHeader } from './PointsListHeader';
import type { PointsListStyles } from './PointsList';

type Params = {
  styles: PointsListStyles;
  colors: { text: string; textMuted: string; textOnPrimary: string };
  isNarrow: boolean;
  isMobile: boolean;
  total: number;
  found: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  activeFilterChips: Array<{ key: string; label: string }>;
  onRemoveFilterChip: (key: string) => void;
  viewMode: 'list' | 'map';
  showFilters: boolean;
  onToggleFilters: () => void;
  showMapSettings: boolean;
  onToggleMapSettings: () => void;
  onOpenActions: () => void;
  onOpenRecommendations: () => void;
  searchQuery: string;
  onSearch: (value: string) => void;
  filters: any;
  onFilterChange: (next: any) => void;
  activePresetId: string | null;
  onPresetChange: (id: string | null) => void;
  siteCategoryOptions: Array<{ id: string; name: string }>;
  availableColors: string[];
};

export const usePointsHeaderRenderer = ({
  styles,
  colors,
  isNarrow,
  isMobile,
  total,
  found,
  hasActiveFilters,
  onResetFilters,
  activeFilterChips,
  onRemoveFilterChip,
  viewMode,
  showFilters,
  onToggleFilters,
  showMapSettings,
  onToggleMapSettings,
  onOpenActions,
  onOpenRecommendations,
  searchQuery,
  onSearch,
  filters,
  onFilterChange,
  activePresetId,
  onPresetChange,
  siteCategoryOptions,
  availableColors,
}: Params) => {
  return useCallback(() => {
    return (
      <PointsListHeader
        styles={styles}
        colors={colors}
        isNarrow={isNarrow}
        isMobile={isMobile}
        total={total}
        found={found}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        activeFilterChips={activeFilterChips}
        onRemoveFilterChip={onRemoveFilterChip}
        viewMode={viewMode}
        onViewModeChange={() => {}}
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        showMapSettings={showMapSettings}
        onToggleMapSettings={onToggleMapSettings}
        onOpenActions={onOpenActions}
        onOpenRecommendations={onOpenRecommendations}
        searchQuery={searchQuery}
        onSearch={onSearch}
        filters={filters}
        onFilterChange={onFilterChange}
        presets={POINTS_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        activePresetId={activePresetId}
        onPresetChange={onPresetChange}
        siteCategoryOptions={siteCategoryOptions}
        availableColors={availableColors}
      />
    );
  }, [
    activeFilterChips,
    activePresetId,
    availableColors,
    colors,
    filters,
    found,
    hasActiveFilters,
    isMobile,
    isNarrow,
    onFilterChange,
    onOpenActions,
    onOpenRecommendations,
    onPresetChange,
    onRemoveFilterChip,
    onResetFilters,
    onSearch,
    onToggleFilters,
    onToggleMapSettings,
    searchQuery,
    showFilters,
    showMapSettings,
    siteCategoryOptions,
    styles,
    total,
    viewMode,
  ]);
};
