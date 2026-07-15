import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouteStore } from '@/stores/routeStore';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { RouteValidator } from '@/utils/routeValidator';
import type { LatLng } from '@/types/coordinates';
import type { RouteData, TransportMode } from '@/types/route';
import { orsDirections } from '@/api/external/ors';
import { osrmRoute } from '@/api/external/osrm';
import { valhallaRoute } from '@/api/external/valhalla';
import { serverRoute } from '@/api/external/serverRouting';
import { translate as i18nT } from '@/i18n'


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
  // P4.2: Гранулярные Zustand селекторы вместо подписки на весь store
  const points = useRouteStore((s) => s.points);
  const transportMode = useRouteStore((s) => s.transportMode);
  const setRoute = useRouteStore((s) => s.setRoute);
  const setBuilding = useRouteStore((s) => s.setBuilding);
  const setError = useRouteStore((s) => s.setError);

  const abortRef = useRef<AbortController | null>(null);
  const lastRouteKeyRef = useRef<string | null>(null);

  // Canonical routing path: server endpoint backed by ORS on the backend
  // (task board #707/#732). ORS/OSRM/Valhalla below remain only as a fallback
  // for network errors or older deployments without this route.
  const fetchServerRoute = useCallback(
    async (
      points: LatLng[],
      mode: TransportMode,
      signal: AbortSignal
    ): Promise<RouteResult> => {
      const res = await serverRoute(
        points.map(p => ({ lat: p.lat, lng: p.lng })),
        mode,
        { signal },
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(
          i18nT('map:components.MapPage.Map.useRouteBuilding.oshibka_servera_marshrutizatsii_value1_value_a1ec17bb', { value1: res.status, value2: errorText ? ` - ${errorText}` : '' })
        );
      }

      const data = await res.json();
      const geometry = data?.geometry;

      if (!Array.isArray(geometry) || geometry.length === 0)
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.pustoy_marshrut_ot_servera_marshrutizatsii_cfc2780a'));

      const coords: LatLng[] = geometry.map(
        ([lng, lat]: [number, number]) => ({ lat, lng })
      );

      return {
        coords,
        distance: Number(data.distance_m) || 0,
        duration: Number(data.duration_s) || 0,
        isOptimal: Boolean(data.is_optimal),
      };
    },
    []
  );

  const fetchORS = useCallback(
    async (
      points: LatLng[],
      mode: TransportMode,
      signal: AbortSignal
    ): Promise<RouteResult> => {
      const parseOrsError = (raw: string): { code?: number; message?: string } => {
        if (!raw) return {};
        try {
          const parsed = JSON.parse(raw);
          const code = Number(parsed?.error?.code);
          const message =
            typeof parsed?.error?.message === 'string' ? parsed.error.message : undefined;
          return {
            code: Number.isFinite(code) ? code : undefined,
            message,
          };
        } catch {
          return {};
        }
      };

      // ORS expects [lng, lat] format
      const coordinates = points.map(p => [p.lng, p.lat]);
      const radiusesToTry: Array<number | undefined> = [undefined, 1000, 2000, 5000];

      let res: Response | null = null;
      let lastErrorText = '';
      for (const radius of radiusesToTry) {
        res = await orsDirections(
          getORSProfile(mode) as any,
          {
            coordinates: coordinates as Array<[number, number]>,
            ...(typeof radius === 'number'
              ? { radiuses: new Array(coordinates.length).fill(radius) }
              : {}),
          },
          String(ORS_API_KEY),
          { signal },
        );

        if (res.ok) break;

        lastErrorText = await res.text().catch(() => '');
        const { code: orsCode } = parseOrsError(lastErrorText);

        // ORS 404 + error.code=2010 => point is too far from routable graph; retry with larger radius.
        if (orsCode === 2010 && radius !== radiusesToTry[radiusesToTry.length - 1]) {
          continue;
        }

        if (res.status === 429)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.prevyshen_limit_zaprosov_podozhdite_nemnogo_1e6bc7a9'));
        if (res.status === 403)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.nevernyy_api_klyuch_ili_dostup_zapreschen_34391e92'));
        if (res.status === 400)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.nekorrektnye_koordinaty_marshruta_26616a57'));
        throw new Error(
          i18nT('map:components.MapPage.Map.useRouteBuilding.oshibka_ors_value1_value2_c7a76deb', { value1: res.status, value2: lastErrorText ? ` - ${lastErrorText}` : '' })
        );
      }

      if (!res || !res.ok) {
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.oshibka_ors_value1_value2_c7a76deb', { value1: res?.status ?? 'unknown', value2: lastErrorText ? ` - ${lastErrorText}` : '' }));
      }

      const data = await res.json();
      const feature = data.features?.[0];
      const geometry = feature?.geometry;
      const summary = feature?.properties?.summary;

      if (!geometry?.coordinates?.length)
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.pustoy_marshrut_ot_ors_8485de5d'));

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
      const res = await osrmRoute(
        {
          coords: points.map(p => [p.lng, p.lat]),
          profile: profile as any,
          overview: 'full',
          geometries: 'geojson',
        },
        { signal },
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 429)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.prevyshen_limit_zaprosov_podozhdite_nemnogo_1e6bc7a9'));
        if (res.status === 400)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.nekorrektnye_koordinaty_marshruta_26616a57'));
        throw new Error(
          i18nT('map:components.MapPage.Map.useRouteBuilding.oshibka_osrm_value1_value2_3fd7248f', { value1: res.status, value2: errorText ? ` - ${errorText}` : '' })
        );
      }

      const data = await res.json();
      const route = data.routes?.[0];

      if (!route?.geometry?.coordinates?.length)
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.pustoy_marshrut_ot_osrm_d903348b'));

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

      const res = await valhallaRoute(requestBody, { signal });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 429)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.prevyshen_limit_zaprosov_podozhdite_nemnogo_1e6bc7a9'));
        if (res.status === 400)
          throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.nekorrektnye_koordinaty_marshruta_26616a57'));
        throw new Error(
          i18nT('map:components.MapPage.Map.useRouteBuilding.oshibka_valhalla_value1_value2_bc96a773', { value1: res.status, value2: errorText ? ` - ${errorText}` : '' })
        );
      }

      const data = await res.json();
      const trip = data.trip;

      if (!trip?.legs?.length)
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.pustoy_marshrut_ot_valhalla_b59f6cdc'));

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
          const decoded = decodePolyline6(leg.shape);
          // Фильтруем невалидные координаты
          const validCoords = decoded.filter(c =>
            Number.isFinite(c.lat) &&
            Number.isFinite(c.lng) &&
            c.lng >= -180 && c.lng <= 180 &&
            c.lat >= -90 && c.lat <= 90
          );
          allCoords.push(...validCoords);
        }
      }

      if (allCoords.length === 0)
        throw new Error(i18nT('map:components.MapPage.Map.useRouteBuilding.pustoy_marshrut_ot_valhalla_b59f6cdc'));

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

    setBuilding(true);
    setError(null);

    try {
      const pointCoords = points.map(p => p.coordinates);
      let result: RouteResult;

      try {
        // Primary: canonical server routing endpoint (backend-configured ORS).
        result = await fetchServerRoute(pointCoords, transportMode, abortController.signal);
      } catch (serverError: any) {
        if (serverError?.name === 'AbortError') throw serverError;

        try {
          // Try client-side service based on transport mode (fallback for
          // network errors / older deployments without the server endpoint).
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
              i18nT('map:components.MapPage.Map.useRouteBuilding.ispolzuetsya_pryamaya_liniya_servisy_marshru_2b26ccae')
            );
          }
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
      // Коммитим ключ ТОЛЬКО после успешного построения — иначе абортнутый запрос
      // оставил бы ключ закоммиченным и dedup навсегда заблокировал бы перестроение.
      lastRouteKeyRef.current = routeKey;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Сбрасываем спиннер, только если нас не вытеснил более новый запрос
        // (иначе затрём его setBuilding(true)).
        if (abortRef.current === abortController) {
          setBuilding(false);
        }
        return;
      }

      const errorMessage = error?.message || i18nT('map:components.MapPage.useRouting.ne_udalos_postroit_marshrut_2d05f3d6');
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
  }, [points, transportMode, ORS_API_KEY, fetchServerRoute, fetchORS, fetchOSRM, fetchValhalla, setRoute, setBuilding, setError]);

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

  return useMemo(() => ({
    buildRoute,
  }), [buildRoute]);
}
