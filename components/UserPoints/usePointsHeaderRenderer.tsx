import { useCallback } from 'react';
import { getPointsPresetLabel, POINTS_PRESETS } from './pointsListLogic';
import { PointsListHeader } from './PointsListHeader';
import type { PointsListStyles } from './types';

type Params = {
  styles: PointsListStyles;
  colors: { text: string; textMuted: string; textOnPrimary: string };
  isMobile: boolean;
  total: number;
  found: number;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  activeFilterChips: Array<{ key: string; label: string }>;
  onRemoveFilterChip: (key: string) => void;
  viewMode: 'list' | 'map';
  onViewModeChange: (mode: 'list' | 'map') => void;
  hideViewToggle?: boolean;
  canShowMapSettings: boolean;
  showMapSettings: boolean;
  onToggleMapSettings: () => void;
  showingRecommendations: boolean;
  onOpenActions: () => void;
  onOpenRecommendations: () => void;
  /** Поле поиска в шапке — только в отдельном режиме списка (#3134). */
  showSearch: boolean;
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
  isMobile,
  total,
  found,
  hasActiveFilters,
  onResetFilters,
  activeFilterChips,
  onRemoveFilterChip,
  viewMode,
  onViewModeChange,
  hideViewToggle,
  canShowMapSettings,
  showMapSettings,
  onToggleMapSettings,
  showingRecommendations,
  onOpenActions,
  onOpenRecommendations,
  showSearch,
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
        isMobile={isMobile}
        total={total}
        found={found}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        activeFilterChips={activeFilterChips}
        onRemoveFilterChip={onRemoveFilterChip}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        hideViewToggle={hideViewToggle}
        canShowMapSettings={canShowMapSettings}
        showMapSettings={showMapSettings}
        onToggleMapSettings={onToggleMapSettings}
        showingRecommendations={showingRecommendations}
        onOpenActions={onOpenActions}
        onOpenRecommendations={onOpenRecommendations}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearch={onSearch}
        filters={filters}
        onFilterChange={onFilterChange}
        presets={POINTS_PRESETS.map((preset) => ({
          id: preset.id,
          label: getPointsPresetLabel(preset),
        }))}
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
    hideViewToggle,
    isMobile,
    onFilterChange,
    onOpenActions,
    onOpenRecommendations,
    onPresetChange,
    onRemoveFilterChip,
    onResetFilters,
    onSearch,
    onToggleMapSettings,
    onViewModeChange,
    searchQuery,
    showSearch,
    showingRecommendations,
    canShowMapSettings,
    showMapSettings,
    siteCategoryOptions,
    styles,
    total,
    viewMode,
  ]);
};
