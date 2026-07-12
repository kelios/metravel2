import { renderHook, waitFor } from '@testing-library/react-native'

import { useMapUserLocation } from '@/components/MapPage/Map/useMapUserLocation'
import { isFallbackMinskCenter } from '@/components/MapPage/Map/fallbackCenter'

// Geolocation auto-request must not fire in these tests; stub expo-location so a
// missing real location never resolves to a position.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 0, longitude: 0 } })),
}))

const MINSK = { latitude: 53.9006, longitude: 27.559 } // exactly the default Minsk center

function setup(
  coordinates: any,
  coordinatesAreFallback?: boolean,
  providedUserLocation?: { latitude: number; longitude: number } | null,
) {
  const mapRef = { current: null } as any
  return renderHook(() =>
    useMapUserLocation({
      coordinates,
      coordinatesAreFallback,
      providedUserLocation,
      mapRef,
      isFallbackMinskCenter,
    }),
  )
}

describe('useMapUserLocation — explicit origin flag (#bug2)', () => {
  it('treats a REAL geolocation at Minsk as the user position (flag=false)', async () => {
    // Regression: a user physically near Minsk used to be misread as the fallback
    // center (coordinate-matching) and got no "you are here" marker.
    const { result } = setup(MINSK, false)
    await waitFor(() => {
      expect(result.current.userLocationLatLng).toEqual({ lat: MINSK.latitude, lng: MINSK.longitude })
    })
  })

  it('does NOT derive a user position from the DEFAULT center (flag=true)', async () => {
    const { result } = setup(MINSK, true)
    // Give effects a tick; userLocation must stay null (no false marker).
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.userLocationLatLng).toBeNull()
  })

  it('falls back to Minsk coordinate-matching when the flag is absent (legacy)', async () => {
    const { result } = setup(MINSK, undefined)
    await new Promise((r) => setTimeout(r, 0))
    // Legacy behavior: Minsk-matching center is treated as fallback -> no marker.
    expect(result.current.userLocationLatLng).toBeNull()
  })

  it('derives a non-Minsk real location regardless of the flag', async () => {
    const KRAKOW = { latitude: 50.0614, longitude: 19.9366 }
    const { result } = setup(KRAKOW, false)
    await waitFor(() => {
      expect(result.current.userLocationLatLng).toEqual({ lat: KRAKOW.latitude, lng: KRAKOW.longitude })
    })
  })

  it('uses an explicit user position instead of the current map center', async () => {
    const MAP_AREA = { latitude: 52.23, longitude: 21.01 }
    const USER = { latitude: 52.2, longitude: 20.98 }
    const { result } = setup(MAP_AREA, undefined, USER)

    await waitFor(() => {
      expect(result.current.userLocationLatLng).toEqual({ lat: USER.latitude, lng: USER.longitude })
    })
  })

  it('does not turn the map center into a user marker when location is explicitly absent', async () => {
    const MAP_AREA = { latitude: 52.23, longitude: 21.01 }
    const { result } = setup(MAP_AREA, undefined, null)

    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.userLocationLatLng).toBeNull()
  })
})
