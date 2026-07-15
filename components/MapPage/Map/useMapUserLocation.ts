import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceEventEmitter, Platform } from 'react-native'

import { CoordinateConverter } from '@/utils/coordinateConverter'
import { isValidCoordinate } from '@/utils/coordinateValidator'
import { showGeolocationErrorToast } from '@/utils/mapToasts'

import { beginProgrammaticMapMove } from './programmaticMoveSignal'
import type { Coordinates } from './types'

const MOBILE_WEB_USER_FOCUS_MAX_WIDTH = 768
const MOBILE_WEB_USER_FOCUS_OFFSET: [number, number] = [84, -92]
const USER_LOCATION_FOCUS_ZOOM = 14
const GEO_REQUEST_TIMEOUT_MS = 15000
const SAME_LOCATION_EPSILON = 0.00001

let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null

async function loadExpoLocation() {
  if (!expoLocationModulePromise) {
    expoLocationModulePromise = Promise.resolve(import('expo-location'))
  }
  return expoLocationModulePromise
}

const isSameCoordinates = (a: Coordinates | null, b: Coordinates | null): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  return (
    Math.abs(a.latitude - b.latitude) < SAME_LOCATION_EPSILON &&
    Math.abs(a.longitude - b.longitude) < SAME_LOCATION_EPSILON
  )
}

type UseMapUserLocationArgs = {
  coordinates: any
  providedUserLocation?: Coordinates | null
  /**
   * Explicit origin flag from useMapCoordinates. Only false permits legacy
   * derivation from `coordinates`; true/undefined fail closed.
   */
  coordinatesAreFallback?: boolean
  mapRef: React.MutableRefObject<any>
  onUserLocationChange?: (coords: Coordinates | null) => void
  onRequestUserLocation?: () => void | Promise<void>
}

export function useMapUserLocation({
  coordinates,
  providedUserLocation,
  coordinatesAreFallback,
  mapRef,
  onUserLocationChange,
  onRequestUserLocation,
}: UseMapUserLocationArgs) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const geoRequestedRef = useRef(false)
  const pendingFocusRef = useRef(false)

  useEffect(() => {
    if (providedUserLocation === undefined) return
    if (
      providedUserLocation &&
      isValidCoordinate(providedUserLocation.latitude, providedUserLocation.longitude)
    ) {
      setUserLocation((prev) =>
        isSameCoordinates(prev, providedUserLocation) ? prev : providedUserLocation,
      )
      return
    }
    setUserLocation((prev) => (prev === null ? prev : null))
  }, [providedUserLocation])

  useEffect(() => {
    try {
      onUserLocationChange?.(userLocation)
    } catch {
      // noop
    }
  }, [onUserLocationChange, userLocation])

  // Whether the legacy coordinates prop represents a REAL user position.
  // Trust is explicit and fail-closed; numeric comparison with a city/default
  // center is not part of the contract.
  const coordinatesAreRealUser = useCallback(
    (lat: number, lng: number) => {
      if (!isValidCoordinate(lat, lng)) return false
      return coordinatesAreFallback === false
    },
    [coordinatesAreFallback],
  )

  useEffect(() => {
    if (providedUserLocation !== undefined) return
    const lat = Number((coordinates as any)?.latitude)
    const lng = Number((coordinates as any)?.longitude)
    if (!coordinatesAreRealUser(lat, lng)) return

    setUserLocation((prev) => {
      if (
        prev &&
        Math.abs(prev.latitude - lat) < SAME_LOCATION_EPSILON &&
        Math.abs(prev.longitude - lng) < SAME_LOCATION_EPSILON
      ) {
        return prev
      }
      return { latitude: lat, longitude: lng }
    })
  }, [coordinates, coordinatesAreRealUser, providedUserLocation])

  const requestUserLocation = useCallback(async (notifyOnFailure = false) => {
    // The main map is controlled by useMapCoordinates. Delegate explicit center
    // requests to that owner so permission/status/current stay one atomic state.
    if (providedUserLocation !== undefined && onRequestUserLocation) {
      try {
        await onRequestUserLocation()
      } catch {
        if (notifyOnFailure) showGeolocationErrorToast()
      }
      return
    }
    if (geoRequestedRef.current) return
    geoRequestedRef.current = true
    try {
      const Location = await loadExpoLocation()
      const { status } = await Location.requestForegroundPermissionsAsync()
      // Системный диалог гео закрыт (granted/denied) — будим Leaflet, чтобы карта дозапросила
      // тайлы под текущий вью на чистой установке (см. F-17b в Map.ios).
      if (Platform.OS !== 'web') DeviceEventEmitter.emit('metravel:map-layout-invalidate')
      if (status !== 'granted') {
        geoRequestedRef.current = false
        if (notifyOnFailure) showGeolocationErrorToast()
        return
      }
      // getCurrentPositionAsync can hang indefinitely on some browsers/devices.
      // Race it against a timeout so geoRequestedRef can't get stuck true.
      const location = await Promise.race([
        Location.getCurrentPositionAsync({}),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('geolocation timeout')), GEO_REQUEST_TIMEOUT_MS)
        }),
      ])
      const lat = location.coords.latitude
      const lng = location.coords.longitude
      if (isValidCoordinate(lat, lng)) {
        setUserLocation({ latitude: lat, longitude: lng })
      }
    } catch {
      // Includes the timeout above, so a hung getCurrentPositionAsync no longer
      // leaves geoRequestedRef stuck true and blocking later retries.
      geoRequestedRef.current = false
      if (notifyOnFailure) showGeolocationErrorToast()
    }
  }, [onRequestUserLocation, providedUserLocation])

  // Автозапрос геолокации при монтировании, если нет валидной пользовательской локации
  useEffect(() => {
    // A defined prop (including null) makes this a controlled consumer. The
    // owner performs the only automatic permission/location request.
    if (providedUserLocation !== undefined) return
    const lat = Number((coordinates as any)?.latitude)
    const lng = Number((coordinates as any)?.longitude)
    // Запрашиваем геолокацию только если координаты не являются валидной пользовательской локацией
    if (!coordinatesAreRealUser(lat, lng)) {
      void requestUserLocation()
    }
  }, [coordinates, coordinatesAreRealUser, providedUserLocation, requestUserLocation])

  const userLocationLatLng = useMemo(() => {
    if (!userLocation) return null
    if (!isValidCoordinate(userLocation.latitude, userLocation.longitude)) return null
    return { lat: userLocation.latitude, lng: userLocation.longitude }
  }, [userLocation])

  const focusOnUserLocation = useCallback((target: { lat: number; lng: number }) => {
    if (!mapRef.current) return
    try {
      beginProgrammaticMapMove()
      mapRef.current.setView(
        CoordinateConverter.toLeaflet(target),
        USER_LOCATION_FOCUS_ZOOM,
        { animate: true },
      )

      const containerWidth = Number(mapRef.current?.getContainer?.()?.clientWidth ?? 0)
      const shouldOffsetForCompactWeb =
        Platform.OS === 'web' &&
        containerWidth > 0 &&
        containerWidth < MOBILE_WEB_USER_FOCUS_MAX_WIDTH &&
        typeof mapRef.current?.panBy === 'function'

      if (shouldOffsetForCompactWeb) {
        mapRef.current.panBy(MOBILE_WEB_USER_FOCUS_OFFSET, { animate: true })
      }
    } catch {
      // noop
    }
  }, [mapRef])

  const centerOnUserLocation = useCallback(async () => {
    if (userLocationLatLng) {
      focusOnUserLocation(userLocationLatLng)
      return
    }

    pendingFocusRef.current = true
    await requestUserLocation(true)
  }, [focusOnUserLocation, requestUserLocation, userLocationLatLng])

  useEffect(() => {
    if (!pendingFocusRef.current) return
    if (!userLocationLatLng) return
    pendingFocusRef.current = false
    focusOnUserLocation(userLocationLatLng)
  }, [focusOnUserLocation, userLocationLatLng])

  return {
    centerOnUserLocation,
    userLocation,
    userLocationLatLng,
  }
}
