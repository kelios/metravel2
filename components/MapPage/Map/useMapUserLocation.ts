import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { CoordinateConverter } from '@/utils/coordinateConverter'
import { isValidCoordinate } from '@/utils/coordinateValidator'

import type { Coordinates } from './types'

let expoLocationModulePromise: Promise<typeof import('expo-location')> | null = null

async function loadExpoLocation() {
  if (!expoLocationModulePromise) {
    expoLocationModulePromise = import('expo-location')
  }
  return expoLocationModulePromise
}

type UseMapUserLocationArgs = {
  L: any
  rl: any
  coordinates: any
  mapContainerId: string
  mapRef: React.MutableRefObject<any>
  onUserLocationChange?: (coords: Coordinates | null) => void
  isFallbackMinskCenter: (lat: number, lng: number) => boolean
}

export function useMapUserLocation({
  L,
  rl,
  coordinates,
  mapContainerId,
  mapRef,
  onUserLocationChange,
  isFallbackMinskCenter,
}: UseMapUserLocationArgs) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const geoRequestedRef = useRef(false)

  useEffect(() => {
    try {
      onUserLocationChange?.(userLocation)
    } catch {
      // noop
    }
  }, [onUserLocationChange, userLocation])

  useEffect(() => {
    const lat = Number((coordinates as any)?.latitude)
    const lng = Number((coordinates as any)?.longitude)
    if (!isValidCoordinate(lat, lng)) return
    if (isFallbackMinskCenter(lat, lng)) return

    setUserLocation((prev) => {
      if (
        prev &&
        Math.abs(prev.latitude - lat) < 0.00001 &&
        Math.abs(prev.longitude - lng) < 0.00001
      ) {
        return prev
      }
      return { latitude: lat, longitude: lng }
    })
  }, [coordinates, isFallbackMinskCenter])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!L || !rl) return

    let cancelled = false

    const loadLocation = () => {
      if (geoRequestedRef.current || cancelled) return
      geoRequestedRef.current = true
      ;(async () => {
        try {
          const Location = await loadExpoLocation()
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status !== 'granted' || cancelled) {
            console.warn('[Map] Location permission not granted')
            return
          }

          const location = await Location.getCurrentPositionAsync({})
          if (cancelled) return

          const lat = location.coords.latitude
          const lng = location.coords.longitude
          if (isValidCoordinate(lat, lng)) {
            setUserLocation({ latitude: lat, longitude: lng })
          } else {
            console.warn('[Map] Invalid location coordinates:', { lat, lng })
          }
        } catch (error) {
          console.error('[Map] Location error:', error)
        }
      })()
    }

    loadLocation()

    return () => {
      cancelled = true
    }
  }, [L, mapContainerId, rl])

  const userLocationLatLng = useMemo(() => {
    if (!userLocation) return null
    if (!isValidCoordinate(userLocation.latitude, userLocation.longitude)) return null
    return { lat: userLocation.latitude, lng: userLocation.longitude }
  }, [userLocation])

  const centerOnUserLocation = useCallback(() => {
    if (!mapRef.current || !userLocationLatLng) return
    try {
      mapRef.current.setView(CoordinateConverter.toLeaflet(userLocationLatLng), 14, { animate: true })
    } catch {
      // noop
    }
  }, [mapRef, userLocationLatLng])

  return {
    centerOnUserLocation,
    userLocation,
    userLocationLatLng,
  }
}
