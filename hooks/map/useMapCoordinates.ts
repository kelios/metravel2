import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { logError, logMessage } from '@/src/utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const DEFAULT_COORDINATES: Coordinates = { latitude: 53.9006, longitude: 27.559 };

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
  // Initialize with default coordinates to prevent NaN errors
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDINATES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
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
  }, []);

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

  return {
    coordinates,
    isLoading,
    error,
    updateCoordinates,
    refreshLocation: requestLocation,
  };
}

