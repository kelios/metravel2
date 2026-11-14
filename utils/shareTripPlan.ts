import { Platform } from 'react-native';

import {
  buildTripPlanUrl,
  buildTripShareText,
  type TripPlanShareSource,
} from '@/utils/tripPlanLinks';
import { translate as i18nT } from '@/i18n'
import { shareOrCopy } from '@/utils/shareOrCopy';


export type ShareTripPlanResult = 'shared' | 'dismissed' | 'unavailable';

/** Open the system share surface, with a clipboard fallback on web. */
export async function shareTripPlan(
  trip: TripPlanShareSource,
): Promise<ShareTripPlanResult> {
  const url = buildTripPlanUrl(trip);
  if (!url) return 'unavailable';

  const title = String(trip.title ?? '').trim() || i18nT('tripsStatic:share.titleFallback');
  const text = buildTripShareText(trip);

  const outcome = await shareOrCopy({
    web: { title, text, url },
    native:
      Platform.OS === 'ios'
        ? { title, message: text, url }
        : { title, message: i18nT('trips:utils.shareTripPlan.value1_value2_cff6d5b0', { value1: text, value2: url }) },
    nativeOptions: { dialogTitle: i18nT('trips:utils.shareTripPlan.podelitsya_poezdkoy_value1_677b9d34', { value1: title }) },
    copyText: url,
  });
  if (outcome === 'dismissed') return 'dismissed';
  return outcome === 'shared' || outcome === 'copied' ? 'shared' : 'unavailable';
}
