import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { pickRandomDistinct } from './pointsListLogic';
import { osrmRoute } from '@/api/external/osrm';

type PointLike = {
  id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type RouteInfo = { distance: number; duration: number; line?: Array<[number, number]> };

type LatLng = { lat: number; lng: number };

type Params = {
  setActivePointId: React.Dispatch<React.SetStateAction<number | null>>;
};

type Result = {
  currentLocation: LatLng | null;
  isLocating: boolean;
  recommendedPointIds: number[];
  showingRecommendations: boolean;
  recommendedRoutes: Record<number, RouteInfo>;
  handleLocateMe: () => Promise<void>;
  handleOpenRecommendations: (points: PointLike[]) => Promise<void>;
  handleCloseRecommendations: () => void;
};

/**
 * PERM-3: геолокация запрашивается ТОЛЬКО по действию пользователя («моё
 * местоположение» или открытие рекомендаций), а не при монтировании экрана:
 * на web запрос high-accuracy при загрузке страницы открывал системный промпт
 * без контекста. Отказ/недоступность → `null`, вызывающий показывает CTA.
 */
async function requestCurrentLocation(): Promise<LatLng | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }

    const Location = await import('expo-location');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm?.granted) return null;
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // user can still browse points without location
    return null;
  }
}

async function loadRoutes(
  points: PointLike[],
  from: LatLng,
  signal: AbortSignal,
): Promise<Record<number, RouteInfo> | null> {
  const routes: Record<number, RouteInfo> = {};
  for (const point of points) {
    try {
      const toLng = Number(point?.longitude);
      const toLat = Number(point?.latitude);
      const pointId = Number(point?.id);
      if (!Number.isFinite(toLng) || !Number.isFinite(toLat) || !Number.isFinite(pointId)) continue;

      const response = await osrmRoute(
        {
          coords: [[from.lng, from.lat], [toLng, toLat]],
          overview: 'full',
          geometries: 'geojson',
        },
        { signal },
      );
      const data = await response.json();

      if (data?.code === 'Ok' && Array.isArray(data?.routes) && data.routes[0]) {
        const route = data.routes[0];
        const coords = route?.geometry?.coordinates;
        const line = Array.isArray(coords)
          ? coords
              .map((c: unknown) => {
                const pair = Array.isArray(c) ? c : [];
                const lng = Number(pair[0]);
                const lat = Number(pair[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return [lat, lng] as [number, number];
              })
              .filter((v: [number, number] | null): v is [number, number] => v != null)
          : undefined;

        routes[pointId] = {
          distance: Math.round(Number(route.distance) / 1000),
          duration: Math.round(Number(route.duration) / 60),
          line,
        };
      }
    } catch (error) {
      if (signal.aborted) return null;
      console.warn('Failed to calculate route for point', point?.id, error);
    }
  }
  return signal.aborted ? null : routes;
}

export const usePointsRecommendations = ({ setActivePointId }: Params): Result => {
  const [recommendedPointIds, setRecommendedPointIds] = useState<number[]>([]);
  const [showingRecommendations, setShowingRecommendations] = useState(false);
  const [recommendedRoutes, setRecommendedRoutes] = useState<Record<number, RouteInfo>>({});
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const recommendationsAbortRef = useRef<AbortController | null>(null);
  // Текущая тройка рекомендаций: «моё местоположение» при открытых
  // рекомендациях дорисовывает маршруты к ней, не перевыбирая точки.
  const recommendedPointsRef = useRef<PointLike[]>([]);

  useEffect(() => {
    return () => {
      recommendationsAbortRef.current?.abort();
      recommendationsAbortRef.current = null;
    };
  }, []);

  const startRouteRequest = useCallback(() => {
    recommendationsAbortRef.current?.abort();
    const controller = new AbortController();
    recommendationsAbortRef.current = controller;
    return controller;
  }, []);

  const applyRoutes = useCallback(
    async (points: PointLike[], from: LatLng, controller: AbortController) => {
      const routes = await loadRoutes(points, from, controller.signal);
      if (!routes || controller.signal.aborted) return false;
      setRecommendedRoutes(routes);
      return true;
    },
    [],
  );

  const handleCloseRecommendations = useCallback(() => {
    recommendationsAbortRef.current?.abort();
    recommendedPointsRef.current = [];
    setShowingRecommendations(false);
    setRecommendedPointIds([]);
    setRecommendedRoutes({});
  }, []);

  const handleOpenRecommendations = useCallback(async (points: PointLike[]) => {
    const controller = startRouteRequest();

    const recommended = pickRandomDistinct(points, 3);
    const recommendedIds = recommended
      .map((p) => Number(p.id))
      .filter((id) => Number.isFinite(id));

    recommendedPointsRef.current = recommended;
    setRecommendedPointIds(recommendedIds);
    setRecommendedRoutes({});
    setShowingRecommendations(true);

    let loc = currentLocation;
    if (!loc) {
      // Действие пользователя — единственный повод спросить геолокацию.
      loc = await requestCurrentLocation();
      if (loc) setCurrentLocation(loc);
    }

    if (controller.signal.aborted) return;
    if (!loc || recommended.length === 0) return;

    if (await applyRoutes(recommended, loc, controller)) setActivePointId(null);
  }, [applyRoutes, currentLocation, setActivePointId, startRouteRequest]);

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    try {
      const loc = await requestCurrentLocation();
      if (!loc) return;
      setCurrentLocation(loc);
      const pending = recommendedPointsRef.current;
      if (pending.length > 0) {
        await applyRoutes(pending, loc, startRouteRequest());
      }
    } finally {
      setIsLocating(false);
    }
  }, [applyRoutes, startRouteRequest]);

  return {
    currentLocation,
    isLocating,
    recommendedPointIds,
    showingRecommendations,
    recommendedRoutes,
    handleLocateMe,
    handleOpenRecommendations,
    handleCloseRecommendations,
  };
};
