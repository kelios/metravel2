import { translate as i18nT } from '@/i18n';
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata';

import { CALENDAR_SEO } from '@/components/screens/calendar/CalendarScreen';

export { default } from '@/components/screens/calendar/CalendarScreen';

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return routeMetadata({
    title: i18nT(CALENDAR_SEO.titleKey),
    description: i18nT(CALENDAR_SEO.descriptionKey),
    canonical: CALENDAR_SEO.path,
    robots: 'noindex, nofollow',
  });
}
