import { apiClient } from '@/api/client'
import type { SupportedLocale } from '@/i18n/config'
import { normalizePlaceRequestId, normalizePlaceRequestRegion } from '@/utils/placeRequestCreateIntent'
import { getSafeExternalUrl } from '@/utils/safeExternalUrl'

export type PlaceRequestStatus = 'open' | 'fulfilled' | 'paused'
type PlaceRequestPreview = { url: string; credit: string; licenseUrl: string; sourceUrl: string }

export type PlaceRequest = {
  id: string
  status: PlaceRequestStatus
  placeId: string
  name: string
  address: string
  countryId: number
  region: string
  categoryId: number
  categoryName: string
  lat: number
  lng: number
  prompt: string
  /** Editorial history of the place; empty when the API has none yet. */
  description: string
  preview: PlaceRequestPreview | null
  publicTravelUrl: string | null
}

const PATH = '/places/requests/'
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
function httpsUrl(value: unknown) {
  const url = cleanText(value)
  const normalized = url.startsWith('https://')
    ? getSafeExternalUrl(url, { allowRelative: false, allowedProtocols: ['https:'] })
    : ''
  if (!normalized) return ''
  const { username, password } = new URL(normalized)
  return username || password ? '' : normalized
}

function parsePublicTravelUrl(value: unknown): string | null {
  const article = cleanText(value)
  if (!article.startsWith('/travels/')) return null
  try {
    return /^\/travels\/[\p{L}\p{N}_-]+\/?$/u.test(decodeURIComponent(article)) ? article : null
  } catch {
    return null
  }
}

function parsePreview(value: unknown): PlaceRequestPreview | null {
  const data = record(value)
  const url = httpsUrl(data.url)
  const credit = cleanText(data.credit)
  const licenseUrl = httpsUrl(data.license_url)
  const sourceUrl = httpsUrl(data.source_url)
  return url && credit && licenseUrl && sourceUrl ? { url, credit, licenseUrl, sourceUrl } : null
}

export function parsePlaceRequest(value: unknown): PlaceRequest {
  const data = record(value)
  const id = normalizePlaceRequestId(data.id)
  const placeId = normalizePlaceRequestId(data.place_id)
  const { status, lat, lng } = data
  const country = record(data.country)
  const category = record(data.category)
  const region = normalizePlaceRequestRegion(data.region)
  const name = cleanText(data.name)
  const prompt = cleanText(data.prompt)
  if (
    !id || !placeId || !name || !prompt || !region ||
    (status !== 'open' && status !== 'fulfilled' && status !== 'paused') ||
    country.code !== 'by' || !positiveInteger(country.id) || !positiveInteger(category.id) ||
    typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
    typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180
  ) {
    throw new Error('Invalid place request response')
  }
  return {
    id,
    placeId,
    status,
    name,
    address: cleanText(data.address) || name,
    countryId: country.id,
    region,
    categoryId: category.id,
    categoryName: cleanText(category.name),
    lat,
    lng,
    prompt,
    description: cleanText(data.description),
    preview: parsePreview(data.preview),
    publicTravelUrl: parsePublicTravelUrl(data.public_travel_url),
  }
}

export async function fetchPlaceRequests(locale: SupportedLocale, signal?: AbortSignal) {
  const payload = record(await apiClient.get<unknown>(`${PATH}?country=by`, undefined, {
    signal, skipAuth: true, headers: { 'Accept-Language': locale },
  }))
  if (!Array.isArray(payload.results) || payload.count !== payload.results.length) {
    throw new Error('Invalid place requests collection')
  }
  return payload.results.map(parsePlaceRequest)
}

export async function fetchPlaceRequest(id: string, locale: SupportedLocale, signal?: AbortSignal) {
  const requestId = normalizePlaceRequestId(id)
  if (!requestId) throw new Error('Invalid place request id')
  const result = parsePlaceRequest(await apiClient.get<unknown>(`${PATH}${requestId}/`, undefined, {
    signal, skipAuth: true, headers: { 'Accept-Language': locale },
  }))
  if (result.id !== requestId) throw new Error('Mismatched place request id')
  return result
}
