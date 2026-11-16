import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import { trackTravelDetailAction } from '@/utils/travelDetailAnalytics'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

describe('trackTravelDetailAction', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => jest.restoreAllMocks())

  it('sends the published route id and action without the phone or the link', () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    trackTravelDetailAction({ id: 124, publication_status: 'published' }, 'contact_phone')
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('travel_detail_action', {
      source: 'travel_detail',
      event_category: 'travel_detail',
      event_label: 'contact_phone',
      travel_id: 124,
    })
  })

  it('uses the canonical publication status with a fallback to legacy flags', () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    trackTravelDetailAction({ id: 124, publish: 1, moderation: 1 }, 'section_map')
    trackTravelDetailAction({ id: 124, publish: 1, moderation: 0 }, 'section_map')
    trackTravelDetailAction({ id: 124, publication_status: 'approved', publish: 1, moderation: 1 }, 'section_map')
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1)
  })

  it('ignores native calls and malformed route ids', () => {
    const os = jest.replaceProperty(Platform, 'OS', 'ios')
    trackTravelDetailAction({ id: 124, publication_status: 'published' }, 'section_map')
    os.replaceValue('web')
    trackTravelDetailAction({ id: 0, publication_status: 'published' }, 'section_points')
    expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  })
})
