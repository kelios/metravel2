import React, { memo } from 'react';
import { View } from 'react-native';
import ModernFilters from './ModernFilters';
import type { FilterGroup } from './ModernFilters';
import type { FilterState } from './ModernFilters';

const SIDEBAR_STYLE = { width: 280, flex: 1 } as const;

interface TravelSidebarProps {
  filterGroups: FilterGroup[];
  filter: FilterState;
  total: number;
  isSuper: boolean;
  onFilterChange: (groupKey: string, optionId: string) => void;
  onClearAll: () => void;
  onYearChange: (value?: string) => void;
  onToggleModeration: () => void;
}

const TravelSidebar: React.FC<TravelSidebarProps> = ({
  filterGroups,
  filter,
  total,
  isSuper,
  onFilterChange,
  onClearAll,
  onYearChange,
  onToggleModeration,
}) => {
  return (
    <View style={SIDEBAR_STYLE}>
      <ModernFilters
        filterGroups={filterGroups}
        selectedFilters={filter as any}
        onFilterChange={onFilterChange}
        onClearAll={onClearAll}
        resultsCount={total}
        year={filter.year}
        onYearChange={onYearChange}
        showModeration={isSuper}
        moderationValue={filter.moderation}
        onToggleModeration={onToggleModeration}
      />
    </View>
  );
};

export default memo(TravelSidebar);
