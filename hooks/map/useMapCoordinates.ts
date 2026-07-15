import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';
import { logError, logMessage } from '@/utils/logger';
import { loadExpoLocation } from '@/hooks/map/expoLocationLoader';
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig';
import { translate as i18nT } from '@/i18n'


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
export type CoordinatesSource = 'geolocation' | 'cache' | 'default' | 'manual';

export const DEFAULT_COORDINATES: Coordinates = {
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
};
const WEB_LAST_COORDS_KEY = 'metravel:lastKnownCoords';
const NATIVE_LOCATION_TIMEOUT_MS = 12000;
const LIVE_LOCATION_MIN_DISTANCE_M = 12;
const LIVE_LOCATION_MAXIMUM_AGE_MS = 15000;

export type LocationSnapshot = Coordinates & {
  accuracy?: number | null;
  timestamp?: number;
};

export type MapLocationState =
  | { status: 'loading'; coordinates: null; accuracy: null; timestamp: null; canAskAgain: true }
  | { status: 'current'; coordinates: Coordinates; accuracy: number | null; timestamp: number; canAskAgain: true; isRefreshing?: boolean }
  | { status: 'cached'; coordinates: Coordinates; accuracy: number | null; timestamp: number | null; canAskAgain: true }
  | { status: 'denied'; coordinates: null; accuracy: null; timestamp: null; canAskAgain: boolean }
  | { status: 'unavailable'; coordinates: null; accuracy: null; timestamp: null; canAskAgain: false }
  | { status: 'error'; coordinates: null; accuracy: null; timestamp: null; canAskAgain: boolean };

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

function readWebCachedLocation(): LocationSnapshot | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WEB_LAST_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocationSnapshot>;
    const latitude = Number(parsed?.latitude);
    const longitude = Number(parsed?.longitude);
    if (!isValidCoordinate(latitude, longitude)) return null;
    return {
      latitude,
      longitude,
      accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : null,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : undefined,
    };
  } catch {
    return null;
  }
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Хук для управления координатами пользователя.
 * На web стартует с кеша/дефолта, затем получает current fix; только подтверждённый
 * fix становится current/userLocation, а viewport anchors остаются недоверенными.
 */
export function useMapCoordinates(options: { isFocused?: boolean } = {}) {
  const routeIsFocused = useIsFocused();
  const isFocused = options.isFocused ?? routeIsFocused;
  const lastTrustedLocationRef = useRef<LocationSnapshot | null>(null);
  const liveWatchCleanupRef = useRef<(() => void) | null>(null);
  const liveWatchActiveRef = useRef(false);
  const liveWatchStartingRef = useRef(false);
  const appWentInactiveRef = useRef(false);
  const settingsReturnPendingRef = useRef(false);

  const [initialCachedLocation] = useState<LocationSnapshot | null>(() => readWebCachedLocation());
  const readWebCachedCoordinates = useCallback(() => readWebCachedLocation(), []);

  // Initialize with last known coordinates on web to avoid default-center flicker.
  const [coordinates, setCoordinates] = useState<Coordinates>(
    () => initialCachedLocation
      ? {
          latitude: initialCachedLocation.latitude,
          longitude: initialCachedLocation.longitude,
        }
      : DEFAULT_COORDINATES,
  );
  // Origin of the current viewport coordinates. Cache is last-known viewport
  // only: it may center the map, but it is not a trusted current user position.
  const [coordinatesSource, setCoordinatesSource] = useState<CoordinatesSource>(
    initialCachedLocation ? 'cache' : 'default',
  );
  const [locationState, setLocationState] = useState<MapLocationState>(() =>
    initialCachedLocation
      ? {
          status: 'cached',
          coordinates: {
            latitude: initialCachedLocation.latitude,
            longitude: initialCachedLocation.longitude,
          },
          accuracy: initialCachedLocation.accuracy ?? null,
          timestamp: initialCachedLocation.timestamp ?? null,
          canAskAgain: true,
        }
      : {
          status: 'loading',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: true,
        },
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheWebCoordinates = useCallback((next: LocationSnapshot) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(WEB_LAST_COORDS_KEY, JSON.stringify(next));
    } catch {
      // noop
    }
  }, []);

  const applyTrustedLocation = useCallback((
    location: LocationSnapshot,
    options: { force?: boolean } = {},
  ) => {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!isValidCoordinate(latitude, longitude)) return false;

    const next: LocationSnapshot = {
      latitude,
      longitude,
      accuracy: typeof location.accuracy === 'number' ? location.accuracy : null,
      timestamp: typeof location.timestamp === 'number' ? location.timestamp : Date.now(),
    };
    const prev = lastTrustedLocationRef.current;

    if (!options.force && prev) {
      const movedEnough = distanceMeters(prev, next) >= LIVE_LOCATION_MIN_DISTANCE_M;
      if (!movedEnough) {
        lastTrustedLocationRef.current = next;
        setLocationState({
          status: 'current',
          coordinates: { latitude: prev.latitude, longitude: prev.longitude },
          accuracy: next.accuracy ?? null,
          timestamp: next.timestamp ?? Date.now(),
          canAskAgain: true,
        });
        cacheWebCoordinates(next);
        return false;
      }
    }

    lastTrustedLocationRef.current = next;
    const coords = { latitude, longitude };
    // The initial/explicit fix owns the viewport anchor. Foreground watch ticks
    // update only the trusted user marker; otherwise every GPS movement also
    // moves the radius/search center and defeats manual pan/follow-off.
    if (options.force || !prev) {
      setCoordinates(coords);
      setCoordinatesSource('geolocation');
    }
    setLocationState({
      status: 'current',
      coordinates: coords,
      accuracy: next.accuracy ?? null,
      timestamp: next.timestamp ?? Date.now(),
      canAskAgain: true,
    });
    setError(null);
    cacheWebCoordinates(next);
    return true;
  }, [cacheWebCoordinates]);

  const markLiveLocationRefreshing = useCallback(() => {
    setLocationState((current) =>
      current.status === 'current'
        ? { ...current, isRefreshing: true }
        : current,
    );
  }, []);

  const clearLocationWatch = useCallback(() => {
    const cleanup = liveWatchCleanupRef.current;
    liveWatchCleanupRef.current = null;
    liveWatchActiveRef.current = false;
    liveWatchStartingRef.current = false;
    if (cleanup) {
      try {
        cleanup();
      } catch {
        // noop
      }
    }
  }, []);

  const startWebLocationWatch = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (liveWatchActiveRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    try {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          applyTrustedLocation({
            latitude,
            longitude,
            accuracy,
            timestamp: position.timestamp,
          });
        },
        () => {
          // Temporary watch failures keep the last trusted point visible; fallback
          // centers must still never become current user position.
          markLiveLocationRefreshing();
        },
        {
          enableHighAccuracy: true,
          timeout: NATIVE_LOCATION_TIMEOUT_MS,
          maximumAge: LIVE_LOCATION_MAXIMUM_AGE_MS,
        },
      );

      liveWatchActiveRef.current = true;
      liveWatchCleanupRef.current = () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } catch {
      liveWatchActiveRef.current = false;
      liveWatchCleanupRef.current = null;
      markLiveLocationRefreshing();
    }
  }, [applyTrustedLocation, markLiveLocationRefreshing]);

  const startNativeLocationWatch = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (liveWatchActiveRef.current) return;
    if (liveWatchStartingRef.current) return;

    liveWatchStartingRef.current = true;
    try {
      const Location = await loadExpoLocation();
      if (typeof Location.watchPositionAsync !== 'function') {
        liveWatchStartingRef.current = false;
        return;
      }
      if (!liveWatchStartingRef.current) return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: LIVE_LOCATION_MIN_DISTANCE_M,
        },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          applyTrustedLocation({
            latitude,
            longitude,
            accuracy,
            timestamp: location.timestamp,
          });
        },
      );

      if (!liveWatchStartingRef.current) {
        subscription.remove();
        return;
      }
      liveWatchStartingRef.current = false;
      liveWatchActiveRef.current = true;
      liveWatchCleanupRef.current = () => {
        subscription.remove();
      };
    } catch {
      liveWatchStartingRef.current = false;
      liveWatchActiveRef.current = false;
      liveWatchCleanupRef.current = null;
      markLiveLocationRefreshing();
    }
  }, [applyTrustedLocation, markLiveLocationRefreshing]);

  const startLocationWatch = useCallback(() => {
    if (!isFocused) return;
    if (Platform.OS === 'web') {
      startWebLocationWatch();
      return;
    }
    void startNativeLocationWatch();
  }, [isFocused, startNativeLocationWatch, startWebLocationWatch]);

  const requestWebLocation = useCallback(async (signal?: AbortSignal) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = readWebCachedCoordinates();
      if (cached) {
        setCoordinates({ latitude: cached.latitude, longitude: cached.longitude });
        setCoordinatesSource('cache');
        setLocationState({
          status: 'cached',
          coordinates: { latitude: cached.latitude, longitude: cached.longitude },
          accuracy: cached.accuracy ?? null,
          timestamp: cached.timestamp ?? null,
          canAskAgain: true,
        });
      } else {
        setCoordinatesSource('default');
        setLocationState({
          status: 'unavailable',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: false,
        });
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
        applyTrustedLocation({
          latitude,
          longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }, { force: true });
        startLocationWatch();
        resolve();
      };

      const handleError = (positionError: GeolocationPositionError) => {
        if (signal?.aborted) {
          resolve();
          return;
        }
        const cached = readWebCachedCoordinates();
        if (cached) {
          setCoordinates({ latitude: cached.latitude, longitude: cached.longitude });
          setCoordinatesSource('cache');
        } else {
          setCoordinates(DEFAULT_COORDINATES);
          setCoordinatesSource('default');
        }
        clearLocationWatch();
        setLocationState(
          positionError.code === positionError.PERMISSION_DENIED
            ? {
                status: 'denied',
                coordinates: null,
                accuracy: null,
                timestamp: null,
                canAskAgain: true,
              }
            : {
                status: 'error',
                coordinates: null,
                accuracy: null,
                timestamp: null,
                canAskAgain: true,
              },
        );
        setError(i18nT('map:hooks.map.useMapCoordinates.mestopolozhenie_ne_opredeleno_8f1bec27'));
        resolve();
      };

      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    });
  }, [applyTrustedLocation, clearLocationWatch, readWebCachedCoordinates, startLocationWatch]);

  const requestLocation = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setLocationState((current) =>
      current.status === 'current'
        ? current
        : {
            status: 'loading',
            coordinates: null,
            accuracy: null,
            timestamp: null,
            canAskAgain: true,
          },
    );

    try {
      if (Platform.OS === 'web') {
        await requestWebLocation(signal);
        return;
      }

      const Location = await loadExpoLocation();
      const permission = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        NATIVE_LOCATION_TIMEOUT_MS,
      );

      if (signal?.aborted) return;

      if (permission.status !== 'granted') {
        logMessage('[map] Location permission denied, using default coordinates', 'info', {
          scope: 'map',
          step: 'getLocation',
        });
        setCoordinates(DEFAULT_COORDINATES);
        setCoordinatesSource('default');
        setLocationState({
          status: 'denied',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: permission.canAskAgain !== false,
        });
        setError(i18nT('map:hooks.map.useMapCoordinates.mestopolozhenie_ne_opredeleno_8f1bec27'));
        setIsLoading(false);
        clearLocationWatch();
        return;
      }

      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        NATIVE_LOCATION_TIMEOUT_MS,
      );

      if (signal?.aborted) return;

      const { latitude, longitude, accuracy } = location.coords;

      if (isValidCoordinate(latitude, longitude)) {
        applyTrustedLocation({
          latitude,
          longitude,
          accuracy,
          timestamp: location.timestamp,
        }, { force: true });
        startLocationWatch();
      } else {
        logMessage('[map] Invalid coordinates from location service', 'warning', {
          scope: 'map',
          step: 'getLocation',
          coords: location.coords,
        });
        setCoordinates(DEFAULT_COORDINATES);
        setCoordinatesSource('default');
        setLocationState({
          status: 'error',
          coordinates: null,
          accuracy: null,
          timestamp: null,
          canAskAgain: true,
        });
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
      setError(i18nT('map:hooks.map.useMapCoordinates.ne_udalos_opredelit_mestopolozhenie_ad63da94'));
      setCoordinates(DEFAULT_COORDINATES);
      setCoordinatesSource('default');
      setLocationState({
        status: 'error',
        coordinates: null,
        accuracy: null,
        timestamp: null,
        canAskAgain: true,
      });
      clearLocationWatch();
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [applyTrustedLocation, clearLocationWatch, requestWebLocation, startLocationWatch]);

  useEffect(() => {
    if (!isFocused) {
      clearLocationWatch();
      return;
    }
    const abortController = new AbortController();
    requestLocation(abortController.signal);

    return () => {
      abortController.abort();
      clearLocationWatch();
    };
  }, [clearLocationWatch, isFocused, requestLocation]);

  useEffect(() => {
    if (!isFocused) {
      clearLocationWatch();
      return;
    }
    if (Platform.OS === 'web') {
      if (locationState.status !== 'current') return;
      if (typeof document === 'undefined') return;
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          clearLocationWatch();
          return;
        }
        startLocationWatch();
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (locationState.status === 'current') {
          settingsReturnPendingRef.current = false;
          startLocationWatch();
        } else if (appWentInactiveRef.current && settingsReturnPendingRef.current) {
          settingsReturnPendingRef.current = false;
          void requestLocation();
        }
        appWentInactiveRef.current = false;
        return;
      }
      appWentInactiveRef.current = true;
      clearLocationWatch();
    });

    return () => {
      subscription.remove();
    };
  }, [clearLocationWatch, isFocused, locationState.status, requestLocation, startLocationWatch]);

  const updateCoordinates = useCallback((lat: number, lng: number) => {
    if (isValidCoordinate(lat, lng)) {
      // Explicit pins/search anchors move the viewport only. They must never
      // become a synthetic current user position or route origin.
      setCoordinates({ latitude: lat, longitude: lng });
      setCoordinatesSource('manual');
    } else {
      logMessage('[map] Attempted to set invalid coordinates', 'warning', {
        scope: 'map',
        lat,
        lng,
      });
    }
  }, []);

  const openLocationSettings = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    try {
      settingsReturnPendingRef.current = true;
      await Linking.openSettings();
      return true;
    } catch (settingsError) {
      settingsReturnPendingRef.current = false;
      logError(settingsError, { scope: 'map', step: 'openLocationSettings' });
      return false;
    }
  }, []);

  // True when coordinates are not a live/current geolocation fix. Downstream
  // uses this to avoid false "you are here", distance, and route-origin states
  // from default or cached viewport anchors.
  const coordinatesAreFallback = coordinatesSource !== 'geolocation';
  const currentLocation = locationState.status === 'current' ? locationState.coordinates : null;

  return useMemo(() => ({
    coordinates,
    coordinatesSource,
    coordinatesAreFallback,
    locationState,
    currentLocation,
    isLoading,
    error,
    updateCoordinates,
    refreshLocation: requestLocation,
    openLocationSettings,
  }), [
    coordinates,
    coordinatesSource,
    coordinatesAreFallback,
    locationState,
    currentLocation,
    isLoading,
    error,
    updateCoordinates,
    requestLocation,
    openLocationSettings,
  ]);
}
