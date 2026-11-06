import type { MapPlaceRequestsState } from './useMapPlaceRequests.web'

export type { MapPlaceRequestsLayer, MapPlaceRequestsState } from './useMapPlaceRequests.web'

// Invitations are available on the main web map only.
export function useMapPlaceRequests(_isFocused: boolean, _urlId: string | null): MapPlaceRequestsState | undefined {
  return undefined
}
