import type { FiltersContextValue } from '@/contexts/FiltersContext';

export function makeFiltersContext(
  overrides: Partial<FiltersContextValue> = {}
): FiltersContextValue {
  return {
    filters: {
      categories: [],
      radius: [],
      address: '',
      ...(overrides.filters || {}),
    },
    filterValue: {
      categories: [],
      radius: '60',
      address: '',
      ...(overrides.filterValue || {}),
    },
    onFilterChange: jest.fn(),
    resetFilters: jest.fn(),
    travelsData: [],
    filteredTravelsData: [],
    isMobile: false,
    closeMenu: jest.fn(),
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    startAddress: '',
    endAddress: '',
    routeDistance: null,
    routePoints: [],
    onRemoveRoutePoint: jest.fn(),
    onClearRoute: jest.fn(),
    swapStartEnd: jest.fn(),
    routeHintDismissed: false,
    onRouteHintDismiss: jest.fn(),
    onAddressSelect: jest.fn(),
    onAddressClear: jest.fn(),
    routingLoading: false,
    routingError: null,
    onBuildRoute: jest.fn(),
    mapUiApi: null,
    userLocation: null,
    onPlaceSelect: jest.fn(),
    onOpenList: jest.fn(),
    hideTopControls: false,
    hideFooterCta: false,
    hideFooterReset: false,
    ...overrides,
  };
}

