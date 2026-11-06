import type { TravelPublicationFormat } from '@/types/types'
import { queueAnalyticsEvent } from '@/utils/analytics'
import type { PlaceContributionSource, PlaceRequestCreateIntent } from '@/utils/placeRequestCreateIntent'

type ContributionEvent = 'impression' | 'cta' | 'auth_gate' | 'auth_return' |
  'editor_started' | 'photo_saved' | 'submitted'

type ContributionParams = {
  source: PlaceContributionSource
  requestId?: string
  mode?: TravelPublicationFormat
  action?: 'collection' | 'create' | 'map'
}

export function trackPlaceContribution(event: ContributionEvent, data: ContributionParams) {
  queueAnalyticsEvent(`place_contribution_${event}`, {
    source: data.source,
    ...(data.requestId ? { request_id: data.requestId } : {}),
    ...(data.mode ? { mode: data.mode } : {}),
    ...(data.action ? { action: data.action } : {}),
  })
}

const authReturnKey = (intent: PlaceRequestCreateIntent, mode: TravelPublicationFormat) =>
  `metravel-place-contribution-auth:${intent.requestId}:${mode}`

export function rememberPlaceContributionAuth(intent: PlaceRequestCreateIntent, mode: TravelPublicationFormat) {
  try {
    window.sessionStorage.setItem(authReturnKey(intent, mode), String(Date.now()))
  } catch {
    // Navigation still works with browser storage disabled.
  }
}

export function consumePlaceContributionAuth(intent: PlaceRequestCreateIntent, mode: TravelPublicationFormat) {
  try {
    const key = authReturnKey(intent, mode)
    const started = Number(window.sessionStorage.getItem(key))
    if (!started) return false
    window.sessionStorage.removeItem(key)
    const elapsed = Date.now() - started
    return elapsed >= 0 && elapsed < 30 * 60_000
  } catch {
    return false
  }
}
