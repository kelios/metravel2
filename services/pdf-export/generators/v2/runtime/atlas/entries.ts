// services/pdf-export/generators/v2/runtime/atlas/entries.ts
// Подбор travel-групп с map-точками и построение записей атласа

import type { TravelSectionMeta } from '../types'
import {
  MIN_TRAVELS_FOR_ATLAS,
  TRAVEL_PALETTE,
  type AtlasTravelEntry,
} from './types'

function hasFiniteCoordinates(location: { lat?: number; lng?: number }): boolean {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng)
}

export function getAtlasTravelsWithMap(meta: TravelSectionMeta[]): TravelSectionMeta[] {
  return meta.filter(
    (item) =>
      item.hasMap &&
      item.locations.some(hasFiniteCoordinates),
  )
}

export function shouldRenderAtlas(meta: TravelSectionMeta[], includeMap: boolean): boolean {
  if (!includeMap) return false
  return getAtlasTravelsWithMap(meta).length >= MIN_TRAVELS_FOR_ATLAS
}

export function buildEntries(meta: TravelSectionMeta[]): AtlasTravelEntry[] {
  const atlasTravels = getAtlasTravelsWithMap(meta)
  return atlasTravels.map((item, idx) => {
    const pointsWithCoords = item.locations.filter(hasFiniteCoordinates)
    const pointCount = item.locations.length
    const headerRows = 2
    const listRows = Math.ceil(Math.max(1, pointCount) / 2)
    return {
      meta: item,
      color: TRAVEL_PALETTE[idx % TRAVEL_PALETTE.length],
      travelOrdinal: idx + 1,
      pointsWithCoords,
      pointCount,
      rowsOnIndexPage: headerRows + listRows + 1, // +1 — отступ между группами
    }
  })
}
