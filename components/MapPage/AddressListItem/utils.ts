import { CoordinateConverter } from '@/utils/coordinateConverter'

import { isWebPlatform } from './constants'

export function addVersion(url?: string, updated?: string) {
  return url && updated ? `${url}?v=${new Date(updated).getTime()}` : url
}

export function parseCoord(coord?: string) {
  if (!coord) return null
  const parsed = CoordinateConverter.fromLooseString(coord)
  return parsed ? { lat: parsed.lat, lon: parsed.lng } : null
}

export function getWebCardWidth(width?: number) {
  if (!isWebPlatform()) return 300
  const safeWidth = Number.isFinite(width) ? (width as number) : 360
  const horizontalInsets =
    safeWidth <= 360 ? 20 : safeWidth <= 480 ? 36 : safeWidth <= 768 ? 56 : 72
  return Math.max(236, Math.min(360, safeWidth - horizontalInsets))
}

// #584 — photo-dominant hero height for the native (Android/iOS) nearby-places
// card. The card stretches full width (sheet width minus the 8pt card margin on
// each side); ~0.62 of that keeps the photo the dominant block while leaving
// room for the title pill + chips + save row below it (rule: фото ~70% карточки).
export function getNativeCardImageHeight(width?: number) {
  const safeWidth = Number.isFinite(width) ? (width as number) : 360
  const cardWidth = Math.max(220, safeWidth - 16)
  return Math.round(Math.max(150, Math.min(240, cardWidth * 0.62)))
}
