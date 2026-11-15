import { Platform } from 'react-native'

import type { Travel } from '@/types/types'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { resolveTravelPublicationStatus } from '@/utils/travelPublicationStatus'

type TravelDetailAction = 'section_description' | 'section_map' | 'section_points' | 'contact_phone'

export function getPublishedTravelAnalyticsId(
  travel: Pick<Travel, 'id' | 'publish' | 'moderation' | 'publication_status'> | null | undefined,
): number | undefined {
  return travel && resolveTravelPublicationStatus(travel) === 'published' ? travel.id : undefined
}

export function trackTravelDetailAction(travelId: number, action: TravelDetailAction) {
  if (Platform.OS !== 'web' || !Number.isSafeInteger(travelId) || travelId <= 0) return

  void sendAnalyticsEvent('travel_detail_action', {
    source: 'travel_detail',
    event_category: 'travel_detail',
    event_label: action,
    travel_id: travelId,
  })
}
