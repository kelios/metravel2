import type { TravelPublicationFormat } from '@/types/types'

export const PLACE_REQUESTS_PATH = '/places/help'

const CONTRIBUTION_SOURCES = ['places', 'map', 'author_page', 'related_travel'] as const
export type PlaceContributionSource = typeof CONTRIBUTION_SOURCES[number]

export type PlaceRequestCreateIntent = {
  requestId: string
  source: PlaceContributionSource
}

export function normalizePlaceRequestId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)
    ? value.toLowerCase()
    : null
}

export function normalizePlaceContributionSource(value: unknown): PlaceContributionSource {
  return CONTRIBUTION_SOURCES.find((source) => source === value) ?? 'places'
}

export function normalizePlaceRequestRegion(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64
    ? value
    : null
}

export function parsePlaceRequestCreateIntent(
  params: Record<string, unknown> | string,
): PlaceRequestCreateIntent | null {
  let request: unknown
  let source: unknown
  if (typeof params === 'string') {
    const [path, query, ...extra] = params.split('?')
    if (path !== '/travel/new' || params.includes('#') || extra.length) return null
    const search = new URLSearchParams(query)
    const requests = search.getAll('place_request_id')
    if (requests.length !== 1) return null
    request = requests[0]
    const sources = search.getAll('contribution_source')
    source = sources.length === 1 ? sources[0] : null
  } else {
    request = params.place_request_id
    source = params.contribution_source
  }
  const requestId = normalizePlaceRequestId(request)
  return requestId ? { requestId, source: normalizePlaceContributionSource(source) } : null
}

export function buildPlaceRequestCreateHref(
  intent: PlaceRequestCreateIntent,
  mode: TravelPublicationFormat,
): string {
  const query = new URLSearchParams()
  if (mode === 'note') query.set('mode', 'note')
  query.set('place_request_id', intent.requestId)
  query.set('contribution_source', intent.source)
  return `/travel/new?${query}`
}

export function getPlaceRequestDraftScope(
  account: string | null,
  requestId: string,
  mode: TravelPublicationFormat,
): string {
  return `place_request:${encodeURIComponent(account ?? 'guest')}:${requestId}:${mode}`
}

export function buildPlaceRequestsHref(
  source: PlaceContributionSource,
  selection: { region?: string | null; requestId?: string | null } = {},
): string {
  const query = new URLSearchParams({ source })
  if (selection.region) query.set('region', selection.region)
  if (selection.requestId) query.set('request', selection.requestId)
  return `${PLACE_REQUESTS_PATH}?${query}`
}
