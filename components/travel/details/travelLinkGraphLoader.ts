import { setResponseHeaders, type ImmutableRequest } from 'expo-server'
import { fetchPublicRouteJsonResponse } from '@/utils/ssr/fetchPublicRouteJson'
import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData'
import type { TravelLinkGraphResult } from '@/utils/travelLinkGraph'
import { validateTravelLinkGraph } from '@/utils/travelLinkGraphContract'

const PENDING_CODES = new Set(['selection_pending', 'publication_unavailable', 'refresh_pending'])
const ERROR_CODES = new Set(['refresh_failed', 'refresh_stale', 'publication_corrupt'])
const FAILURE_FIELDS = new Set(['schema_version', 'state', 'locale', 'view', 'travel_id', 'publication_id',
  'corpus_revision', 'source_revision', 'content_revision', 'quests', 'related', 'error_code', 'source_checked_at', 'source_age_seconds'])

export async function loadTravelLinkGraph(request: ImmutableRequest, travelId: number): Promise<TravelLinkGraphResult> {
  return memoizePublicRouteData(request, `travel-links:${travelId}`, async () => {
    let result: TravelLinkGraphResult
    try {
      const response = await fetchPublicRouteJsonResponse(request, `quests/web/discovery/?lang=ru&view=travel&travel_id=${travelId}`)
      const graph = response.ok ? validateTravelLinkGraph(response.data, travelId) : null
      if (graph) {
        setResponseHeaders({ 'X-Metravel-Travel-Graph-State': 'available' })
        return graph
      }
      const raw = response.data as Record<string, unknown> | null
      const code = typeof raw?.error_code === 'string' ? raw.error_code : ''
      const failureShape = raw && Object.keys(raw).every((key) => FAILURE_FIELDS.has(key))
        && ['publication_id', 'corpus_revision', 'source_revision', 'content_revision'].every((key) => raw[key] == null)
        && Array.isArray(raw.quests) && raw.quests.length === 0 && Array.isArray(raw.related) && raw.related.length === 0
      const knownFailure = failureShape && response.status === 503 && raw?.schema_version === 2 && raw.state === 'temporary_failure'
        && raw.locale === 'ru' && raw.view === 'travel' && raw.travel_id === travelId
        && (PENDING_CODES.has(code) || ERROR_CODES.has(code))
      const withdrawn = failureShape && response.status === 404 && raw?.schema_version === 2 && raw.state === 'unavailable'
        && raw.locale === 'ru' && raw.view === 'travel' && raw.travel_id === travelId && code === 'unavailable'
      const age = typeof raw?.source_age_seconds === 'number' && Number.isFinite(raw.source_age_seconds)
        && raw.source_age_seconds >= 0 ? raw.source_age_seconds : null
      const checked = typeof raw?.source_checked_at === 'number' && Number.isFinite(raw.source_checked_at)
        && raw.source_checked_at > 0 ? raw.source_checked_at : null
      const pendingProof = code === 'publication_unavailable' || (age !== null && checked !== null)
      let errorCode = knownFailure ? code : 'invalid_graph_response'
      if (withdrawn) errorCode = 'unavailable'
      else if (knownFailure && age !== null && age > 30) errorCode = 'refresh_stale'
      else if (knownFailure && PENDING_CODES.has(code) && !pendingProof) errorCode = 'invalid_graph_response'
      result = {
        state: knownFailure && PENDING_CODES.has(code) && pendingProof && (age === null || age <= 30) ? 'pending' : 'error',
        errorCode,
        retryAfterSeconds: 5,
        sourceCheckedAt: knownFailure ? checked : null,
        sourceAgeSeconds: knownFailure ? age : null,
      }
    } catch {
      result = { state: 'error', errorCode: 'graph_transport_failed', retryAfterSeconds: 5, sourceCheckedAt: null, sourceAgeSeconds: null }
    }
    // The article remains readable, but incomplete selected links are never
    // advertised or cached as a complete publication.
    setResponseHeaders({ 'Cache-Control': 'no-store', 'Retry-After': '5', 'X-Metravel-Travel-Graph-State': result.state })
    return result
  })
}
