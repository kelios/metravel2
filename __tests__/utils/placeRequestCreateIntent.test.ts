import {
  buildPlaceRequestCreateHref,
  getPlaceRequestDraftScope,
  parsePlaceRequestCreateIntent,
} from '@/utils/placeRequestCreateIntent'
import { buildExplicitLoginHref, buildRegistrationHref, resolvePostAuthPath } from '@/utils/authNavigation'

const placeRequestId = 'c8df6a13-bd0c-4cda-a4bc-7d065ead040b'
const secondRequestId = '28fb188e-9e43-4634-b811-233d34693911'

describe('place request creation intent', () => {
  it('round-trips the two modes through login and registration with only safe campaign context', () => {
    const intent = { requestId: placeRequestId, source: 'related_travel' } as const
    for (const mode of ['note', 'full'] as const) {
      const href = buildPlaceRequestCreateHref(intent, mode)
      for (const authHref of [buildExplicitLoginHref({ redirect: href }), buildRegistrationHref({ redirect: href })]) {
        const redirect = new URL(authHref, 'https://metravel.by').searchParams.get('redirect')
        const destination = resolvePostAuthPath({ redirect })
        expect(destination).toBe(href)
        expect(parsePlaceRequestCreateIntent(destination)).toEqual(intent)
        expect(destination.includes('mode=note')).toBe(mode === 'note')
      }
    }
  })

  it('rejects malformed, external and duplicate invitation links', () => {
    expect(parsePlaceRequestCreateIntent({ place_request_id: ['wrong', placeRequestId] })).toBeNull()
    expect(parsePlaceRequestCreateIntent('https://example.org/travel/new?place_request_id=' + placeRequestId)).toBeNull()
    expect(parsePlaceRequestCreateIntent('/travel/new?place_request_id=' + placeRequestId + '&place_request_id=' + secondRequestId)).toBeNull()
    expect(parsePlaceRequestCreateIntent({ place_request_id: placeRequestId, contribution_source: 'external-url' })).toEqual({ requestId: placeRequestId, source: 'places' })
  })

  it('keeps pending drafts isolated by viewer, request and mode', () => {
    const scope = getPlaceRequestDraftScope('15', placeRequestId, 'note')
    expect(scope).not.toBe(getPlaceRequestDraftScope('16', placeRequestId, 'note'))
    expect(scope).not.toBe(getPlaceRequestDraftScope('15', secondRequestId, 'note'))
    expect(scope).not.toBe(getPlaceRequestDraftScope('15', placeRequestId, 'full'))
  })
})
