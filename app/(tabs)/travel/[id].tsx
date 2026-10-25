import LazyUpsertTravelRoute from '@/components/travel/upsert/LazyUpsertTravelRoute';
import { buildUpsertTravelSeoText } from '@/components/travel/upsert/upsertTravelSeo';
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata';

export default function EditTravelScreen() {
  return <LazyUpsertTravelRoute />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return shellRouteMetadata({
    ...buildUpsertTravelSeoText(false),
    robots: 'noindex, nofollow',
  });
}
