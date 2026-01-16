import { useMemo, useCallback, useEffect } from 'react';
import { Dimensions, LayoutAnimation } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { getFiltersPanelStyles } from '@/components/MapPage/filtersPanelStyles';
import type { RoutePoint } from '@/types/route';

type CategoryOption = string | { id?: string | number; name?: string; value?: string };

interface UseFiltersPanelModelProps {
  isMobile: boolean;
  filterValue: {
    categories: CategoryOption[];
    radius: string;
    address: string;
  };
  travelsData: { categoryName?: string }[];
  filteredTravelsData?: { categoryName?: string }[];
  mode: 'radius' | 'route';
  routePoints: RoutePoint[];
  routingLoading?: boolean;
  routeDistance: number | null;
  onClearRoute?: () => void;
  setMode: (m: 'radius' | 'route') => void;
  onRemoveRoutePoint?: (id: string) => void;
  resetFilters: () => void;
  closeMenu: () => void;
  routeHintDismissed: boolean;
  onRouteHintDismiss?: () => void;
}

const useFiltersPanelModel = ({
  isMobile,
  filterValue,
  travelsData,
  filteredTravelsData,
  mode,
  routePoints,
  routingLoading,
  routeDistance,
  onClearRoute,
  setMode,
  onRemoveRoutePoint,
  resetFilters,
  closeMenu,
  routeHintDismissed,
  onRouteHintDismiss,
}: UseFiltersPanelModelProps) => {
  const windowWidth = Dimensions.get('window').width;
  const colors = useThemedColors();
  const styles = useMemo(
    () => getFiltersPanelStyles(colors, isMobile, windowWidth) as any,
    [colors, isMobile, windowWidth]
  );

  const safeRemoveRoutePoint = useCallback(
    (id: string) => {
      if (typeof onRemoveRoutePoint !== 'function') return;
      onRemoveRoutePoint(id);
    },
    [onRemoveRoutePoint]
  );

  const safeResetFilters = useCallback(() => {
    if (typeof resetFilters !== 'function') return;
    resetFilters();
  }, [resetFilters]);

  const safeCloseMenu = useCallback(() => {
    if (typeof closeMenu !== 'function') return;
    closeMenu();
  }, [closeMenu]);

  const handleSetMode = useCallback(
    (nextMode: 'radius' | 'route') => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (nextMode === 'radius' && onClearRoute) {
        onClearRoute();
      }

      setMode(nextMode);
    },
    [setMode, onClearRoute]
  );

  const hasActiveFilters = useMemo(
    () => filterValue.categories.length > 0 || filterValue.radius !== '',
    [filterValue.categories.length, filterValue.radius]
  );

  const canBuildRoute = useMemo(
    () => (mode === 'route' ? routePoints.length >= 2 : true),
    [mode, routePoints.length]
  );

  const ctaLabel = routingLoading
    ? 'Строим…'
    : routeDistance != null
      ? 'Пересчитать маршрут'
      : canBuildRoute
        ? 'Построить маршрут'
        : 'Добавьте старт и финиш';

  const totalPoints = useMemo(() => {
    const dataset = filteredTravelsData ?? travelsData;
    return Array.isArray(dataset) ? dataset.length : 0;
  }, [filteredTravelsData, travelsData]);

  useEffect(() => {
    if (routeDistance != null && !routeHintDismissed && onRouteHintDismiss) {
      onRouteHintDismiss();
    }
  }, [routeDistance, routeHintDismissed, onRouteHintDismiss]);

  return {
    colors,
    styles,
    safeRemoveRoutePoint,
    safeResetFilters,
    safeCloseMenu,
    handleSetMode,
    hasActiveFilters,
    canBuildRoute,
    ctaLabel,
    totalPoints,
  };
};

export default useFiltersPanelModel;
