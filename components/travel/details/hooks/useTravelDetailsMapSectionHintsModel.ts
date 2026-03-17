import { useMemo } from 'react'

import type { Travel } from '@/types/types'

export function useTravelDetailsMapSectionHintsModel(travel: Travel) {
  const hasEmbeddedCoords = (travel.coordsMeTravel?.length ?? 0) > 0
  const hasTravelAddressPoints = (travel.travelAddress?.length ?? 0) > 0

  const placeHints = useMemo(() => {
    const points = Array.isArray(travel?.travelAddress) ? travel.travelAddress : []
    return points
      .map((point: any) => {
        const coord = String(point?.coord ?? '').trim()
        if (!coord) return null
        const name = String(point?.name ?? point?.address ?? '').trim()
        if (!name) return null
        return { name, coord }
      })
      .filter((item): item is { name: string; coord: string } => Boolean(item))
  }, [travel?.travelAddress])

  const transportHints = useMemo(() => {
    const raw =
      (travel as any)?.transports ??
      (travel as any)?.transportsTravel ??
      (travel as any)?.transportMode ??
      null
    const values = Array.isArray(raw) ? raw : raw != null ? [raw] : []
    const labels = values
      .map((value) => String(value ?? '').toLowerCase().trim())
      .map((token) => {
        if (!token) return ''
        if (token.includes('car') || token.includes('маш')) return 'Машина'
        if (token.includes('bike') || token.includes('вело')) return 'Велосипед'
        if (token.includes('foot') || token.includes('walk') || token.includes('пеш')) return 'Пешком'
        return String(token).charAt(0).toUpperCase() + String(token).slice(1)
      })
      .filter(Boolean)

    return Array.from(new Set(labels))
  }, [travel])

  return {
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    placeHints,
    transportHints,
  }
}
