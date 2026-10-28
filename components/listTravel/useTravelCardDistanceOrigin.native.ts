import { useTravelCardDistanceOriginState } from './useTravelCardDistanceOriginState'

type LatLng = { lat: number; lng: number }

async function readNativeGrantedPosition(): Promise<LatLng | null> {
  // Карточка стоит в каждом ряду. В unit-тестах нативный модуль не трогаем.
  if (process.env.NODE_ENV === 'test') return null
  const Location = await import('expo-location')
  const permission = await Location.getForegroundPermissionsAsync()
  if (permission.status !== 'granted') return null
  const last = await Location.getLastKnownPositionAsync()
  if (!last) return null
  return { lat: last.coords.latitude, lng: last.coords.longitude }
}

export function useTravelCardDistanceOrigin() {
  return useTravelCardDistanceOriginState(readNativeGrantedPosition)
}
