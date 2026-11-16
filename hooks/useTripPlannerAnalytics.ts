import { useEffect, useState } from 'react';
import { trackTripPlannerForm } from '@/utils/tripPlannerAnalytics';

/** Wait for restored auth and the loaded draft before declaring the form ready. */
export function useTripPlannerAnalytics(href: string, authReady: boolean, authenticated: boolean, formReady: boolean): string {
  const [entryId, setEntryId] = useState('');
  useEffect(() => {
    if (!authReady) return;
    setEntryId(trackTripPlannerForm(href, authenticated, formReady));
  }, [href, authReady, authenticated, formReady]);
  return entryId;
}
