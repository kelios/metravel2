// components/MapPage/map/useLeafletIcons.ts
import { useMemo } from 'react'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import { buildBirdMarkerHtml, buildMapPinHtml } from './mapMarkerStyles'

export const useLeafletIcons = (L: any) => {
  return useMemo(() => {
    if (!L || typeof L.divIcon !== 'function') return null
    if (typeof document === 'undefined') return null

    const makeBirdPin = () => {
      const html = buildBirdMarkerHtml()
      return L.divIcon({
        className: 'metravel-pin-marker metravel-pin-marker-bird',
        html,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })
    }

    const makeDivPin = (bg: string) => {
      const html = buildMapPinHtml(bg)
      return L.divIcon({
        className: 'metravel-pin-marker',
        html,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -18],
      })
    }

    return {
      meTravel: makeBirdPin(),
      start: makeDivPin(DESIGN_TOKENS.colors.success),
      end: makeDivPin(DESIGN_TOKENS.colors.dangerDark),
      userLocation: makeDivPin(DESIGN_TOKENS.colors.accent),
    }
  }, [L])
}
