import { useEffect, useRef, useCallback } from 'react';
import { useRouteStore } from '@/stores/routeStore';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { RouteValidator } from '@/utils/routeValidator';
import type { LatLng } from '@/types/coordinates';
import type { RouteData, TransportMode } from '@/types/route';

interface RouteResult {
  coords: LatLng[];
  distance: number;
  duration: number;
  isOptimal: boolean;
}

const getORSProfile = (mode: TransportMode) => {
  switch (mode) {
    case 'bike':
      return 'cycling-regular';
    case 'foot':
      return 'foot-walking';
    default:
      return 'driving-car';
  }
};

const getOSRMProfile = (mode: TransportMode) => {
  switch (mode) {
    case 'bike':
      return 'bike';
    case 'foot':
      return 'foot';
    default:
      return 'driving';
  }
};

/**
 * Hook for building routes using external routing services
 */
export function useRouteBuilding(ORS_API_KEY?: string) {
  const {
    points,
    transportMode,
    setRoute,
    setBuilding,
    setError,
  } = useRouteStore();

  const abortRef = useRef<AbortController | null>(null);
  const lastRouteKeyRef = useRef<string | null>(null);

  const fetchORS = useCallback(
    async (
      points: LatLng[],
      mode: TransportMode,
      signal: AbortSignal
    ): Promise<RouteResult> => {
      // ORS expects [lng, lat] format
      const coordinates = points.map(p => [p.lng, p.lat]);

      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/${getORSProfile(mode)}/geojson`,
        {
          method: 'POST',
          headers: {
            Authorization: String(ORS_API_KEY),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ coordinates }),
          signal,
        }
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 429)
          throw new Error('Превышен лимит запросов. Подождите немного.');
        if (res.status === 403)
          throw new Error('Неверный API ключ или доступ запрещен.');
        if (res.status === 400)
          throw new Error('Некорректные координаты маршрута.');
        throw new Error(
          `Ошибка ORS: ${res.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const data = await res.json();
      const feature = data.features?.[0];
      const geometry = feature?.geometry;
      const summary = feature?.properties?.summary;

      if (!geometry?.coordinates?.length)
        throw new Error('Пустой маршрут от ORS');

      // Convert [lng, lat] back to LatLng
      const coords: LatLng[] = geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ lat, lng })
      );

      return {
        coords,
        distance: summary?.distance || 0,
        duration: summary?.duration || 0,
        isOptimal: true,
      };
    },
    [ORS_API_KEY]
  );

  const fetchOSRM = useCallback(
    async (
      points: LatLng[],
      mode: TransportMode,
      signal: AbortSignal
    ): Promise<RouteResult> => {
      const profile = getOSRMProfile(mode);
      // OSRM expects lng,lat format
      const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson`;

      const res = await fetch(url, { signal });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 429)
          throw new Error('Превышен лимит запросов. Подождите немного.');
        if (res.status === 400)
          throw new Error('Некорректные координаты маршрута.');
        throw new Error(
          `Ошибка OSRM: ${res.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const data = await res.json();
      const route = data.routes?.[0];

      if (!route?.geometry?.coordinates?.length)
        throw new Error('Пустой маршрут от OSRM');

      // Convert [lng, lat] back to LatLng
      const coords: LatLng[] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ lat, lng })
      );

      return {
        coords,
        distance: route.distance || 0,
        duration: route.duration || 0,
        isOptimal: true,
      };
    },
    []
  );

  const buildRoute = useCallback(async () => {
    // Validate points
    const validation = RouteValidator.validate(points);
    if (!validation.valid) {
      setError(RouteValidator.getErrorMessage(validation));
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Route warnings:', validation.warnings);
    }

    // Generate route key for deduplication
    const routeKey = `${transportMode}-${points.map(p => CoordinateConverter.toString(p.coordinates)).join('|')}`;

    // Skip if already processing this exact route
    if (lastRouteKeyRef.current === routeKey) {
      return;
    }

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const abortController = new AbortController();
    abortRef.current = abortController;
    lastRouteKeyRef.current = routeKey;

    setBuilding(true);
    setError(null);

    try {
      const pointCoords = points.map(p => p.coordinates);
      let result: RouteResult;

      try {
        // Try primary service
        result = ORS_API_KEY
          ? await fetchORS(pointCoords, transportMode, abortController.signal)
          : await fetchOSRM(pointCoords, transportMode, abortController.signal);
      } catch (primaryError: any) {
        if (primaryError?.name === 'AbortError') throw primaryError;

        // Try fallback
        if (ORS_API_KEY) {
          try {
            result = await fetchOSRM(
              pointCoords,
              transportMode,
              abortController.signal
            );
          } catch (fallbackError: any) {
            if (fallbackError?.name === 'AbortError') throw fallbackError;

            // Use direct line as last resort
            const distance = CoordinateConverter.pathDistance(pointCoords);
            result = {
              coords: pointCoords,
              distance,
              duration: 0,
              isOptimal: false,
            };

            setError(
              'Используется прямая линия (сервисы маршрутизации недоступны)'
            );
          }
        } else {
          throw primaryError;
        }
      }

      // Set route in store
      const routeData: RouteData = {
        coordinates: result.coords,
        distance: result.distance,
        duration: result.duration,
        isOptimal: result.isOptimal,
      };

      setRoute(routeData);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;

      const errorMessage = error?.message || 'Не удалось построить маршрут';
      setError(errorMessage);

      // Fallback to direct line
      const pointCoords = points.map(p => p.coordinates);
      const distance = CoordinateConverter.pathDistance(pointCoords);
      setRoute({
        coordinates: pointCoords,
        distance,
        duration: 0,
        isOptimal: false,
        error: errorMessage,
      });
    }
  }, [points, transportMode, ORS_API_KEY, fetchORS, fetchOSRM, setRoute, setBuilding, setError]);

  // Auto-build route when points change
  useEffect(() => {
    if (points.length >= 2) {
      buildRoute();
    } else {
      setRoute(null);
      setError(null);
      lastRouteKeyRef.current = null;
    }

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [points, transportMode, buildRoute, setRoute, setError]);

  return {
    buildRoute,
  };
}
