// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import {
  buildBirdMarkerHtml,
  buildMapPinHtml,
  buildUserLocationHtml,
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
      const html = buildUserLocationHtml(DESIGN_TOKENS.colors.accent)
      return L.divIcon({
        className: 'metravel-pin-marker metravel-pin-marker-user',
        html,
        iconSize: [30, 30],
        // Centered anchor: a GPS "you are here" dot is centered on the fix,
        // not bottom-anchored like a teardrop POI pin.
        iconAnchor: [15, 15],
        popupAnchor: [0, -16],
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
