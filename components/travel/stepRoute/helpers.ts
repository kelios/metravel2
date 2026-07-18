import { Platform } from 'react-native'

import type { TravelFilters } from '@/hooks/useTravelFilters'
import { removePendingImageFile } from '@/utils/pendingImageFiles'
import { getMapGeocoderLanguage } from '@/utils/mapLocale'
import { translate as i18nT } from '@/i18n'

import type { ManualPointState } from './types'

export const MAP_COACHMARK_STORAGE_KEY = 'travelWizardRouteMapCoachmarkDismissed'
export const ROUTE_MARKERS_ANCHOR_ID = 'markers-list-root'
export const ROUTE_COUNTRIES_ANCHOR_ID = 'travelwizard-route-countries'
export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height'
export const getDefaultTitle = () => i18nT('travel:components.travel.stepRoute.helpers.defaultTitle')
export const getDefaultNextLabel = () => i18nT('travel:components.travel.stepRoute.helpers.defaultNextLabel')
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

// Normalizes a single numeric token, tolerating the comma decimal separator
// that Android decimal-pad keyboards emit on RU/BE/PL locales ("53,9" -> 53.9).
export const parseCoordinate = (raw: string): number => {
  const trimmed = String(raw ?? '').trim().replace(',', '.')
  // Number('') === 0, which would silently place a point on the equator; treat blank as invalid.
  return trimmed === '' ? NaN : Number(trimmed)
}

export const parseCoordsPair = (raw: string): { lat: number; lng: number } | null => {
  // Extract signed decimal tokens directly so we accept both dot and comma
  // decimals and any separator ("53.9, 27.5", "53,9 27,5", "-53.9;-27.5").
  const tokens = String(raw || '').match(/-?\d+(?:[.,]\d+)?/g)
  if (!tokens || tokens.length < 2) return null

  const lat = parseCoordinate(tokens[0])
  const lng = parseCoordinate(tokens[1])

  return isValidCoordinate(lat, lng) ? { lat, lng } : null
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
  const geocoderLanguage = getMapGeocoderLanguage()

  try {
    const primary = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${encodeURIComponent(geocoderLanguage)}`,
    )
    if (primary.ok) return await primary.json()
  } catch {
    // ignore and fall back
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=${encodeURIComponent(geocoderLanguage)}`,
    )
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
