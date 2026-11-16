import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { resolveTravelPublicationStatus } from '@/utils/travelPublicationStatus'

type TravelDetailAction = 'section_description' | 'section_map' | 'section_points' | 'contact_phone'

export type TravelAnalyticsSource = Pick<Travel, 'id' | 'publish' | 'moderation' | 'publication_status'>

export function trackTravelDetailAction(travel: TravelAnalyticsSource, action: TravelDetailAction) {
  if (Platform.OS !== 'web' || resolveTravelPublicationStatus(travel) !== 'published') return
  const travelId = travel.id
  if (!Number.isSafeInteger(travelId) || travelId <= 0) return

  void sendAnalyticsEvent('travel_detail_action', {
    source: 'travel_detail',
    event_category: 'travel_detail',
    event_label: action,
    travel_id: travelId,
  })
}
