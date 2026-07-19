import { useCallback, useMemo } from 'react';

import { useRouteStore } from '@/stores/routeStore';
import { createCollator } from '@/i18n';
import type { TravelCoords } from '@/types/types';
import type { MapUiApi } from '@/types/mapUi';
import type { useMapFilters } from '@/hooks/map/useMapFilters';
import type { useMapOverlays } from '@/hooks/map/useMapOverlays';
import type { useRouteController } from '@/hooks/map/useRouteController';
import {
  FiltersPanelComponent,
  FiltersProviderComponent,
} from '@/hooks/map/mapFiltersPanelLoader';

// Сборка props панели фильтров (FiltersProvider pattern) из независимых
// memoized-слайсов. Извлечено из useMapScreenController без изменения поведения:
// слайсы, deps и итоговый contextValue идентичны исходным.

type FiltersPick = Pick<
  ReturnType<typeof useMapFilters>,
  'filters' | 'filterValues' | 'handleFilterChangeForPanel'
>;

type OverlaysPick = ReturnType<typeof useMapOverlays>;

type RoutePick = Pick<
  ReturnType<typeof useRouteController>,
  | 'mode'
  | 'setMode'
  | 'transportMode'
  | 'setTransportMode'
  | 'startAddress'
  | 'endAddress'
  | 'routeDistance'
  | 'routeDuration'
  | 'routeElevationGain'
  | 'routeElevationLoss'
  | 'routeStorePoints'
  | 'onRemoveRoutePoint'
  | 'handleClearRoute'
  | 'swapStartEnd'
  | 'handleAddressSelect'
  | 'handleAddressClear'
  | 'routingLoading'
  | 'routingError'
>;

interface UseMapFiltersPanelPropsParams extends FiltersPick, OverlaysPick, RoutePick {
  resetFilters: () => void;
  allTravelsData: TravelCoords[];
  travelsData: TravelCoords[];
  travelsCount: number;
  isMobile: boolean;
  mapUiApi: MapUiApi | null;
  closeRightPanel: () => void;
  userLocation: { latitude: number; longitude: number } | null | undefined;
  buildRouteToStable: (item: TravelCoords) => unknown;
  focusPlaceStable: (item: TravelCoords) => unknown;
  selectTravelsTab: () => void;
  loading: boolean;
  isFetching: boolean;
  isDebouncingFilters: boolean;
}

export function useMapFiltersPanelProps(params: UseMapFiltersPanelPropsParams) {
  const {
    filters,
    filterValues,
    handleFilterChangeForPanel,
    resetFilters,
    allTravelsData,
    overlayOptions,
    enabledOverlays,
    handleOverlayToggle,
    resetOverlays,
    mode,
    setMode,
    transportMode,
    setTransportMode,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    routeStorePoints,
    onRemoveRoutePoint,
    handleClearRoute,
    swapStartEnd,
    handleAddressSelect,
    handleAddressClear,
    routingLoading,
    routingError,
    travelsData,
    travelsCount,
    isMobile,
    mapUiApi,
    closeRightPanel,
    userLocation,
    buildRouteToStable,
    focusPlaceStable,
    selectTravelsTab,
    loading,
    isFetching,
    isDebouncingFilters,
  } = params;

  const categoryCollator = useMemo(() => createCollator(), []);

  const resolvedCategoryTravelAddressOptions = useMemo(() => {
    const apiOptions = Array.isArray(filters.categoryTravelAddress)
      ? filters.categoryTravelAddress
          .filter((c) => c && c.name)
          .map((c) => ({
            id: c.id,
            name: String(c.name || '').trim(),
          }))
          .filter((c) => c.name)
      : [];

    if (apiOptions.length > 0) return apiOptions;

    const fallbackNames = new Set<string>();
    (Array.isArray(allTravelsData) ? allTravelsData : []).forEach((travel) => {
      String(travel?.categoryName || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => fallbackNames.add(entry));
    });

    return Array.from(fallbackNames)
      .sort((a, b) => categoryCollator.compare(a, b))
      .map((name) => ({
        id: name,
        name,
      }));
  }, [allTravelsData, categoryCollator, filters.categoryTravelAddress]);

  // Filters panel props (FiltersProvider pattern).
  //
  // Stabilization: the FiltersProvider needs a single flat context object, but
  // rebuilding that whole object on every routing-state change cascaded invalidations
  // (mapComponent, mobile layout, helpers). We split it into independent memoized
  // slices with narrow deps — changing one slice (e.g. route metrics) no longer
  // reconstructs the others (filter values / overlay / list-actions). The final
  // flat `contextValue` is composed from those stable slices.

  // Slice 1 — filter option lists + selected values (changes only on filter edits).
  const filterOptionsSlice = useMemo(
    () => ({
      categories: filters.categories
        .filter((c) => c && c.name)
        .map((c) => ({ id: c.id, name: String(c.name || '').trim() }))
        .filter((c) => c.name),
      categoryTravelAddress: resolvedCategoryTravelAddressOptions,
      radius: filters.radius.map((r) => ({ id: r.id, name: r.name })),
      address: filters.address,
    }),
    [filters.categories, filters.radius, filters.address, resolvedCategoryTravelAddressOptions]
  );

  const filtersValuesSlice = useMemo(
    () => ({
      filters: filterOptionsSlice,
      filterValue: filterValues,
      onFilterChange: handleFilterChangeForPanel,
      resetFilters,
    }),
    [filterOptionsSlice, filterValues, handleFilterChangeForPanel, resetFilters]
  );

  // Slice 2 — overlay layer state (changes only on overlay toggles).
  const overlaySlice = useMemo(
    () => ({
      overlayOptions,
      enabledOverlays,
      onOverlayToggle: handleOverlayToggle,
      onResetOverlays: resetOverlays,
    }),
    [overlayOptions, enabledOverlays, handleOverlayToggle, resetOverlays]
  );

  const onBuildRoute = useCallback(() => {
    try {
      useRouteStore.getState().forceRebuild();
    } catch {
      // noop
    }
  }, []);

  // Slice 3 — routing state + actions (changes on route building / mode switches).
  const routingSlice = useMemo(
    () => ({
      mode,
      setMode,
      transportMode,
      setTransportMode,
      startAddress,
      endAddress,
      routeDistance,
      routeDuration,
      routeElevationGain,
      routeElevationLoss,
      routePoints: routeStorePoints,
      onRemoveRoutePoint,
      onClearRoute: handleClearRoute,
      swapStartEnd,
      routeHintDismissed: false,
      onAddressSelect: handleAddressSelect,
      onAddressClear: handleAddressClear,
      routingLoading,
      routingError,
      onBuildRoute,
    }),
    [
      mode,
      setMode,
      transportMode,
      setTransportMode,
      startAddress,
      endAddress,
      routeDistance,
      routeDuration,
      routeElevationGain,
      routeElevationLoss,
      routeStorePoints,
      onRemoveRoutePoint,
      handleClearRoute,
      swapStartEnd,
      handleAddressSelect,
      handleAddressClear,
      routingLoading,
      routingError,
      onBuildRoute,
    ]
  );

  // Slice 4 — list/data + map-api + panel actions (changes on data refresh / api ready).
  const listActionsSlice = useMemo(
    () => ({
      travelsData: allTravelsData,
      filteredTravelsData: travelsData,
      // Серверный счётчик результатов (учитывает where.query, BE #695) — для бейджа
      // «На карте подходит», чтобы он показывал полный total, а не длину загруженной
      // страницы (≤30).
      resultsTotal: travelsCount,
      isMobile,
      mapUiApi,
      closeMenu: closeRightPanel,
      userLocation,
      onPlaceSelect: buildRouteToStable,
      onPlaceFocus: focusPlaceStable,
      onOpenList: selectTravelsTab,
      // #211 — карта/список грузятся или фильтры дебаунсятся: не показывать
      // empty-state «Ничего не нашлось», пока идёт запрос (иначе мигает при
      // смене вкладок/режимов и при первичной загрузке).
      isBusy: loading || isFetching || isDebouncingFilters,
      hideTopControls: false,
      hideFooterCta: false,
      hideFooterReset: !isMobile,
    }),
    [
      allTravelsData,
      travelsData,
      travelsCount,
      isMobile,
      mapUiApi,
      closeRightPanel,
      userLocation,
      buildRouteToStable,
      focusPlaceStable,
      selectTravelsTab,
      loading,
      isFetching,
      isDebouncingFilters,
    ]
  );

  const filtersPanelProps = useMemo(() => {
    const contextValue = {
      ...filtersValuesSlice,
      ...overlaySlice,
      ...routingSlice,
      ...listActionsSlice,
    };

    return {
      Component: FiltersProviderComponent,
      contextValue,
      props: contextValue,
      Panel: FiltersPanelComponent,
    };
  }, [filtersValuesSlice, overlaySlice, routingSlice, listActionsSlice]);

  return { filtersValuesSlice, overlaySlice, routingSlice, filtersPanelProps };
}
