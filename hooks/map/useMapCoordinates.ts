import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { logError, logMessage } from '@/utils/logger';
import { loadExpoLocation } from '@/hooks/map/expoLocationLoader';
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Where the current viewport coordinates came from. Used downstream to decide
 * whether to draw the real "you are here" marker and center-on-self: cached and
 * default centers are useful anchors, but they must NOT masquerade as current
 * user position. This replaces brittle coordinate-matching (isFallbackMinskCenter).
 */
export type CoordinatesSource = 'geolocation' | 'cache' | 'default';

export const DEFAULT_COORDINATES: Coordinates = {
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
};
const WEB_LAST_COORDS_KEY = 'metravel:lastKnownCoords';
const NATIVE_LOCATION_TIMEOUT_MS = 12000;

class LocationTimeoutError extends Error {
  constructor() {
    super('Location request timed out');
    this.name = 'LocationTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LocationTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function isLocationTimeoutError(error: unknown): boolean {
  return error instanceof LocationTimeoutError || (error as { name?: string } | null)?.name === 'LocationTimeoutError';
}
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Хук для управления координатами пользователя.
 * На web стартует с кеша/дефолта и запрашивает геолокацию только по явному действию.
 */
export function useMapCoordinates() {
  const readWebCachedCoordinates = useCallback((): Coordinates | null => {
    if (Platform.OS !== 'web') return null;
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(WEB_LAST_COORDS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Coordinates>;
      const lat = Number(parsed?.latitude);
      const lng = Number(parsed?.longitude);
      if (!isValidCoordinate(lat, lng)) return null;
      return { latitude: lat, longitude: lng };
    } catch {
      return null;
    }
  }, []);

  // Initialize with last known coordinates on web to avoid default-center flicker.
  const [coordinates, setCoordinates] = useState<Coordinates>(() => {
    const cached = Platform.OS === 'web' ? (() => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.localStorage.getItem(WEB_LAST_COORDS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Coordinates>;
        const lat = Number(parsed?.latitude);
        const lng = Number(parsed?.longitude);
        return isValidCoordinate(lat, lng) ? { latitude: lat, longitude: lng } : null;
      } catch {
        return null;
      }
    })() : null;
    return cached ?? DEFAULT_COORDINATES;
  });
  // Origin of the current viewport coordinates. Cache is last-known viewport
  // only: it may center the map, but it is not a trusted current user position.
  const [coordinatesSource, setCoordinatesSource] = useState<CoordinatesSource>(() => {
    if (Platform.OS !== 'web') return 'default';
    if (typeof window === 'undefined') return 'default';
    try {
      const raw = window.localStorage.getItem(WEB_LAST_COORDS_KEY);
      if (!raw) return 'default';
      const parsed = JSON.parse(raw) as Partial<Coordinates>;
      return isValidCoordinate(Number(parsed?.latitude), Number(parsed?.longitude))
        ? 'cache'
        : 'default';
    } catch {
      return 'default';
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestWebLocation = useCallback(async (signal?: AbortSignal) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = readWebCachedCoordinates();
      if (cached) {
        setCoordinates(cached);
        setCoordinatesSource('cache');
      } else {
        setCoordinatesSource('default');
      }
      setIsLoading(false);
      return;
    }

    await new Promise<void>((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const handleSuccess = (position: GeolocationPosition) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const { latitude, longitude } = position.coords;
        if (isValidCoordinate(latitude, longitude)) {
          const next = { latitude, longitude };
          setCoordinates(next);
          setCoordinatesSource('geolocation');
          setError(null);
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(WEB_LAST_COORDS_KEY, JSON.stringify(next));
            }
          } catch {
            // noop
          }
        }
        resolve();
      };

      const handleError = () => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const cached = readWebCachedCoordinates();
        if (cached) {
          setCoordinates(cached);
          setCoordinatesSource('cache');
        } else {
          setCoordinates(DEFAULT_COORDINATES);
          setCoordinatesSource('default');
        }
        setError('Местоположение не определено');
        resolve();
      };

      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    });
  }, [readWebCachedCoordinates]);

  const requestLocation = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS === 'web') {
        await requestWebLocation(signal);
        return;
      }

      const Location = await loadExpoLocation();
      const { status } = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        NATIVE_LOCATION_TIMEOUT_MS,
      );

      if (signal?.aborted) return;

      if (status !== 'granted') {
        logMessage('[map] Location permission denied, using default coordinates', 'info', {
          scope: 'map',
          step: 'getLocation',
        });
        setCoordinates(DEFAULT_COORDINATES);
        setCoordinatesSource('default');
        setError('Местоположение не определено');
        setIsLoading(false);
        return;
      }

      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        NATIVE_LOCATION_TIMEOUT_MS,
      );

      if (signal?.aborted) return;

      const { latitude, longitude } = location.coords;

      if (isValidCoordinate(latitude, longitude)) {
        setCoordinates({ latitude, longitude });
        setCoordinatesSource('geolocation');
        setError(null);
      } else {
        logMessage('[map] Invalid coordinates from location service', 'warning', {
          scope: 'map',
          step: 'getLocation',
          coords: location.coords,
        });
        setCoordinates(DEFAULT_COORDINATES);
        setCoordinatesSource('default');
      }
    } catch (err) {
      if (signal?.aborted) return;

      if (isLocationTimeoutError(err)) {
        logMessage('[map] Location request timed out, using default coordinates', 'warning', {
          scope: 'map',
          step: 'getLocation',
        });
      } else {
        logError(err, { scope: 'map', step: 'getLocation' });
      }
      setError('Не удалось определить местоположение');
      setCoordinates(DEFAULT_COORDINATES);
      setCoordinatesSource('default');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [requestWebLocation]);

  useEffect(() => {
    const abortController = new AbortController();
    requestLocation(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [requestLocation]);

  const updateCoordinates = useCallback((lat: number, lng: number) => {
    if (isValidCoordinate(lat, lng)) {
      setCoordinates({ latitude: lat, longitude: lng });
      // An explicit programmatic pin is a deliberate position choice, not a
      // silent default — treat it as a real location for marker/centering.
      setCoordinatesSource('geolocation');
    } else {
      logMessage('[map] Attempted to set invalid coordinates', 'warning', {
        scope: 'map',
        lat,
        lng,
      });
    }
  }, []);

  // True when coordinates are not a live/current geolocation fix. Downstream
  // uses this to avoid false "you are here", distance, and route-origin states
  // from default or cached viewport anchors.
  const coordinatesAreFallback = coordinatesSource !== 'geolocation';

  return useMemo(() => ({
    coordinates,
    coordinatesSource,
    coordinatesAreFallback,
    isLoading,
    error,
    updateCoordinates,
    refreshLocation: requestLocation,
  }), [coordinates, coordinatesSource, coordinatesAreFallback, isLoading, error, updateCoordinates, requestLocation]);
}
