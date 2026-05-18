import { Platform } from 'react-native'

import type { TravelFilters } from '@/hooks/useTravelFilters'
import { removePendingImageFile } from '@/utils/pendingImageFiles'

import type { ManualPointState } from './types'

export const MAP_COACHMARK_STORAGE_KEY = 'travelWizardRouteMapCoachmarkDismissed'
export const ROUTE_MARKERS_ANCHOR_ID = 'markers-list-root'
export const ROUTE_COUNTRIES_ANCHOR_ID = 'travelwizard-route-countries'
export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height'
export const DEFAULT_TITLE = 'Маршрут путешествия'
export const DEFAULT_NEXT_LABEL = 'К медиа'
export const EMPTY_MANUAL_POINT: ManualPointState = {
  coords: '',
  lat: '',
  lng: '',
  photoPreviewUrl: null,
}

export const toStringIds = (ids: unknown[] | undefined | null) => (ids || []).map(String).filter(Boolean)

export const getProgressPercent = (progress: number) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  return Math.round(clampedProgress * 100)
}

export const parseCoordsPair = (raw: string): { lat: number; lng: number } | null => {
  const parts = String(raw || '')
    .trim()
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) return null

  const lat = Number(parts[0])
  const lng = Number(parts[1])
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180

  return latOk && lngOk ? { lat, lng } : null
}

export const isValidCoordinate = (lat: number, lng: number) => (
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180
)

export const getSearchResultAddress = (result: any) => {
  const displayName = typeof result?.display_name === 'string' ? result.display_name.trim() : ''
  if (displayName) return displayName

  const address = result?.address ?? {}
  const locality = address.city || address.town || address.village
  return [locality, address.state, address.country].filter(Boolean).join(', ')
}

export const getMatchedCountry = (countryId: string | null, countries: TravelFilters['countries']) => {
  if (!countryId) return null
  return (countries || []).find((country: any) => Number(country?.country_id) === Number(countryId)) ?? null
}

export const getReverseGeocodeCountry = (data: any) => ({
  name:
    data?.address?.country ||
    data?.countryName ||
    data?.localityInfo?.administrative?.find((item: any) => item?.order === 2)?.name ||
    '',
  code:
    data?.address?.country_code ||
    data?.countryCode ||
    data?.address?.ISO3166_1_alpha2 ||
    null,
})

export function revokeManualPreview(previewUrl: string | null) {
  if (!previewUrl) return

  removePendingImageFile(previewUrl)
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewUrl)
    }
  } catch {
    // noop
  }
}

export async function reverseGeocode(lat: number, lng: number) {
  if (Platform.OS === 'web') return null

  try {
    const primary = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`,
    )
    if (primary.ok) return await primary.json()
  } catch {
    // ignore and fall back
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`,
    )
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
