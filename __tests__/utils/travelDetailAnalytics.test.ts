import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import { getPublishedTravelAnalyticsId, trackTravelDetailAction } from '@/utils/travelDetailAnalytics'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

describe('getPublishedTravelAnalyticsId', () => {
  it('identifies published articles for both canonical and legacy payloads', () => {
    expect(getPublishedTravelAnalyticsId({ id: 124, publication_status: 'published' })).toBe(124)
    expect(getPublishedTravelAnalyticsId({ id: 124, publish: 1, moderation: 1 })).toBe(124)
    expect(getPublishedTravelAnalyticsId({ id: 124, publish: 1, moderation: 0 })).toBeUndefined()
    expect(getPublishedTravelAnalyticsId({ id: 124, publication_status: 'approved' })).toBeUndefined()
  })
})

describe('trackTravelDetailAction', () => {
  afterEach(() => jest.restoreAllMocks())

  it('sends the route id and action without the phone or the link', () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    trackTravelDetailAction(124, 'contact_phone')
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('travel_detail_action', {
      source: 'travel_detail',
      event_category: 'travel_detail',
      event_label: 'contact_phone',
      travel_id: 124,
    })
  })

  it('ignores native calls and malformed route ids', () => {
    const os = jest.replaceProperty(Platform, 'OS', 'ios')
    jest.clearAllMocks()
    trackTravelDetailAction(124, 'section_map')
    os.replaceValue('web')
    trackTravelDetailAction(0, 'section_points')
    expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  })
})
