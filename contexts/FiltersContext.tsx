/**
 * Filters Context - centralized state management for FiltersPanel
 * @module contexts/FiltersContext
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { RoutePoint } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import type { MapUiApi } from '@/src/types/mapUi';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

/**
 * Filters context value type
 */
export interface FiltersContextValue {
  // Filters
  filters: {
    categories: CategoryOption[];
    radius: { id: string; name: string }[];
    address: string;
  };
  filterValue: {
    categories: CategoryOption[];
    radius: string;
    address: string;
  };
  onFilterChange: (field: string, value: any) => void;
  resetFilters: () => void;

  // Data
  travelsData: { categoryName?: string }[];
  filteredTravelsData?: { categoryName?: string }[];

  // UI
  isMobile: boolean;
  closeMenu: () => void;

  // Mode
  mode: 'radius' | 'route';
  setMode: (m: 'radius' | 'route') => void;

  // Transport
  transportMode: 'car' | 'bike' | 'foot';
  setTransportMode: (m: 'car' | 'bike' | 'foot') => void;

  // Route
  startAddress: string;
  endAddress: string;
  routeDistance: number | null;
  routeDuration: number | null;
  routePoints: RoutePoint[];
  onRemoveRoutePoint?: (id: string) => void;
  onClearRoute?: () => void;
  swapStartEnd?: () => void;

  // Route hints
  routeHintDismissed: boolean;
  onRouteHintDismiss?: () => void;

  // Address
  onAddressSelect?: (address: string, coords: LatLng, isStart: boolean) => void;
  onAddressClear?: (isStart: boolean) => void;

  // Routing state
  routingLoading: boolean;
  routingError?: string | boolean | null;
  onBuildRoute?: () => void;

  // Map API
  mapUiApi?: MapUiApi | null;
  userLocation?: { latitude: number; longitude: number } | null;

  // Actions
  onPlaceSelect?: (place: any) => void;
  onOpenList?: () => void;

  // Visibility flags
  hideTopControls: boolean;
  hideFooterCta: boolean;
  hideFooterReset: boolean;
}

/**
 * Filters context
 */
export const FiltersContext = createContext<FiltersContextValue | null>(null);

/**
 * Filters context provider props
 */
export interface FiltersProviderProps extends FiltersContextValue {
  children: ReactNode;
}

/**
 * Filters context provider
 *
 * Provides centralized state management for FiltersPanel and its children.
 * Eliminates prop drilling by making all filter-related state available via context.
 *
 * @example
 * ```typescript
 * <FiltersProvider
 *   filters={filters}
 *   filterValue={filterValue}
 *   onFilterChange={handleFilterChange}
 *   // ... other props
 * >
 *   <FiltersPanel />
 * </FiltersProvider>
 * ```
 */
export function FiltersProvider({ children, ...contextValue }: FiltersProviderProps) {
  return (
    <FiltersContext.Provider value={contextValue}>
      {children}
    </FiltersContext.Provider>
  );
}

/**
 * Hook to access filters context
 *
 * @throws Error if used outside FiltersProvider
 *
 * @example
 * ```typescript
 * function FilterComponent() {
 *   const { filters, filterValue, onFilterChange } = useFiltersContext();
 *   return <Select options={filters.categories} />;
 * }
 * ```
 */
export function useFiltersContext(): FiltersContextValue {
  const context = useContext(FiltersContext);

  if (!context) {
    throw new Error('useFiltersContext must be used within FiltersProvider');
  }

  return context;
}

/**
 * Optional hook - returns context if available, otherwise null
 *
 * Useful for components that can work both inside and outside FiltersProvider
 *
 * @example
 * ```typescript
 * function OptionalFilterComponent() {
 *   const context = useOptionalFiltersContext();
 *   if (!context) return null;
 *   return <FilterView filters={context.filters} />;
 * }
 * ```
 */
export function useOptionalFiltersContext(): FiltersContextValue | null {
  return useContext(FiltersContext);
}
