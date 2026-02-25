import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { logError, logMessage } from '@/utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const DEFAULT_COORDINATES: Coordinates = { latitude: 53.9006, longitude: 27.559 };
const WEB_LAST_COORDS_KEY = 'metravel:lastKnownCoords';

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
 * Запрашивает геолокацию при монтировании.
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestWebLocation = useCallback(async (signal?: AbortSignal) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = readWebCachedCoordinates();
      if (cached) setCoordinates(cached);
      setIsLoading(false);
      return;
    }

    await new Promise<void>((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const handleSuccess = (position: any) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const { latitude, longitude } = position.coords;
        if (isValidCoordinate(latitude, longitude)) {
          const next = { latitude, longitude };
          setCoordinates(next);
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
        const cached = readWebCachedCoordinates();
        if (cached) {
          setCoordinates(cached);
        } else {
          setCoordinates(DEFAULT_COORDINATES);
        }
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

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (signal?.aborted) return;

      if (status !== 'granted') {
        logMessage('[map] Location permission denied, using default coordinates', 'info', {
          scope: 'map',
          step: 'getLocation',
        });
        setCoordinates(DEFAULT_COORDINATES);
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (signal?.aborted) return;

      const { latitude, longitude } = location.coords;

      if (isValidCoordinate(latitude, longitude)) {
        setCoordinates({ latitude, longitude });
      } else {
        logMessage('[map] Invalid coordinates from location service', 'warning', {
          scope: 'map',
          step: 'getLocation',
          coords: location.coords,
        });
        setCoordinates(DEFAULT_COORDINATES);
      }
    } catch (err) {
      if (signal?.aborted) return;

      logError(err, { scope: 'map', step: 'getLocation' });
      setError('Не удалось определить местоположение');
      setCoordinates(DEFAULT_COORDINATES);
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
    } else {
      logMessage('[map] Attempted to set invalid coordinates', 'warning', {
        scope: 'map',
        lat,
        lng,
      });
    }
  }, []);

  return useMemo(() => ({
    coordinates,
    isLoading,
    error,
    updateCoordinates,
    refreshLocation: requestLocation,
  }), [coordinates, isLoading, error, updateCoordinates, requestLocation]);
}
