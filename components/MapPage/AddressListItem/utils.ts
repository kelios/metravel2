import { METRICS } from '@/constants/layout'
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

export function getCardHeight(width: number) {
  if (width <= 320) return 200
  if (width <= 480) return 240
  if (width <= METRICS.breakpoints.tablet) return 280
  if (width <= METRICS.breakpoints.largeTablet) return 320
  return 360
}

export function getWebCardWidth(width: number) {
  if (!isWebPlatform()) return 300
  const horizontalInsets = width <= 360 ? 20 : width <= 480 ? 36 : width <= 768 ? 56 : 72
  return Math.max(236, Math.min(360, width - horizontalInsets))
}
