// components/MapPage/OptimizedMap.web.tsx
// Wrapper component for Map.web.tsx with optimized props handling
import React from 'react';
import MapPageComponent from './Map.web';

type Point = {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

type TransportMode = 'car' | 'bike' | 'foot';
type MapMode = 'radius' | 'route';

interface OptimizedMapProps {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  routePoints: [number, number][];
  setRoutePoints: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setRouteDuration?: (durationSeconds: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  placesAlongRoute?: any[]; // For compatibility, not used in Map.web
  onMapUiApiReady?: (api: any | null) => void;
}

const OptimizedMap: React.FC<OptimizedMapProps> = ({
  travel,
  coordinates,
  routePoints,
  setRoutePoints,
  onMapClick,
  mode,
  transportMode,
  setRouteDistance,
  setRouteDuration,
  setFullRouteCoords,
  placesAlongRoute: _placesAlongRoute, // Accepted but not passed to Map.web
  onMapUiApiReady,
}) => {
  return (
    <MapPageComponent
      travel={travel}
      coordinates={coordinates}
      routePoints={routePoints}
      setRoutePoints={setRoutePoints}
      onMapClick={onMapClick}
      mode={mode}
      transportMode={transportMode}
      setRouteDistance={setRouteDistance}
      setRouteDuration={setRouteDuration}
      setFullRouteCoords={setFullRouteCoords}
      onMapUiApiReady={onMapUiApiReady}
    />
  );
};

// Кастомный компаратор для оптимизации - перерисовываем только при изменении ключевых пропсов
const arePropsEqual = (
  prevProps: OptimizedMapProps,
  nextProps: OptimizedMapProps
): boolean => {
  // Сравниваем координаты с учетом точности (избегаем лишних перерисовок из-за микроизменений)
  const COORD_EPSILON = 0.0001;
  if (
    Math.abs(prevProps.coordinates.latitude - nextProps.coordinates.latitude) > COORD_EPSILON ||
    Math.abs(prevProps.coordinates.longitude - nextProps.coordinates.longitude) > COORD_EPSILON
  ) {
    return false;
  }

  // Сравниваем режим и транспорт
  if (prevProps.mode !== nextProps.mode || prevProps.transportMode !== nextProps.transportMode) {
    return false;
  }

  // Сравниваем точки маршрута
  if (prevProps.routePoints.length !== nextProps.routePoints.length) {
    return false;
  }
  // ✅ ИСПРАВЛЕНИЕ: Более точное сравнение с учетом точности координат
  if (
    !prevProps.routePoints.every(
      (point, i) => {
        const nextPoint = nextProps.routePoints[i];
        if (!nextPoint) return false;
        return (
          Math.abs(point[0] - nextPoint[0]) < COORD_EPSILON &&
          Math.abs(point[1] - nextPoint[1]) < COORD_EPSILON
        );
      }
    )
  ) {
    return false;
  }

  // Сравниваем данные путешествий
  const prevData = prevProps.travel?.data || [];
  const nextData = nextProps.travel?.data || [];
  if (prevData.length !== nextData.length) {
    return false;
  }
  // ✅ ИСПРАВЛЕНИЕ: Более надежное сравнение с проверкой всех ключевых полей
  if (
    !prevData.every(
      (p, i) => {
        const nextPoint = nextData[i];
        if (!nextPoint) return false;
        return (
          p.id === nextPoint.id &&
          p.coord === nextPoint.coord &&
          p.address === nextPoint.address
        );
      }
    )
  ) {
    return false;
  }

  return true;
};

export default React.memo(OptimizedMap, arePropsEqual);
