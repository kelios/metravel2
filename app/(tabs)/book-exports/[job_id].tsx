import { translate as i18nT } from '@/i18n';
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

export { default } from '@/components/export/book-job/BookExportJobPage'

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return shellRouteMetadata({
    title: i18nT('export:components.export.BookJob.title'),
    description: i18nT('export:components.export.BookJob.description'),
    robots: 'noindex, nofollow',
  });
}
