import { Platform, Share } from 'react-native';

import {
  buildTripPlanUrl,
  buildTripShareText,
  type TripPlanShareSource,
} from '@/utils/tripPlanLinks';
import { translate as i18nT } from '@/i18n'


export type ShareTripPlanResult = 'shared' | 'dismissed' | 'unavailable';

const isShareCancellation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

/** Open the system share surface, with a clipboard fallback on web. */
export async function shareTripPlan(
  trip: TripPlanShareSource,
): Promise<ShareTripPlanResult> {
  const url = buildTripPlanUrl(trip);
  if (!url) return 'unavailable';

  const title = String(trip.title ?? '').trim() || i18nT('tripsStatic:share.titleFallback');
  const text = buildTripShareText(trip);

  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return 'shared';
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return 'shared';
      }
      return 'unavailable';
    }

    const result = await Share.share(
      Platform.OS === 'ios'
        ? { title, message: text, url }
        : { title, message: i18nT('trips:utils.shareTripPlan.value1_value2_cff6d5b0', { value1: text, value2: url }) },
      { dialogTitle: i18nT('trips:utils.shareTripPlan.podelitsya_poezdkoy_value1_677b9d34', { value1: title }) },
    );

    return result.action === Share.sharedAction ? 'shared' : 'dismissed';
  } catch (error) {
    return isShareCancellation(error) ? 'dismissed' : 'unavailable';
  }
}
