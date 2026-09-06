// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import {
  buildBirdMarkerHtml,
  buildMapPinHtml,
  buildUserLocationHtml,
  USER_LOCATION_MARKER_SIZE,
} from './mapMarkerStyles'

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.divIcon !== 'function') return null
    if (typeof document === 'undefined') return null

    const makeBirdPin = () => {
      const html = buildBirdMarkerHtml()
      return L.divIcon({
        className: 'metravel-pin-marker metravel-pin-marker-bird',
        html,
        iconSize: [48, 58],
        iconAnchor: [24, 54],
        popupAnchor: [0, -46],
      })
    }

    const makeDivPin = (bg: string) => {
      const html = buildMapPinHtml(bg)
      return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [34, 44],
        iconAnchor: [17, 40],
        popupAnchor: [0, -34],
      })
    }

    const makeUserLocationPin = () => {
      const html = buildUserLocationHtml()
      const half = USER_LOCATION_MARKER_SIZE / 2
      return L.divIcon({
        className: 'metravel-pin-marker metravel-pin-marker-user',
        html,
        iconSize: [USER_LOCATION_MARKER_SIZE, USER_LOCATION_MARKER_SIZE],
        // Centered anchor: a GPS "you are here" dot is centered on the fix,
        // not bottom-anchored like a teardrop POI pin.
        iconAnchor: [half, half],
        popupAnchor: [0, -half - 1],
      })
    }

    return {
      meTravel: makeBirdPin(),
      start: makeDivPin(DESIGN_TOKENS.colors.success),
      end: makeDivPin(DESIGN_TOKENS.colors.dangerDark),
      userLocation: makeUserLocationPin(),
    }
  }, [L])
}
