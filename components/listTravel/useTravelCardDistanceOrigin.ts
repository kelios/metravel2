import { useTravelCardDistanceOriginState } from './useTravelCardDistanceOriginState'

type LatLng = { lat: number; lng: number }

function readWebGrantedPosition(): Promise<LatLng | null> {
  if (typeof navigator === 'undefined' || typeof navigator.permissions?.query !== 'function') {
    return Promise.resolve(null)
  }
  if (typeof navigator.geolocation?.getCurrentPosition !== 'function') {
    return Promise.resolve(null)
  }
  return navigator.permissions
    .query({ name: 'geolocation' })
    .then((status) => {
      if (status.state !== 'granted') return null
      return new Promise<LatLng | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            })
          },
          () => resolve(null),
          { maximumAge: 10 * 60 * 1000, timeout: 1500, enableHighAccuracy: false },
        )
      })
    })
    .catch(() => null)
}

/** Web и Jest. Нативный модуль геолокации сюда не импортируется: иначе он попадает в web-бандл. */
export function useTravelCardDistanceOrigin() {
  return useTravelCardDistanceOriginState(readWebGrantedPosition)
}
