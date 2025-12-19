import React from 'react';
import type { TravelFilters } from '@/src/types/types';

interface FiltersComponentProps {
  filters: TravelFilters | null;
  filterValue: any;
  onSelectedItemsChange: (field: string, items: any[]) => void;
  handleApplyFilters: () => void;
  resetFilters: () => void;
  isSuperuser?: boolean;
  isCompact?: boolean;
  disableApplyOnMobileClose?: boolean;
  closeMenu?: () => void;
}

/**
 * Temporary placeholder to satisfy type-checking where the legacy FiltersComponent
 * is referenced. If needed, replace with actual implementation.
 */
const FiltersComponent: React.FC<FiltersComponentProps> = () => null;

export default FiltersComponent;
