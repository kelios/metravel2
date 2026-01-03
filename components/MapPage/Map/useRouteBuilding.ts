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
  // Публичный OSRM (router.project-osrm.org) поддерживает только 'driving'
  switch (mode) {
    case 'bike':
      return 'cycling'; // Не поддерживается публичным OSRM
    case 'foot':
      return 'walking'; // Не поддерживается публичным OSRM
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

  // Бесплатный routing через Valhalla для bike/foot
  const fetchValhalla = useCallback(
    async (
      points: LatLng[],
      mode: TransportMode,
      signal: AbortSignal
    ): Promise<RouteResult> => {
      const costingMode = mode === 'bike' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'auto';

      const locations = points.map(p => ({ lon: p.lng, lat: p.lat }));

      const requestBody = {
        locations,
        costing: costingMode,
        directions_options: { units: 'kilometers' }
      };

      const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(requestBody))}`;

      const res = await fetch(url, { signal });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 429)
          throw new Error('Превышен лимит запросов. Подождите немного.');
        if (res.status === 400)
          throw new Error('Некорректные координаты маршрута.');
        throw new Error(
          `Ошибка Valhalla: ${res.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const data = await res.json();
      const trip = data.trip;

      if (!trip?.legs?.length)
        throw new Error('Пустой маршрут от Valhalla');

      // Декодируем polyline6 (Valhalla использует precision 6)
      const decodePolyline6 = (encoded: string): LatLng[] => {
        const coords: LatLng[] = [];
        let index = 0, lat = 0, lng = 0;

        while (index < encoded.length) {
          let shift = 0, result = 0, byte: number;
          do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
          } while (byte >= 0x20);
          lat += (result & 1) ? ~(result >> 1) : (result >> 1);

          shift = 0;
          result = 0;
          do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
          } while (byte >= 0x20);
          lng += (result & 1) ? ~(result >> 1) : (result >> 1);

          coords.push({ lat: lat / 1e6, lng: lng / 1e6 });
        }
        return coords;
      };

      const allCoords: LatLng[] = [];
      for (const leg of trip.legs) {
        if (leg.shape) {
          allCoords.push(...decodePolyline6(leg.shape));
        }
      }

      if (allCoords.length === 0)
        throw new Error('Пустой маршрут от Valhalla');

      const distanceKm = trip.summary?.length || 0;
      const durationSec = trip.summary?.time || 0;

      return {
        coords: allCoords,
        distance: distanceKm * 1000,
        duration: durationSec,
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
        // Try primary service based on transport mode
        if (ORS_API_KEY) {
          // ORS supports all modes
          result = await fetchORS(pointCoords, transportMode, abortController.signal);
        } else if (transportMode === 'car') {
          // OSRM only supports driving
          result = await fetchOSRM(pointCoords, transportMode, abortController.signal);
        } else {
          // For bike/foot use free Valhalla
          result = await fetchValhalla(pointCoords, transportMode, abortController.signal);
        }
      } catch (primaryError: any) {
        if (primaryError?.name === 'AbortError') throw primaryError;

        // Try fallback services
        try {
          if (transportMode === 'car') {
            // For car, try Valhalla as fallback
            result = await fetchValhalla(pointCoords, transportMode, abortController.signal);
          } else {
            // For bike/foot, try OSRM driving route (better than nothing)
            result = await fetchOSRM(pointCoords, 'car', abortController.signal);
            result.isOptimal = false;
          }
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
  }, [points, transportMode, ORS_API_KEY, fetchORS, fetchOSRM, fetchValhalla, setRoute, setBuilding, setError]);

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
