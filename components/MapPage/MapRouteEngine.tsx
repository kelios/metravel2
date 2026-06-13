// components/MapPage/MapRouteEngine.tsx
// Headless-движок маршрутизации для native: на web маршрут строит RoutingMachine
// внутри Map.web (react-leaflet), а на native карта — WebView+Leaflet без движка ORS,
// поэтому fullRouteCoords оставался пустым и маршрут не рисовался (#111/F-34).
// Этот компонент монтируется ТОЛЬКО в native-ветке MapPanel, считает геометрию
// маршрута через общий useMapRouting и прокидывает её в стор теми же сеттерами,
// что и web-ветка. Ничего не рендерит.
import { useCallback } from 'react';
import { useMapRouting, type UseMapRoutingResult } from '@/components/map-core';
import type { TransportMode } from '@/components/map-core/types';

interface MapRouteEngineProps {
  routePoints: [number, number][];
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setRouteDuration?: (durationSeconds: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  setRouteElevationStats?: (gainMeters: number | null, lossMeters: number | null) => void;
  setRoutingLoading?: (loading: boolean) => void;
  setRoutingError?: (error: string | null) => void;
}

const MapRouteEngine: React.FC<MapRouteEngineProps> = ({
  routePoints,
  transportMode,
  setRouteDistance,
  setRouteDuration,
  setFullRouteCoords,
  setRouteElevationStats,
  setRoutingLoading,
  setRoutingError,
}) => {
  const handleRouteChange = useCallback(
    (result: UseMapRoutingResult) => {
      setFullRouteCoords(result.coords);
      setRouteDistance(result.distance);
      setRouteDuration?.(result.duration);
      setRouteElevationStats?.(result.elevationGain, result.elevationLoss);
      setRoutingLoading?.(result.loading);
      setRoutingError?.(result.error);
    },
    [
      setFullRouteCoords,
      setRouteDistance,
      setRouteDuration,
      setRouteElevationStats,
      setRoutingLoading,
      setRoutingError,
    ],
  );

  useMapRouting(
    {
      routePoints,
      transportMode,
      apiKey: process.env.EXPO_PUBLIC_ORS_API_KEY,
    },
    handleRouteChange,
  );

  return null;
};

export default MapRouteEngine;
