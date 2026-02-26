import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { pickRandomDistinct } from './pointsListLogic';

type PointLike = {
  id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type RouteInfo = { distance: number; duration: number; line?: Array<[number, number]> };

type Params = {
  setActivePointId: React.Dispatch<React.SetStateAction<number | null>>;
};

type Result = {
  currentLocation: { lat: number; lng: number } | null;
  isLocating: boolean;
  recommendedPointIds: number[];
  showingRecommendations: boolean;
  recommendedRoutes: Record<number, RouteInfo>;
  handleLocateMe: () => Promise<void>;
  handleOpenRecommendations: (points: PointLike[]) => Promise<void>;
  handleCloseRecommendations: () => void;
};

export const usePointsRecommendations = ({ setActivePointId }: Params): Result => {
  const [recommendedPointIds, setRecommendedPointIds] = useState<number[]>([]);
  const [showingRecommendations, setShowingRecommendations] = useState(false);
  const [recommendedRoutes, setRecommendedRoutes] = useState<Record<number, RouteInfo>>({});
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const recommendationsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      recommendationsAbortRef.current?.abort();
      recommendationsAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          if (typeof navigator === 'undefined' || !navigator.geolocation) return;

          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });

          setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          return;
        }

        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const pos = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // user can still browse points without location
      }
    };

    requestLocation();
  }, []);

  const handleCloseRecommendations = useCallback(() => {
    setShowingRecommendations(false);
    setRecommendedPointIds([]);
    setRecommendedRoutes({});
  }, []);

  const handleOpenRecommendations = useCallback(async (points: PointLike[]) => {
    recommendationsAbortRef.current?.abort();
    const controller = new AbortController();
    recommendationsAbortRef.current = controller;

    const recommended = pickRandomDistinct(points, 3);
    const recommendedIds = recommended
      .map((p) => Number(p.id))
      .filter((id) => Number.isFinite(id));

    setRecommendedPointIds(recommendedIds);
    setShowingRecommendations(true);

    let loc = currentLocation;
    if (!loc) {
      try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            });
          });
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
        }
      } catch {
        // noop
      }
    }

    if (controller.signal.aborted) return;
    if (!loc || recommended.length === 0) return;

    const routes: Record<number, RouteInfo> = {};
    for (const point of recommended) {
      try {
        const toLng = Number(point?.longitude);
        const toLat = Number(point?.latitude);
        const pointId = Number(point?.id);
        if (!Number.isFinite(toLng) || !Number.isFinite(toLat) || !Number.isFinite(pointId)) continue;

        const url = `https://router.project-osrm.org/route/v1/driving/${loc.lng},${loc.lat};${toLng},${toLat}?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: controller.signal });
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
        if (controller.signal.aborted) return;
        console.warn('Failed to calculate route for point', point?.id, error);
      }
    }

    if (controller.signal.aborted) return;
    setRecommendedRoutes(routes);
    setActivePointId(null);
  }, [currentLocation, setActivePointId]);

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          });
        });
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        return;
      }

      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm?.granted) return;
      const pos = await Location.getCurrentPositionAsync({});
      setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      // noop
    } finally {
      setIsLocating(false);
    }
  }, []);

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
