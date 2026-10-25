import LazyUpsertTravelRoute from '@/components/travel/upsert/LazyUpsertTravelRoute';
import { UPSERT_TRAVEL_NEW_PATH, buildUpsertTravelSeoText } from '@/components/travel/upsert/upsertTravelSeo';
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata';

export default function NewTravelScreen() {
  return <LazyUpsertTravelRoute />;
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return routeMetadata({
    ...buildUpsertTravelSeoText(true),
    canonical: UPSERT_TRAVEL_NEW_PATH,
    robots: 'noindex, nofollow',
  });
}
