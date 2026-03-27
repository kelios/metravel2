import React from 'react'

import type { PointColor } from '@/types/userPoints'
import { buildDropMarkerHtml } from '@/utils/markerSvg'

export function useUserPointsMarkerIcons({
  L,
  colors,
}: {
  L: any
  colors: { primary: string; border: string; surface: string }
}) {
  const getMarkerIcon = React.useCallback(
    (color: PointColor | string | undefined, opts?: { active?: boolean; emphasize?: boolean }) => {
      if (!L) return undefined

      const fill = String(color || '').trim() || colors.primary
      const isActive = Boolean(opts?.active)
      const sizeBase = isActive ? 42 : 34
      const size = opts?.emphasize ? sizeBase * 2 : sizeBase
      const anchor = size / 2
      const strokeW = isActive ? 2 : 1
      const html = buildDropMarkerHtml({
        size,
        fill,
        stroke: colors.border,
        strokeWidth: strokeW,
        innerColor: colors.surface,
        innerRadius: isActive ? 4 : 3,
      })

      return L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [anchor, size],
        popupAnchor: [0, -(size - 6)],
      })
    },
    [L, colors.border, colors.primary, colors.surface]
  )

  const markerIconCacheRef = React.useRef<Map<string, any>>(new Map())
  React.useEffect(() => {
    markerIconCacheRef.current.clear()
  }, [L, colors.border, colors.primary, colors.surface])

  const getMarkerIconCached = React.useCallback(
    (color: PointColor | string | undefined, opts?: { active?: boolean; emphasize?: boolean }) => {
      const fill = String(color || '').trim() || colors.primary
      const active = Boolean(opts?.active)
      const emphasize = Boolean(opts?.emphasize)
      const key = `${fill}|${active ? '1' : '0'}|${emphasize ? '1' : '0'}`
      const cached = markerIconCacheRef.current.get(key)
      if (cached) return cached
      const icon = getMarkerIcon(color, opts)
      if (icon) markerIconCacheRef.current.set(key, icon)
      return icon
    },
    [colors.primary, getMarkerIcon]
  )

  return { getMarkerIconCached }
}
