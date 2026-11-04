export const MAP_STARTUP_LOCATION_KEY = '__metravelMapStartupLocation'

// The first web fix chooses the viewport. Both the document and the mounted
// map use the same precise request before falling back to a cheaper fix.
export const MAP_PRECISE_WEB_LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 10000,
} satisfies PositionOptions

type MapStartupLocationResult =
  | { position: GeolocationPosition }
  | { error: GeolocationPositionError }

type MapStartupLocationEntry = {
  result: Promise<MapStartupLocationResult | null>
}

export function consumeMapStartupLocation() {
  if (typeof window === 'undefined') return undefined
  const scope = window as typeof window & { [MAP_STARTUP_LOCATION_KEY]?: MapStartupLocationEntry }
  const entry = scope[MAP_STARTUP_LOCATION_KEY]
  if (!entry) return undefined
  delete scope[MAP_STARTUP_LOCATION_KEY]
  if (!/^\/map\/?$/.test(scope.location.pathname) || scope.location.search) return undefined
  return entry.result
}
